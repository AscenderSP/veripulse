'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Landmark,
  TrendingUp,
  Cpu,
  HeartPulse,
  Trophy,
  Newspaper,
  Search,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Share2,
  Check,
  ExternalLink,
  Clock,
  Tag,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MapPin,
  Flame,
  ArrowRight,
  ArrowLeft,
  X,
  FileCheck,
  Lock,
  Eye,
  MessageSquare,
  PenSquare,
  Award,
  Users,
  Timer,
  CheckCheck,
  Zap,
} from 'lucide-react';
import { Card, Button, Badge, CredMeter, CustomSelect } from '@/components/ui/primitives';
import { cn, timeAgo, formatINR, formatVPCoins, inrToVPCoins } from '@/lib/utils';
import { useLang } from '@/hooks/useLang';
import { useSession } from '@/hooks/useSession';
import { voteWeight, nextCredibility, type ConsensusVote } from '@/lib/consensus';
import { AudioReadout } from '@/components/feed/AudioReadout';
import { NEWS_CATEGORIES, DEMO_NEWS_ARTICLES, isSupabaseConfigured } from '@/lib/demoData';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  findDuplicateNews,
  synthesizeMultiReporterSummary,
  calculateImpactEarnings,
} from '@/lib/journalism';
import { t } from '@/lib/translations';
import { getReferenceImage, isNewsExpired, isStockImage, NEWS_EXPIRY_HOURS } from '@/lib/referenceImages';
import { useRelatedImage } from '@/hooks/useRelatedImage';
import type { NewsCategory, NewsArticle, Lang, ReporterDispatch, Story } from '@/lib/types';

/** Image for an article card. Verified photo wins; otherwise a subject-related
 *  image is fetched from Wikipedia with the title as the query, and the curated
 *  category reference image is the last fallback. The "Reference Image"
 *  disclaimer shows for anything that is not the article's own verified photo. */
