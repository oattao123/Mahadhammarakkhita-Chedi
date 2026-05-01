/**
 * Standalone script to ingest dataset files into Supabase RAG.
 *
 * Usage:
 *   npx tsx scripts/ingest-dataset.ts
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

// ==================== Config ====================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DATASET_PATHS = [
  path.join(process.cwd(), 'dataset', 'B dhamma'),
  path.join(process.cwd(), 'dataset', 'อภิธรรม'),
];

const SUPPORTED_EXTENSIONS = new Set([
  '.pdf', '.docx', '.doc', '.htm', '.html', '.txt', '.rtf',
]);

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const SYSTEM_USER_ID = 0;

// ==================== Table Setup ====================

async function ensureTables() {
  console.log('Checking tables...');

  // Try to query documents table
  const { error } = await supabase.from('documents').select('id').limit(1);

  if (error && error.message.includes('does not exist')) {
    console.log('Creating documents + document_chunks tables...');

    // Use Supabase REST to create tables via rpc or direct SQL
    // Since supabase-js doesn't support DDL, we create via insert test
    console.error('Tables do not exist. Please run the following SQL in Supabase SQL Editor:');
    console.error(`
-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL DEFAULT 0,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf',
  total_pages INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document chunks for RAG
CREATE TABLE IF NOT EXISTS document_chunks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL DEFAULT 0,
  page_number INT,
  content TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_keywords ON document_chunks(keywords);
    `);
    process.exit(1);
  }

  console.log('Tables OK');
}

// ==================== Parsers ====================

async function parsePdf(filePath: string): Promise<{ text: string; pageBreaks: number[]; numPages: number } | null> {
  try {
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
  } catch {
    return null;
  }
}

async function parseDocx(filePath: string): Promise<string | null> {
  try {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch {
    return null;
  }
}

async function parseHtml(filePath: string): Promise<string | null> {
  try {
    const html = await fs.readFile(filePath, 'utf-8');
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header').remove();
    const text = $('body').text() || $.text();
    return text.replace(/\s+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  } catch {
    return null;
  }
}

async function parseTxt(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

// ==================== Chunking ====================

function extractKeywords(text: string, maxKeywords = 20): string {
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
      chunks.push({ content: currentChunk.trim(), pageNumber: pageBreaks ? currentPage : null, index: chunkIndex++ });
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.ceil(CHUNK_OVERLAP / 5));
      currentChunk = overlapWords.join(' ') + '\n\n' + trimmed;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    }

    charOffset += para.length + 2;
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), pageNumber: pageBreaks ? currentPage : null, index: chunkIndex });
  }

  return chunks;
}

// ==================== File Discovery ====================

async function findFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // skip hidden files
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await findFiles(fullPath));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return files;
}

// ==================== Ingestion ====================

async function processFile(filePath: string, basePath: string): Promise<number> {
  const ext = path.extname(filePath).toLowerCase();
  const relativePath = path.relative(basePath, filePath);

  let text: string | null = null;
  let pageBreaks: number[] | null = null;
  let numPages: number | null = null;

  switch (ext) {
    case '.pdf': {
      const parsed = await parsePdf(filePath);
      if (parsed) {
        text = parsed.text;
        pageBreaks = parsed.pageBreaks;
        numPages = parsed.numPages;
      }
      break;
    }
    case '.docx':
    case '.doc':
      text = await parseDocx(filePath);
      break;
    case '.htm':
    case '.html':
      text = await parseHtml(filePath);
      break;
    case '.txt':
    case '.rtf':
      text = await parseTxt(filePath);
      break;
  }

  if (!text || text.trim().length < 20) return 0;

  // Check if already exists
  const { data: existing } = await supabase
    .from('documents')
    .select('id')
    .eq('user_id', SYSTEM_USER_ID)
    .eq('filename', relativePath)
    .limit(1);

  if (existing && existing.length > 0) return 0; // Already ingested

  // Create document
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({ user_id: SYSTEM_USER_ID, filename: relativePath, file_type: ext.slice(1), total_pages: numPages })
    .select('id')
    .single();

  if (docErr || !doc) return 0;

  // Chunk and store
  const chunks = chunkText(text, pageBreaks);
  let stored = 0;

  // Batch insert chunks for speed
  const rows = chunks
    .filter(c => c.content.trim().length >= 10)
    .map(c => ({
      document_id: doc.id,
      chunk_index: c.index,
      page_number: c.pageNumber,
      content: c.content,
      keywords: extractKeywords(c.content),
    }));

  if (rows.length > 0) {
    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error } = await supabase.from('document_chunks').insert(batch);
      if (!error) stored += batch.length;
    }
  }

  return stored;
}

// ==================== Main ====================

async function main() {
  console.log('=== Dhamma Dataset Ingestion ===\n');

  await ensureTables();

  for (const datasetPath of DATASET_PATHS) {
    const folderName = path.basename(datasetPath);
    console.log(`\nScanning: ${folderName}...`);

    const files = await findFiles(datasetPath);
    console.log(`Found ${files.length} supported files\n`);

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let totalChunks = 0;

    for (let i = 0; i < files.length; i++) {
      const relativePath = path.relative(datasetPath, files[i]);
      const pct = Math.round(((i + 1) / files.length) * 100);

      try {
        const chunks = await processFile(files[i], datasetPath);
        if (chunks > 0) {
          processed++;
          totalChunks += chunks;
          process.stdout.write(`\r  [${pct}%] ${processed} ingested, ${skipped} skipped, ${errors} errors — ${relativePath.slice(0, 60)}`);
        } else {
          skipped++;
          process.stdout.write(`\r  [${pct}%] ${processed} ingested, ${skipped} skipped, ${errors} errors`);
        }
      } catch (err: unknown) {
        errors++;
        const msg = err instanceof Error ? err.message : '';
        process.stdout.write(`\r  [${pct}%] ${processed} ingested, ${skipped} skipped, ${errors} errors — ERR: ${msg.slice(0, 40)}`);
      }
    }

    console.log(`\n\n  ${folderName} complete: ${processed} docs, ${totalChunks} chunks, ${skipped} skipped, ${errors} errors`);
  }

  // Final count
  const { count } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', SYSTEM_USER_ID);

  console.log(`\n=== Total dataset documents in DB: ${count ?? '?'} ===\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
