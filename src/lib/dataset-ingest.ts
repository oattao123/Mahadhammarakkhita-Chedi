/**
 * Dataset Ingestion Library
 *
 * Reads files from the local dataset folder and ingests them into
 * the RAG system as system-wide documents (user_id = 0).
 *
 * Supported formats: PDF, DOCX, HTML/HTM, TXT, DOC (best-effort)
 */

import fs from 'fs/promises';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';
import {
  createDatasetDocument,
  addDocumentChunk,
  getDatasetDocumentNames,
} from './db';

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.htm', '.html', '.txt', '.rtf',
]);

export interface IngestProgress {
  total: number;
  processed: number;
  skipped: number;
  errors: string[];
  currentFile: string;
}

/** Extract keywords from text */
function extractKeywords(text: string, maxKeywords: number = 20): string {
  const words = text
    .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const freq: Record<string, number> = {};
  for (const w of words) {
    const lower = w.toLowerCase();
    freq[lower] = (freq[lower] || 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word)
    .join(',');
}

/** Split text into overlapping chunks */
function chunkText(
  text: string,
  pageBreaks: number[] | null
): Array<{ content: string; pageNumber: number | null; index: number }> {
  const chunks: Array<{ content: string; pageNumber: number | null; index: number }> = [];
  const paragraphs = text.split(/\n{2,}/);
  let currentChunk = '';
  let currentPage = 1;
  let charOffset = 0;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (pageBreaks) {
      while (currentPage < pageBreaks.length && charOffset >= pageBreaks[currentPage - 1]) {
        currentPage++;
      }
    }

    if (currentChunk.length + trimmed.length > CHUNK_SIZE && currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        pageNumber: pageBreaks ? currentPage : null,
        index: chunkIndex++,
      });
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.ceil(CHUNK_OVERLAP / 5));
      currentChunk = overlapWords.join(' ') + '\n\n' + trimmed;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    }

    charOffset += para.length + 2;
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      pageNumber: pageBreaks ? currentPage : null,
      index: chunkIndex,
    });
  }

  return chunks;
}

// ==================== File Parsers ====================

async function parsePdf(filePath: string): Promise<{ text: string; pageBreaks: number[]; numPages: number }> {
  const buffer = await fs.readFile(filePath);
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();

  const pageBreaks: number[] = [];
  let offset = 0;
  for (const page of result.pages) {
    offset += page.text.length + 1;
    pageBreaks.push(offset);
  }

  return { text: result.text, pageBreaks, numPages: result.total };
}

async function parseDocx(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function parseHtml(filePath: string): Promise<string> {
  const html = await fs.readFile(filePath, 'utf-8');
  const $ = cheerio.load(html);

  // Remove script, style, nav, footer
  $('script, style, nav, footer, header').remove();

  // Get text from body
  const text = $('body').text() || $.text();
  // Clean up whitespace
  return text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

async function parseTxt(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

// ==================== Main Ingestion ====================

/** Recursively find all supported files in a directory */
async function findFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subFiles = await findFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/** Process a single file and store in database */
async function processFile(filePath: string, basePath: string): Promise<{ chunks: number } | null> {
  const ext = path.extname(filePath).toLowerCase();
  const relativePath = path.relative(basePath, filePath);
  const filename = relativePath; // Use relative path as filename for context

  let text = '';
  let pageBreaks: number[] | null = null;
  let numPages: number | null = null;

  try {
    switch (ext) {
      case '.pdf': {
        const parsed = await parsePdf(filePath);
        text = parsed.text;
        pageBreaks = parsed.pageBreaks;
        numPages = parsed.numPages;
        break;
      }
      case '.docx':
      case '.doc': {
        text = await parseDocx(filePath);
        break;
      }
      case '.htm':
      case '.html': {
        text = await parseHtml(filePath);
        break;
      }
      case '.txt':
      case '.rtf': {
        text = await parseTxt(filePath);
        break;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }

  if (!text || text.trim().length < 20) return null;

  // Create document record
  const doc = await createDatasetDocument(filename, ext.slice(1), numPages, filePath);

  // Chunk and store
  const chunks = chunkText(text, pageBreaks);
  let stored = 0;

  for (const chunk of chunks) {
    if (chunk.content.trim().length < 10) continue;
    const keywords = extractKeywords(chunk.content);
    try {
      await addDocumentChunk(doc.id, chunk.index, chunk.pageNumber, chunk.content, keywords);
      stored++;
    } catch {
      // Skip duplicate chunks (re-ingestion)
    }
  }

  return { chunks: stored };
}

/** Ingest all files from a dataset directory */
export async function ingestDataset(
  datasetPath: string,
  onProgress?: (progress: IngestProgress) => void
): Promise<IngestProgress> {
  const allFiles = await findFiles(datasetPath);

  // Get already-ingested filenames to skip
  const existingNames = new Set(await getDatasetDocumentNames());

  const progress: IngestProgress = {
    total: allFiles.length,
    processed: 0,
    skipped: 0,
    errors: [],
    currentFile: '',
  };

  for (const filePath of allFiles) {
    const relativePath = path.relative(datasetPath, filePath);
    progress.currentFile = relativePath;

    // Skip already-ingested files
    if (existingNames.has(relativePath)) {
      progress.skipped++;
      progress.processed++;
      onProgress?.(progress);
      continue;
    }

    try {
      const result = await processFile(filePath, datasetPath);
      if (result) {
        progress.processed++;
      } else {
        progress.skipped++;
        progress.processed++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      progress.errors.push(`${relativePath}: ${msg}`);
      progress.processed++;
    }

    onProgress?.(progress);
  }

  return progress;
}
