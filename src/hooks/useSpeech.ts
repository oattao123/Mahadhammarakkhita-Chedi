'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSpeechOptions {
  lang?: string;
  rate?: number;
}

interface UseSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  speaking: boolean;
  supported: boolean;
  rate: number;
  setRate: (r: number) => void;
}

/** Split long text into sentence-sized chunks to avoid Web Speech API cutoff */
function splitIntoChunks(text: string, maxLen = 200): string[] {
  // Clean markdown-ish formatting for cleaner speech
  const clean = text
    .replace(/#{1,3}\s*/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[-*] /g, '')
    .replace(/\d+\. /g, '')
    .trim();

  if (!clean) return [];

  const chunks: string[] = [];
  // Split by sentences (Thai and English)
  const sentences = clean.split(/(?<=[.!?\n\u0E2F\u0E46])\s*/);

  let current = '';
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length > maxLen && current.length > 0) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current += (current ? ' ' : '') + trimmed;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

/**
 * Hook for text-to-speech using Web Speech API.
 * Handles voice loading, chunked speaking, and cleanup.
 */
export function useSpeech(options: UseSpeechOptions = {}): UseSpeechReturn {
  const { lang = 'th-TH' } = options;
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(options.rate ?? 0.9);
  const [supported, setSupported] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);
  const stoppedRef = useRef(false);

  // Check support and load voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    setSupported(true);

    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const findVoice = useCallback((targetLang: string): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;
    if (!voices.length) return null;

    // Exact match first
    const exact = voices.find(v => v.lang === targetLang);
    if (exact) return exact;

    // Prefix match (e.g. 'th' matches 'th-TH')
    const prefix = targetLang.split('-')[0];
    const partial = voices.find(v => v.lang.startsWith(prefix));
    return partial || null;
  }, []);

  const speakNextChunk = useCallback(() => {
    if (stoppedRef.current) {
      setSpeaking(false);
      return;
    }

    const chunks = chunksRef.current;
    const idx = chunkIndexRef.current;

    if (idx >= chunks.length) {
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[idx]);
    utterance.lang = lang;
    utterance.rate = rate;

    const voice = findVoice(lang);
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      chunkIndexRef.current++;
      speakNextChunk();
    };

    utterance.onerror = () => {
      // Try next chunk on error
      chunkIndexRef.current++;
      speakNextChunk();
    };

    window.speechSynthesis.speak(utterance);
  }, [lang, rate, findVoice]);

  const speak = useCallback((text: string) => {
    if (!supported) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    const chunks = splitIntoChunks(text);
    if (!chunks.length) return;

    chunksRef.current = chunks;
    chunkIndexRef.current = 0;
    stoppedRef.current = false;
    setSpeaking(true);
    speakNextChunk();
  }, [supported, speakNextChunk]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return { speak, stop, speaking, supported, rate, setRate };
}
