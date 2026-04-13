/**
 * Pali Word Segmenter - Hybrid AI System
 *
 * Uses rule-based sandhi/samasa decomposition for Pali compound words.
 * In production, this would be augmented with a BiLSTM model trained on
 * annotated Pali corpora for >92% accuracy word boundary detection.
 */

// Common Pali sandhi rules for vowel combination
const SANDHI_RULES: Array<{ pattern: RegExp; split: (match: string) => string[] }> = [
  // Vowel sandhi: a + a = ā
  { pattern: /ā/, split: () => ['a', 'a'] },
  // Vowel sandhi: a + i = e
  { pattern: /e(?=[^e])/, split: () => ['a', 'i'] },
  // Vowel sandhi: a + u = o
  { pattern: /o(?=[^o])/, split: () => ['a', 'u'] },
  // Niggahita sandhi: ṃ before consonant
  { pattern: /ṃ([kgcjṭḍtdpb])/, split: (m) => ['ṃ', m[1]] },
];

// Common Pali prefixes (upasagga)
const PREFIXES = [
  'ati', 'adhi', 'anu', 'apa', 'api', 'abhi',
  'ava', 'ud', 'upa', 'dur', 'ni', 'nī',
  'pa', 'pati', 'parā', 'pari', 'vi', 'saṃ', 'su',
];

// Common Pali word endings (vibhatti)
const CASE_ENDINGS = {
  nominal: ['o', 'ā', 'aṃ', 'ena', 'assa', 'asmā', 'asmiṃ', 'e', 'ānaṃ', 'ehi', 'esu'],
  verbal: ['ti', 'nti', 'si', 'tha', 'mi', 'ma', 'ati', 'eti', 'oti'],
};

// Well-known Pali compound words and their decompositions
const KNOWN_COMPOUNDS: Record<string, string[]> = {
  'dhammacakka': ['dhamma', 'cakka'],
  'buddhasāsana': ['buddha', 'sāsana'],
  'ariyasacca': ['ariya', 'sacca'],
  'sammādiṭṭhi': ['sammā', 'diṭṭhi'],
  'sammāsaṅkappa': ['sammā', 'saṅkappa'],
  'sammāvācā': ['sammā', 'vācā'],
  'sammākammanta': ['sammā', 'kammanta'],
  'sammāājīva': ['sammā', 'ājīva'],
  'sammāvāyāma': ['sammā', 'vāyāma'],
  'sammāsati': ['sammā', 'sati'],
  'sammāsamādhi': ['sammā', 'samādhi'],
  'paṭiccasamuppāda': ['paṭicca', 'samuppāda'],
  'satipaṭṭhāna': ['sati', 'paṭṭhāna'],
  'bodhipakkhiya': ['bodhi', 'pakkhiya'],
  'mahāsatipaṭṭhāna': ['mahā', 'sati', 'paṭṭhāna'],
  'aniccā': ['a', 'niccā'],
  'anattā': ['an', 'attā'],
  'dukkha': ['du', 'kha'],
  'tisaraṇa': ['ti', 'saraṇa'],
  'pañcasīla': ['pañca', 'sīla'],
  'aṭṭhaṅgika': ['aṭṭha', 'aṅgika'],
  'catusaccā': ['catu', 'saccā'],
  'brahmavihāra': ['brahma', 'vihāra'],
  'iddhipāda': ['iddhi', 'pāda'],
  'bojjhaṅga': ['bojjha', 'aṅga'],
  'khandha': ['khandha'],
  'āyatana': ['āyatana'],
  'dhātu': ['dhātu'],
  'indriya': ['indriya'],
  'bala': ['bala'],
};

// Dictionary of known Pali root words
const PALI_DICTIONARY = new Set([
  'dhamma', 'buddha', 'saṅgha', 'sīla', 'samādhi', 'paññā',
  'sati', 'viriya', 'saddhā', 'khanti', 'mettā', 'karuṇā',
  'muditā', 'upekkhā', 'dāna', 'cāga', 'sacca', 'dukkha',
  'nirodha', 'magga', 'samudaya', 'nibbāna', 'kamma', 'vipāka',
  'saṃsāra', 'jhāna', 'vipassanā', 'samatha', 'bojjhaṅga',
  'sutta', 'vinaya', 'abhidhamma', 'piṭaka', 'āyatana',
  'khandha', 'dhātu', 'indriya', 'bala', 'magga', 'phala',
  'ariya', 'bhikkhu', 'bhikkhunī', 'upāsaka', 'upāsikā',
  'cetanā', 'vedanā', 'saññā', 'saṅkhāra', 'viññāṇa',
  'rūpa', 'nāma', 'citta', 'cetasika', 'pīti', 'sukha',
  'passaddhi', 'ekaggatā', 'avijjā', 'taṇhā', 'upādāna',
  'bhava', 'jāti', 'jarā', 'maraṇa', 'soka', 'parideva',
]);

export interface SegmentResult {
  original: string;
  segments: string[];
  roots: string[];
  type: 'compound' | 'simple' | 'prefix' | 'unknown';
}

/**
 * Segment a Pali word into its component parts using rule-based decomposition.
 * This is the rule-based component of the hybrid system.
 * A BiLSTM model would be used in production for initial boundary prediction.
 */
export function segmentPaliWord(word: string): SegmentResult {
  const normalized = word.toLowerCase().trim();

  // Check known compounds first
  if (KNOWN_COMPOUNDS[normalized]) {
    return {
      original: word,
      segments: KNOWN_COMPOUNDS[normalized],
      roots: KNOWN_COMPOUNDS[normalized].filter(s => PALI_DICTIONARY.has(s)),
      type: 'compound',
    };
  }

  // Check if it's a simple known word
  if (PALI_DICTIONARY.has(normalized)) {
    return {
      original: word,
      segments: [normalized],
      roots: [normalized],
      type: 'simple',
    };
  }

  // Try prefix decomposition
  for (const prefix of PREFIXES) {
    if (normalized.startsWith(prefix) && normalized.length > prefix.length + 2) {
      const remainder = normalized.slice(prefix.length);
      if (PALI_DICTIONARY.has(remainder)) {
        return {
          original: word,
          segments: [prefix, remainder],
          roots: [remainder],
          type: 'prefix',
        };
      }
    }
  }

  // Try splitting compound words by matching dictionary entries
  for (let i = 3; i < normalized.length - 2; i++) {
    const first = normalized.slice(0, i);
    const second = normalized.slice(i);
    if (PALI_DICTIONARY.has(first) && PALI_DICTIONARY.has(second)) {
      return {
        original: word,
        segments: [first, second],
        roots: [first, second],
        type: 'compound',
      };
    }
  }

  return {
    original: word,
    segments: [normalized],
    roots: [],
    type: 'unknown',
  };
}

/**
 * Segment a full Pali text into words and decompose compounds.
 */
export function segmentPaliText(text: string): SegmentResult[] {
  const words = text.split(/[\s,;.]+/).filter(w => w.length > 0);
  return words.map(segmentPaliWord);
}

/**
 * Get Pali word info for enriching RAG context.
 */
export function getPaliContext(query: string): string {
  const segments = segmentPaliText(query);
  const knownTerms = segments.filter(s => s.type !== 'unknown');

  if (knownTerms.length === 0) return '';

  return knownTerms
    .map(s => {
      if (s.type === 'compound') {
        return `[${s.original}: สมาส/สนธิ → ${s.segments.join(' + ')}]`;
      }
      return `[${s.original}: รากศัพท์บาลี]`;
    })
    .join(' ');
}
