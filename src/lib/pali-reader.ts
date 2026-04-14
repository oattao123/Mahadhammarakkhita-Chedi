/**
 * Pali text-to-syllable converter (ported from Python)
 *
 * Converts Pali text written in Thai script into phonetic Thai syllables
 * suitable for Thai text-to-speech engines (Web Speech API).
 */

// Thai consonant classes
const THAI_CONSONANTS = new Set([
  'ก','ข','ฃ','ค','ฅ','ฆ','ง','จ','ฉ','ช','ซ','ฌ','ญ',
  'ฎ','ฏ','ฐ','ฑ','ฒ','ณ','ด','ต','ถ','ท','ธ','น',
  'บ','ป','ผ','ฝ','พ','ฟ','ภ','ม','ย','ร','ล','ว',
  'ศ','ษ','ส','ห','ฬ','อ','ฮ',
]);

const THAI_VOWELS = new Set([
  '\u0E31', // ั (sara am mai han akat)
  '\u0E34', // ิ
  '\u0E35', // ี
  '\u0E36', // ึ
  '\u0E37', // ื
  '\u0E38', // ุ
  '\u0E39', // ู
  '\u0E40', // เ
  '\u0E41', // แ
  '\u0E42', // โ
  '\u0E43', // ใ
  '\u0E44', // ไ
  '\u0E47', // ็
]);

const THAI_TONE_MARKS = new Set([
  '\u0E48', // ่
  '\u0E49', // ้
  '\u0E4A', // ๊
  '\u0E4B', // ๋
]);

// Mapping: Thai Pali stopper consonant → phonetic Thai reading
const THAI_STOPPERS: Record<string, string> = {
  'ก': 'กะ',
  'ข': 'ขะ',
  'ค': 'คะ',
  'ฆ': 'คะ',
  'ง': 'งะ',
  'จ': 'จะ',
  'ฉ': 'ฉะ',
  'ช': 'ชะ',
  'ฌ': 'ชะ',
  'ญ': 'ยะ',
  'ฏ': 'ตะ',
  'ฎ': 'ดะ',
  'ฐ': 'ถะ',
  'ฑ': 'ทะ',
  'ฒ': 'ทะ',
  'ณ': 'นะ',
  'ด': 'ดะ',
  'ต': 'ตะ',
  'ถ': 'ถะ',
  'ท': 'ทะ',
  'ธ': 'ทะ',
  'น': 'นะ',
  'บ': 'บะ',
  'ป': 'ปะ',
  'ผ': 'ผะ',
  'พ': 'พะ',
  'ภ': 'พะ',
  'ม': 'มะ',
  'ย': 'ยะ',
  'ร': 'ระ',
  'ล': 'ละ',
  'ว': 'วะ',
  'ศ': 'สะ',
  'ษ': 'สะ',
  'ส': 'สะ',
  'ห': 'หะ',
  'ฬ': 'ละ',
  'อ': 'อะ',
};

function isConsonant(ch: string): boolean {
  return THAI_CONSONANTS.has(ch);
}

function isVowel(ch: string): boolean {
  return THAI_VOWELS.has(ch);
}

function isToneMark(ch: string): boolean {
  return THAI_TONE_MARKS.has(ch);
}

function isThaiChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x0E00 && code <= 0x0E7F;
}

/**
 * Convert Pali text (in Thai script) to a list of syllables
 * suitable for Thai TTS pronunciation.
 */
export function paliToSyllableList(text: string): string[] {
  const syllables: string[] = [];
  const chars = [...text]; // handle multi-codepoint correctly
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i];

    // Skip non-Thai characters — pass them through as-is
    if (!isThaiChar(ch)) {
      // Collect contiguous non-Thai characters
      let nonThai = '';
      while (i < chars.length && !isThaiChar(chars[i])) {
        nonThai += chars[i];
        i++;
      }
      const trimmed = nonThai.trim();
      if (trimmed) syllables.push(trimmed);
      continue;
    }

    // Leading vowels (เ, แ, โ, ใ, ไ) come before the consonant they belong to
    if ('\u0E40\u0E41\u0E42\u0E43\u0E44'.includes(ch)) {
      let syl = ch;
      i++;
      // Collect consonant + following vowels/tone marks
      while (i < chars.length && (isConsonant(chars[i]) || isVowel(chars[i]) || isToneMark(chars[i]))) {
        syl += chars[i];
        i++;
        // After we picked up the consonant and its above/below vowels,
        // break if the next char is a consonant (start of next syllable)
        if (i < chars.length && isConsonant(chars[i]) && !(i + 1 < chars.length && (isVowel(chars[i + 1]) || isToneMark(chars[i + 1])))) {
          break;
        }
      }
      syllables.push(syl);
      continue;
    }

    // Consonant-led syllable
    if (isConsonant(ch)) {
      let syl = ch;
      i++;

      // Collect vowels and tone marks immediately after
      while (i < chars.length && (isVowel(chars[i]) || isToneMark(chars[i]))) {
        syl += chars[i];
        i++;
      }

      // Check if this is a bare consonant (no vowel attached)
      const hasVowel = [...syl].some(c => isVowel(c));

      if (!hasVowel) {
        // Check if next char is a consonant that starts its own syllable
        // (i.e. it has a vowel after it, or is a leading vowel)
        if (i < chars.length && isConsonant(chars[i])) {
          // This consonant is a stopper — convert to phonetic syllable
          const mapped = THAI_STOPPERS[ch];
          if (mapped) {
            syllables.push(mapped);
          } else {
            syllables.push(syl);
          }
          continue;
        }
        // If next char is a leading vowel, this consonant is also a stopper
        if (i < chars.length && '\u0E40\u0E41\u0E42\u0E43\u0E44'.includes(chars[i])) {
          const mapped = THAI_STOPPERS[ch];
          if (mapped) {
            syllables.push(mapped);
          } else {
            syllables.push(syl);
          }
          continue;
        }
        // End of text — bare final consonant
        if (i >= chars.length || !isThaiChar(chars[i])) {
          const mapped = THAI_STOPPERS[ch];
          if (mapped) {
            syllables.push(mapped);
          } else {
            syllables.push(syl);
          }
          continue;
        }
      }

      syllables.push(syl);
      continue;
    }

    // Standalone vowels/tone marks or other Thai characters
    i++;
  }

  return syllables;
}

/**
 * Convert Pali text to a Thai pronunciation string
 * suitable for Web Speech API.
 */
export function paliToThaiReading(text: string): string {
  const syllables = paliToSyllableList(text);
  return syllables.join(' ');
}

/**
 * Detect if text contains Pali in Thai script
 * (heuristic: has Thai consonant clusters without common Thai vowel patterns)
 */
export function containsPaliText(text: string): boolean {
  // Simple heuristic: text contains Thai characters
  return /[\u0E00-\u0E7F]/.test(text);
}
