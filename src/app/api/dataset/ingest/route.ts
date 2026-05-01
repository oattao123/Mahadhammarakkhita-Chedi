import { NextResponse } from 'next/server';
import path from 'path';
import { getSession } from '@/lib/auth';
import { ingestDataset } from '@/lib/dataset-ingest';
import { getDatasetDocumentCount } from '@/lib/db';

// All dataset folders to ingest
const DATASET_PATHS = [
  path.join(process.cwd(), 'dataset', 'B dhamma'),
  path.join(process.cwd(), 'dataset', 'อภิธรรม'),
];

// POST: Trigger dataset ingestion
export async function POST() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let totalFiles = 0;
    let totalProcessed = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    for (const datasetPath of DATASET_PATHS) {
      try {
        const progress = await ingestDataset(datasetPath);
        totalFiles += progress.total;
        totalProcessed += progress.processed;
        totalSkipped += progress.skipped;
        allErrors.push(...progress.errors);
      } catch {
        allErrors.push(`Failed to process: ${path.basename(datasetPath)}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: totalFiles,
      processed: totalProcessed,
      skipped: totalSkipped,
      errors: allErrors.slice(0, 20),
      errorCount: allErrors.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET: Check dataset ingestion status
export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const count = await getDatasetDocumentCount();
  return NextResponse.json({ datasetDocuments: count });
}
