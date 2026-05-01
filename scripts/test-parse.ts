import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs/promises';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

const BASE = path.join(process.cwd(), 'dataset');

async function testFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  const rel = path.relative(BASE, filePath);
  console.log(`\n--- ${rel} (${ext}) ---`);

  try {
    if (ext === '.pdf') {
      const buffer = await fs.readFile(filePath);
      console.log(`  File size: ${buffer.length} bytes`);
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      console.log(`  Pages: ${result.total}`);
      console.log(`  Text length: ${result.text.length}`);
      console.log(`  First 200 chars: ${result.text.slice(0, 200).replace(/\n/g, ' ')}`);
    } else if (ext === '.docx' || ext === '.doc') {
      const buffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer });
      console.log(`  Text length: ${result.value.length}`);
      console.log(`  First 200 chars: ${result.value.slice(0, 200).replace(/\n/g, ' ')}`);
    } else if (ext === '.htm' || ext === '.html') {
      const html = await fs.readFile(filePath, 'utf-8');
      const $ = cheerio.load(html);
      $('script, style, nav, footer, header').remove();
      const text = ($('body').text() || $.text()).replace(/\s+/g, ' ').trim();
      console.log(`  Text length: ${text.length}`);
      console.log(`  First 200 chars: ${text.slice(0, 200)}`);
    } else if (ext === '.txt') {
      const text = await fs.readFile(filePath, 'utf-8');
      console.log(`  Text length: ${text.length}`);
      console.log(`  First 200 chars: ${text.slice(0, 200).replace(/\n/g, ' ')}`);
    }
  } catch (err: any) {
    console.log(`  ERROR: ${err.message}`);
  }
}

async function main() {
  // Test a few files from each format in each folder
  const folders = ['B dhamma', 'อภิธรรม'];

  for (const folder of folders) {
    const dir = path.join(BASE, folder);
    console.log(`\n===== ${folder} =====`);

    // Find first few files of each type
    const allFiles = await findSomeFiles(dir, 3);
    for (const f of allFiles) {
      await testFile(f);
    }
  }
}

async function findSomeFiles(dir: string, maxPerType: number): Promise<string[]> {
  const found: Record<string, string[]> = {};

  async function scan(d: string) {
    try {
      const entries = await fs.readdir(d, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          await scan(full);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.pdf', '.docx', '.doc', '.htm', '.html', '.txt'].includes(ext)) {
            if (!found[ext]) found[ext] = [];
            if (found[ext].length < maxPerType) found[ext].push(full);
          }
        }
      }
    } catch {}
  }

  await scan(dir);
  return Object.values(found).flat();
}

main().catch(console.error);
