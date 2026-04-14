import { NextResponse } from 'next/server';
import { paliToSyllableList, paliToThaiReading } from '@/lib/pali-reader';

export async function POST(req: Request) {
  const { text } = await req.json();

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 });
  }

  const syllables = paliToSyllableList(text);
  const thaiReading = paliToThaiReading(text);

  return NextResponse.json({ syllables, thaiReading });
}
