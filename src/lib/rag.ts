/**
 * Retrieval-Augmented Generation (RAG) Module
 *
 * Retrieves relevant context from:
 * 1. Built-in Tipitaka knowledge base
 * 2. User-uploaded documents (with file + page references)
 */

import { searchTipitaka, type TipitakaEntry } from './tipitaka-data';
import { getPaliContext } from './pali-segmenter';
import { searchDocumentChunksMulti, searchDatasetChunksMulti, type DocumentChunk } from './db';

export interface RAGSource {
  title: string;
  source: string;
  id: string;
}

export interface DocumentSource {
  filename: string;
  pageNumber: number | null;
  chunkIndex: number;
  excerpt: string;
}

export interface RAGResult {
  context: string;
  sources: RAGSource[];
  documentSources: DocumentSource[];
}

/**
 * Retrieve relevant context from the Tipitaka knowledge base only (no user documents).
 */
export function retrieveContext(query: string): RAGResult {
  const paliContext = getPaliContext(query);
  const entries = searchTipitaka(query, 3);

  if (entries.length === 0) {
    return {
      context: paliContext || '',
      sources: [],
      documentSources: [],
    };
  }

  const context = entries.map(formatEntry).join('\n\n---\n\n');
  const fullContext = paliContext
    ? `การวิเคราะห์คำบาลี: ${paliContext}\n\n${context}`
    : context;

  return {
    context: fullContext,
    sources: entries.map(e => ({
      title: e.thaiTitle,
      source: e.source,
      id: e.id,
    })),
    documentSources: [],
  };
}

/**
 * Retrieve context from both Tipitaka AND user-uploaded documents AND dataset documents.
 */
export async function retrieveContextWithDocuments(
  query: string,
  userId: number
): Promise<RAGResult> {
  // Get standard Tipitaka context
  const base = retrieveContext(query);

  let documentSources: DocumentSource[] = [];
  let docContext = '';

  try {
    // Search user's uploaded documents AND dataset (system) documents in parallel
    const [userChunks, datasetChunks] = await Promise.all([
      searchDocumentChunksMulti(userId, query, 5),
      searchDatasetChunksMulti(query, 5),
    ]);

    // Combine and deduplicate, keeping top results
    const allChunks = [...userChunks, ...datasetChunks]
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (allChunks.length > 0) {
      documentSources = allChunks.map(chunk => ({
        filename: chunk.filename,
        pageNumber: chunk.page_number,
        chunkIndex: chunk.chunk_index,
        excerpt: chunk.content.slice(0, 150) + (chunk.content.length > 150 ? '...' : ''),
      }));

      docContext = allChunks.map((chunk) => {
        const pageRef = chunk.page_number ? ` (หน้า ${chunk.page_number})` : '';
        return `📄 [${chunk.filename}${pageRef}]\n${chunk.content}`;
      }).join('\n\n---\n\n');
    }
  } catch {
    // If document search fails, continue with just Tipitaka context
  }

  const fullContext = docContext
    ? `${base.context}\n\n===== เอกสารอ้างอิง =====\n\n${docContext}`
    : base.context;

  return {
    context: fullContext,
    sources: base.sources,
    documentSources,
  };
}

function formatEntry(entry: TipitakaEntry): string {
  return `📖 ${entry.thaiTitle} (${entry.paliTitle})
แหล่งที่มา: ${entry.source}

${entry.content}

💡 การนำไปใช้: ${entry.practicalApplication}`;
}
