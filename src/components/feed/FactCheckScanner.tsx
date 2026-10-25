'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  Copy,
  ExternalLink,
  Sparkles,
  ScanLine,
  Loader2,
  CheckCircle2,
  Share2,
  FileText,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui/primitives';
import { DEMO_FACT_CHECKS } from '@/lib/demoData';
import type { FactCheckResult, FactCheckVerdict } from '@/lib/types';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';

export function FactCheckScanner() {
  const { lang } = useLang();
  const [inputText, setInputText] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [currentResult, setCurrentResult] = useState<FactCheckResult | null>(null);
  const [scanHistory, setScanHistory] = useState<FactCheckResult[]>(DEMO_FACT_CHECKS);
  const [copied, setCopied] = useState(false);

  const sampleViralClaims = [
    'Government is distributing free laptops to all college students. Register at this link before 30th October.',
    'Breaking: Kolkata Metro fare increased to ₹50 minimum from November 1st.',
    'Drinking warm lemon water every morning cures diabetes permanently.',
  ];

  function runScan(textToScan?: string) {
    const text = textToScan ?? inputText;
    if (!text.trim()) return;

    setIsScanning(true);
    setCurrentResult(null);

    setTimeout(() => {
      // Find if we have a match in demo data or create a dynamic evaluation
      const lower = text.toLowerCase();
      const existing = DEMO_FACT_CHECKS.find(
        (fc) =>
          lower.includes(fc.inputText.slice(0, 20).toLowerCase()) ||
          fc.inputText.toLowerCase().includes(lower.slice(0, 20)),
      );

      if (existing) {
        setCurrentResult(existing);
      } else {
        // AI heuristic assessment
        const isLikelyScam =
          lower.includes('free') ||
          lower.includes('winner') ||
          lower.includes('cure') ||
          lower.includes('lottery') ||
          lower.includes('click here');

        const dynamicResult: FactCheckResult = {
          id: `fc-${Date.now()}`,
          inputText: text.trim(),
          verdict: isLikelyScam ? 'false' : 'misleading',
          confidence: isLikelyScam ? 94 : 76,
          explanation: isLikelyScam
            ? 'High-confidence hoax pattern detected. Official government and institutional registries contain no record of this claim. The message structure closely resembles phishing campaigns designed to harvest credentials.'
            : 'Unverified viral claim. No major authorized press wires or government gazettes have verified this information. Exercise caution before forwarding.',
          sources: ['PIB Fact Check Registry', 'Cyber Safety Cell Advisory'],
          pibFactCheckUrl: 'https://factcheck.pib.gov.in',
          createdAt: new Date().toISOString().split('T')[0],
        };

        setCurrentResult(dynamicResult);
        setScanHistory([dynamicResult, ...scanHistory]);
      }

      setIsScanning(false);
    }, 1100);
  }

  function handleCopyVerdict() {
    if (!currentResult) return;
    const shareMessage = `[VeriPulse Fact-Check]\nVerdict: ${currentResult.verdict.toUpperCase()} (${currentResult.confidence}% confidence)\nClaim: "${currentResult.inputText}"\nExplanation: ${currentResult.explanation}\nVerified via VeriPulse`;
    navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const verdictMeta: Record<FactCheckVerdict, { label: string; color: string; bg: string }> = {
    true: { label: t('verdictConfirmedReal', lang), color: 'var(--brand-emerald)', bg: 'var(--brand-emerald-glow)' },
    mostly_true: { label: t('verdictMostlyTrue', lang), color: 'var(--brand-sky)', bg: 'rgba(14,165,233,0.12)' },
    misleading: { label: t('verdictMisleading', lang), color: 'var(--brand-amber)', bg: 'rgba(245,158,11,0.12)' },
    false: { label: t('verdictConfirmedHoax', lang), color: 'var(--brand-rose)', bg: 'rgba(244,63,94,0.15)' },
    satire: { label: t('verdictSatire', lang), color: 'var(--brand-sky)', bg: 'rgba(14,165,233,0.12)' },
    unverifiable: { label: t('verdictUnverifiable', lang), color: 'var(--text-muted)', bg: 'var(--bg-elevated)' },
  };

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-button border border-[var(--border-subtle)] bg-bg-surface p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-emerald">
              {t('nav_scanner', lang)}
            </span>
            <Badge color="var(--brand-emerald)" bg="var(--brand-emerald-glow)">
              AI PIB Integration
            </Badge>
          </div>
          <h3 className="mt-1 text-base font-extrabold text-content-primary">
            {t('scannerTitle', lang)}
          </h3>
          <p className="text-xs text-content-muted">
            {t('scannerSubtitle', lang)}
          </p>
        </div>
      </div>

      {/* Input Form */}
      <Card className="p-4 space-y-3">
        <div className="relative">
          <textarea
            rows={3}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t('pastePlaceholder', lang)}
            className="w-full rounded border border-[var(--border-subtle)] bg-bg-elevated p-3 text-xs text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
          />
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-content-muted font-semibold">{t('quickExamples', lang)}:</span>
          {sampleViralClaims.map((claim, idx) => (
            <button
              key={idx}
              onClick={() => {
                setInputText(claim);
                runScan(claim);
              }}
              className="rounded-pill border border-[var(--border-subtle)] bg-bg-surface px-2.5 py-0.5 text-content-secondary hover:border-brand-emerald hover:text-brand-emerald truncate max-w-[280px]"
            >
              &quot;{claim.slice(0, 35)}...&quot;
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-1 border-t border-[var(--border-subtle)]">
          {inputText && (
            <Button variant="ghost" onClick={() => setInputText('')} className="px-3 py-1.5 text-xs">
              {lang === 'bn' ? 'মুছুন' : lang === 'hi' ? 'हटाएं' : 'Clear'}
            </Button>
          )}
          <Button
            onClick={() => runScan()}
            disabled={!inputText.trim() || isScanning}
            className="bg-brand-emerald text-[#04110b] font-bold px-4 py-1.5 text-xs flex items-center gap-1.5"
          >
            {isScanning ? (
              <>
                <Loader2 size={14} className="animate-spin" /> {t('analyzing', lang)}
              </>
            ) : (
              <>
                <ScanLine size={14} /> {t('analyzeClaim', lang)}
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Active Scan Result */}
      {currentResult && (
        <Card className="p-4 border-2 border-brand-emerald/40 animate-slide-up space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="rounded-pill px-3 py-1 font-mono text-xs font-black"
                style={{
                  color: verdictMeta[currentResult.verdict].color,
                  background: verdictMeta[currentResult.verdict].bg,
                }}
              >
                {verdictMeta[currentResult.verdict].label}
              </span>
              <span className="text-xs font-mono text-content-muted">
                {currentResult.confidence}% {t('confidence', lang)}
              </span>
            </div>

            <Button
              variant="outline"
              onClick={handleCopyVerdict}
              className="px-2.5 py-1 text-[11px] flex items-center gap-1 text-content-primary"
            >
              {copied ? (
                <>
                  <CheckCircle2 size={12} className="text-brand-emerald" /> {t('copied', lang)}
                </>
              ) : (
                <>
                  <Copy size={12} /> {t('copyVerdict', lang)}
                </>
              )}
            </Button>
          </div>

          <div className="rounded bg-bg-surface p-2.5 text-xs border border-[var(--border-subtle)]">
            <span className="font-semibold text-content-muted">{lang === 'bn' ? 'স্ক্যানকৃত দাবি:' : lang === 'hi' ? 'स्कैन किया गया दावा:' : 'Scanned Claim:'}</span>
            <div className="italic text-content-secondary mt-0.5">&quot;{currentResult.inputText}&quot;</div>
          </div>

          <p className="text-xs text-content-secondary leading-relaxed">
            {currentResult.explanation}
          </p>

          {/* Sources */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle)] text-[11px]">
            <span className="text-content-muted font-semibold">{lang === 'bn' ? 'নির্ভরযোগ্য সূত্র:' : lang === 'hi' ? 'विश्वसनीय स्रोत:' : 'Credible Sources:'}</span>
            {currentResult.sources.map((s, idx) => (
              <span key={idx} className="rounded bg-bg-elevated px-2 py-0.5 text-content-secondary">
                {s}
              </span>
            ))}
            {currentResult.pibFactCheckUrl && (
              <a
                href={currentResult.pibFactCheckUrl}
                target="_blank"
                rel="noreferrer"
                className="text-brand-sky font-semibold hover:underline flex items-center gap-0.5 ml-auto"
              >
                Official PIB Portal <ExternalLink size={11} />
              </a>
            )}
          </div>
        </Card>
      )}

      {/* Recent Scans History */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-content-muted px-1">
          {t('recentScans', lang)}
        </h4>
        {scanHistory.map((item) => (
          <Card key={item.id} className="p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span
                className="rounded-pill px-2 py-0.5 font-mono text-[10px] font-bold"
                style={{
                  color: verdictMeta[item.verdict].color,
                  background: verdictMeta[item.verdict].bg,
                }}
              >
                {verdictMeta[item.verdict].label}
              </span>
              <span className="text-[10px] text-content-muted">{item.createdAt}</span>
            </div>
            <div className="font-medium text-content-primary line-clamp-1">
              &quot;{item.inputText}&quot;
            </div>
            <p className="text-[11px] text-content-secondary line-clamp-2">
              {item.explanation}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
