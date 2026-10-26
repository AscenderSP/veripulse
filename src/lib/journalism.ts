// Algorithms for decentralized verified journalism, deduplication, and multi-reporter consensus.

import type { NewsArticle, ReporterDispatch, LocalizedText } from './types';

export const NEWS_EXPIRY_HOURS = 12;
export const NEWS_EXPIRY_MS = NEWS_EXPIRY_HOURS * 60 * 60 * 1000;

export function isNewsExpired(publishedAtOrCreatedAt: string | Date | number): boolean {
  const time = new Date(publishedAtOrCreatedAt).getTime();
  if (isNaN(time)) return false;
  return Date.now() - time > NEWS_EXPIRY_MS;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'were', 'been',
  'will', 'after', 'across', 'their', 'about', 'under', 'into', 'over', 'more',
]);

/**
 * Calculates Jaccard similarity score between two texts [0 to 1].
 */
export function calculateTextSimilarity(textA: string, textB: string): number {
  const setA = tokenize(textA);
  const setB = tokenize(textB);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : +(intersection / union).toFixed(3);
}

/**
 * Duplicate Detection Engine:
 * Checks whether a freshly submitted dispatch is covering an existing recent news event.
 */
export function findDuplicateNews(
  dispatch: { title: string; text: string; category: string; tags: string[] },
  existingArticles: NewsArticle[],
): { isDuplicate: boolean; matchedArticle?: NewsArticle; similarityScore: number } {
  let bestMatch: NewsArticle | undefined;
  let highestScore = 0;

  const dispatchContent = `${dispatch.title} ${dispatch.text}`;

  for (const article of existingArticles) {
    // Expired news (>12 hours) cannot receive updates as recent developing stories
    if (isNewsExpired(article.publishedAt)) continue;

    // Only match articles in the same or related category
    const isSameCategory = article.category === dispatch.category;
    const articleContent = `${article.titles.en} ${article.summaries.en} ${article.tags.join(' ')}`;

    const textSim = calculateTextSimilarity(dispatchContent, articleContent);
    const titleSim = calculateTextSimilarity(dispatch.title, article.titles.en);

    // Tag overlap bonus (case-insensitive)
    const normalizedArticleTags = article.tags.map((t) => t.toLowerCase());
    const tagMatches = dispatch.tags.filter((t) =>
      normalizedArticleTags.includes(t.toLowerCase()),
    ).length;
    const tagBonus = tagMatches * 0.15;

    const totalScore = textSim + titleSim * 0.25 + (isSameCategory ? 0.08 : 0) + tagBonus;

    if (totalScore > highestScore) {
      highestScore = totalScore;
      bestMatch = article;
    }
  }

  // If score exceeds duplicate threshold (0.28), flag as an update to existing story
  const isDuplicate = highestScore >= 0.28 && bestMatch !== undefined;

  return {
    isDuplicate,
    matchedArticle: isDuplicate ? bestMatch : undefined,
    similarityScore: Math.min(1.0, +highestScore.toFixed(2)),
  };
}

/**
 * Multi-Reporter 10-Minute Consensus Synthesizer:
 * Ingests all dispatches submitted during the window, synthesizes a consolidated
 * summary under 60 words, and awards points/earnings based on match percentage.
 */
export function synthesizeMultiReporterSummary(
  dispatches: {
    reporterId: string;
    reporterName: string;
    reporterUsername: string;
    reporterAvatar: string;
    reporterBadge: string;
    originalDraft: string;
    submittedAt: string;
    location: string;
  }[],
  baseSummaryEn: string,
  baseSummaryBn?: string,
  baseSummaryHi?: string,
): {
  unifiedSummary: LocalizedText;
  reporterAttributions: ReporterDispatch[];
  totalPoolInr: number;
} {
  // Hard clamp the consolidated summary to <= 60 words
  const clampWords = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return words.length <= 60 ? words.join(' ') : words.slice(0, 60).join(' ');
  };

  const unifiedSummary: LocalizedText = {
    en: clampWords(baseSummaryEn),
    bn: clampWords(baseSummaryBn || baseSummaryEn),
    hi: clampWords(baseSummaryHi || baseSummaryEn),
  };

  // Base reward pool for the news impact (e.g. ₹400 for fresh breaking coverage)
  const totalPoolInr = 450;
  const totalPointsPool = 600;

  // Calculate similarity score of each reporter's original draft against the final summary
  const scoredDispatches = dispatches.map((d) => {
    const sim = calculateTextSimilarity(d.originalDraft, unifiedSummary.en);
    // Base match percentage scaled [50% - 98%]
    const matchPercent = Math.min(98, Math.max(45, Math.round(sim * 100 + 35)));
    return {
      ...d,
      matchScorePercent: matchPercent,
    };
  });

  // Sort descending by match score
  scoredDispatches.sort((a, b) => b.matchScorePercent - a.matchScorePercent);

  // Compute proportional point and earning shares (lead gets highest)
  const sumScores = scoredDispatches.reduce((acc, curr) => acc + curr.matchScorePercent, 0) || 1;

  const reporterAttributions: ReporterDispatch[] = scoredDispatches.map((d, index) => {
    const shareRatio = d.matchScorePercent / sumScores;
    const pointsAwarded = Math.round(totalPointsPool * shareRatio);
    const earningsInr = Math.round(totalPoolInr * shareRatio);

    return {
      id: `disp-${d.reporterId}-${Date.now().toString(36)}-${index}`,
      reporterId: d.reporterId,
      reporterName: d.reporterName,
      reporterUsername: d.reporterUsername,
      reporterAvatar: d.reporterAvatar,
      reporterBadge: d.reporterBadge,
      submittedAt: d.submittedAt,
      originalDraft: d.originalDraft,
      matchScorePercent: d.matchScorePercent,
      pointsAwarded,
      earningsInr,
      location: d.location,
      status: index === 0 ? 'lead' : 'corroborating',
      c2paProofHash: `c2pa:sha256:${d.reporterId.slice(0, 6)}${Date.now().toString(16)}`,
    };
  });

  return {
    unifiedSummary,
    reporterAttributions,
    totalPoolInr,
  };
}

/**
 * Calculates dynamic impact score and earnings based on community consensus,
 * reading time, C2PA validity, and real votes.
 */
export function calculateImpactEarnings(article: {
  realVotes?: number;
  credibilityScore: number;
  c2paVerified: boolean;
  contributorsCount?: number;
}): { impactScore: number; earningsInr: number } {
  const votes = article.realVotes ?? 120;
  const cred = article.credibilityScore;
  const c2paBonus = article.c2paVerified ? 15 : 0;
  const contribBonus = Math.min(20, (article.contributorsCount ?? 1) * 5);

  const rawImpact = Math.round((votes * 0.4) + (cred * 0.4) + c2paBonus + contribBonus);
  const impactScore = Math.min(99, Math.max(50, rawImpact));

  // Earnings scale with impact (₹150 to ₹750)
  const earningsInr = Math.round((impactScore / 100) * 550 + 150);

  return { impactScore, earningsInr };
}