function ArticleImage({
  article,
  titleText,
  size = 'card',
}: {
  article: NewsArticle;
  titleText: string;
  size?: 'card' | 'detail';
}) {
  // Treat the DB-side category stock substitute as "no real image" so we fall
  // through to the Wikipedia subject fetch instead of showing the same stock
  // photo for every story in a category.
  const hasVerifiedImage = Boolean(article.mediaUrl) && !isStockImage(article.mediaUrl);
  const relatedImage = useRelatedImage(titleText, !hasVerifiedImage);
  const displayImage = hasVerifiedImage
    ? article.mediaUrl!
    : relatedImage ?? article.mediaUrl ?? getReferenceImage(article.category);

  const wrapperCls =
    size === 'card'
      ? 'relative aspect-square w-full sm:w-48 sm:h-48 overflow-hidden rounded-card bg-bg-elevated border border-[var(--border-subtle)]'
      : 'relative aspect-square w-full sm:w-48 sm:h-48 shrink-0 overflow-hidden rounded-card border border-[var(--border-subtle)] bg-bg-elevated';

  const imgCls =
    size === 'card'
      ? 'h-full w-full object-cover transition-transform duration-300 hover:scale-105'
      : 'h-full w-full object-cover';

  return (
    <div className={wrapperCls}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={displayImage} alt={titleText} className={imgCls} loading="lazy" />
      {article.c2paVerified ? (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-pill bg-[#04110b]/80 px-2 py-0.5 text-[9px] font-bold text-brand-emerald backdrop-blur-sm">
          <ShieldCheck size={11} /> {size === 'detail' ? 'C2PA Authenticated' : 'C2PA Signed'}
        </div>
      ) : !hasVerifiedImage ? (
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-pill bg-black/70 px-2 py-0.5 text-[9px] font-medium text-white/90 backdrop-blur-sm">
          <Sparkles size={10} className="text-brand-amber" />
          Reference Image
        </div>
      ) : null}
      {size === 'card' && (
        <div className="absolute bottom-2 left-2 rounded-pill bg-bg-surface/80 px-2 py-0.5 text-[10px] font-mono text-content-primary backdrop-blur-sm">
          {article.readingTimeMinutes} min read
        </div>
      )}
      {!hasVerifiedImage && size === 'detail' && (
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[9px] leading-tight text-white/80 text-right">
          Illustrative — not from scene
        </div>
      )}
    </div>
  );
}

function mapStoryToArticle(s: any): NewsArticle {
  const catRaw = (s.category || 'Politics').toLowerCase();
  let category: NewsCategory = 'politics';
  if (catRaw.includes('biz') || catRaw.includes('finance') || catRaw.includes('econ') || catRaw.includes('market')) {
    category = 'business';
  } else if (catRaw.includes('tech') || catRaw.includes('electronic') || catRaw.includes('sci')) {
    category = 'tech';
  } else if (catRaw.includes('health') || catRaw.includes('weather') || catRaw.includes('environ') || catRaw.includes('civic')) {
    category = 'health';
  } else if (catRaw.includes('sport') || catRaw.includes('entertain')) {
    category = 'entertainment';
  }

  const enTitle = typeof s.titles === 'object' ? s.titles?.en : s.titles;
  const bnTitle = typeof s.titles === 'object' ? s.titles?.bn : s.titles;
  const hiTitle = typeof s.titles === 'object' ? s.titles?.hi : s.titles;

  const enSummary = typeof s.summaries === 'object' ? s.summaries?.en : s.summaries;
  const bnSummary = typeof s.summaries === 'object' ? s.summaries?.bn : s.summaries;
  const hiSummary = typeof s.summaries === 'object' ? s.summaries?.hi : s.summaries;

  return {
    id: s.id,
    category,
    categoryName: s.category || 'National News',
    tags: [s.category || 'News', s.location_name || 'India', s.source === 'rss' ? 'Wire Agency' : 'Verified Sentinel'],
    titles: {
      en: enTitle || 'Live Wire Update',
      bn: bnTitle || enTitle || 'লাইভ আপডেট',
      hi: hiTitle || enTitle || 'लाइव अपडेट',
    },
    summaries: {
      en: enSummary || '',
      bn: bnSummary || enSummary || '',
      hi: hiSummary || enSummary || '',
    },
    source: s.source === 'rss' ? 'Verified Wire Agency' : 'Citizen Sentinel',
    publishedAt: s.created_at || new Date().toISOString(),
    mediaUrl: s.media_url || undefined,
    c2paVerified: Boolean(s.c2pa_verified),
    credibilityScore: Number(s.credibility_score) || 82,
    aiProbabilityScore: Number(s.ai_probability_score) || 8,
    readingTimeMinutes: 1,
    locationName: s.location_name || 'National',
    keyTakeaways: [
      enSummary ? enSummary.slice(0, 100) + '...' : 'Verified wire news dispatch',
      `Source: ${s.source === 'rss' ? 'Wire Agency Wire' : 'Verified Sentinel'}`,
      `Credibility Index: ${s.credibility_score || 82}%`,
    ],
    realVotes: 12,
    hoaxVotes: 1,
    contextVotes: 1,
    stage: s.rollout_stage,
    detailedAnalysis: enSummary || undefined,
  };
}

export function NewsHub() {
  const { lang } = useLang();
  const { profile, updateProfile, patchDemoProfile } = useSession();
  const [selectedCategory, setSelectedCategory] = useState<NewsCategory | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'credibility' | 'fastest'>('latest');
  const [c2paOnly, setC2paOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // In-memory article cache for instant 0ms tab navigation
  const [articles, setArticles] = useState<NewsArticle[]>(() => {
    if (typeof window !== 'undefined' && (window as any).__VERIPULSE_NEWS_CACHE__) {
      return (window as any).__VERIPULSE_NEWS_CACHE__;
    }
    return DEMO_NEWS_ARTICLES;
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Load real-time news stories directly from Supabase
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabaseBrowserClient();

    const loadLiveStories = async () => {
      try {
        setIsSyncing(true);
        const twelveHoursAgo = new Date(Date.now() - NEWS_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
        const { data, error } = await sb
          .from('stories')
          .select('*')
          .eq('rollout_stage', 'public')
          .gte('created_at', twelveHoursAgo)
          .order('created_at', { ascending: false })
          .limit(40);

        if (!error && data && data.length > 0) {
          const live = data.map(mapStoryToArticle);
          setArticles((prev) => {
            const liveIds = new Set(live.map((a) => a.id));
            const remaining = prev.filter((a) => !liveIds.has(a.id));
            const merged = [...live, ...remaining];
            if (typeof window !== 'undefined') {
              (window as any).__VERIPULSE_NEWS_CACHE__ = merged;
            }
            return merged;
          });
        }
      } catch {
        // keep existing articles on network error
      } finally {
        setIsSyncing(false);
      }
    };

    loadLiveStories();

    const channel = sb
      .channel('news_hub_live_stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => {
        loadLiveStories();
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, []);
  // User's active votes: articleId -> ConsensusVote
  const [userVotes, setUserVotes] = useState<Record<string, ConsensusVote>>({});
  // Selected article for drill-down modal
  const [drillDownArticle, setDrillDownArticle] = useState<NewsArticle | null>(null);
  // Initial tab inside drill-down
  const [drillDownInitialTab, setDrillDownInitialTab] = useState<'analysis' | 'timeline' | 'c2pa' | 'community' | 'dispatches'>('analysis');

  // Modals for posting news
  const [fileDispatchOpen, setFileDispatchOpen] = useState(false);
  const [pressPassModalOpen, setPressPassModalOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ title: string; desc: string; type: 'success' | 'merge' | 'buffer' } | null>(null);

  // Auto-dismiss banner notice
  useEffect(() => {
    if (bannerNotice) {
      const timer = setTimeout(() => setBannerNotice(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [bannerNotice]);

  // All unique tags across the demo news dataset
  const allTags = useMemo(() => {
    const set = new Set<string>();
    DEMO_NEWS_ARTICLES.forEach((a) => a.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, []);

  // Filtered & sorted articles
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      // Expire news if older than 12 hours
      if (isNewsExpired(article.publishedAt)) {
        return false;
      }
      if (selectedCategory !== 'all' && article.category !== selectedCategory) {
        return false;
      }
      if (selectedTag && !article.tags.includes(selectedTag)) {
        return false;
      }
      if (c2paOnly && !article.c2paVerified) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = article.titles[lang]?.toLowerCase().includes(q) || article.titles.en.toLowerCase().includes(q);
        const summaryMatch = article.summaries[lang]?.toLowerCase().includes(q) || article.summaries.en.toLowerCase().includes(q);
        const tagMatch = article.tags.some((t) => t.toLowerCase().includes(q));
        const sourceMatch = article.source.toLowerCase().includes(q);
        if (!titleMatch && !summaryMatch && !tagMatch && !sourceMatch) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'credibility') {
        return b.credibilityScore - a.credibilityScore;
      }
      if (sortBy === 'fastest') {
        return a.readingTimeMinutes - b.readingTimeMinutes;
      }
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
  }, [articles, selectedCategory, selectedTag, c2paOnly, searchQuery, sortBy, lang]);

  // Handle live credibility voting
  const handleVote = (articleId: string, vote: ConsensusVote) => {
    const previousVote = userVotes[articleId];
    const isTogglingOff = previousVote === vote;
    const newVote = isTogglingOff ? null : vote;

    // Calculate user's consensus weight
    const userTrust = profile?.trust_score ?? 80;
    const isOwner = profile?.is_ownership_verified ?? false;
    const weight = voteWeight(userTrust, null, isOwner);

    setArticles((prev) =>
      prev.map((art) => {
        if (art.id !== articleId) return art;

        let newCredibility = art.credibilityScore;
        let realCount = art.realVotes ?? 100;
        let hoaxCount = art.hoaxVotes ?? 5;
        let contextCount = art.contextVotes ?? 10;

        if (previousVote === 'real') realCount = Math.max(0, realCount - 1);
        if (previousVote === 'hoax') hoaxCount = Math.max(0, hoaxCount - 1);
        if (previousVote === 'needs_context') contextCount = Math.max(0, contextCount - 1);

        if (newVote === 'real') {
          realCount += 1;
          newCredibility = nextCredibility(art.credibilityScore, 'real', weight);
        } else if (newVote === 'hoax') {
          hoaxCount += 1;
          newCredibility = nextCredibility(art.credibilityScore, 'hoax', weight);
        } else if (newVote === 'needs_context') {
          contextCount += 1;
          newCredibility = nextCredibility(art.credibilityScore, 'needs_context', weight);
        }

        const updated = {
          ...art,
          credibilityScore: Math.round(newCredibility),
          realVotes: realCount,
          hoaxVotes: hoaxCount,
          contextVotes: contextCount,
        };

        if (drillDownArticle?.id === articleId) {
          setDrillDownArticle(updated);
        }

        return updated;
      }),
    );

    setUserVotes((prev) => {
      const next = { ...prev };
      if (newVote === null) {
        delete next[articleId];
      } else {
        next[articleId] = newVote;
      }
      return next;
    });
  };

  // Rule check: only journalist verified paid accounts can post news
  const handleOpenFileDispatch = () => {
    const isJournalist = profile?.is_journalist_verified && profile?.is_press_pass_paid;
    if (!isJournalist) {
      setPressPassModalOpen(true);
    } else {
      setFileDispatchOpen(true);
    }
  };

  // The global PostFab sets this sessionStorage flag when the user picks
  // "File News Dispatch" from any section — on arrival at NewsHub we drop
  // straight into the dispatch flow and clear the flag.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.sessionStorage.getItem('veripulse_open_news_dispatch_v1') === '1') {
        window.sessionStorage.removeItem('veripulse_open_news_dispatch_v1');
        handleOpenFileDispatch();
      }
    } catch {
      /* ignore storage errors */
    }
    // Intentionally runs on mount and when profile load finishes, so the
    // press-pass gate reads the right profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.is_journalist_verified]);

  // Submit news dispatch with duplicate detection and 10-minute consensus buffer
  const handleDispatchSubmit = (data: {
    title: string;
    text: string;
    category: NewsCategory;
    tags: string[];
    location: string;
    mediaUrl?: string;
  }) => {
    const reporterName = profile?.full_name ?? profile?.username ?? 'Anonymous Reporter';
    const reporterUsername = profile?.username ?? 'reporter';
    const reporterAvatar = profile?.avatar_url ?? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80';
    const reporterBadge = profile?.badge?.includes('Journalist') ? profile.badge : 'Verified Press Pass';

    // 1. Run Duplicate Detection Algorithm
    const duplicateCheck = findDuplicateNews(
      { title: data.title, text: data.text, category: data.category, tags: data.tags },
      articles,
    );

    if (duplicateCheck.isDuplicate && duplicateCheck.matchedArticle) {
      // ── DUPLICATE / DEVELOPING STORY DETECTED: Add older news to timeline & promote latest news ──
      const matched = duplicateCheck.matchedArticle;
      
      // 1. Add the OLDER news into the timeline of the latest news
      const olderTimelineItem = {
        time: timeAgo(matched.publishedAt),
        event: `Earlier Dispatch: ${matched.titles.en} — ${matched.summaries.en}`,
        verifiedBy: matched.source || 'Original Dispatch',
      };

      // 2. Also record this latest incoming update event
      const latestUpdateTimelineItem = {
        time: 'Just now',
        event: `Update: ${data.title} — ${data.text.slice(0, 100)}...`,
        verifiedBy: `${reporterName} (${reporterBadge})`,
      };

      // Create new corroborating dispatch
      const newDispatch: ReporterDispatch = {
        id: `disp-${profile?.id ?? 'user'}-${Date.now().toString(36)}`,
        reporterId: profile?.id ?? 'user',
        reporterName,
        reporterUsername,
        reporterAvatar,
        reporterBadge,
        pressIdNumber: profile?.press_credential_id ?? 'PRESS-PASS-2026',
        submittedAt: new Date().toISOString(),
        originalDraft: data.text,
        matchScorePercent: Math.round(duplicateCheck.similarityScore * 100),
        pointsAwarded: 240,
        earningsInr: 180,
        location: data.location,
        c2paProofHash: `c2pa:sha256:${Date.now().toString(16)}proof`,
        status: 'corroborating',
      };

      // Multi-reporter synthesis for unified 60-word summary
      const existingDispatches = [
        ...(matched.leadReporter ? [matched.leadReporter] : []),
        ...(matched.contributors ?? []),
        newDispatch,
      ];

      const synthesis = synthesizeMultiReporterSummary(
        existingDispatches.map((d) => ({
          reporterId: d.reporterId,
          reporterName: d.reporterName,
          reporterUsername: d.reporterUsername,
          reporterAvatar: d.reporterAvatar,
          reporterBadge: d.reporterBadge,
          originalDraft: d.originalDraft,
          submittedAt: d.submittedAt,
          location: d.location,
        })),
        matched.summaries.en,
        matched.summaries.bn,
        matched.summaries.hi,
      );

      // Credit earnings to reporter wallet
      if (profile) {
        const bonus = 180;
        patchDemoProfile({
          wallet_balance_inr: +(profile.wallet_balance_inr + bonus).toFixed(2),
          journalist_earnings_inr: +((profile.journalist_earnings_inr ?? 0) + bonus).toFixed(2),
        });
      }

      setArticles((prev) =>
        prev.map((art) => {
          if (art.id !== matched.id) return art;
          const assignedMedia = data.mediaUrl || art.mediaUrl || getReferenceImage(art.category);
          return {
            ...art,
            titles: {
              en: data.title || art.titles.en,
              bn: synthesis.unifiedSummary.bn ? data.title : art.titles.bn,
              hi: synthesis.unifiedSummary.hi ? data.title : art.titles.hi,
            },
            summaries: {
              en: synthesis.unifiedSummary.en,
              bn: synthesis.unifiedSummary.bn || art.summaries.bn,
              hi: synthesis.unifiedSummary.hi || art.summaries.hi,
            },
            publishedAt: new Date().toISOString(), // Refreshed timestamp for latest news (<12h)
            mediaUrl: assignedMedia,
            timeline: [latestUpdateTimelineItem, olderTimelineItem, ...(art.timeline ?? [])],
            contributors: [...(art.contributors ?? []), newDispatch],
            dispatchesCount: (art.dispatchesCount ?? 1) + 1,
            totalImpactEarningsInr: (art.totalImpactEarningsInr ?? 350) + 180,
            keyTakeaways: [
              `Latest update from ${reporterName} at ${data.location}`,
              ...(art.keyTakeaways ?? []),
            ].slice(0, 5),
          };
        }),
      );

      setBannerNotice({
        title: 'Corroborating News Merged Into Timeline!',
        desc: `No duplicate card was created. Your dispatch on "${matched.titles.en}" was merged into the official timeline as a co-contributor! +1,800 VP credited to your wallet.`,
        type: 'merge',
      });
      setFileDispatchOpen(false);
      return;
    }

    // ── FRESH STORY: Ingestion with 10-Minute Multi-Reporter Buffer ──
    const newArticleId = `news-${Date.now().toString(36)}`;
    const bufferExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const initialDispatch: ReporterDispatch = {
      id: `disp-${profile?.id ?? 'user'}-${Date.now().toString(36)}`,
      reporterId: profile?.id ?? 'user',
      reporterName,
      reporterUsername,
      reporterAvatar,
      reporterBadge,
      pressIdNumber: profile?.press_credential_id ?? 'PIB-PRESS-2026-9812',
      submittedAt: new Date().toISOString(),
      originalDraft: data.text,
      matchScorePercent: 96,
      pointsAwarded: 450,
      earningsInr: 320,
      location: data.location,
      c2paProofHash: `c2pa:sha256:${Date.now().toString(16)}root`,
      status: 'lead',
    };

    // Trim summary to under 60 words
    const words = data.text.trim().split(/\s+/).slice(0, 58).join(' ');

    const newArticle: NewsArticle = {
      id: newArticleId,
      category: data.category,
      categoryName: NEWS_CATEGORIES.find((c) => c.id === data.category)?.name ?? 'General News',
      tags: data.tags.length > 0 ? data.tags : ['Breaking', 'VerifiedNews'],
      titles: {
        en: data.title,
        bn: `${data.title} (সংবাদ আপডেট)`,
        hi: `${data.title} (ताज़ा खबर)`,
      },
      summaries: {
        en: words,
        bn: `${words} - প্রেস পাস যাচাইকৃত সংবাদদাতার সরেজমিন প্রতিবেদন।`,
        hi: `${words} - प्रेस पास द्वारा सत्यापित संवाददाता की ज़मीनी रिपोर्ट।`,
      },
      source: `${reporterName} / VeriPulse Syndicate`,
      sourceUrl: undefined,
      publishedAt: new Date().toISOString(),
      mediaUrl: data.mediaUrl || 'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=600&q=80',
      c2paVerified: true,
      credibilityScore: 92,
      aiProbabilityScore: 2,
      readingTimeMinutes: 1,
      locationName: data.location,
      realVotes: 1,
      hoaxVotes: 0,
      contextVotes: 0,
      stage: 'tier_1',
      keyTakeaways: [
        `First reported by ${reporterName} on-site at ${data.location}`,
        'Cryptographic hardware signature recorded at point-of-dispatch',
        '10-Minute multi-reporter consensus buffer active',
      ],
      detailedAnalysis: data.text,
      timeline: [
        {
          time: 'Just now',
          event: `Initial dispatch filed by ${reporterName}`,
          verifiedBy: 'VeriPulse Hardware Authenticator',
        },
      ],
      c2paMetadata: {
        issuer: 'VeriPulse Accredited Press Network',
        algorithm: 'ECDSA P-256 with SHA-256',
        signatureHash: `c2pa:sha256:${Date.now().toString(16)}accredited`,
        captureDevice: 'Mobile C2PA Secure Enclave Camera',
        tamperProofStatus: 'Verified Untampered (100% Cryptographic Match)',
      },
      leadReporter: initialDispatch,
      contributors: [],
      impactScore: 88,
      totalImpactEarningsInr: 450,
      ingestionStatus: 'buffer_active',
      bufferExpiresAt,
      dispatchesCount: 1,
    };

    // Credit initial lead reporter reward
    if (profile) {
      patchDemoProfile({
        wallet_balance_inr: +(profile.wallet_balance_inr + 320).toFixed(2),
        journalist_earnings_inr: +((profile.journalist_earnings_inr ?? 0) + 320).toFixed(2),
      });
    }

    setArticles([newArticle, ...articles]);
    setFileDispatchOpen(false);

    setBannerNotice({
      title: 'Fresh News Dispatch Published!',
      desc: '10-Minute Multi-Reporter Consensus Buffer is now active. Peer journalists can submit corroborating updates without duplicating the card. +3,200 VP initial bounty credited!',
      type: 'buffer',
    });
  };

  // 1-Click finalization of 10-minute consensus buffer
  const handleFinalizeBuffer = (articleId: string) => {
    setArticles((prev) =>
      prev.map((art) => {
        if (art.id !== articleId) return art;
        return {
          ...art,
          ingestionStatus: 'published',
          bufferExpiresAt: undefined,
          credibilityScore: Math.min(99, art.credibilityScore + 5),
          keyTakeaways: [
            '10-Minute multi-reporter consensus verified and closed',
            ...(art.keyTakeaways ?? []),
          ],
        };
      }),
    );
    setBannerNotice({
      title: '10-Minute Consensus Finalized!',
      desc: 'Multi-reporter synthesis complete. Dispatches consolidated under 60 words and points locked.',
      type: 'success',
    });
  };

  const copyArticleLink = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`https://veripulse.in/news/${id}`).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  };

  const getCategoryIcon = (catId: NewsCategory) => {
    switch (catId) {
      case 'politics':
        return <Landmark size={15} />;
      case 'business':
        return <TrendingUp size={15} />;
      case 'tech':
        return <Cpu size={15} />;
      case 'health':
        return <HeartPulse size={15} />;
      case 'entertainment':
        return <Trophy size={15} />;
      default:
        return <Newspaper size={15} />;
    }
  };

  const currentCategoryMeta = NEWS_CATEGORIES.find((c) => c.id === selectedCategory);

  const getCategoryName = (catId: string, defaultName: string) => {
    const map: Record<string, Record<Lang, string>> = {
      politics: { en: 'Politics', bn: 'রাজনীতি', hi: 'राजनीति' },
      business: { en: 'Business', bn: 'ব্যবসা ও বাজার', hi: 'व्यापार व बाजार' },
      tech: { en: 'Technology', bn: 'প্রযুক্তি ও উদ্ভাবন', hi: 'तकनीक व नवाचार' },
      health: { en: 'Health & Science', bn: 'স্বাস্থ্য ও বিজ্ঞান', hi: 'स्वास्थ्य और विज्ञान' },
      entertainment: { en: 'Culture & Sports', bn: 'সংস্কৃতি ও খেলাধুলা', hi: 'संस्कृति और खेल' },
      all: { en: 'All Categories', bn: 'সমস্ত বিভাগ', hi: 'सभी श्रेणियां' },
    };
    return map[catId]?.[lang] ?? defaultName;
  };

  // ── Inline full-page views (replacing modals) ──

  if (pressPassModalOpen) {
    return (
      <PressPassVerificationPage
        onBack={() => setPressPassModalOpen(false)}
        onAccredit={() => {
          if (profile) {
            patchDemoProfile({
              is_journalist_verified: true,
              is_press_pass_paid: true,
              press_credential_id: 'PIB-PRESS-2026-9812',
              press_pass_expiry: '2027-12-31',
              badge: 'PIB Accredited Correspondent',
            });
          }
          setPressPassModalOpen(false);
          setFileDispatchOpen(true);
        }}
      />
    );
  }

  if (fileDispatchOpen) {
    return (
      <FileDispatchPage
        onBack={() => setFileDispatchOpen(false)}
        onSubmit={handleDispatchSubmit}
        reporterName={profile?.full_name ?? profile?.username ?? 'Journalist'}
        pressCredentialId={profile?.press_credential_id ?? 'PIB-PRESS-2026-9812'}
      />
    );
  }

  if (drillDownArticle) {
    return (
      <NewsDrillDownPage
        article={drillDownArticle}
        lang={lang}
        userVote={userVotes[drillDownArticle.id]}
        onVote={(v) => handleVote(drillDownArticle.id, v)}
        onBack={() => setDrillDownArticle(null)}
        onCopyLink={() => copyArticleLink(drillDownArticle.id)}
        copied={copiedId === drillDownArticle.id}
        getCategoryIcon={getCategoryIcon}
        initialTab={drillDownInitialTab}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Banner Notice (Deduplication / Consensus Alert) ── */}
      {bannerNotice && (
        <div
          className={cn(
            'flex items-start justify-between gap-3 rounded-card p-3.5 text-xs animate-slide-up shadow-md border',
            bannerNotice.type === 'merge'
              ? 'border-brand-sky/40 bg-brand-sky/10 text-content-primary'
              : bannerNotice.type === 'buffer'
              ? 'border-brand-amber/40 bg-brand-amber/10 text-content-primary'
              : 'border-brand-emerald/40 bg-brand-emerald/10 text-content-primary',
          )}
        >
          <div className="flex items-start gap-2.5">
            {bannerNotice.type === 'merge' ? (
              <CheckCheck size={18} className="text-brand-sky shrink-0 mt-0.5" />
            ) : bannerNotice.type === 'buffer' ? (
              <Timer size={18} className="text-brand-amber shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 size={18} className="text-brand-emerald shrink-0 mt-0.5" />
            )}
            <div>
              <div className="font-bold">{bannerNotice.title}</div>
              <div className="text-content-secondary mt-0.5">{bannerNotice.desc}</div>
            </div>
          </div>
          <button onClick={() => setBannerNotice(null)} className="text-content-muted hover:text-content-primary">
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Compact Sticky Filter Bar ──
          Replaces the old Reporter Action Bar + big category grid + tag
          strip + wide search row. Each filter is now a chip-shaped
          dropdown; search is icon-only until expanded. The whole bar is
          sticky so filters stay reachable while the article feed scrolls. */}
      <StickyFilterBar
        lang={lang}
        profile={profile}
        selectedCategory={selectedCategory}
        setSelectedCategory={(c) => {
          setSelectedCategory(c);
          setSelectedTag(null);
        }}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        allTags={currentCategoryMeta ? currentCategoryMeta.popularTags : allTags}
        sortBy={sortBy}
        setSortBy={setSortBy}
        c2paOnly={c2paOnly}
        setC2paOnly={setC2paOnly}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        filteredCount={filteredArticles.length}
        isSyncing={isSyncing}
        getCategoryIcon={getCategoryIcon}
        getCategoryName={getCategoryName}
      />


      {/* ── Articles Feed ── */}
      <div className="space-y-4">
        {filteredArticles.map((article) => {
          const summaryText = article.summaries[lang] ?? article.summaries.en;
          const titleText = article.titles[lang] ?? article.titles.en;
          const currentVote = userVotes[article.id];
          const totalVotes = (article.realVotes ?? 100) + (article.hoaxVotes ?? 5) + (article.contextVotes ?? 10);
          const realPercent = Math.round(((article.realVotes ?? 100) / totalVotes) * 100);
          const isBufferActive = article.ingestionStatus === 'buffer_active';

          return (
            <Card
              key={article.id}
              onClick={() => {
                setDrillDownArticle(article);
                setDrillDownInitialTab('analysis');
              }}
              className="cursor-pointer overflow-hidden border-[var(--border-subtle)] bg-bg-surface transition-all hover:border-[var(--border-strong)] hover:shadow-md"
            >
              {/* 10-Minute Buffer Notice Strip (if breaking news is aggregating) */}
              {isBufferActive && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-between border-b border-brand-amber/30 bg-brand-amber/10 px-4 py-2 text-xs text-content-primary"
                >
                  <div className="flex items-center gap-2">
                    <Timer size={14} className="text-brand-amber animate-spin" />
                    <span className="font-semibold">
                      10-Minute Reporter Consensus Buffer Active:
                    </span>
                    <span className="text-content-secondary hidden sm:inline">
                      Waiting for corroborating dispatches before locking summary...
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => handleFinalizeBuffer(article.id)}
                    className="px-2.5 py-1 text-[11px] font-bold border-brand-amber/40 hover:bg-brand-amber/20"
                  >
                    Finalize 60-Word Consensus
                  </Button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row p-4 gap-4">
                {/* ── Left Column: Squarish Photo & Reporter Badge ── */}
                <div className="flex flex-col gap-2 shrink-0 sm:w-48">
                  {/* Squarish 1:1 Photo — verified media, else subject-related image, else category stock */}
                  <ArticleImage article={article} titleText={titleText} size="card" />

                  {/* ── Reporter's Badge Strip Directly Below the Photo ── */}
                  {article.leadReporter && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setDrillDownArticle(article);
                        setDrillDownInitialTab('dispatches');
                      }}
                      className="rounded-card border border-[var(--border-subtle)] bg-bg-primary/80 p-2.5 transition-colors hover:border-brand-emerald/40"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-brand-emerald/60">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={article.leadReporter.reporterAvatar}
                            alt={article.leadReporter.reporterName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1 truncate">
                          <div className="flex items-center gap-1 truncate text-[11px] font-bold text-content-primary">
                            <span className="truncate">{article.leadReporter.reporterName}</span>
                            <CheckCircle2 size={11} className="text-brand-emerald shrink-0" />
                          </div>
                          <div className="truncate text-[9px] text-content-muted">
                            {article.leadReporter.reporterBadge}
                          </div>
                        </div>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between border-t border-[var(--border-subtle)] pt-1.5 text-[10px]">
                        <span className="flex items-center gap-1 text-content-muted" suppressHydrationWarning>
                          <Clock size={10} /> {timeAgo(article.leadReporter.submittedAt)}
                        </span>
                        <span className="flex items-center gap-0.5 font-mono font-bold text-brand-emerald">
                          <Zap size={10} /> {article.leadReporter.matchScorePercent}% Match
                        </span>
                      </div>

                      {/* Earnings & Impact Pill */}
                      <div className="mt-1 flex items-center justify-between text-[10px]">
                        <span className="font-mono text-content-muted">
                          Impact: <span className="font-bold text-content-primary">{article.impactScore ?? 92}</span>
                        </span>
                        <span className="font-mono font-bold text-brand-amber">
                          Earned: {formatVPCoins(inrToVPCoins(article.leadReporter.earningsInr))}
                        </span>
                      </div>

                      {/* Co-reporters indicator */}
                      {article.contributors && article.contributors.length > 0 && (
                        <div className="mt-1.5 rounded-pill bg-bg-elevated px-2 py-0.5 text-center text-[9px] font-semibold text-brand-sky">
                          +{article.contributors.length} Co-Reporter Dispatches
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Right Column: Content Body & Interactive Voting ── */}
                <div className="flex flex-1 flex-col justify-between space-y-2.5">
                  <div>
                    {/* Top Meta Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-content-muted">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 font-semibold text-brand-emerald">
                          {getCategoryIcon(article.category)} {article.categoryName}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {article.locationName}
                        </span>
                        <span>•</span>
                        <span suppressHydrationWarning>{timeAgo(article.publishedAt)}</span>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-content-muted">Credibility:</span>
                        <span
                          className={cn(
                            'font-bold',
                            article.credibilityScore >= 80 ? 'text-brand-emerald' : 'text-brand-amber',
                          )}
                        >
                          {article.credibilityScore}%
                        </span>
                      </div>
                    </div>

                    {/* Headline Title */}
                    <h3 className="mt-1 text-base font-extrabold text-content-primary group-hover:text-brand-emerald transition-colors leading-snug">
                      {titleText}
                    </h3>

                    {/* 60-Word Story Summary */}
                    <p className="mt-1.5 text-xs text-content-secondary leading-relaxed line-clamp-3">
                      {summaryText}
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {article.tags.map((t) => (
                      <button
                        key={t}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTag(t);
                        }}
                        className="rounded-pill bg-bg-elevated px-2 py-0.5 text-[10px] font-mono text-content-muted hover:bg-brand-emerald/10 hover:text-brand-emerald transition-colors"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>

                  {/* ── Credibility & Live Voting Strip ── */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-card border border-[var(--border-subtle)] bg-bg-primary/50 p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-content-secondary">Consensus:</span>
                        <span className="font-mono font-bold text-brand-emerald">{realPercent}% Verified</span>
                        <span className="text-content-muted font-mono">({totalVotes} votes)</span>
                      </div>
                      <div className="text-[10px] text-content-muted">
                        Impact Pool: {formatVPCoins(inrToVPCoins(article.totalImpactEarningsInr ?? 450))}
                      </div>
                    </div>

                    {/* Consensus Meter Bar */}
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
                      <div
                        className="h-full bg-brand-emerald transition-all duration-300"
                        style={{ width: `${realPercent}%` }}
                      />
                    </div>

                    {/* 3-Way Vote Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                      <button
                        onClick={() => handleVote(article.id, 'real')}
                        className={cn(
                          'flex items-center justify-center gap-1 rounded-button py-1.5 text-[10px] font-semibold transition-all',
                          currentVote === 'real'
                            ? 'bg-brand-emerald text-[#04110b] shadow-sm'
                            : 'border border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
                        )}
                      >
                        <CheckCircle2 size={12} />
                        <span>{t('realVotes', lang)}</span>
                      </button>

                      <button
                        onClick={() => handleVote(article.id, 'needs_context')}
                        className={cn(
                          'flex items-center justify-center gap-1 rounded-button py-1.5 text-[10px] font-semibold transition-all',
                          currentVote === 'needs_context'
                            ? 'bg-brand-amber text-[#04110b] shadow-sm'
                            : 'border border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
                        )}
                      >
                        <HelpCircle size={12} />
                        <span>{lang === 'bn' ? 'প্রসঙ্গ প্রয়োজন' : lang === 'hi' ? 'संदर्भ चाहिए' : 'Context'}</span>
                      </button>

                      <button
                        onClick={() => handleVote(article.id, 'hoax')}
                        className={cn(
                          'flex items-center justify-center gap-1 rounded-button py-1.5 text-[10px] font-semibold transition-all',
                          currentVote === 'hoax'
                            ? 'bg-brand-rose text-white shadow-sm'
                            : 'border border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
                        )}
                      >
                        <AlertTriangle size={12} />
                        <span>{t('hoaxVotes', lang)}</span>
                      </button>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-content-muted">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-content-primary">Source:</span>
                      {article.sourceUrl ? (
                        <a
                          href={article.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 text-brand-emerald hover:underline"
                        >
                          {article.source} <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span>{article.source}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <AudioReadout text={summaryText} lang={lang} />
                      <button
                        onClick={(e) => copyArticleLink(article.id, e)}
                        className="flex items-center gap-1 rounded-button border border-[var(--border-subtle)] bg-bg-surface px-2 py-1 text-content-secondary hover:text-content-primary"
                      >
                        {copiedId === article.id ? <Check size={12} className="text-brand-emerald" /> : <Share2 size={12} />}
                      </button>
                      <span className="flex items-center gap-0.5 text-brand-emerald font-semibold hover:underline">
                        Deep Dive <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        {filteredArticles.length === 0 && (
          <Card className="p-8 text-center border-[var(--border-subtle)] bg-bg-surface text-content-muted text-xs">
            No news stories found matching your filter criteria. Try clearing tags or searching for broader topics.
          </Card>
        )}
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticky Filter Bar — compact chip-dropdowns + icon search toggle
// ─────────────────────────────────────────────────────────────────────────────

interface StickyFilterBarProps {
  lang: Lang;
  profile: ReturnType<typeof useSession>['profile'];
  selectedCategory: NewsCategory | 'all';
  setSelectedCategory: (c: NewsCategory | 'all') => void;
  selectedTag: string | null;
  setSelectedTag: (t: string | null) => void;
  allTags: string[];
  sortBy: 'latest' | 'credibility' | 'fastest';
  setSortBy: (s: 'latest' | 'credibility' | 'fastest') => void;
  c2paOnly: boolean;
  setC2paOnly: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  filteredCount: number;
  isSyncing: boolean;
  getCategoryIcon: (c: NewsCategory) => React.ReactNode;
  getCategoryName: (id: string, def: string) => string;
}

function StickyFilterBar({
  lang,
  profile,
  selectedCategory,
  setSelectedCategory,
  selectedTag,
  setSelectedTag,
  allTags,
  sortBy,
  setSortBy,
  c2paOnly,
  setC2paOnly,
  searchQuery,
  setSearchQuery,
  searchOpen,
  setSearchOpen,
  filteredCount,
  isSyncing,
  getCategoryIcon,
  getCategoryName,
}: StickyFilterBarProps) {
  const [openMenu, setOpenMenu] = useState<null | 'category' | 'tag' | 'sort'>(null);

  // Selected tag → pinned to front of the list, visibly highlighted.
  const orderedTags = useMemo(() => {
    if (!selectedTag) return allTags;
    const rest = allTags.filter((t) => t !== selectedTag);
    return [selectedTag, ...rest];
  }, [allTags, selectedTag]);

  const hasActiveFilter =
    selectedCategory !== 'all' ||
    selectedTag !== null ||
    c2paOnly ||
    searchQuery.trim().length > 0;

  const categoryLabel =
    selectedCategory === 'all'
      ? lang === 'bn'
        ? 'সব বিভাগ'
        : lang === 'hi'
          ? 'सभी'
          : 'All categories'
      : getCategoryName(selectedCategory, selectedCategory);

  const sortLabel: Record<string, string> = {
    latest: lang === 'bn' ? 'সর্বশেষ' : lang === 'hi' ? 'नवीनतम' : 'Latest',
    credibility: lang === 'bn' ? 'নির্ভরযোগ্যতা' : lang === 'hi' ? 'विश्वसनीयता' : 'Credibility',
    fastest: lang === 'bn' ? 'দ্রুত পাঠ' : lang === 'hi' ? 'त्वरित' : 'Quick read',
  };

  function clearAll() {
    setSelectedCategory('all');
    setSelectedTag(null);
    setC2paOnly(false);
    setSearchQuery('');
    setSearchOpen(false);
  }

  return (
    <div className="sticky top-[72px] z-30 -mx-4 border-b border-[var(--border-subtle)] bg-bg-primary/95 backdrop-blur-md lg:top-0">
      <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 no-scrollbar">
        <FilterChip
          active={selectedCategory !== 'all'}
          icon={
            selectedCategory === 'all'
              ? <Newspaper size={13} />
              : getCategoryIcon(selectedCategory as NewsCategory)
          }
          label={categoryLabel}
          onClick={() => setOpenMenu(openMenu === 'category' ? null : 'category')}
          open={openMenu === 'category'}
        />
        <FilterChip
          active={selectedTag !== null}
          icon={<Tag size={12} />}
          label={selectedTag ? `#${selectedTag}` : lang === 'bn' ? 'ট্যাগ' : lang === 'hi' ? 'टैग' : 'Tags'}
          onClick={() => setOpenMenu(openMenu === 'tag' ? null : 'tag')}
          open={openMenu === 'tag'}
        />
        <FilterChip
          icon={<Clock size={12} />}
          label={sortLabel[sortBy] ?? 'Sort'}
          onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
          open={openMenu === 'sort'}
        />
        <button
          onClick={() => setC2paOnly(!c2paOnly)}
          aria-pressed={c2paOnly}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition',
            c2paOnly
              ? 'border-brand-emerald bg-brand-emerald text-[#04110b]'
              : 'border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
          )}
        >
          <ShieldCheck size={12} /> C2PA
        </button>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          aria-label="Toggle search"
          aria-pressed={searchOpen || searchQuery.length > 0}
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition',
            searchOpen || searchQuery.length > 0
              ? 'border-brand-sky bg-brand-sky/15 text-brand-sky'
              : 'border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
          )}
        >
          <Search size={12} /> {searchQuery.length > 0 ? 'On' : ''}
        </button>

        {hasActiveFilter && (
          <button
            onClick={clearAll}
            className="ml-auto shrink-0 whitespace-nowrap rounded-pill px-2 py-1 text-[11px] font-semibold text-brand-rose hover:underline"
          >
            Clear
          </button>
        )}

        <span className="ml-auto hidden shrink-0 items-center gap-2 whitespace-nowrap text-[10px] text-content-muted sm:inline-flex">
          {isSyncing && (
            <span className="inline-flex items-center gap-1 font-mono text-brand-emerald animate-pulse">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-emerald animate-ping" />
              syncing
            </span>
          )}
          <span>{filteredCount} reports</span>
          {profile?.is_journalist_verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-emerald/15 px-1.5 py-0.5 font-semibold text-brand-emerald">
              <Award size={10} /> Press
            </span>
          )}
        </span>
      </div>

      {/* Expanded search */}
      {searchOpen && (
        <div className="px-4 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'শিরোনাম, ট্যাগ বা উৎস খুঁজুন…'
                  : lang === 'hi'
                    ? 'शीर्षक, टैग या स्रोत खोजें…'
                    : 'Search headlines, tags, sources…'
              }
              className="w-full rounded-pill border border-[var(--border-subtle)] bg-bg-surface py-1.5 pl-8 pr-8 text-xs text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expanded category dropdown */}
      {openMenu === 'category' && (
        <DropdownPanel onClose={() => setOpenMenu(null)}>
          <DropdownRow
            selected={selectedCategory === 'all'}
            onClick={() => {
              setSelectedCategory('all');
              setOpenMenu(null);
            }}
            icon={<Newspaper size={13} className="text-brand-emerald" />}
            label={lang === 'bn' ? 'সব বিভাগ' : lang === 'hi' ? 'सभी श्रेणियां' : 'All categories'}
          />
          {NEWS_CATEGORIES.map((cat) => (
            <DropdownRow
              key={cat.id}
              selected={selectedCategory === cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setOpenMenu(null);
              }}
              icon={<span className="text-brand-emerald">{getCategoryIcon(cat.id)}</span>}
              label={getCategoryName(cat.id, cat.name)}
              sub={cat.description}
            />
          ))}
        </DropdownPanel>
      )}

      {/* Expanded tag dropdown — selected tag pinned to the top. */}
      {openMenu === 'tag' && (
        <DropdownPanel onClose={() => setOpenMenu(null)}>
          <div className="flex flex-wrap gap-1 p-2">
            <button
              onClick={() => {
                setSelectedTag(null);
                setOpenMenu(null);
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-semibold transition',
                selectedTag === null
                  ? 'bg-brand-emerald text-[#04110b] ring-2 ring-brand-emerald/40'
                  : 'border border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
              )}
            >
              {selectedTag === null && <Check size={11} strokeWidth={3} />}
              #AllTags
            </button>
            {orderedTags.map((tag) => {
              const isActive = selectedTag === tag;
              return (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTag(isActive ? null : tag);
                    setOpenMenu(null);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[11px] font-semibold transition',
                    isActive
                      ? 'bg-brand-emerald text-[#04110b] ring-2 ring-brand-emerald/40 shadow-sm scale-[1.03]'
                      : 'border border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:border-brand-emerald/50 hover:text-content-primary',
                  )}
                >
                  {isActive && <Check size={11} strokeWidth={3} />}
                  #{tag}
                </button>
              );
            })}
          </div>
        </DropdownPanel>
      )}

      {/* Expanded sort dropdown */}
      {openMenu === 'sort' && (
        <DropdownPanel onClose={() => setOpenMenu(null)}>
          {(['latest', 'credibility', 'fastest'] as const).map((opt) => (
            <DropdownRow
              key={opt}
              selected={sortBy === opt}
              onClick={() => {
                setSortBy(opt);
                setOpenMenu(null);
              }}
              icon={
                opt === 'latest' ? (
                  <Clock size={12} className="text-brand-sky" />
                ) : opt === 'credibility' ? (
                  <ShieldCheck size={12} className="text-brand-emerald" />
                ) : (
                  <Zap size={12} className="text-brand-amber" />
                )
              }
              label={sortLabel[opt]}
            />
          ))}
        </DropdownPanel>
      )}
    </div>
  );
}

function FilterChip({
  icon,
  label,
  onClick,
  open,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  open?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition',
        active
          ? 'border-brand-emerald bg-brand-emerald text-[#04110b] shadow-sm'
          : open
            ? 'border-brand-emerald bg-[var(--brand-emerald-glow)] text-content-primary'
            : 'border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
      )}
    >
      {icon}
      <span className="max-w-[9rem] truncate">{label}</span>
      <ChevronDown size={11} className={cn('transition-transform', open && 'rotate-180')} />
    </button>
  );
}

function DropdownPanel({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="animate-fade-in max-h-80 overflow-y-auto border-t border-[var(--border-subtle)] bg-bg-elevated"
    >
      {children}
    </div>
  );
}

function DropdownRow({
  icon,
  label,
  sub,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-selected={selected}
      className={cn(
        'flex w-full items-center gap-2 px-4 py-2 text-left text-[12px] transition',
        selected
          ? 'bg-[var(--brand-emerald-glow)] text-content-primary'
          : 'text-content-secondary hover:bg-bg-primary hover:text-content-primary',
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-button bg-bg-primary">
        {icon}
      </span>
      <span className="flex-1 truncate">
        <span className="font-semibold">{label}</span>
        {sub && <span className="ml-2 text-[10px] text-content-muted">{sub}</span>}
      </span>
      {selected && <Check size={12} className="text-brand-emerald" />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal 1: Post News Dispatch Modal
// ─────────────────────────────────────────────────────────────────────────────

function FileDispatchPage({
  onBack,
  onSubmit,
  reporterName,
  pressCredentialId,
}: {
  onBack: () => void;
  onSubmit: (data: {
    title: string;
    text: string;
    category: NewsCategory;
    tags: string[];
    location: string;
    mediaUrl?: string;
  }) => void;
  reporterName: string;
  pressCredentialId: string;
}) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [category, setCategory] = useState<NewsCategory>('politics');
  const [tagInput, setTagInput] = useState('');
  const [location, setLocation] = useState('New Delhi, DL');
  const [mediaUrl, setMediaUrl] = useState('');

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) return;

    const tags = tagInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    onSubmit({
      title: title.trim(),
      text: text.trim(),
      category,
      tags: tags.length > 0 ? tags : ['VerifiedNews', 'Breaking'],
      location: location.trim() || 'India',
      mediaUrl: mediaUrl.trim() || undefined,
    });
  };

  return (
    <div className="space-y-5 section-enter">
      <button
        onClick={onBack}
        className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
      >
        <ArrowLeft size={18} /> Back to News Hub
      </button>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--glass-border)] p-4">
          <PenSquare size={17} className="text-brand-emerald" />
          <h2 className="text-base font-extrabold text-content-primary">File News Dispatch</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between rounded-card border border-brand-emerald/30 bg-[var(--brand-emerald-glow)] p-3">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-brand-emerald" />
              <div>
                <span className="font-bold text-content-primary">{reporterName}</span>
                <span className="text-content-muted"> · {pressCredentialId}</span>
              </div>
            </div>
            <span className="rounded-pill bg-brand-emerald px-2 py-0.5 text-[10px] font-bold text-[#04110b]">
              Verified Journalist
            </span>
          </div>

          <div>
            <label className="font-bold text-content-secondary">News Headline</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. ECI initiates remote voting pilot for domestic migrant workers"
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-content-secondary">Category</label>
              <CustomSelect<NewsCategory>
                value={category}
                onChange={setCategory}
                variant="card"
                size="md"
                align="left"
                className="mt-1 w-full"
                buttonClassName="w-full justify-between"
                options={[
                  { value: 'politics', label: 'Politics & Government' },
                  { value: 'business', label: 'Business & Economy' },
                  { value: 'tech', label: 'Science & Technology' },
                  { value: 'health', label: 'Health & Environment' },
                  { value: 'entertainment', label: 'Sports & Entertainment' },
                ]}
              />
            </div>

            <div>
              <label className="font-bold text-content-secondary">Location</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. New Delhi, DL"
                className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="font-bold text-content-secondary">Full Dispatch Text</label>
              <span
                className={cn(
                  'font-mono text-[10px]',
                  wordCount > 60 ? 'text-brand-amber' : 'text-brand-emerald',
                )}
              >
                {wordCount} words {wordCount > 60 && '(Will be synthesized to ≤ 60 words)'}
              </span>
            </div>
            <textarea
              rows={5}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter verified facts, observer statements, and on-the-ground technical metrics..."
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-content-secondary">Topic Tags (comma separated)</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Elections2026, ECI, PolicyReform"
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-content-secondary">Photo URL / C2PA Evidence URL (Optional)</label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://images.unsplash.com/photo-..."
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-primary px-3 py-2 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
            />
          </div>

          <div className="rounded-card border border-[var(--border-subtle)] bg-bg-primary p-3 text-[11px] text-content-secondary space-y-1">
            <div className="font-bold text-brand-emerald flex items-center gap-1">
              <Sparkles size={13} /> Automatic Ingestion & Deduplication Rules:
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-content-muted">
              <li>If another reporter submitted related news on this event, it will merge into the existing timeline without creating a duplicate card.</li>
              <li>A 10-minute multi-reporter consensus buffer activates to synthesize the most detailed 60-word summary.</li>
              <li>You earn impact rewards based on how closely your dispatch matches the final facts.</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <Button variant="ghost" type="button" onClick={onBack} className="px-3 py-1.5 text-xs">
              Cancel
            </Button>
            <Button variant="solid" type="submit" className="px-4 py-1.5 text-xs font-bold">
              Publish Dispatch
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal 2: Press Pass Verification Modal (Rules Enforcement)
// ─────────────────────────────────────────────────────────────────────────────

function PressPassVerificationPage({
  onBack,
  onAccredit,
}: {
  onBack: () => void;
  onAccredit: () => void;
}) {
  return (
    <div className="space-y-5 section-enter">
      <button
        onClick={onBack}
        className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
      >
        <ArrowLeft size={18} /> Back to News Hub
      </button>

      <Card className="max-w-lg space-y-5 p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-emerald text-[#04110b]">
            <Award size={22} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-content-primary">Verified Journalist Account Required</h2>
            <p className="text-[11px] text-content-muted">VeriPulse News Syndicate Access</p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs text-content-secondary leading-relaxed bg-bg-primary p-3.5 rounded-card border border-[var(--border-subtle)]">
          <p className="font-semibold text-content-primary">
            To prevent spam, hoaxes, and clickbait, news dispatches can only be filed by verified journalists with an active Press Pass.
          </p>
          <div className="space-y-1.5 pt-1 text-[11px]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-brand-emerald shrink-0" />
              <span>PIB, RNI, or International Press ID verification</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-brand-emerald shrink-0" />
              <span>10-Minute multi-reporter consensus review window</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={13} className="text-brand-emerald shrink-0" />
              <span>Direct UPI earnings from story impact & reader consensus</span>
            </div>
          </div>
        </div>

        <div className="rounded-button bg-[var(--brand-emerald-glow)] p-3 text-xs text-content-primary flex items-center justify-between">
          <div>
            <div className="font-bold">VeriPulse Press Pass</div>
            <div className="text-[10px] text-content-muted">₹199 / month (Free Demo Pass available)</div>
          </div>
          <span className="font-mono font-bold text-brand-emerald text-sm">₹0 for Demo</span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onBack} className="px-3 py-1.5 text-xs">
            Cancel
          </Button>
          <Button variant="solid" onClick={onAccredit} className="px-4 py-1.5 text-xs font-bold">
            Accredit & Activate Press Pass
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal 3: In-Depth Drill-Down Modal
// ─────────────────────────────────────────────────────────────────────────────

function NewsDrillDownPage({
  article,
  lang,
  userVote,
  onVote,
  onBack,
  onCopyLink,
  copied,
  getCategoryIcon,
  initialTab = 'analysis',
}: {
  article: NewsArticle;
  lang: Lang;
  userVote?: ConsensusVote;
  onVote: (v: ConsensusVote) => void;
  onBack: () => void;
  onCopyLink: () => void;
  copied: boolean;
  getCategoryIcon: (cat: NewsCategory) => React.ReactNode;
  initialTab?: 'analysis' | 'timeline' | 'c2pa' | 'community' | 'dispatches';
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const summaryText = article.summaries[lang] ?? article.summaries.en;
  const titleText = article.titles[lang] ?? article.titles.en;
  const totalVotes = (article.realVotes ?? 100) + (article.hoaxVotes ?? 5) + (article.contextVotes ?? 10);
  const realPercent = Math.round(((article.realVotes ?? 100) / totalVotes) * 100);

  const allDispatches = [
    ...(article.leadReporter ? [article.leadReporter] : []),
    ...(article.contributors ?? []),
  ];

  return (
    <div className="space-y-5 section-enter">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} /> Back to News Hub
        </button>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-semibold text-brand-emerald text-xs">
            {getCategoryIcon(article.category)} {article.categoryName}
          </span>
          <button
            onClick={onCopyLink}
            className="press-effect flex items-center gap-1 rounded-button border border-[var(--border-subtle)] glass px-2.5 py-1 text-xs text-content-secondary hover:text-content-primary"
          >
            {copied ? <Check size={13} className="text-brand-emerald" /> : <Share2 size={13} />}
            <span>{copied ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </div>

        <div className="space-y-5">
          {/* Main Visual & Title Header */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <ArticleImage article={article} titleText={titleText} size="detail" />

            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between text-xs text-content-muted">
                <span>Published {timeAgo(article.publishedAt)}</span>
                <span className="font-mono text-brand-emerald font-bold">{article.credibilityScore}% Credibility</span>
              </div>

              <h2 className="text-lg sm:text-xl font-extrabold text-content-primary leading-tight">
                {titleText}
              </h2>

              <p className="text-xs text-content-secondary leading-relaxed bg-bg-primary/60 p-3 rounded-card border border-[var(--border-subtle)]">
                {summaryText}
              </p>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs text-content-muted">
                  <span>Source:</span>
                  {article.sourceUrl ? (
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-brand-emerald hover:underline font-medium"
                    >
                      {article.source} <ExternalLink size={11} />
                    </a>
                  ) : (
                    <span>{article.source}</span>
                  )}
                </div>
                <AudioReadout text={summaryText} lang={lang} />
              </div>
            </div>
          </div>

          {/* ── Consensus Voting Center ── */}
          <Card className="border-[var(--border-subtle)] bg-bg-primary p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-content-primary">
                  Citizen Consensus Verification
                </h4>
                <p className="text-[11px] text-content-muted">
                  Cast your vote to shape the article&apos;s cryptographic trust index on VeriPulse.
                </p>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs font-bold text-brand-emerald">{realPercent}% Real</div>
                <div className="text-[10px] text-content-muted">{totalVotes} consensus votes</div>
              </div>
            </div>

            {/* Meter Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full bg-brand-emerald transition-all duration-300"
                style={{ width: `${realPercent}%` }}
              />
            </div>

            {/* Voting Options */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => onVote('real')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-button py-2 text-xs font-bold transition-all',
                  userVote === 'real'
                    ? 'bg-brand-emerald text-[#04110b] shadow-md'
                    : 'border border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
                )}
              >
                <CheckCircle2 size={14} />
                <span>Verify Real ({article.realVotes ?? 100})</span>
              </button>

              <button
                onClick={() => onVote('needs_context')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-button py-2 text-xs font-bold transition-all',
                  userVote === 'needs_context'
                    ? 'bg-brand-amber text-[#04110b] shadow-md'
                    : 'border border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
                )}
              >
                <HelpCircle size={14} />
                <span>Needs Context ({article.contextVotes ?? 10})</span>
              </button>

              <button
                onClick={() => onVote('hoax')}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-button py-2 text-xs font-bold transition-all',
                  userVote === 'hoax'
                    ? 'bg-brand-rose text-white shadow-md'
                    : 'border border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary',
                )}
              >
                <AlertTriangle size={14} />
                <span>Flag Hoax ({article.hoaxVotes ?? 5})</span>
              </button>
            </div>
          </Card>

          {/* ── Sub-Tabs for Drill-Down Details ── */}
          <div className="flex items-center gap-1.5 border-b border-[var(--border-subtle)] pb-2 text-xs overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('analysis')}
              className={cn(
                'rounded-button px-3 py-1.5 font-bold transition-colors shrink-0',
                activeTab === 'analysis'
                  ? 'bg-bg-elevated text-brand-emerald'
                  : 'text-content-secondary hover:text-content-primary',
              )}
            >
              Detailed Analysis
            </button>
            <button
              onClick={() => setActiveTab('dispatches')}
              className={cn(
                'rounded-button px-3 py-1.5 font-bold transition-colors shrink-0 flex items-center gap-1',
                activeTab === 'dispatches'
                  ? 'bg-bg-elevated text-brand-emerald'
                  : 'text-content-secondary hover:text-content-primary',
              )}
            >
              <Users size={12} /> Reporters & Dispatches ({allDispatches.length})
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={cn(
                'rounded-button px-3 py-1.5 font-bold transition-colors shrink-0',
                activeTab === 'timeline'
                  ? 'bg-bg-elevated text-brand-emerald'
                  : 'text-content-secondary hover:text-content-primary',
              )}
            >
              Timeline & Events ({article.timeline?.length ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('c2pa')}
              className={cn(
                'rounded-button px-3 py-1.5 font-bold transition-colors shrink-0',
                activeTab === 'c2pa'
                  ? 'bg-bg-elevated text-brand-emerald'
                  : 'text-content-secondary hover:text-content-primary',
              )}
            >
              C2PA Provenance
            </button>
            <button
              onClick={() => setActiveTab('community')}
              className={cn(
                'rounded-button px-3 py-1.5 font-bold transition-colors shrink-0',
                activeTab === 'community'
                  ? 'bg-bg-elevated text-brand-emerald'
                  : 'text-content-secondary hover:text-content-primary',
              )}
            >
              Citizen Notes ({article.communityNotes?.length ?? 0})
            </button>
          </div>

          {/* Tab 1: Detailed Analysis */}
          {activeTab === 'analysis' && (
            <div className="space-y-4 animate-fade-in text-xs leading-relaxed text-content-secondary">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-content-primary mb-1.5">
                  In-Depth Context & Investigation
                </h4>
                <p className="bg-bg-surface p-3.5 rounded-card border border-[var(--border-subtle)] text-content-primary">
                  {article.detailedAnalysis ?? summaryText}
                </p>
              </div>

              {article.keyTakeaways && article.keyTakeaways.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-content-primary mb-2">
                    Verified Key Takeaways
                  </h4>
                  <div className="space-y-2">
                    {article.keyTakeaways.map((takeaway, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 rounded-card border border-[var(--border-subtle)] bg-bg-primary p-3"
                      >
                        <CheckCircle2 size={15} className="mt-0.5 text-brand-emerald shrink-0" />
                        <span className="text-content-primary">{takeaway}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Reporters & Contributing Dispatches */}
          {activeTab === 'dispatches' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-content-primary">
                    Contributing Dispatches & Match Analysis
                  </h4>
                  <p className="text-[11px] text-content-muted">
                    Reporters whose dispatches have the highest match with the 60-word consensus summary get the most points and revenue share.
                  </p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-brand-amber font-bold">Pool: {formatVPCoins(inrToVPCoins(article.totalImpactEarningsInr ?? 450))}</div>
                  <div className="text-[10px] text-content-muted">Impact Score: {article.impactScore ?? 92}/100</div>
                </div>
              </div>

              <div className="space-y-3">
                {allDispatches.map((dispatch) => (
                  <Card
                    key={dispatch.id}
                    className="border-[var(--border-subtle)] bg-bg-primary p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={dispatch.reporterAvatar}
                          alt={dispatch.reporterName}
                          className="h-9 w-9 rounded-full object-cover border border-brand-emerald"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-content-primary text-xs">{dispatch.reporterName}</span>
                            <span className="rounded-pill bg-[var(--brand-emerald-glow)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-brand-emerald">
                              {dispatch.status === 'lead' ? 'Lead Reporter' : 'Corroborating'}
                            </span>
                          </div>
                          <div className="text-[10px] text-content-muted">
                            {dispatch.reporterBadge} · {dispatch.pressIdNumber || 'PRESS-PASS-2026'} · {dispatch.location}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-brand-amber text-sm">
                          +{formatVPCoins(inrToVPCoins(dispatch.earningsInr))}
                        </div>
                        <div className="text-[10px] text-content-muted">
                          {dispatch.matchScorePercent}% Match Score
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar of Match Score */}
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[10px] text-content-muted">
                        <span>Factual Accuracy & Content Match</span>
                        <span className="font-mono font-bold text-content-primary">{dispatch.matchScorePercent}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
                        <div
                          className="h-full bg-brand-emerald"
                          style={{ width: `${dispatch.matchScorePercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Original Submitted Draft */}
                    <div className="rounded-card bg-bg-surface p-3 border border-[var(--border-subtle)] space-y-1">
                      <div className="text-[10px] font-bold text-content-muted uppercase">Original Draft Submitted:</div>
                      <p className="text-content-secondary leading-relaxed">{dispatch.originalDraft}</p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-content-muted border-t border-[var(--border-subtle)] pt-2">
                      <span>Filed {timeAgo(dispatch.submittedAt)}</span>
                      <span className="font-mono">Hash: {dispatch.c2paProofHash || 'c2pa:verified'}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Chronological Timeline */}
          {activeTab === 'timeline' && (
            <div className="space-y-3 animate-fade-in">
              <h4 className="text-xs font-bold uppercase tracking-wider text-content-primary">
                Chronological Development Timeline
              </h4>
              <ol className="relative ml-2 space-y-4 border-l border-[var(--border-strong)] pl-4 text-xs">
                {article.timeline && article.timeline.length > 0 ? (
                  article.timeline.map((item, idx) => (
                    <li key={idx} className="relative">
                      <span className="absolute -left-[21px] mt-1 h-2.5 w-2.5 rounded-full bg-brand-emerald ring-4 ring-bg-surface" />
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-brand-emerald">{item.time}</span>
                        <span className="rounded-pill bg-bg-elevated px-2 py-0.5 text-[9px] text-content-muted">
                          Verified by {item.verifiedBy}
                        </span>
                      </div>
                      <p className="mt-1 text-content-primary">{item.event}</p>
                    </li>
                  ))
                ) : (
                  <li className="text-xs text-content-muted">No timeline updates recorded yet.</li>
                )}
              </ol>
            </div>
          )}

          {/* Tab 4: C2PA Provenance */}
          {activeTab === 'c2pa' && (
            <div className="space-y-3 animate-fade-in text-xs">
              <div className="flex items-center gap-2 text-brand-emerald">
                <FileCheck size={18} />
                <h4 className="font-bold text-sm text-content-primary">
                  C2PA Cryptographic Content Credentials
                </h4>
              </div>
              <p className="text-content-muted">
                This news media item was cryptographically signed at point-of-capture to ensure zero
                tampering, synthetic modification, or deepfake alteration.
              </p>

              {article.c2paMetadata ? (
                <div className="space-y-2 rounded-card border border-[var(--border-subtle)] bg-bg-primary p-3.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                    <span className="text-content-muted">Issuer Authority:</span>
                    <span className="text-content-primary font-bold">{article.c2paMetadata.issuer}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2">
                    <span className="text-content-muted">Signing Algorithm:</span>
                    <span className="text-content-primary">{article.c2paMetadata.algorithm}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] py-2">
                    <span className="text-content-muted">Hardware Device:</span>
                    <span className="text-content-primary">{article.c2paMetadata.captureDevice}</span>
                  </div>
                  <div className="flex flex-col gap-1 border-b border-[var(--border-subtle)] py-2">
                    <span className="text-content-muted">Signature Hash:</span>
                    <span className="text-brand-emerald break-all text-[10px]">{article.c2paMetadata.signatureHash}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-content-muted">Tamper Status:</span>
                    <span className="text-brand-emerald font-bold flex items-center gap-1">
                      <CheckCircle2 size={13} /> {article.c2paMetadata.tamperProofStatus}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-content-muted">No raw cryptographic envelope attached.</div>
              )}
            </div>
          )}

          {/* Tab 5: Citizen Community Notes */}
          {activeTab === 'community' && (
            <div className="space-y-3 animate-fade-in text-xs">
              <h4 className="text-xs font-bold uppercase tracking-wider text-content-primary">
                On-The-Ground Citizen & Sentinel Observations
              </h4>
              <div className="space-y-2">
                {article.communityNotes && article.communityNotes.length > 0 ? (
                  article.communityNotes.map((note, idx) => (
                    <div
                      key={idx}
                      className="rounded-card border border-[var(--border-subtle)] bg-bg-primary p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-content-primary">{note.author}</span>
                          <span className="rounded-pill bg-[var(--brand-emerald-glow)] px-1.5 py-0.5 text-[9px] font-bold text-brand-emerald">
                            {note.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-content-muted">{note.timestamp}</span>
                      </div>
                      <p className="text-content-secondary leading-relaxed">{note.comment}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-content-muted">No citizen notes submitted yet.</div>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
