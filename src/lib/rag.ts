/**
 * Retrieval-Augmented Generation (RAG) Module
 *
 * Retrieves relevant Tipitaka context for the AI to reference.
 * In production, this would use vector embeddings + pgvector for semantic search.
 */

import { searchTipitaka, type TipitakaEntry } from './tipitaka-data';
import { getPaliContext } from './pali-segmenter';

export interface RAGResult {
  context: string;
  sources: Array<{
    title: string;
    source: string;
    id: string;
  }>;
}

/**
 * Retrieve relevant context from the Tipitaka knowledge base.
 */
export function retrieveContext(query: string): RAGResult {
  // Get Pali term analysis
  const paliContext = getPaliContext(query);

  // Search Tipitaka corpus
  const entries = searchTipitaka(query, 3);

  if (entries.length === 0) {
    return {
      context: paliContext || '',
      sources: [],
    };
  }

  const context = entries
    .map(formatEntry)
    .join('\n\n---\n\n');

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
  };
}

function formatEntry(entry: TipitakaEntry): string {
  return `📖 ${entry.thaiTitle} (${entry.paliTitle})
แหล่งที่มา: ${entry.source}

${entry.content}

💡 การนำไปใช้: ${entry.practicalApplication}`;
}
