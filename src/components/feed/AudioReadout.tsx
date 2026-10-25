'use client';

import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import type { Lang } from '@/lib/types';

export function AudioReadout({
  text,
  lang,
}: {
  text: string;
  lang: Lang;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setSupported(false);
    }
  }, []);

  function toggleSpeech() {
    if (!supported || typeof window === 'undefined') return;

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    window.speechSynthesis.cancel(); // Stop any pending speech

    const utterance = new SpeechSynthesisUtterance(text);
    // Regional language speech codes
    if (lang === 'bn') {
      utterance.lang = 'bn-IN';
    } else if (lang === 'hi') {
      utterance.lang = 'hi-IN';
    } else {
      utterance.lang = 'en-IN';
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setIsPlaying(false);
    };

    utterance.onerror = () => {
      setIsPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  }

  if (!supported) return null;

  return (
    <button
      onClick={toggleSpeech}
      title={isPlaying ? 'Stop voice readout' : 'Listen to 60-word summary'}
      aria-label={isPlaying ? 'Stop voice readout' : 'Listen to summary'}
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold transition-all ${
        isPlaying
          ? 'bg-brand-emerald text-[#04110b] font-bold shadow-sm animate-pulse'
          : 'bg-bg-elevated text-content-secondary hover:text-content-primary hover:bg-bg-surface border border-[var(--border-subtle)]'
      }`}
    >
      {isPlaying ? <VolumeX size={12} /> : <Volume2 size={12} />}
      <span>{isPlaying ? 'Listening...' : 'Listen'}</span>
    </button>
  );
}
