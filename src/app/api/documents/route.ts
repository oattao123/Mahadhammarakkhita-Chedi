import { NextResponse } from 'next/server';
import { PDFParse } from 'pdf-parse';
import { getSession } from '@/lib/auth';
import { createDocument, addDocumentChunk, getUserDocuments, deleteDocument } from '@/lib/db';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const CHUNK_SIZE = 800; // characters per chunk
const CHUNK_OVERLAP = 100; // overlap between chunks

/** Extract keywords from text (simple TF-based approach) */
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

/** Split text into overlapping chunks, tracking approximate page numbers */
function chunkText(
  text: string,
  pageBreaks: number[] | null
): Array<{ content: string; pageNumber: number | null; index: number }> {
  const chunks: Array<{ content: string; pageNumber: number | null; index: number }> = [];

  // Split by paragraphs first, then combine into chunks
  const paragraphs = text.split(/\n{2,}/);
  let currentChunk = '';
  let currentPage = 1;
  let charOffset = 0;
  let chunkIndex = 0;

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Determine page number from character offset
    if (pageBreaks) {
      while (currentPage < pageBreaks.length && charOffset >= pageBreaks[currentPage - 1]) {
        currentPage++;
      }
    }

    if (currentChunk.length + trimmed.length > CHUNK_SIZE && currentChunk.length > 0) {
      // Save current chunk
      chunks.push({
        content: currentChunk.trim(),
        pageNumber: pageBreaks ? currentPage : null,
        index: chunkIndex++,
      });
      // Start new chunk with overlap
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.ceil(CHUNK_OVERLAP / 5));
      currentChunk = overlapWords.join(' ') + '\n\n' + trimmed;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    }

    charOffset += para.length + 2; // +2 for \n\n
  }

  // Last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      pageNumber: pageBreaks ? currentPage : null,
      index: chunkIndex,
    });
  }

  return chunks;
}

/** Parse PDF using PDFParse class and return per-page text */
async function parsePdf(buffer: Buffer): Promise<{ text: string; pageBreaks: number[]; numPages: number }> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  await parser.destroy();

  // Build page break offsets from per-page text results
  const pageBreaks: number[] = [];
  let offset = 0;
  for (const page of result.pages) {
    offset += page.text.length + 1;
    pageBreaks.push(offset);
  }

  return {
    text: result.text,
    pageBreaks,
    numPages: result.total,
  };
}

// POST: Upload a file
export async function POST(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const filename = file.name;
  const fileType = file.type || 'text/plain';

  try {
    let text: string;
    let pageBreaks: number[] | null = null;
    let numPages: number | null = null;

    if (fileType === 'application/pdf' || filename.endsWith('.pdf')) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parsePdf(buffer);
      text = parsed.text;
      pageBreaks = parsed.pageBreaks;
      numPages = parsed.numPages;
    } else {
      // Treat as text file (txt, md, csv, etc.)
      text = await file.text();
    }

    if (!text.trim()) {
      return NextResponse.json({ error: 'File is empty or could not be read' }, { status: 400 });
    }

    // Create document record
    const doc = await createDocument(user.id, filename, fileType, numPages);

    // Chunk the text and store each chunk
    const chunks = chunkText(text, pageBreaks);
    let storedChunks = 0;

    for (const chunk of chunks) {
      if (chunk.content.trim().length < 10) continue; // skip tiny chunks
      const keywords = extractKeywords(chunk.content);
      await addDocumentChunk(doc.id, chunk.index, chunk.pageNumber, chunk.content, keywords);
      storedChunks++;
    }

    return NextResponse.json({
      document: {
        id: doc.id,
        filename: doc.filename,
        totalPages: numPages,
        chunks: storedChunks,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to process file: ${err.message}` },
      { status: 500 }
    );
  }
}

// GET: List user's documents
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const documents = await getUserDocuments(user.id);
  return NextResponse.json({ documents });
}

// DELETE: Remove a document
export async function DELETE(req: Request) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await req.json();
  await deleteDocument(id, user.id);
  return NextResponse.json({ success: true });
}
