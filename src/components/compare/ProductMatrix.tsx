'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  SlidersHorizontal,
  Camera,
  Battery,
  Cpu,
  Smartphone,
  Volume2,
  Star,
  BadgeCheck,
  Check,
  Plus,
  X,
  ExternalLink,
  Car,
  Bike,
  Laptop,
  ChevronRight,
  Sparkles,
  Scale,
  RotateCcw,
  ShieldCheck,
  Flame,
  MessageSquare,
  Bell,
  ArrowUpDown,
  IndianRupee,
  ChevronDown,
  Image as ImageIcon,
  Clock,
  Wrench,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Award,
  Info,
  Fuel,
  PiggyBank,
  Percent,
  History,
  Layers,
  ThumbsUp,
  ArrowLeft,
} from 'lucide-react';
import { Card, Badge, Button, CustomSelect } from '@/components/ui/primitives';
import { DEMO_PRODUCTS, DEMO_HEAD_TO_HEAD_BATTLES, isSupabaseConfigured } from '@/lib/demoData';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { apiUrl } from '@/lib/api';
import { formatINR, cn } from '@/lib/utils';
import type { Product, ProductReview, ProductCategory, ProductMetricScores, HeadToHeadBattle, Lang } from '@/lib/types';
import { useSession } from '@/hooks/useSession';
import { useLang } from '@/hooks/useLang';
import { t } from '@/lib/translations';
import { DecayIndex } from '@/components/product/DecayIndex';
import { AskOwner } from '@/components/product/AskOwner';
import { ServiceRadar } from '@/components/product/ServiceRadar';
import { AICopilot } from '@/components/product/AICopilot';
import { useRelatedImage } from '@/hooks/useRelatedImage';
import { useListboxKeys } from '@/hooks/useListboxKeys';
import { onRefresh } from '@/lib/refreshBus';

/** Hero image for a product card. Uses the submitted `imageUrl` if present,
 *  otherwise fetches a related image from Wikipedia using the product name as
 *  the query, with a solid category tile as the last-resort fallback. The
 *  card's key details (brand, name, rating, option tags) are drawn as
 *  overlays on top of the image, with a "Reference Image" disclaimer when the
 *  photo wasn't supplied by the owner. */
function ProductCardImage({
  product,
  onOpen,
}: {
  product: Product;
  onOpen: () => void;
}) {
  const hasOwnImage = Boolean(product.imageUrl);
  const query = `${product.brand ?? ''} ${product.name}`.trim();
  const related = useRelatedImage(query, !hasOwnImage);
  const src = product.imageUrl ?? related ?? null;

  return (
    <div
      onClick={onOpen}
      className="relative mb-3 h-40 w-full cursor-pointer overflow-hidden rounded-card border border-[var(--border-subtle)] bg-gradient-to-br from-bg-elevated via-bg-surface to-bg-elevated"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-content-muted">
          {product.category}
        </div>
      )}

      {/* Dark gradient so overlay text stays legible on any photo */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/50" />

      {/* Top-left: brand chip. Top-right: rating badge. */}
      <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between">
        <span className="rounded-pill bg-black/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
          {product.brand ?? product.category}
        </span>
        {product.owner_rating != null && (
          <span className="inline-flex items-center gap-1 rounded-pill bg-black/70 px-2 py-0.5 text-[11px] font-black text-white ring-1 ring-brand-amber/60 backdrop-blur-sm">
            <Star size={11} className="fill-brand-amber text-brand-amber" />
            {product.owner_rating.toFixed(1)}
          </span>
        )}
      </div>

      {/* Bottom overlay: product name, options, verified-owner count.
          Every chip gets an opaque dark backdrop so the text stays readable
          over bright reference imagery; coloured accents stay only on the
          icon / stroke, not the fill. */}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 space-y-1.5">
        <h3 className="text-sm font-extrabold leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] line-clamp-2">
          {product.name}
        </h3>
        <div className="flex flex-wrap items-center gap-1">
          {product.verified_owners > 0 && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-brand-emerald/50 backdrop-blur-sm">
              <ShieldCheck size={11} className="text-brand-emerald" />
              {product.verified_owners} verified
            </span>
          )}
          {product.reliabilityGrade && (
            <span className="inline-flex items-center gap-1 rounded-pill bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white ring-1 ring-brand-sky/50 backdrop-blur-sm">
              <span className="text-brand-sky">★</span>
              Grade {product.reliabilityGrade}
            </span>
          )}
          {product.options?.slice(0, 2).map((opt) => (
            <span
              key={opt}
              className="rounded-pill bg-black/55 px-2 py-0.5 text-[10px] font-medium capitalize text-white backdrop-blur-sm"
            >
              #{opt}
            </span>
          ))}
        </div>
      </div>

      {/* Disclaimer for non-owner-supplied images. */}
      {!hasOwnImage && (
        <div className="pointer-events-none absolute left-2 top-9 flex items-center gap-1 rounded-pill bg-black/55 px-1.5 py-0.5 text-[8.5px] font-medium text-white/80 backdrop-blur-sm">
          <Sparkles size={9} className="text-brand-amber" /> Reference Image
        </div>
      )}
    </div>
  );
}

export function ProductMatrix() {
  const { profile, user } = useSession();
  const { lang } = useLang();

  // Local state with persistence for user-submitted reviews
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);

  // Restore modified products from localStorage after hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('veripulse_products_v1');
        if (saved) {
          const parsed = JSON.parse(saved) as Product[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setProducts(parsed);
          }
        }
      } catch {
        // fallback to DEMO_PRODUCTS
      }
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('veripulse_products_v1', JSON.stringify(products));
      } catch {
        // ignore
      }
    }
  }, [products]);

  // Load live products from Supabase
  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    const loadLiveProducts = async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const { data, error } = await sb.from('products').select('*');
        if (!error && data && data.length > 0) {
          setProducts((prev) => {
            const liveMap = new Map(data.map((p: any) => [p.id, p]));
            return prev.map((p) => (liveMap.has(p.id) ? { ...p, ...liveMap.get(p.id) } : p));
          });
        }
      } catch {
        // ignore
      }
    };
    loadLiveProducts();
    return onRefresh('compare', loadLiveProducts);
  }, []);

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | 'all'>('mobile');
  const [selectedPriceRange, setSelectedPriceRange] = useState<string>('all');
  const [selectedOption, setSelectedOption] = useState<string>('all');

  // Compare mode
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  // Review modal
  const [reviewProduct, setReviewProduct] = useState<Product | null>(null);

  // Detail modal
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  // Sub-features inside Product Hub
  const [hubTab, setHubTab] = useState<'browse' | 'battles' | 'copilot' | 'decay' | 'ask_owner' | 'service_radar'>('browse');
  
  // Dedicated Sorting
  const [selectedSort, setSelectedSort] = useState<
    'default' | 'rating_desc' | 'owners_desc' | 'price_asc' | 'price_desc' | 'gap_asc' | 'tco_asc' | 'resale_desc' | 'repair_desc'
  >('default');

  // Dynamic Category Quick Ranking
  const [categoryQuickRanking, setCategoryQuickRanking] = useState<string>('all');

  // Advanced Filters
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  const [customMinPrice, setCustomMinPrice] = useState<string>('');
  const [customMaxPrice, setCustomMaxPrice] = useState<string>('');
  const [filterVerified20Only, setFilterVerified20Only] = useState(false);
  const [filterGradeAOnly, setFilterGradeAOnly] = useState(false);
  const [filterDisputedOnly, setFilterDisputedOnly] = useState(false);
  const [filterStealDealsOnly, setFilterStealDealsOnly] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  // Hardware deal-breaker filters
  const [hardwareFilters, setHardwareFilters] = useState<{
    headphoneJack: boolean;
    microSd: boolean;
    cleanOs: boolean;
    ipRating: boolean;
    esim: boolean;
    dualAbs: boolean;
    upgradableRam: boolean;
    oledDisplay: boolean;
  }>({
    headphoneJack: false,
    microSd: false,
    cleanOs: false,
    ipRating: false,
    esim: false,
    dualAbs: false,
    upgradableRam: false,
    oledDisplay: false,
  });

  // Head-to-Head battles state with persistent voting
  const [battles, setBattles] = useState<HeadToHeadBattle[]>(() => DEMO_HEAD_TO_HEAD_BATTLES);
  const [votedBattles, setVotedBattles] = useState<Record<string, 'productA' | 'productB'>>({});

  function handleVoteBattle(battleId: string, choice: 'productA' | 'productB') {
    if (votedBattles[battleId]) return;
    setVotedBattles((prev) => ({ ...prev, [battleId]: choice }));
    setBattles((prev) =>
      prev.map((b) => {
        if (b.id !== battleId) return b;
        return {
          ...b,
          votes: {
            ...b.votes,
            [choice]: b.votes[choice] + 1,
          },
        };
      }),
    );
  }

  const [trackedPriceIds, setTrackedPriceIds] = useState<string[]>(['poco-x6-pro-5g']);
  const [activeDecayProductId, setActiveDecayProductId] = useState<string>('realme-12-plus-5g');
  const [activeAskProductId, setActiveAskProductId] = useState<string>('realme-12-plus-5g');
  const [priceAlertToast, setPriceAlertToast] = useState<string | null>(null);
  const [activeTooltipBadge, setActiveTooltipBadge] = useState<string | null>(null);

  function togglePriceAlert(productId: string, productName: string) {
    setTrackedPriceIds((prev) => {
      if (prev.includes(productId)) {
        setPriceAlertToast(`Removed price alert for ${productName}`);
        setTimeout(() => setPriceAlertToast(null), 3000);
        return prev.filter((id) => id !== productId);
      } else {
        setPriceAlertToast(`🔔 Price Drop Alert set! We will notify you if ${productName} drops in price.`);
        setTimeout(() => setPriceAlertToast(null), 3000);
        return [...prev, productId];
      }
    });
  }

  // Available brands in the current category
  const categoryCounts = useMemo(
    () => ({
      all: products.length,
      mobile: products.filter((p) => p.category === 'mobile').length,
      bike: products.filter((p) => p.category === 'bike').length,
      car: products.filter((p) => p.category === 'car').length,
      laptop: products.filter((p) => p.category === 'laptop').length,
    }),
    [products],
  );

  const availableBrands = useMemo(() => {
    const brandSet = new Set<string>();
    products.forEach((p) => {
      if ((selectedCategory === 'all' || p.category === selectedCategory) && p.brand) {
        brandSet.add(p.brand);
      }
    });
    return Array.from(brandSet);
  }, [products, selectedCategory]);

  // Price range filters definition per category
  const priceRanges = useMemo(() => {
    if (selectedCategory === 'bike') {
      return [
        { id: 'all', label: 'All Prices' },
        { id: '<10k', label: '< ₹1 Lakh' },
        { id: '10-15k', label: '₹1L - ₹1.5L' },
        { id: '15-20k', label: '₹1.5L - ₹2.5L' },
        { id: '>30k', label: '> ₹2.5 Lakh' },
      ];
    }
    if (selectedCategory === 'car') {
      return [
        { id: 'all', label: 'All Prices' },
        { id: '<10k', label: '< ₹8 Lakh' },
        { id: '15-20k', label: '₹8L - ₹20L' },
        { id: '>30k', label: '> ₹20 Lakh' },
      ];
    }
    if (selectedCategory === 'laptop') {
      return [
        { id: 'all', label: 'All Prices' },
        { id: '15-20k', label: '< ₹50k' },
        { id: '20-30k', label: '₹50k - ₹80k' },
        { id: '>30k', label: '> ₹80k' },
      ];
    }
    // Mobile default
    return [
      { id: 'all', label: 'All Prices' },
      { id: '<10k', label: '< ₹10k' },
      { id: '10-15k', label: '₹10k - 15k' },
      { id: '15-20k', label: '₹15k - 20k' },
      { id: '20-30k', label: '₹20k - 30k' },
      { id: '>30k', label: '> ₹30k' },
    ];
  }, [selectedCategory]);

  // Option/persona filters definition
  const optionFilters = useMemo(() => {
    if (selectedCategory === 'bike') {
      return [
        { id: 'all', label: 'All Options' },
        { id: 'commute', label: '🛵 Commute / Mileage' },
        { id: 'casual', label: '🏍️ Touring / Cruiser' },
        { id: 'gaming', label: '⚡ Performance / Sport' },
        { id: 'all-rounder', label: '🌟 All-rounder' },
      ];
    }
    if (selectedCategory === 'car') {
      return [
        { id: 'all', label: 'All Options' },
        { id: 'casual', label: '🚗 City / Compact' },
        { id: 'all-rounder', label: '🚙 Midsize SUV' },
        { id: 'photography', label: '✨ Luxury / 360 ADAS' },
      ];
    }
    if (selectedCategory === 'laptop') {
      return [
        { id: 'all', label: 'All Options' },
        { id: 'all-rounder', label: '💻 Coding & Dev' },
        { id: 'gaming', label: '🎮 Hardcore Gaming' },
        { id: 'casual', label: '🎓 Student / Casual' },
        { id: 'photography', label: '🎨 Creator / Video' },
      ];
    }
    // Mobile default
    return [
      { id: 'all', label: 'All Options' },
      { id: 'gaming', label: '🎮 Gaming' },
      { id: 'photography', label: '📸 Photography' },
      { id: 'casual', label: '☕ Casual' },
      { id: 'all-rounder', label: '⚡ All-rounder' },
    ];
  }, [selectedCategory]);

  // Dynamic Category Quick Rankings definitions (only related to currently active category)
  const categoryQuickRankingsList = useMemo(() => {
    const map: Record<string, { id: string; label: string; icon: string }[]> = {
      mobile: [
        { id: 'all', label: 'All Mobiles', icon: '📱' },
        { id: 'best_cam_20k', label: 'Best Camera (<₹20k)', icon: '📸' },
        { id: 'battery_sot', label: 'Battery Titan (>8h SOT)', icon: '🔋' },
        { id: 'gaming_perf', label: 'Top Gaming Speed', icon: '⚡' },
        { id: 'clean_ui', label: 'Clean UI (Zero Ads)', icon: '🛡️' },
        { id: 'honest_mkt', label: 'Most Honest Marketing', icon: '🎯' },
        { id: 'best_resale', label: 'Best Resale Value', icon: '📈' },
      ],
      bike: [
        { id: 'all', label: 'All Bikes', icon: '🏍️' },
        { id: 'best_mileage', label: 'Best Mileage (>50 km/l)', icon: '🛵' },
        { id: 'tourer', label: 'Best Highway Cruiser', icon: '🛣️' },
        { id: 'low_tco', label: 'Lowest 3-Year TCO', icon: '💰' },
        { id: 'fast_ev', label: 'Fastest Charging EV', icon: '⚡' },
      ],
      car: [
        { id: 'all', label: 'All Cars', icon: '🚗' },
        { id: 'best_safety', label: '5-Star Safety & ADAS', icon: '🛡️' },
        { id: 'best_value_car', label: 'Best Value (<₹15L)', icon: '🏷️' },
        { id: 'low_maintenance', label: 'Lowest Service Cost', icon: '🔧' },
      ],
      laptop: [
        { id: 'all', label: 'All Laptops', icon: '💻' },
        { id: 'battery_12h', label: 'Battery Champion (>12h)', icon: '🔋' },
        { id: 'best_display', label: '100% sRGB / OLED', icon: '🎨' },
        { id: 'workstation', label: 'Heavy Coding & 3D Render', icon: '⚙️' },
        { id: 'upgradable_ram', label: 'Upgradable RAM & Spares', icon: '🛠️' },
      ],
      all: [
        { id: 'all', label: 'All Categories', icon: '🌟' },
        { id: 'most_owners', label: 'Most Verified Owners', icon: '👥' },
        { id: 'top_rating', label: 'Highest Owner Rating', icon: '⭐' },
        { id: 'grade_a', label: 'Grade A+ Longevity', icon: '🏆' },
        { id: 'honest_mkt', label: 'Lowest Reality Gap', icon: '🎯' },
      ],
    };
    return map[selectedCategory] || map.all;
  }, [selectedCategory]);

  // Filter products
  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      // Category filter
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      // Brand filter
      if (selectedBrand !== 'all' && p.brand !== selectedBrand) {
        return false;
      }

      // Custom numeric price range
      const minP = customMinPrice ? parseFloat(customMinPrice) : null;
      const maxP = customMaxPrice ? parseFloat(customMaxPrice) : null;
      if (p.price_inr !== null) {
        if (minP !== null && p.price_inr < minP) return false;
        if (maxP !== null && p.price_inr > maxP) return false;
      }

      // Price preset range filter
      if (selectedPriceRange !== 'all') {
        if (p.price_range) {
          if (p.price_range !== selectedPriceRange) return false;
        } else if (p.price_inr !== null) {
          const price = p.price_inr;
          if (selectedPriceRange === '<10k' && price >= 10000) return false;
          if (selectedPriceRange === '10-15k' && (price < 10000 || price > 15000)) return false;
          if (selectedPriceRange === '15-20k' && (price < 15000 || price > 20000)) return false;
          if (selectedPriceRange === '20-30k' && (price < 20000 || price > 30000)) return false;
          if (selectedPriceRange === '>30k' && price <= 30000) return false;
        }
      }

      // Option filter (e.g. photography, gaming, casual, all-rounder)
      if (selectedOption !== 'all') {
        const hasOption = p.options?.includes(selectedOption);
        if (!hasOption) return false;
      }

      // Trust & Verification Filters
      if (filterVerified20Only && p.verified_owners < 20) return false;
      if (filterGradeAOnly && p.reliabilityGrade !== 'A+' && p.reliabilityGrade !== 'A') return false;
      if (filterDisputedOnly && !p.marketingDisputed && (p.realityGapScore ?? 0) < 20) return false;
      if (filterStealDealsOnly && p.fairPriceStatus !== 'steal_deal') return false;

      // Hardware Deal-Breaker Filters
      if (hardwareFilters.headphoneJack && !p.hardwareFeatures?.headphoneJack) return false;
      if (hardwareFilters.microSd && !p.hardwareFeatures?.microSdSlot) return false;
      if (hardwareFilters.cleanOs && !p.hardwareFeatures?.cleanOs) return false;
      if (
        hardwareFilters.ipRating &&
        (!p.hardwareFeatures?.waterResistance || p.hardwareFeatures.waterResistance === 'None')
      )
        return false;
      if (hardwareFilters.esim && !p.hardwareFeatures?.esimSupport) return false;
      if (hardwareFilters.dualAbs && !p.hardwareFeatures?.dualChannelAbs) return false;
      if (hardwareFilters.upgradableRam && !p.hardwareFeatures?.upgradableRam) return false;
      if (
        hardwareFilters.oledDisplay &&
        !p.hardwareFeatures?.oledDisplay &&
        !p.claimed_specs.display?.toLowerCase().includes('oled') &&
        !p.claimed_specs.display?.toLowerCase().includes('amoled')
      )
        return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = p.name.toLowerCase().includes(q);
        const brandMatch = p.brand?.toLowerCase().includes(q) ?? false;
        const catMatch = p.category.toLowerCase().includes(q);
        const optionMatch = p.options?.some((o) => o.toLowerCase().includes(q)) ?? false;
        const specMatch = Object.values({ ...p.claimed_specs, ...p.measured_specs }).some((v) =>
          v.toLowerCase().includes(q),
        );
        if (!nameMatch && !brandMatch && !catMatch && !optionMatch && !specMatch) {
          return false;
        }
      }

      return true;
    });

    let result = [...list];

    // Apply Dynamic Category Quick Rankings
    if (categoryQuickRanking === 'best_cam_20k') {
      result = result
        .filter((p) => p.price_inr !== null && p.price_inr <= 20000)
        .sort((a, b) => (b.scores?.camera ?? 0) - (a.scores?.camera ?? 0));
    } else if (categoryQuickRanking === 'battery_sot') {
      result.sort((a, b) => (b.scores?.battery ?? 0) - (a.scores?.battery ?? 0));
    } else if (categoryQuickRanking === 'gaming_perf') {
      result.sort((a, b) => (b.scores?.performance ?? 0) - (a.scores?.performance ?? 0));
    } else if (categoryQuickRanking === 'clean_ui') {
      result = result
        .filter((p) => p.hardwareFeatures?.cleanOs === true)
        .sort((a, b) => (b.owner_rating ?? 0) - (a.owner_rating ?? 0));
    } else if (categoryQuickRanking === 'honest_mkt') {
      result.sort((a, b) => (a.realityGapScore ?? 15) - (b.realityGapScore ?? 15));
    } else if (categoryQuickRanking === 'best_resale') {
      result.sort((a, b) => (b.resaleRetentionPercent ?? 0) - (a.resaleRetentionPercent ?? 0));
    } else if (categoryQuickRanking === 'best_mileage') {
      result = result.sort((a, b) => (b.scores?.battery ?? 0) - (a.scores?.battery ?? 0));
    } else if (categoryQuickRanking === 'tourer') {
      result = result.sort((a, b) => (b.scores?.performance ?? 0) - (a.scores?.performance ?? 0));
    } else if (categoryQuickRanking === 'low_tco') {
      result.sort((a, b) => (a.threeYearTcoInr ?? 999999) - (b.threeYearTcoInr ?? 999999));
    } else if (categoryQuickRanking === 'fast_ev') {
      result = result.filter((p) => p.hardwareFeatures?.fastCharging === true);
    } else if (categoryQuickRanking === 'best_safety') {
      result = result.sort((a, b) => (b.scores?.multimedia ?? 0) - (a.scores?.multimedia ?? 0));
    } else if (categoryQuickRanking === 'best_value_car') {
      result = result
        .filter((p) => (p.price_inr ?? 0) <= 1500000)
        .sort((a, b) => (b.owner_rating ?? 0) - (a.owner_rating ?? 0));
    } else if (categoryQuickRanking === 'low_maintenance') {
      result.sort((a, b) => (a.threeYearTcoInr ?? 999999) - (b.threeYearTcoInr ?? 999999));
    } else if (categoryQuickRanking === 'battery_12h') {
      result.sort((a, b) => (b.scores?.battery ?? 0) - (a.scores?.battery ?? 0));
    } else if (categoryQuickRanking === 'best_display') {
      result.sort((a, b) => (b.scores?.display ?? 0) - (a.scores?.display ?? 0));
    } else if (categoryQuickRanking === 'workstation') {
      result.sort((a, b) => (b.scores?.performance ?? 0) - (a.scores?.performance ?? 0));
    } else if (categoryQuickRanking === 'upgradable_ram') {
      result = result.filter((p) => p.hardwareFeatures?.upgradableRam === true);
    } else if (categoryQuickRanking === 'most_owners') {
      result.sort((a, b) => b.verified_owners - a.verified_owners);
    } else if (categoryQuickRanking === 'top_rating') {
      result.sort((a, b) => (b.owner_rating ?? 0) - (a.owner_rating ?? 0));
    } else if (categoryQuickRanking === 'grade_a') {
      result = result.filter((p) => p.reliabilityGrade === 'A+' || p.reliabilityGrade === 'A');
    }

    // Apply Dedicated Sorting (if not overridden by quick ranking)
    if (categoryQuickRanking === 'all') {
      if (selectedSort === 'rating_desc') {
        result.sort((a, b) => (b.owner_rating ?? 0) - (a.owner_rating ?? 0));
      } else if (selectedSort === 'owners_desc') {
        result.sort((a, b) => b.verified_owners - a.verified_owners);
      } else if (selectedSort === 'price_asc') {
        result.sort((a, b) => (a.price_inr ?? 0) - (b.price_inr ?? 0));
      } else if (selectedSort === 'price_desc') {
        result.sort((a, b) => (b.price_inr ?? 0) - (a.price_inr ?? 0));
      } else if (selectedSort === 'gap_asc') {
        result.sort((a, b) => (a.realityGapScore ?? 15) - (b.realityGapScore ?? 15));
      } else if (selectedSort === 'tco_asc') {
        result.sort((a, b) => (a.threeYearTcoInr ?? 999999) - (b.threeYearTcoInr ?? 999999));
      } else if (selectedSort === 'resale_desc') {
        result.sort((a, b) => (b.resaleRetentionPercent ?? 0) - (a.resaleRetentionPercent ?? 0));
      } else if (selectedSort === 'repair_desc') {
        result.sort((a, b) => (b.repairabilityIndex ?? 0) - (a.repairabilityIndex ?? 0));
      }
    }

    return result;
  }, [
    products,
    selectedCategory,
    selectedBrand,
    customMinPrice,
    customMaxPrice,
    selectedPriceRange,
    selectedOption,
    filterVerified20Only,
    filterGradeAOnly,
    filterDisputedOnly,
    filterStealDealsOnly,
    hardwareFilters,
    searchQuery,
    categoryQuickRanking,
    selectedSort,
  ]);

  // Handle adding/removing to compare
  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 4) {
        alert('You can compare a maximum of 4 products side-by-side.');
        return prev;
      }
      return [...prev, id];
    });
  }

  // Affiliate click redirect
  function buy(productId: string) {
    window.open(apiUrl(`/api/affiliate/click?product=${encodeURIComponent(productId)}`), '_blank', 'noopener');
  }

  // Handle new verified review submission
  function handleAddReview(productId: string, newReview: ProductReview) {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const updatedReviews = [newReview, ...(p.reviews ?? [])];
        const newVerifiedCount = p.verified_owners + 1;

        // Recalculate average scores
        const revCount = updatedReviews.length;
        const avgScores: ProductMetricScores = {
          camera: Number(
            (updatedReviews.reduce((sum, r) => sum + r.scores.camera, 0) / revCount).toFixed(1),
          ),
          battery: Number(
            (updatedReviews.reduce((sum, r) => sum + r.scores.battery, 0) / revCount).toFixed(1),
          ),
          performance: Number(
            (updatedReviews.reduce((sum, r) => sum + r.scores.performance, 0) / revCount).toFixed(1),
          ),
          display: Number(
            (updatedReviews.reduce((sum, r) => sum + r.scores.display, 0) / revCount).toFixed(1),
          ),
          multimedia: Number(
            (updatedReviews.reduce((sum, r) => sum + r.scores.multimedia, 0) / revCount).toFixed(1),
          ),
        };
        const avgOverall = Number(
          (
            (avgScores.camera +
              avgScores.battery +
              avgScores.performance +
              avgScores.display +
              avgScores.multimedia) /
            5
          ).toFixed(1),
        );

        return {
          ...p,
          verified_owners: newVerifiedCount,
          owner_rating: avgOverall,
          scores: avgScores,
          reviews: updatedReviews,
        };
      }),
    );
    setReviewProduct(null);
  }

  // Reset all filters
  function resetFilters() {
    setSearchQuery('');
    setSelectedCategory('mobile');
    setSelectedPriceRange('all');
    setSelectedOption('all');
  }

  const isFiltered =
    selectedCategory !== 'mobile' ||
    selectedPriceRange !== 'all' ||
    selectedOption !== 'all' ||
    searchQuery.trim().length > 0;

  // ── Full Page Drill-Down & Creation Views (Consistent with News Hub) ──
  if (reviewProduct) {
    return (
      <ProductReviewPage
        product={reviewProduct}
        onClose={() => setReviewProduct(null)}
        onSubmit={(review) => {
          handleAddReview(reviewProduct.id, review);
          setReviewProduct(null);
        }}
        currentUsername={profile?.username ?? user?.email ?? 'verified_citizen'}
        lang={lang}
      />
    );
  }

  if (isCompareModalOpen && compareIds.length > 0) {
    return (
      <ProductComparePage
        productIds={compareIds}
        allProducts={products}
        onClose={() => setIsCompareModalOpen(false)}
        onRemove={toggleCompare}
        onBuy={buy}
        lang={lang}
      />
    );
  }

  if (detailProduct) {
    return (
      <ProductDrillDownPage
        product={detailProduct}
        allProducts={products}
        onSelectProduct={(p) => setDetailProduct(p)}
        onClose={() => setDetailProduct(null)}
        onOpenReview={() => {
          setReviewProduct(detailProduct);
          setDetailProduct(null);
        }}
        onBuy={buy}
        lang={lang}
      />
    );
  }

  const priceCap =
    selectedCategory === 'car' ? 5_000_000
    : selectedCategory === 'bike' ? 500_000
    : selectedCategory === 'laptop' ? 400_000
    : selectedCategory === 'mobile' ? 150_000
    : 500_000;

  return (
    <div className="space-y-4">
      <ProductFilterBar
        hubTab={hubTab}
        setHubTab={setHubTab}
        selectedCategory={selectedCategory}
        setSelectedCategory={(c) => {
          setSelectedCategory(c);
          setSelectedPriceRange('all');
          setSelectedOption('all');
          setCustomMinPrice('');
          setCustomMaxPrice('');
        }}
        categoryCounts={categoryCounts}
        selectedOption={selectedOption}
        setSelectedOption={setSelectedOption}
        optionFilters={optionFilters}
        customMinPrice={customMinPrice}
        setCustomMinPrice={setCustomMinPrice}
        customMaxPrice={customMaxPrice}
        setCustomMaxPrice={setCustomMaxPrice}
        priceCap={priceCap}
        selectedSort={selectedSort}
        setSelectedSort={(s) => {
          setSelectedSort(s);
          setCategoryQuickRanking('all');
        }}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isAdvancedFiltersOpen={isAdvancedFiltersOpen}
        setIsAdvancedFiltersOpen={setIsAdvancedFiltersOpen}
        lang={lang}
      />

      {/* Old hub-tab chip row — hidden, kept only to preserve render order
          references below. The ProductFilterBar replaces this UI. */}
      <div className="hidden">
        <button
          onClick={() => setHubTab('browse')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            hubTab === 'browse'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <Search size={14} /> {t('browseAndCompare', lang)}
        </button>
        <button
          onClick={() => setHubTab('battles')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            hubTab === 'battles'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <Flame size={14} /> {t('headToHeadBattles', lang)}
        </button>
        <button
          onClick={() => setHubTab('copilot')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            hubTab === 'copilot'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <Sparkles size={14} /> {t('aiDecisionCopilot', lang)}
        </button>
        <button
          onClick={() => setHubTab('decay')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            hubTab === 'decay'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <Clock size={14} /> {t('sixMoDecayIndex', lang)}
        </button>
        <button
          onClick={() => setHubTab('ask_owner')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            hubTab === 'ask_owner'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <MessageSquare size={14} /> {t('askVerifiedOwner', lang)}
        </button>
        <button
          onClick={() => setHubTab('service_radar')}
          className={`flex shrink-0 items-center gap-1.5 rounded-button px-3.5 py-2 text-xs font-bold transition-all ${
            hubTab === 'service_radar'
              ? 'bg-brand-emerald text-[#04110b] shadow-sm'
              : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary'
          }`}
        >
          <Wrench size={14} /> {t('serviceCenterRadar', lang)}
        </button>
      </div>

      {/* Price Alert Toast Notification */}
      {priceAlertToast && (
        <div className="rounded-button bg-brand-emerald/15 border border-brand-emerald/40 p-2.5 text-xs font-bold text-brand-emerald flex items-center justify-between animate-fade-in">
          <span>{priceAlertToast}</span>
          <button onClick={() => setPriceAlertToast(null)} className="text-content-muted text-[10px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Render sub-feature views if selected */}
      {hubTab === 'copilot' && (
        <AICopilot
          products={products}
          onSelectProduct={(p) => {
            setDetailProduct(p);
          }}
        />
      )}
      {hubTab === 'decay' && (
        <DecayIndex productId={activeDecayProductId} />
      )}
      {hubTab === 'ask_owner' && (
        <AskOwner productId={activeAskProductId} />
      )}
      {hubTab === 'service_radar' && (
        <ServiceRadar
          brand={selectedCategory === 'bike' ? 'TVS' : 'Realme'}
          category={selectedCategory === 'all' ? 'mobile' : selectedCategory}
        />
      )}

      {/* Head-to-Head Battles Tab */}
      {hubTab === 'battles' && (
        <div className="space-y-4">
          <div className="rounded-card border border-brand-amber/30 bg-gradient-to-r from-brand-amber/10 via-bg-surface to-brand-amber/5 p-4">
            <div className="flex items-center gap-2 text-brand-amber font-bold text-sm">
              <Flame size={18} /> Community Head-to-Head Battles
            </div>
            <p className="mt-1 text-xs text-content-secondary">
              Crowdsourced market rivalries verified by GST/RC owners. Vote on real-world low-light photography, sustained heavy gaming temperatures, long-term battery decay, and official spare parts pricing.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {battles.map((battle) => {
              const productA = products.find((p) => p.id === battle.productAId);
              const productB = products.find((p) => p.id === battle.productBId);
              if (!productA || !productB) return null;

              const totalVotes = battle.votes.productA + battle.votes.productB;
              const percentA = totalVotes > 0 ? Math.round((battle.votes.productA / totalVotes) * 100) : 50;
              const percentB = 100 - percentA;
              const userVote = votedBattles[battle.id];

              return (
                <Card key={battle.id} className="p-4 overflow-hidden border-[var(--border-strong)]">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-brand-emerald mb-1">
                    {battle.category.toUpperCase()} RIVALRY
                  </div>
                  <h3 className="text-base font-extrabold text-content-primary mb-3">
                    {battle.title}
                  </h3>

                  {/* Battle Face-Off Cards */}
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[var(--border-subtle)]">
                    {/* Contender A */}
                    <div className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-3 text-center flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-content-muted">{productA.brand}</div>
                        <div className="font-bold text-sm text-content-primary">{productA.name}</div>
                        <div className="font-mono text-sm font-extrabold text-brand-emerald mt-1">
                          {formatINR(productA.price_inr ?? 0).replace(/\.00$/, '')}
                        </div>
                        <div className="text-[11px] text-brand-amber font-bold mt-0.5">
                          ★ {productA.owner_rating?.toFixed(1)} / 10 ({productA.verified_owners} owners)
                        </div>
                      </div>
                      <Button
                        variant={userVote === 'productA' ? 'solid' : 'outline'}
                        onClick={() => handleVoteBattle(battle.id, 'productA')}
                        disabled={Boolean(userVote)}
                        className={`mt-3 w-full text-xs font-bold ${userVote === 'productA' ? 'bg-brand-emerald text-[#04110b]' : ''}`}
                      >
                        <ThumbsUp size={12} /> {userVote === 'productA' ? 'Voted' : 'Vote A'} ({battle.votes.productA})
                      </Button>
                    </div>

                    {/* Contender B */}
                    <div className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-3 text-center flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-content-muted">{productB.brand}</div>
                        <div className="font-bold text-sm text-content-primary">{productB.name}</div>
                        <div className="font-mono text-sm font-extrabold text-brand-sky mt-1">
                          {formatINR(productB.price_inr ?? 0).replace(/\.00$/, '')}
                        </div>
                        <div className="text-[11px] text-brand-amber font-bold mt-0.5">
                          ★ {productB.owner_rating?.toFixed(1)} / 10 ({productB.verified_owners} owners)
                        </div>
                      </div>
                      <Button
                        variant={userVote === 'productB' ? 'solid' : 'outline'}
                        onClick={() => handleVoteBattle(battle.id, 'productB')}
                        disabled={Boolean(userVote)}
                        className={`mt-3 w-full text-xs font-bold ${userVote === 'productB' ? 'bg-brand-sky text-white' : ''}`}
                      >
                        <ThumbsUp size={12} /> {userVote === 'productB' ? 'Voted' : 'Vote B'} ({battle.votes.productB})
                      </Button>
                    </div>
                  </div>

                  {/* Community Consensus Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs font-bold mb-1">
                      <span className="text-brand-emerald">{percentA}% {productA.name.split(' ')[0]}</span>
                      <span className="text-content-muted text-[10px]">{totalVotes} Total Votes</span>
                      <span className="text-brand-sky">{percentB}% {productB.name.split(' ')[0]}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-bg-surface flex">
                      <div className="bg-brand-emerald h-full transition-all duration-500" style={{ width: `${percentA}%` }} />
                      <div className="bg-brand-sky h-full transition-all duration-500" style={{ width: `${percentB}%` }} />
                    </div>
                  </div>

                  {/* Metric Winners Breakdown */}
                  <div className="mt-3.5 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                      Telemetry & Evidence Scorecard
                    </div>
                    {battle.metrics.map((m) => {
                      const isAWinner = m.winnerId === productA.id;
                      const winner = isAWinner ? productA : productB;
                      return (
                        <div key={m.name} className="rounded-button bg-bg-surface p-2 text-xs border border-[var(--border-subtle)]">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-content-primary">{m.name}</span>
                            <span className={`inline-flex items-center gap-1 font-bold text-[11px] px-1.5 py-0.5 rounded ${isAWinner ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-brand-sky/15 text-brand-sky'}`}>
                              <Award size={11} /> Winner: {winner.name.split(' ')[0]}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-content-secondary">{m.note}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Launch Side-by-Side Comparison */}
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="outline"
                      className="w-full text-xs font-bold"
                      onClick={() => {
                        setCompareIds([productA.id, productB.id]);
                        setIsCompareModalOpen(true);
                      }}
                    >
                      <Scale size={13} /> Open Side-by-Side Matrix
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Browse Tab */}
      {hubTab === 'browse' && (
        <>
          {/* ── Legacy Top Bar: Search / Categories / Sort / Quick Rank ──
              Hidden; replaced by the sticky ProductFilterBar at the top
              of the hub. Quick-rank chips still handled inside this
              hidden tree so the filtering state remains valid. */}
          <Card className="hidden p-3.5 sm:p-4">
            <div className="flex flex-col gap-3">
              {/* Search Input */}
              <div className="relative flex items-center">
                <Search className="absolute left-3.5 text-content-muted" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('searchProducts', lang)}
                  className="w-full rounded-button border border-[var(--border-subtle)] bg-bg-surface py-2.5 pl-10 pr-10 text-sm text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 text-content-muted hover:text-content-primary"
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <CategoryButton
              active={selectedCategory === 'mobile'}
              onClick={() => {
                setSelectedCategory('mobile');
                setSelectedPriceRange('all');
                setSelectedOption('all');
              }}
              icon={<Smartphone size={15} />}
              label={t('mobile', lang)}
              count={products.filter((p) => p.category === 'mobile').length}
            />
            <CategoryButton
              active={selectedCategory === 'bike'}
              onClick={() => {
                setSelectedCategory('bike');
                setSelectedPriceRange('all');
                setSelectedOption('all');
              }}
              icon={<Bike size={15} />}
              label={t('bike', lang)}
              count={products.filter((p) => p.category === 'bike').length}
            />
            <CategoryButton
              active={selectedCategory === 'car'}
              onClick={() => {
                setSelectedCategory('car');
                setSelectedPriceRange('all');
                setSelectedOption('all');
              }}
              icon={<Car size={15} />}
              label={t('car', lang)}
              count={products.filter((p) => p.category === 'car').length}
            />
            <CategoryButton
              active={selectedCategory === 'laptop'}
              onClick={() => {
                setSelectedCategory('laptop');
                setSelectedPriceRange('all');
                setSelectedOption('all');
              }}
              icon={<Laptop size={15} />}
              label={t('laptop', lang)}
              count={products.filter((p) => p.category === 'laptop').length}
            />
            <CategoryButton
              active={selectedCategory === 'all'}
              onClick={() => {
                setSelectedCategory('all');
                setSelectedPriceRange('all');
                setSelectedOption('all');
              }}
              icon={<Sparkles size={15} />}
              label={t('allCategories', lang)}
              count={products.length}
            />
          </div>

          {/* Dedicated Sorting & Advanced Filter Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5">
            <div className="flex items-center gap-1.5 text-xs">
              <ArrowUpDown size={13} className="text-content-muted" />
              <span className="text-content-muted font-bold text-[11px] uppercase tracking-wider">{t('sortBy', lang)}:</span>
              <CustomSelect
                value={selectedSort}
                onChange={(val) => {
                  setSelectedSort(val as any);
                  setCategoryQuickRanking('all');
                }}
                variant="pill"
                size="sm"
                options={[
                  { value: 'default', label: lang === 'bn' ? 'প্রস্তাবিত (যাচাইকৃত প্রথমে)' : lang === 'hi' ? 'अनुशंसित (सत्यापित पहले)' : 'Recommended (Verified First)' },
                  { value: 'rating_desc', label: t('sort_rating', lang), icon: <span>⭐</span> },
                  { value: 'owners_desc', label: t('sort_owners', lang), icon: <span>👥</span> },
                  { value: 'price_asc', label: t('sort_price_low', lang), icon: <span>💵</span> },
                  { value: 'price_desc', label: t('sort_price_high', lang), icon: <span>💎</span> },
                  { value: 'gap_asc', label: t('sort_gap', lang), icon: <span>🎯</span> },
                  { value: 'tco_asc', label: t('sort_tco', lang), icon: <span>💰</span> },
                  { value: 'resale_desc', label: t('sort_resale', lang), icon: <span>📈</span> },
                  { value: 'repair_desc', label: t('sort_repair', lang), icon: <span>🔧</span> },
                ]}
              />
            </div>

            <button
              onClick={() => setIsAdvancedFiltersOpen(!isAdvancedFiltersOpen)}
              className={`inline-flex items-center gap-1.5 rounded-button border px-2.5 py-1 text-xs font-semibold transition-all ${
                isAdvancedFiltersOpen || filterVerified20Only || filterGradeAOnly || filterDisputedOnly || filterStealDealsOnly || selectedBrand !== 'all' || customMinPrice || customMaxPrice || Object.values(hardwareFilters).some(Boolean)
                  ? 'border-brand-emerald bg-brand-emerald/15 text-brand-emerald'
                  : 'border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:text-content-primary'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Advanced Filters</span>
              {(filterVerified20Only || filterGradeAOnly || filterDisputedOnly || filterStealDealsOnly || selectedBrand !== 'all' || customMinPrice || customMaxPrice || Object.values(hardwareFilters).some(Boolean)) && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-emerald text-[10px] font-bold text-[#04110b]">
                  ✓
                </span>
              )}
            </button>
          </div>

          {/* Dynamic Category Quick Ranking (Only related to current active category) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs border-t border-[var(--border-subtle)] pt-2.5">
            <span className="text-content-muted font-bold text-[11px] shrink-0 uppercase tracking-wider flex items-center gap-1">
              <Zap size={12} className="text-brand-amber" /> Quick Rank:
            </span>
            {categoryQuickRankingsList.map((qr) => {
              const active = categoryQuickRanking === qr.id;
              return (
                <button
                  key={qr.id}
                  onClick={() => {
                    setCategoryQuickRanking(qr.id);
                    if (qr.id !== 'all') setSelectedSort('default');
                  }}
                  className={`rounded-pill px-2.5 py-0.5 text-[11px] font-semibold border transition-all shrink-0 ${
                    active
                      ? 'border-brand-emerald bg-brand-emerald/20 text-brand-emerald font-bold shadow-sm'
                      : 'border-[var(--border-subtle)] bg-bg-surface text-content-muted hover:text-content-primary hover:border-content-muted'
                  }`}
                >
                  {qr.icon} {qr.label}
                </button>
              );
            })}
          </div>

          {/* ── Advanced Filters Drawer ── */}
          {isAdvancedFiltersOpen && (
            <div className="mt-3 rounded-button border border-brand-emerald/30 bg-bg-elevated p-3 space-y-3 animate-fade-in text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <span className="font-bold text-content-primary flex items-center gap-1.5">
                  <SlidersHorizontal size={13} className="text-brand-emerald" /> Advanced Filter Controls
                </span>
                <button
                  onClick={() => {
                    setCustomMinPrice('');
                    setCustomMaxPrice('');
                    setFilterVerified20Only(false);
                    setFilterGradeAOnly(false);
                    setFilterDisputedOnly(false);
                    setFilterStealDealsOnly(false);
                    setSelectedBrand('all');
                    setHardwareFilters({
                      headphoneJack: false,
                      microSd: false,
                      cleanOs: false,
                      ipRating: false,
                      esim: false,
                      dualAbs: false,
                      upgradableRam: false,
                      oledDisplay: false,
                    });
                  }}
                  className="text-[11px] text-content-muted hover:text-brand-rose"
                >
                  Reset Advanced
                </button>
              </div>

              {/* Custom Min-Max Price Slider/Inputs */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1 block">
                  Custom Price Range (₹ INR)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={customMinPrice}
                    onChange={(e) => setCustomMinPrice(e.target.value)}
                    placeholder="Min Price (e.g. 10000)"
                    className="w-full rounded border border-[var(--border-subtle)] bg-bg-surface px-2.5 py-1 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
                  />
                  <span className="text-content-muted font-bold">—</span>
                  <input
                    type="number"
                    value={customMaxPrice}
                    onChange={(e) => setCustomMaxPrice(e.target.value)}
                    placeholder="Max Price (e.g. 25000)"
                    className="w-full rounded border border-[var(--border-subtle)] bg-bg-surface px-2.5 py-1 text-xs text-content-primary focus:border-brand-emerald focus:outline-none"
                  />
                  {(customMinPrice || customMaxPrice) && (
                    <button
                      onClick={() => {
                        setCustomMinPrice('');
                        setCustomMaxPrice('');
                      }}
                      className="text-xs text-content-muted hover:text-content-primary p-1"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Trust & Verification Badges */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5 block">
                  Trust & Evidence Verification
                </label>
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                    <input
                      type="checkbox"
                      checked={filterVerified20Only}
                      onChange={(e) => setFilterVerified20Only(e.target.checked)}
                      className="rounded accent-brand-emerald"
                    />
                    <span>👥 ≥ 20 GST/RC Verified Owners</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                    <input
                      type="checkbox"
                      checked={filterGradeAOnly}
                      onChange={(e) => setFilterGradeAOnly(e.target.checked)}
                      className="rounded accent-brand-emerald"
                    />
                    <span>🏆 Grade A/A+ Decay Index</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                    <input
                      type="checkbox"
                      checked={filterDisputedOnly}
                      onChange={(e) => setFilterDisputedOnly(e.target.checked)}
                      className="rounded accent-brand-rose"
                    />
                    <span className="text-brand-rose">⚠️ Disputed Marketing Claims</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                    <input
                      type="checkbox"
                      checked={filterStealDealsOnly}
                      onChange={(e) => setFilterStealDealsOnly(e.target.checked)}
                      className="rounded accent-brand-emerald"
                    />
                    <span className="text-brand-emerald font-semibold">🟢 Steal Deals Only</span>
                  </label>
                </div>
              </div>

              {/* Hardware Deal-Breakers (Contextual) */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5 block">
                  Hardware Deal-Breakers ({selectedCategory})
                </label>
                <div className="flex flex-wrap gap-2">
                  {(selectedCategory === 'mobile' || selectedCategory === 'all') && (
                    <>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                        <input
                          type="checkbox"
                          checked={hardwareFilters.headphoneJack}
                          onChange={(e) =>
                            setHardwareFilters((prev) => ({ ...prev, headphoneJack: e.target.checked }))
                          }
                          className="rounded accent-brand-emerald"
                        />
                        <span>🎧 3.5mm Headphone Jack</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                        <input
                          type="checkbox"
                          checked={hardwareFilters.microSd}
                          onChange={(e) =>
                            setHardwareFilters((prev) => ({ ...prev, microSd: e.target.checked }))
                          }
                          className="rounded accent-brand-emerald"
                        />
                        <span>💾 MicroSD Slot</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                        <input
                          type="checkbox"
                          checked={hardwareFilters.cleanOs}
                          onChange={(e) =>
                            setHardwareFilters((prev) => ({ ...prev, cleanOs: e.target.checked }))
                          }
                          className="rounded accent-brand-emerald"
                        />
                        <span>🛡️ Clean OS (Zero Adware)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                        <input
                          type="checkbox"
                          checked={hardwareFilters.ipRating}
                          onChange={(e) =>
                            setHardwareFilters((prev) => ({ ...prev, ipRating: e.target.checked }))
                          }
                          className="rounded accent-brand-emerald"
                        />
                        <span>💧 Water Resistance (IP64/IP68)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                        <input
                          type="checkbox"
                          checked={hardwareFilters.esim}
                          onChange={(e) =>
                            setHardwareFilters((prev) => ({ ...prev, esim: e.target.checked }))
                          }
                          className="rounded accent-brand-emerald"
                        />
                        <span>📶 eSIM Support</span>
                      </label>
                    </>
                  )}
                  {(selectedCategory === 'bike' || selectedCategory === 'car' || selectedCategory === 'all') && (
                    <>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                        <input
                          type="checkbox"
                          checked={hardwareFilters.dualAbs}
                          onChange={(e) =>
                            setHardwareFilters((prev) => ({ ...prev, dualAbs: e.target.checked }))
                          }
                          className="rounded accent-brand-emerald"
                        />
                        <span>🛑 Dual-Channel ABS</span>
                      </label>
                    </>
                  )}
                  {(selectedCategory === 'laptop' || selectedCategory === 'all') && (
                    <>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                        <input
                          type="checkbox"
                          checked={hardwareFilters.upgradableRam}
                          onChange={(e) =>
                            setHardwareFilters((prev) => ({ ...prev, upgradableRam: e.target.checked }))
                          }
                          className="rounded accent-brand-emerald"
                        />
                        <span>🛠️ Upgradable SO-DIMM RAM</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer bg-bg-surface border border-[var(--border-subtle)] px-2 py-1 rounded text-[11px]">
                        <input
                          type="checkbox"
                          checked={hardwareFilters.oledDisplay}
                          onChange={(e) =>
                            setHardwareFilters((prev) => ({ ...prev, oledDisplay: e.target.checked }))
                          }
                          className="rounded accent-brand-emerald"
                        />
                        <span>🎨 100% sRGB / OLED Screen</span>
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Brand Selector */}
              {availableBrands.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-content-muted mb-1.5 block">
                    Filter by Brand
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedBrand('all')}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        selectedBrand === 'all'
                          ? 'border-brand-emerald bg-brand-emerald/15 text-brand-emerald'
                          : 'border-[var(--border-subtle)] bg-bg-surface text-content-muted'
                      }`}
                    >
                      All Brands
                    </button>
                    {availableBrands.map((b) => (
                      <button
                        key={b}
                        onClick={() => setSelectedBrand(b)}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          selectedBrand === b
                            ? 'border-brand-emerald bg-brand-emerald/15 text-brand-emerald'
                            : 'border-[var(--border-subtle)] bg-bg-surface text-content-muted hover:text-content-primary'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Guided Drill-Down Breadcrumb & Filters ──
          Hidden: Category / Price Range / Focus & Use Case are already
          available as chip-dropdowns in the floating filter bar above, so
          the duplicate inline chrome just took up space. The Reset button
          moved into the ProductFilterBar's Clear link. */}
      <Card className="hidden p-3.5 sm:p-4">
        {/* Breadcrumb Display */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-content-muted">
          <span className="font-semibold uppercase tracking-wider text-content-secondary">Flow:</span>
          <span className="inline-flex items-center gap-1 font-medium capitalize text-brand-emerald">
            {selectedCategory === 'all' ? 'All Categories' : selectedCategory}
          </span>
          <ChevronRight size={13} className="text-content-muted" />
          <span
            className={cn(
              'font-medium',
              selectedPriceRange !== 'all' ? 'text-brand-sky' : 'text-content-muted',
            )}
          >
            {priceRanges.find((r) => r.id === selectedPriceRange)?.label ?? 'All Prices'}
          </span>
          <ChevronRight size={13} className="text-content-muted" />
          <span
            className={cn(
              'font-medium',
              selectedOption !== 'all' ? 'text-brand-amber' : 'text-content-muted',
            )}
          >
            {optionFilters.find((o) => o.id === selectedOption)?.label ?? 'All Options'}
          </span>

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="ml-auto inline-flex items-center gap-1 rounded-pill bg-bg-surface px-2 py-0.5 text-[11px] font-medium text-content-secondary hover:text-content-primary"
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>

        {/* Filter Step 1: Price Range */}
        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-content-secondary">
            Price Range
          </div>
          <div className="flex flex-wrap gap-1.5">
            {priceRanges.map((range) => {
              const active = selectedPriceRange === range.id;
              return (
                <button
                  key={range.id}
                  onClick={() => setSelectedPriceRange(range.id)}
                  className={cn(
                    'rounded-pill px-3 py-1 text-xs font-medium transition-all',
                    active
                      ? 'bg-brand-sky/20 font-bold text-brand-sky border border-brand-sky/40 shadow-sm'
                      : 'border border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary',
                  )}
                >
                  {range.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Step 2: Preferred Options (Gaming, Photography, Casual, All-Rounder) */}
        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3 mt-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-content-secondary">
            Focus & Use Case
          </div>
          <div className="flex flex-wrap gap-1.5">
            {optionFilters.map((opt) => {
              const active = selectedOption === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSelectedOption(opt.id)}
                  className={cn(
                    'rounded-pill px-3 py-1 text-xs font-medium transition-all',
                    active
                      ? 'bg-brand-emerald/20 font-bold text-brand-emerald border border-brand-emerald/40 shadow-sm'
                      : 'border border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary',
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ── Active Compare Dock (if any selected) ── */}
      {compareIds.length > 0 && (
        <div className="sticky top-2 z-30 flex items-center justify-between rounded-card border border-brand-emerald/40 bg-bg-elevated/95 p-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-brand-emerald" />
            <div className="text-xs font-medium text-content-primary">
              <span className="font-bold text-brand-emerald">{compareIds.length}</span> / 4 products selected to compare
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompareIds([])}
              className="text-xs text-content-muted hover:text-content-primary"
            >
              Clear
            </button>
            <Button
              onClick={() => setIsCompareModalOpen(true)}
              className="bg-brand-emerald text-[#04110b] font-bold px-3 py-1.5 text-xs"
            >
              Compare Now ({compareIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* ── Products List Header ── */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-semibold text-content-muted">
          Showing <span className="font-bold text-content-primary">{filteredProducts.length}</span> verified products
          {selectedOption !== 'all' && (
            <span className="ml-1 text-brand-emerald">
              matching &quot;{optionFilters.find((o) => o.id === selectedOption)?.label}&quot;
            </span>
          )}
        </div>
        {filteredProducts.length > 1 && (
          <button
            onClick={() => {
              // Quick-compare first 3 filtered products
              const topIds = filteredProducts.slice(0, 3).map((p) => p.id);
              setCompareIds(topIds);
              setIsCompareModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-sky hover:underline"
          >
            <Scale size={13} /> Compare all top {Math.min(filteredProducts.length, 3)}
          </button>
        )}
      </div>

      {/* ── Empty State ── */}
      {filteredProducts.length === 0 && (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-surface text-content-muted">
            <Search size={22} />
          </div>
          <h3 className="mt-3 text-sm font-bold text-content-primary">No products match your filter</h3>
          <p className="mt-1 text-xs text-content-muted">
            Try adjusting your price range or focus options to see verified owner products.
          </p>
          <Button variant="outline" onClick={resetFilters} className="mt-4 px-3 py-1.5 text-xs">
            Reset All Filters
          </Button>
        </Card>
      )}

      {/* ── Products Grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {filteredProducts.map((p) => {
          const isComparing = compareIds.includes(p.id);
          const isCardActive = activeTooltipBadge !== null && activeTooltipBadge.startsWith(p.id);
          const scores = p.scores ?? {
            camera: 7.5,
            battery: 8.0,
            performance: 7.8,
            display: 8.0,
            multimedia: 7.7,
          };

          return (
            <Card
              key={p.id}
              style={{ zIndex: isCardActive ? 40 : 1 }}
              className={cn(
                'relative flex flex-col justify-between overflow-visible p-4 transition-all duration-200 hover:border-[var(--border-strong)]',
                isComparing && 'border-brand-emerald shadow-sm',
                isCardActive && 'ring-1 ring-brand-emerald/40',
              )}
            >
              <div>
                {/* Hero image with brand / rating / name / tag overlays */}
                <ProductCardImage product={p} onOpen={() => setDetailProduct(p)} />

                {/* Header: Title, Category Badge, Price */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                      {p.brand ?? p.category}
                    </div>
                    <h3
                      onClick={() => setDetailProduct(p)}
                      className="cursor-pointer text-base font-bold text-content-primary hover:text-brand-emerald"
                    >
                      {p.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePriceAlert(p.id, p.name);
                      }}
                      title={trackedPriceIds.includes(p.id) ? 'Tracking price drop' : 'Set price drop alert'}
                      className={`p-1.5 rounded-button border text-xs transition-colors ${
                        trackedPriceIds.includes(p.id)
                          ? 'border-brand-amber bg-brand-amber/15 text-brand-amber'
                          : 'border-[var(--border-subtle)] bg-bg-surface text-content-muted hover:text-content-primary'
                      }`}
                    >
                      <Bell size={13} className={trackedPriceIds.includes(p.id) ? 'fill-brand-amber text-brand-amber' : ''} />
                    </button>
                    <div className="text-right">
                      <div className="font-mono text-base font-extrabold text-content-primary">
                        {p.price_inr !== null ? formatINR(p.price_inr).replace(/\.00$/, '') : '—'}
                      </div>
                      <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)" className="mt-0.5 text-[10px]">
                        {p.merchant}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {p.options && p.options.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {p.options.map((opt: string) => (
                      <span
                        key={opt}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium capitalize',
                          opt === selectedOption
                            ? 'bg-brand-emerald/20 text-brand-emerald font-bold'
                            : 'bg-bg-surface text-content-muted',
                        )}
                      >
                        #{opt}
                      </span>
                    ))}
                  </div>
                )}

                {/* Transparency & Longevity Badges Strip (Interactive Tap Tooltips) */}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  {/* Reality Gap Pill */}
                  {p.realityGapScore !== undefined && (
                    <BadgeTooltip
                      align="left"
                      isOpen={activeTooltipBadge === `${p.id}-gap`}
                      onToggle={(open) => setActiveTooltipBadge(open ? `${p.id}-gap` : null)}
                      icon={<span className="text-xs">🎯</span>}
                      title={lang === 'bn' ? 'মার্কেটিং ও বাস্তবের ব্যবধান' : lang === 'hi' ? 'मार्केटिंग रियलिटी गैप' : 'Marketing Reality Gap'}
                      description={
                        lang === 'bn'
                          ? `নির্মাতার বিজ্ঞাপনের দাবি এবং যাচাইকৃত মালিকদের পরিমাপ করা বাস্তব টেলিমেট্রির মধ্যে ${p.realityGapScore}% অমিল। কম শতাংশ ভালো (≤১২% চমৎকার, >২২% অতিরঞ্জিত দাবি)।`
                          : lang === 'hi'
                          ? `निर्माता के विज्ञापन दावों और सत्यापित मालिकों से मापी गई वास्तविक टेलीमेट्री के बीच ${p.realityGapScore}% का अंतर। कम प्रतिशत बेहतर है (≤12% उत्कृष्ट, >22% अधिक अंतर)।`
                          : `Measures the variance between manufacturer advertising claims (battery life, peak speed, endurance) and real telemetry measured from verified owners. Lower is better (≤12% is best-in-class, >22% indicates inflated claims).`
                      }
                      benchmarkLabel="Benchmark"
                      benchmarkValue={p.realityGapScore <= 12 ? '≤12% Best-in-Class' : p.realityGapScore <= 22 ? '13–22% Typical' : '>22% Disputed'}
                      badge={
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold border transition-colors ${
                            p.realityGapScore <= 12
                              ? 'border-brand-emerald/40 bg-brand-emerald/15 text-brand-emerald hover:bg-brand-emerald/25'
                              : p.realityGapScore <= 22
                              ? 'border-brand-sky/40 bg-brand-sky/15 text-brand-sky hover:bg-brand-sky/25'
                              : 'border-brand-rose/40 bg-brand-rose/15 text-brand-rose hover:bg-brand-rose/25'
                          }`}
                        >
                          🎯 {p.realityGapScore}% Gap
                        </span>
                      }
                    />
                  )}

                  {/* Fair Price Status */}
                  {p.fairPriceStatus && (
                    <BadgeTooltip
                      align="left"
                      isOpen={activeTooltipBadge === `${p.id}-price`}
                      onToggle={(open) => setActiveTooltipBadge(open ? `${p.id}-price` : null)}
                      icon={<span className="text-xs">{p.fairPriceStatus === 'steal_deal' ? '🟢' : p.fairPriceStatus === 'fair_market' ? '🔵' : '🔴'}</span>}
                      title={
                        p.fairPriceStatus === 'steal_deal'
                          ? (lang === 'bn' ? 'সেরা ডিল (Steal Deal)' : lang === 'hi' ? 'शानदार सौदा (Steal Deal)' : 'Fair Price: Steal Deal')
                          : p.fairPriceStatus === 'fair_market'
                          ? (lang === 'bn' ? 'ন্যায্য বাজার মূল্য' : lang === 'hi' ? 'उचित बाज़ार मूल्य' : 'Fair Market Price')
                          : (lang === 'bn' ? 'অতিরিক্ত দাম (অপেক্ষা করুন)' : lang === 'hi' ? 'अधिक कीमत (इंतज़ार करें)' : 'Overpriced (Wait for Sale)')
                      }
                      description={
                        p.fairPriceStatus === 'steal_deal'
                          ? (lang === 'bn'
                              ? 'বর্তমান বিক্রয় মূল্য শীর্ষ ভারতীয় স্টোরগুলোর বিগত ৯০ দিনের সর্বনিম্ন মূল্যের সমান বা কম। সেরা সাশ্রয়ী ডিল।'
                              : lang === 'hi'
                              ? 'मौजूदा बिक्री मूल्य प्रमुख भारतीय स्टोर्स के 90-दिन के न्यूनतम ऐतिहासिक मूल्य के बराबर या उससे कम है। अत्यधिक किफायती सौदा।'
                              : 'Selling at or below the 90-day verified lowest price across top Indian retailers (Amazon, Flipkart, brand store). Exceptional value-to-performance.')
                          : p.fairPriceStatus === 'fair_market'
                          ? (lang === 'bn'
                              ? 'বর্তমান মূল্য বিগত ৯০ দিনের যাচাইকৃত বাজার দরের স্বাভাবিক গড়ের সাথে সংগতিপূর্ণ।'
                              : lang === 'hi'
                              ? 'मौजूदा कीमत पिछले 90 दिनों के सत्यापित सामान्य बाज़ार औसत के अनुरूप है।'
                              : 'Current price aligns with the 90-day verified median historical price baseline.')
                          : (lang === 'bn'
                              ? 'বর্তমান মূল্য ঐতিহাসিক গড়ের চেয়ে বেশি। উৎসবের অফার বা পরবর্তী মূল্যহ্রাসের জন্য অপেক্ষা করার পরামর্শ দেওয়া হচ্ছে।'
                              : lang === 'hi'
                              ? 'मौजूदा कीमत ऐतिहासिक औसत से अधिक है। आगामी सेल या मूल्य गिरावट का इंतज़ार करने की सलाह दी जाती है।'
                              : 'Currently priced above historical averages. Consider waiting for an upcoming festive sale or refresh discount.')
                      }
                      benchmarkLabel="Retail History"
                      benchmarkValue={p.fairPriceStatus === 'steal_deal' ? '90-Day Low' : p.fairPriceStatus === 'fair_market' ? 'Median Price' : 'Above Average'}
                      badge={
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold border transition-colors ${
                            p.fairPriceStatus === 'steal_deal'
                              ? 'border-brand-emerald/40 bg-brand-emerald/15 text-brand-emerald hover:bg-brand-emerald/25'
                              : p.fairPriceStatus === 'fair_market'
                              ? 'border-brand-sky/40 bg-brand-sky/15 text-brand-sky hover:bg-brand-sky/25'
                              : 'border-brand-rose/40 bg-brand-rose/15 text-brand-rose hover:bg-brand-rose/25'
                          }`}
                        >
                          {p.fairPriceStatus === 'steal_deal' && `🟢 ${t('stealDeal', lang)}`}
                          {p.fairPriceStatus === 'fair_market' && `🔵 ${t('fairMarket', lang)}`}
                          {p.fairPriceStatus === 'overpriced' && `🔴 ${t('overpriced', lang)}`}
                        </span>
                      }
                    />
                  )}

                  {/* Reliability Grade */}
                  {p.reliabilityGrade && (
                    <BadgeTooltip
                      align="right"
                      isOpen={activeTooltipBadge === `${p.id}-grade`}
                      onToggle={(open) => setActiveTooltipBadge(open ? `${p.id}-grade` : null)}
                      icon={<span className="text-xs">🏆</span>}
                      title={lang === 'bn' ? `স্থায়িত্ব গ্রেড ${p.reliabilityGrade}` : lang === 'hi' ? `विश्वसनीयता ग्रेड ${p.reliabilityGrade}` : `Reliability & Longevity: Grade ${p.reliabilityGrade}`}
                      description={
                        lang === 'bn'
                          ? `১২-২৪+ মাস ব্যবহারকারী মালিকদের দীর্ঘমেয়াদী চেক-ইন তথ্যের ভিত্তিতে প্রস্তুত। ব্যাটারি ক্ষয়, হার্ডওয়্যার স্থায়িত্ব ও যন্ত্রাংশের সহজলভ্যতায় গ্রেড ${p.reliabilityGrade} শীর্ষমানের স্থায়িত্ব নির্দেশ করে।`
                          : lang === 'hi'
                          ? `12–24+ महीने के मालिक चेक-इन के आधार पर निर्धारित। बैटरी क्षय, हार्डवेयर स्थायित्व और स्पेयर पार्ट्स की उपलब्धता में ग्रेड ${p.reliabilityGrade} शीर्ष स्तर की दीर्घायु दर्शाता है।`
                          : `Computed from verified 12–24+ month owner check-ins evaluating battery health retention, motherboard integrity, parts availability, and repairability. Grade ${p.reliabilityGrade} indicates top-tier long-term endurance.`
                      }
                      benchmarkLabel="Longevity Score"
                      benchmarkValue={p.reliabilityGrade === 'A+' ? '9.5+ / 10 Minimal Decay' : p.reliabilityGrade === 'A' ? '8.5–9.4 / 10 Solid' : 'Moderate Decay'}
                      badge={
                        <span className="rounded bg-bg-surface border border-[var(--border-subtle)] px-1.5 py-0.5 font-semibold text-content-primary hover:border-brand-emerald/50 transition-colors">
                          🏆 Grade {p.reliabilityGrade}
                        </span>
                      }
                    />
                  )}

                  {/* 1-Yr Resale Retention */}
                  {p.resaleRetentionPercent !== undefined && (
                    <BadgeTooltip
                      align="right"
                      isOpen={activeTooltipBadge === `${p.id}-resale`}
                      onToggle={(open) => setActiveTooltipBadge(open ? `${p.id}-resale` : null)}
                      icon={<span className="text-xs">📈</span>}
                      title={lang === 'bn' ? '১ বছরের রিসেল মূল্য সংরক্ষণ' : lang === 'hi' ? '1-वर्षीय रीसेल मूल्य प्रतिधारण' : '1-Year Resale Value Retention'}
                      description={
                        lang === 'bn'
                          ? `১২ মাস স্বাভাবিক ব্যবহারের পর ভারতীয় এক্সচেঞ্জ ও সেকেন্ডারি মার্কেটপ্লেসে (যেমন Cashify, ট্রেড-ইন) আনুমানিক ${p.resaleRetentionPercent}% ক্রয়মূল্য অক্ষুণ্ণ থাকে।`
                          : lang === 'hi'
                          ? `12 महीने के सामान्य उपयोग के बाद भारतीय एक्सचेंज और सेकेंडरी मार्केट (जैसे Cashify, ट्रेड-इन) में अनुमानित ${p.resaleRetentionPercent}% खरीद मूल्य सुरक्षित रहता है।`
                          : `Estimated percentage of original purchase price retained after 12 months on verified secondary and trade-in marketplaces in India (Cashify, OLX, exchange programs).`
                      }
                      benchmarkLabel="1-Year Retention"
                      benchmarkValue={`${p.resaleRetentionPercent}% of Original Price`}
                      badge={
                        <span className="rounded bg-bg-surface border border-[var(--border-subtle)] px-1.5 py-0.5 text-content-secondary hover:border-brand-sky/50 transition-colors">
                          📈 {p.resaleRetentionPercent}% Resale
                        </span>
                      }
                    />
                  )}
                </div>

                {/* Verified Owners & Overall Score */}
                <div className="mt-3 flex items-center justify-between rounded-button bg-bg-surface p-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-emerald/15 text-brand-emerald">
                      <ShieldCheck size={14} />
                    </div>
                    <div>
                      <div className="text-[10px] text-content-muted">{t('verifiedOwners', lang)}</div>
                      <div className="font-semibold text-content-primary">{p.verified_owners} {lang === 'bn' ? 'যাচাইকৃত' : lang === 'hi' ? 'सत्यापित' : 'verified'}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 rounded-pill bg-brand-amber/15 px-2.5 py-1 text-xs font-black text-brand-amber">
                    <Star size={13} className="fill-brand-amber" />
                    <span>{p.owner_rating ? `${p.owner_rating.toFixed(1)} / 10` : '—'}</span>
                  </div>
                </div>

                {/* ── 5 Key Verified Metrics [1-10] ── */}
                <div className="mt-3.5 space-y-2 rounded-button border border-[var(--border-subtle)] bg-bg-surface/50 p-2.5">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-content-muted">
                    <span>Verified Telemetry</span>
                    <span>Score (1-10)</span>
                  </div>

                  <ScoreBar
                    icon={<Camera size={12} />}
                    label={p.category === 'bike' || p.category === 'car' ? 'Build / Ergonomics' : 'Camera'}
                    score={scores.camera}
                    color="emerald"
                  />
                  <ScoreBar
                    icon={<Battery size={12} />}
                    label={p.category === 'bike' || p.category === 'car' ? 'Mileage / Fuel' : 'Battery'}
                    score={scores.battery}
                    color="sky"
                  />
                  <ScoreBar
                    icon={<Cpu size={12} />}
                    label="Performance"
                    score={scores.performance}
                    color="amber"
                  />
                  <ScoreBar
                    icon={<Smartphone size={12} />}
                    label={p.category === 'bike' || p.category === 'car' ? 'Cockpit / Display' : 'Display'}
                    score={scores.display}
                    color="emerald"
                  />
                  <ScoreBar
                    icon={<Volume2 size={12} />}
                    label="Multimedia / Audio"
                    score={scores.multimedia}
                    color="sky"
                  />
                </div>

                {/* Real-world Telemetry vs Claimed */}
                {(p.measured_specs || p.claimed_specs) && (
                  <div className="mt-2.5 rounded bg-bg-surface/40 p-2 text-[11px] text-content-muted">
                    <div className="font-semibold text-content-secondary">Owner Telemetry:</div>
                    <div className="truncate text-brand-emerald">
                      {Object.entries(p.measured_specs)[0]
                        ? `${Object.entries(p.measured_specs)[0][0]}: ${Object.entries(p.measured_specs)[0][1]}`
                        : p.summary ?? 'Verified by real owners'}
                    </div>
                  </div>
                )}

                {/* The Good & The Bad Teaser */}
                {(p.theGood?.[0] || p.theBad?.[0]) && (
                  <div className="mt-2 space-y-1 rounded border border-[var(--border-subtle)] bg-bg-surface/30 p-2 text-[11px]">
                    {p.theGood?.[0] && (
                      <div className="flex items-center gap-1.5 text-brand-emerald font-medium truncate">
                        <CheckCircle2 size={12} className="shrink-0" />
                        <span className="truncate">{p.theGood[0]}</span>
                      </div>
                    )}
                    {p.theBad?.[0] && (
                      <div className="flex items-center gap-1.5 text-brand-rose font-medium truncate">
                        <AlertTriangle size={12} className="shrink-0" />
                        <span className="truncate">{p.theBad[0]}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  {/* Compare Checkbox Button */}
                  <button
                    onClick={() => toggleCompare(p.id)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-button border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                      isComparing
                        ? 'border-brand-emerald bg-brand-emerald/15 text-brand-emerald'
                        : 'border-[var(--border-subtle)] bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary',
                    )}
                  >
                    {isComparing ? (
                      <>
                        <Check size={13} /> Comparing
                      </>
                    ) : (
                      <>
                        <Scale size={13} /> Compare
                      </>
                    )}
                  </button>

                  {/* Give Review Button */}
                  <button
                    onClick={() => setReviewProduct(p)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-button border border-[var(--border-subtle)] bg-bg-surface px-2.5 py-1.5 text-xs font-semibold text-content-secondary hover:border-brand-emerald hover:text-brand-emerald"
                  >
                    <Plus size={13} /> Rate (1-10)
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* View Details / Reviews */}
                  <Button
                    variant="outline"
                    onClick={() => setDetailProduct(p)}
                    className="flex-1 px-2.5 py-1.5 text-xs"
                  >
                    <MessageSquare size={13} /> Reviews ({p.reviews?.length ?? 0})
                  </Button>

                  {/* Buy Button */}
                  <Button
                    variant="solid"
                    onClick={() => buy(p.id)}
                    className="flex-1 bg-brand-emerald text-[#04110b] font-bold px-2.5 py-1.5 text-xs"
                  >
                    Buy <ExternalLink size={13} />
                  </Button>
                </div>

                {/* 6-Month Decay & Ask Owner Shortcuts */}
                <div className="flex items-center gap-1.5 text-[10px] pt-1 border-t border-[var(--border-subtle)]">
                  <button
                    onClick={() => {
                      setActiveDecayProductId(p.id);
                      setHubTab('decay');
                    }}
                    className="flex-1 rounded bg-bg-surface py-1 text-center font-medium text-content-muted hover:text-brand-emerald hover:bg-bg-elevated"
                  >
                    📉 6-Mo Decay Log
                  </button>
                  <button
                    onClick={() => {
                      setActiveAskProductId(p.id);
                      setHubTab('ask_owner');
                    }}
                    className="flex-1 rounded bg-bg-surface py-1 text-center font-medium text-content-muted hover:text-brand-sky hover:bg-bg-elevated"
                  >
                    💬 Ask Owners
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      </>
      )}
    </div>
  );
}

// ── Category Tab Button ──────────────────────────────────────────────────
function CategoryButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-button px-3 py-2 text-xs font-semibold transition-all',
        active
          ? 'bg-brand-emerald text-[#04110b] shadow-sm'
          : 'bg-bg-surface text-content-secondary hover:bg-bg-elevated hover:text-content-primary',
      )}
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span
        className={cn(
          'rounded-pill px-1.5 py-0.5 font-mono text-[10px]',
          active ? 'bg-black/20 text-[#04110b]' : 'bg-bg-elevated text-content-muted',
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ── Interactive Badge Tooltip (Click/Tap for Phone & Desktop) ───────────
function BadgeTooltip({
  badge,
  icon,
  title,
  description,
  benchmarkLabel,
  benchmarkValue,
  align = 'left',
  isOpen: controlledIsOpen,
  onToggle,
}: {
  badge: React.ReactNode;
  icon?: React.ReactNode;
  title: string;
  description: string;
  benchmarkLabel?: string;
  benchmarkValue?: string;
  align?: 'left' | 'right';
  isOpen?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const setIsOpen = useCallback((valOrFn: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof valOrFn === 'function' ? valOrFn(isOpen) : valOrFn;
    if (onToggle) {
      onToggle(nextVal);
    } else {
      setInternalIsOpen(nextVal);
    }
  }, [isOpen, onToggle]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleOutsideClick(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen, setIsOpen]);

  return (
    <div ref={containerRef} className={cn('relative inline-flex', isOpen ? 'z-50' : 'z-auto')}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Tap to learn what this metric means"
        className="group inline-flex items-center cursor-pointer transition-transform active:scale-95 focus:outline-none"
      >
        {badge}
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'absolute bottom-full mb-2 z-[60] w-64 sm:w-72 rounded-card border border-[var(--border-strong)] p-3.5 shadow-2xl text-left text-xs text-content-secondary animate-in fade-in zoom-in-95',
            align === 'right' ? 'right-0 sm:left-auto' : 'left-0 sm:right-auto',
          )}
          style={{
            backgroundColor: 'var(--bg-surface)',
            boxShadow: '0 20px 45px -4px rgba(0, 0, 0, 0.45), 0 0 0 1px var(--border-strong)',
            opacity: 1,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2 mb-2">
            <div className="flex items-center gap-1.5 font-bold text-xs text-content-primary">
              {icon}
              <span>{title}</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="text-content-muted hover:text-content-primary p-1 rounded-full hover:bg-bg-elevated transition-colors"
              aria-label="Close tooltip"
            >
              <X size={13} />
            </button>
          </div>

          {/* Description */}
          <p className="text-[11px] leading-relaxed text-content-secondary">
            {description}
          </p>

          {/* Benchmark info pill if present */}
          {benchmarkLabel && benchmarkValue && (
            <div
              className="mt-2.5 flex items-center justify-between rounded px-2.5 py-1.5 text-[10px] border border-[var(--border-subtle)]"
              style={{ backgroundColor: 'var(--bg-elevated)' }}
            >
              <span className="text-content-muted font-medium">{benchmarkLabel}</span>
              <span className="font-bold text-brand-emerald">{benchmarkValue}</span>
            </div>
          )}

          {/* Footer cue */}
          <div className="mt-2.5 pt-1.5 border-t border-[var(--border-subtle)] text-[9px] text-content-muted flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Info size={11} className="text-brand-emerald shrink-0" />
              <span>Tap badge or outside to dismiss</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 1-10 Metric Score Bar ────────────────────────────────────────────────
function ScoreBar({
  icon,
  label,
  score,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  score: number;
  color: 'emerald' | 'sky' | 'amber';
}) {
  const percentage = Math.min(Math.max((score / 10) * 100, 0), 100);

  const colorMap = {
    emerald: 'bg-brand-emerald text-brand-emerald',
    sky: 'bg-brand-sky text-brand-sky',
    amber: 'bg-brand-amber text-brand-amber',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium text-content-secondary">
          <span className="text-content-muted">{icon}</span>
          {label}
        </span>
        <span className={cn('font-mono font-bold', colorMap[color].split(' ')[1])}>
          {score.toFixed(1)} <span className="text-[10px] text-content-muted font-normal">/ 10</span>
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
        <div
          className={cn('h-full rounded-full transition-all duration-300', colorMap[color].split(' ')[0])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ── Product Drill-Down Page (Full In-Page Experience) ─────────────────────
function ProductDrillDownPage({
  product,
  allProducts,
  onSelectProduct,
  onClose,
  onOpenReview,
  onBuy,
  lang = 'en',
}: {
  product: Product;
  allProducts?: Product[];
  onSelectProduct?: (p: Product) => void;
  onClose: () => void;
  onOpenReview: () => void;
  onBuy: (id: string) => void;
  lang?: import('@/lib/types').Lang;
}) {
  const [dailyCommuteKm, setDailyCommuteKm] = useState(35);
  const [activeDrillTab, setActiveDrillTab] = useState<'verdict' | 'specs' | 'price_history' | 'issues' | 'spares' | 'reviews'>('verdict');

  const scores = product.scores ?? {
    camera: 7.5,
    battery: 8.0,
    performance: 7.8,
    display: 8.0,
    multimedia: 7.7,
  };

  const betterAlt = allProducts?.find((p) => p.id === product.betterAlternativeId);

  // Commute ROI calculations
  const petrolPricePerLiter = 105;
  const evUnitCost = 8.5;
  const isEv = product.category === 'bike' && Boolean(product.hardwareFeatures?.fastCharging);
  const realMileage = product.hardwareFeatures?.realMileageKmpl ?? (product.category === 'bike' ? 45 : 14);
  const monthlyPetrolSpend = Math.round(((dailyCommuteKm * 30) / realMileage) * petrolPricePerLiter);
  const monthlyEvSpend = Math.round((dailyCommuteKm * 30 * 0.035) * evUnitCost);
  const monthlySavings = Math.max(0, monthlyPetrolSpend - monthlyEvSpend);
  const annualSavings = monthlySavings * 12;

  return (
    <div className="space-y-5 section-enter">
      {/* ── Top Navigation Bar ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} /> {lang === 'bn' ? 'প্রোডাক্ট হাবে ফিরে যান' : lang === 'hi' ? 'प्रोडक्ट हब पर वापस जाएं' : 'Back to Product Hub'}
        </button>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-brand-emerald">
            {product.brand} · {product.category.toUpperCase()}
          </span>
          {product.reliabilityGrade && (
            <span className="rounded-pill bg-brand-emerald/15 px-2 py-0.5 text-[10px] font-bold text-brand-emerald">
              Grade {product.reliabilityGrade} Longevity
            </span>
          )}
        </div>
      </div>

      <div className="rounded-card border border-[var(--border-strong)] bg-bg-surface p-5 sm:p-6 shadow-xl space-y-5">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-emerald">
            <span>{product.brand}</span>
            <span>·</span>
            <span>{product.category.toUpperCase()}</span>
            {product.reliabilityGrade && (
              <BadgeTooltip
                align="left"
                icon={<span className="text-xs">🏆</span>}
                title={lang === 'bn' ? `স্থায়িত্ব গ্রেড ${product.reliabilityGrade}` : lang === 'hi' ? `विश्वसनीयता ग्रेड ${product.reliabilityGrade}` : `Reliability & Longevity: Grade ${product.reliabilityGrade}`}
                description={
                  lang === 'bn'
                    ? `১২-২৪+ মাস ব্যবহারকারী মালিকদের দীর্ঘমেয়াদী তথ্যের ভিত্তিতে নির্ধারিত। ব্যাটারি ক্ষয়, হার্ডওয়্যার স্থায়িত্ব ও যন্ত্রাংশের সহজলভ্যতায় গ্রেড ${product.reliabilityGrade} শীর্ষমানের স্থায়িত্ব নির্দেশ করে।`
                    : lang === 'hi'
                    ? `12–24+ महीने के मालिक चेक-इन के आधार पर निर्धारित। बैटरी क्षय, हार्डवेयर स्थायित्व और स्पेयर पार्ट्स की उपलब्धता में ग्रेड ${product.reliabilityGrade} शीर्ष स्तर की दीर्घायु दर्शाता है।`
                    : `Computed from verified 12–24+ month owner check-ins evaluating battery health retention, motherboard integrity, parts availability, and repairability. Grade ${product.reliabilityGrade} indicates top-tier long-term endurance.`
                }
                benchmarkLabel="Longevity Score"
                benchmarkValue={product.reliabilityGrade === 'A+' ? '9.5+ / 10 Minimal Decay' : '8.5+ / 10 Solid'}
                badge={
                  <span className="rounded-pill bg-brand-emerald/15 px-2 py-0.5 text-[10px] font-bold text-brand-emerald hover:bg-brand-emerald/25 transition-colors">
                    Grade {product.reliabilityGrade} Longevity
                  </span>
                }
              />
            )}
          </div>
          <h1 className="text-2xl font-black text-content-primary mt-1">{product.name}</h1>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span className="font-mono text-lg font-bold text-content-primary">
              {product.price_inr !== null ? formatINR(product.price_inr).replace(/\.00$/, '') : '—'}
            </span>
            <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)">
              {product.merchant}
            </Badge>
            <div className="flex items-center gap-1 rounded-pill bg-brand-amber/15 px-2 py-0.5 text-xs font-bold text-brand-amber">
              <Star size={12} className="fill-brand-amber" />
              {product.owner_rating?.toFixed(1) ?? '—'} / 10
            </div>
            {product.fairPriceStatus && (
              <BadgeTooltip
                align="left"
                icon={<span className="text-xs">{product.fairPriceStatus === 'steal_deal' ? '🟢' : product.fairPriceStatus === 'fair_market' ? '🔵' : '🔴'}</span>}
                title={
                  product.fairPriceStatus === 'steal_deal'
                    ? (lang === 'bn' ? 'সেরা ডিল (Steal Deal)' : lang === 'hi' ? 'शानदार सौदा (Steal Deal)' : 'Fair Price: Steal Deal')
                    : product.fairPriceStatus === 'fair_market'
                    ? (lang === 'bn' ? 'ন্যায্য বাজার মূল্য' : lang === 'hi' ? 'उचित बाज़ार मूल्य' : 'Fair Market Price')
                    : (lang === 'bn' ? 'অতিরিক্ত দাম (অপেক্ষা করুন)' : lang === 'hi' ? 'अधिक कीमत (इंतज़ार करें)' : 'Overpriced (Wait for Sale)')
                }
                description={
                  product.fairPriceStatus === 'steal_deal'
                    ? 'Selling at or below the 90-day verified lowest price across top Indian retailers (Amazon, Flipkart, brand store). Exceptional value-to-performance.'
                    : product.fairPriceStatus === 'fair_market'
                    ? 'Current price aligns with the 90-day verified median historical price baseline.'
                    : 'Currently priced above historical averages. Consider waiting for an upcoming festive sale or refresh discount.'
                }
                benchmarkLabel="Retail History"
                benchmarkValue={product.fairPriceStatus === 'steal_deal' ? '90-Day Low' : product.fairPriceStatus === 'fair_market' ? 'Median Price' : 'Above Average'}
                badge={
                  <span
                    className={`rounded-pill px-2 py-0.5 text-xs font-bold border transition-colors ${
                      product.fairPriceStatus === 'steal_deal'
                        ? 'border-brand-emerald/40 bg-brand-emerald/15 text-brand-emerald hover:bg-brand-emerald/25'
                        : product.fairPriceStatus === 'fair_market'
                        ? 'border-brand-sky/40 bg-brand-sky/15 text-brand-sky hover:bg-brand-sky/25'
                        : 'border-brand-rose/40 bg-brand-rose/15 text-brand-rose hover:bg-brand-rose/25'
                    }`}
                  >
                    {product.fairPriceStatus === 'steal_deal' && '🟢 Steal Deal'}
                    {product.fairPriceStatus === 'fair_market' && '🔵 Fair Market Price'}
                    {product.fairPriceStatus === 'overpriced' && '🔴 Overpriced (Wait)'}
                  </span>
                }
              />
            )}
          </div>
        </div>

        {/* ── Sub-Navigation Tabs Inside Modal ── */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-[var(--border-subtle)] text-xs">
          <button
            onClick={() => setActiveDrillTab('verdict')}
            className={`px-3 py-1.5 rounded-button font-bold transition-all shrink-0 ${
              activeDrillTab === 'verdict'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            🛡️ Reliable Summary & Pros/Cons
          </button>
          <button
            onClick={() => setActiveDrillTab('specs')}
            className={`px-3 py-1.5 rounded-button font-bold transition-all shrink-0 ${
              activeDrillTab === 'specs'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            📊 Verified Telemetry (1-10)
          </button>
          <button
            onClick={() => setActiveDrillTab('price_history')}
            className={`px-3 py-1.5 rounded-button font-bold transition-all shrink-0 ${
              activeDrillTab === 'price_history'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            📉 90-Day Price Trend
          </button>
          <button
            onClick={() => setActiveDrillTab('issues')}
            className={`px-3 py-1.5 rounded-button font-bold transition-all shrink-0 ${
              activeDrillTab === 'issues'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            ⚠️ Known Bugs & Fixes ({product.knownIssues?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveDrillTab('spares')}
            className={`px-3 py-1.5 rounded-button font-bold transition-all shrink-0 ${
              activeDrillTab === 'spares'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            🔧 Spares & 3-Yr TCO
          </button>
          <button
            onClick={() => setActiveDrillTab('reviews')}
            className={`px-3 py-1.5 rounded-button font-bold transition-all shrink-0 ${
              activeDrillTab === 'reviews'
                ? 'bg-brand-emerald text-[#04110b]'
                : 'text-content-secondary hover:text-content-primary'
            }`}
          >
            💬 Owner Reviews ({product.reviews?.length ?? 0})
          </button>
        </div>

        {/* ── TAB 1: EXECUTIVE VERDICT & PROS/CONS ── */}
        {activeDrillTab === 'verdict' && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {/* Most Reliable Summary Banner */}
            <div className="rounded-button border border-brand-emerald/40 bg-gradient-to-r from-brand-emerald/15 via-bg-elevated to-brand-emerald/5 p-4">
              <div className="flex items-center justify-between pb-2 border-b border-brand-emerald/20">
                <div className="flex items-center gap-1.5 text-xs font-bold text-brand-emerald">
                  <ShieldCheck size={16} /> Most Reliable Summary (Verified Owner Consensus)
                </div>
                <span className="text-[10px] font-bold text-brand-emerald bg-brand-emerald/20 px-2 py-0.5 rounded-pill">
                  96% Confidence ({product.verified_owners} GST/RC Owners)
                </span>
              </div>
              <p className="mt-2.5 text-xs text-content-primary leading-relaxed">
                {product.reliableSummary || product.summary}
              </p>
            </div>

            {/* Smart Better Alternative Banner */}
            {product.betterAlternativeId && (
              <div className="rounded-button border border-brand-sky/40 bg-brand-sky/10 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-brand-sky text-[11px] uppercase tracking-wider">
                    <Sparkles size={13} /> Better Spec-for-Money Alternative
                  </div>
                  <p className="mt-0.5 text-content-secondary text-xs">
                    {product.betterAlternativeReason}
                  </p>
                </div>
                {betterAlt && onSelectProduct && (
                  <Button
                    className="shrink-0 bg-brand-sky text-white text-xs font-bold px-3 py-1"
                    onClick={() => onSelectProduct(betterAlt)}
                  >
                    View {betterAlt.name.split(' ')[0]}
                  </Button>
                )}
              </div>
            )}

            {/* The Good & The Bad (Pros & Cons Matrix) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* The Good */}
              <div className="rounded-button border border-brand-emerald/30 bg-bg-elevated p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-emerald pb-1 border-b border-[var(--border-subtle)]">
                  <CheckCircle2 size={14} /> The Good (Verified Strengths)
                </div>
                <ul className="space-y-2 text-xs text-content-secondary">
                  {product.theGood && product.theGood.length > 0 ? (
                    product.theGood.map((g, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check size={13} className="text-brand-emerald shrink-0 mt-0.5" />
                        <span>{g}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-content-muted">Solid verified owner telemetry and everyday reliability.</li>
                  )}
                </ul>
              </div>

              {/* The Bad */}
              <div className="rounded-button border border-brand-rose/30 bg-bg-elevated p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-rose pb-1 border-b border-[var(--border-subtle)]">
                  <AlertTriangle size={14} /> The Bad (Catches & Shortcomings)
                </div>
                <ul className="space-y-2 text-xs text-content-secondary">
                  {product.theBad && product.theBad.length > 0 ? (
                    product.theBad.map((b, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <AlertTriangle size={13} className="text-brand-rose shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-content-muted">Minor compromises typical of its budget tier.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Quick Reality Gap & Longevity Snapshot (Interactive Tooltips) */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <BadgeTooltip
                align="left"
                icon={<span className="text-xs">🎯</span>}
                title="Marketing Reality Gap"
                description={`Measures the variance between manufacturer claims and real telemetry from verified owners. ${product.realityGapScore ?? 12}% gap indicates real-world alignment under daily workloads. Lower is better (≤12% is best-in-class).`}
                benchmarkLabel="Benchmark"
                benchmarkValue={(product.realityGapScore ?? 12) <= 12 ? '≤12% Best-in-Class' : (product.realityGapScore ?? 12) <= 22 ? '13–22% Typical' : '>22% Disputed'}
                badge={
                  <div className="w-full rounded-button bg-bg-elevated p-2 border border-[var(--border-subtle)] hover:border-brand-emerald/40 transition-colors">
                    <div className="text-[10px] text-content-muted flex items-center justify-center gap-1">
                      <span>Marketing Reality Gap</span>
                      <Info size={10} className="text-content-muted" />
                    </div>
                    <div className="font-mono font-bold text-brand-emerald text-sm mt-0.5">
                      {product.realityGapScore ?? 12}%
                    </div>
                  </div>
                }
              />
              <BadgeTooltip
                align="left"
                icon={<span className="text-xs">📈</span>}
                title="1-Year Resale Value Retention"
                description={`Estimated ${product.resaleRetentionPercent ?? 65}% of original retail purchase price retained on trade-in and refurbished marketplaces after 12 months.`}
                benchmarkLabel="1-Year Retention"
                benchmarkValue={`${product.resaleRetentionPercent ?? 65}% Retained`}
                badge={
                  <div className="w-full rounded-button bg-bg-elevated p-2 border border-[var(--border-subtle)] hover:border-brand-sky/40 transition-colors">
                    <div className="text-[10px] text-content-muted flex items-center justify-center gap-1">
                      <span>1-Year Resale Value</span>
                      <Info size={10} className="text-content-muted" />
                    </div>
                    <div className="font-mono font-bold text-brand-sky text-sm mt-0.5">
                      {product.resaleRetentionPercent ?? 65}%
                    </div>
                  </div>
                }
              />
              <BadgeTooltip
                align="right"
                icon={<span className="text-xs">🔧</span>}
                title="Hardware Repairability Score"
                description="Evaluation of modular components, screen and battery replacement difficulty, and OEM spare parts availability in India."
                benchmarkLabel="Score Standard"
                benchmarkValue={`${product.repairabilityIndex ?? 7.5} / 10 Easy Repair`}
                badge={
                  <div className="w-full rounded-button bg-bg-elevated p-2 border border-[var(--border-subtle)] hover:border-brand-amber/40 transition-colors">
                    <div className="text-[10px] text-content-muted flex items-center justify-center gap-1">
                      <span>Repairability Score</span>
                      <Info size={10} className="text-content-muted" />
                    </div>
                    <div className="font-mono font-bold text-brand-amber text-sm mt-0.5">
                      {product.repairabilityIndex ?? 7.5} / 10
                    </div>
                  </div>
                }
              />
            </div>

            {/* Vehicle Commute ROI Calculator (if bike or car) */}
            {(product.category === 'bike' || product.category === 'car') && (
              <div className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-3.5 space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)]">
                  <span className="text-xs font-bold text-content-primary flex items-center gap-1.5">
                    <Fuel size={14} className="text-brand-amber" /> Daily Commute Fuel & ROI Calculator
                  </span>
                  <span className="text-xs font-bold text-brand-emerald">
                    {dailyCommuteKm} km / day
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={dailyCommuteKm}
                  onChange={(e) => setDailyCommuteKm(Number(e.target.value))}
                  className="w-full accent-brand-emerald"
                />
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-bg-surface p-2 border border-[var(--border-subtle)]">
                    <div className="text-[10px] text-content-muted">Estimated Monthly Petrol</div>
                    <div className="font-mono font-bold text-content-primary mt-0.5">
                      {formatINR(monthlyPetrolSpend)}/mo
                    </div>
                    <div className="text-[10px] text-content-muted">at {realMileage} km/l real</div>
                  </div>
                  <div className="rounded bg-bg-surface p-2 border border-[var(--border-subtle)]">
                    <div className="text-[10px] text-content-muted">
                      {isEv ? '⚡ EV Charging Cost' : 'Annual Fuel Budget'}
                    </div>
                    <div className="font-mono font-bold text-brand-emerald mt-0.5">
                      {isEv ? `${formatINR(monthlyEvSpend)}/mo` : `${formatINR(monthlyPetrolSpend * 12)}/yr`}
                    </div>
                    {isEv && (
                      <div className="text-[10px] text-brand-emerald font-semibold">
                        Saves ~{formatINR(annualSavings)}/yr
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: SPECS & REALITY GAP ── */}
        {activeDrillTab === 'specs' && (
          <div className="mt-4 space-y-4 animate-fade-in">
            {/* 1-10 Ratings Card */}
            <div className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-content-secondary mb-3">
                Verified Owner Scores [1-10]
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ScoreBar icon={<Camera size={14} />} label="Camera Quality" score={scores.camera} color="emerald" />
                <ScoreBar icon={<Battery size={14} />} label="Battery Life / Range" score={scores.battery} color="sky" />
                <ScoreBar icon={<Cpu size={14} />} label="Performance & Speed" score={scores.performance} color="amber" />
                <ScoreBar icon={<Smartphone size={14} />} label="Display & Brightness" score={scores.display} color="emerald" />
                <ScoreBar icon={<Volume2 size={14} />} label="Multimedia & Sound" score={scores.multimedia} color="sky" />
              </div>
            </div>

            {/* Claimed vs Measured Specs */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-content-muted">Claimed Marketing Specs</div>
                <ul className="mt-2 space-y-1.5 text-xs text-content-secondary">
                  {Object.entries(product.claimed_specs).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span className="capitalize text-content-muted">{k}:</span>
                      <span className="font-medium text-content-primary">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-button border border-brand-emerald/30 bg-brand-emerald/5 p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-brand-emerald">
                  Owner Measured Telemetry
                </div>
                <ul className="mt-2 space-y-1.5 text-xs">
                  {Object.entries(product.measured_specs).map(([k, v]) => (
                    <li key={k} className="flex justify-between">
                      <span className="capitalize text-content-muted">{k}:</span>
                      <span className="font-semibold text-brand-emerald">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Software Support Track Record */}
            {product.softwareSupport && (
              <div className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-3 text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-content-muted mb-2">
                  Software Support & Patch Rollout
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-bg-surface p-2">
                    <div className="text-[10px] text-content-muted">Promised OS Upgrades</div>
                    <div className="font-bold text-content-primary mt-0.5">{product.softwareSupport.promisedYears} Years</div>
                  </div>
                  <div className="rounded bg-bg-surface p-2">
                    <div className="text-[10px] text-content-muted">Security Patch Grade</div>
                    <div className="font-bold text-brand-emerald mt-0.5">Grade {product.softwareSupport.securityPatchGrade}</div>
                  </div>
                  <div className="rounded bg-bg-surface p-2">
                    <div className="text-[10px] text-content-muted">Rollout Punctuality</div>
                    <div className="font-bold text-brand-sky mt-0.5">
                      {product.softwareSupport.isPunctual ? 'On Schedule' : 'Delayed'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: 90-DAY PRICE TREND & FAIR VALUE ── */}
        {activeDrillTab === 'price_history' && (
          <div className="mt-4 space-y-4 animate-fade-in">
            <div className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                    90-Day Verified Price History
                  </h4>
                  <div className="text-xs text-content-muted mt-0.5">
                    Tracked across Amazon, Flipkart & Brand Authorized Dealers
                  </div>
                </div>
                <Badge
                  color={product.fairPriceStatus === 'steal_deal' ? 'var(--brand-emerald)' : 'var(--brand-sky)'}
                  bg={product.fairPriceStatus === 'steal_deal' ? 'rgba(16,185,129,0.15)' : 'rgba(14,165,233,0.12)'}
                  className="font-bold text-xs"
                >
                  {product.fairPriceStatus === 'steal_deal' ? '🟢 Great Time to Buy' : 'Fair Price'}
                </Badge>
              </div>

              {/* Price Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
                <div className="rounded bg-bg-surface p-2 border border-[var(--border-subtle)]">
                  <div className="text-[10px] text-content-muted">All-Time Low</div>
                  <div className="font-mono font-bold text-brand-emerald mt-0.5">
                    {formatINR(product.allTimeLowInr ?? (product.price_inr ? product.price_inr * 0.9 : 0)).replace(/\.00$/, '')}
                  </div>
                </div>
                <div className="rounded bg-bg-surface p-2 border border-[var(--border-subtle)]">
                  <div className="text-[10px] text-content-muted">Current Price</div>
                  <div className="font-mono font-bold text-content-primary mt-0.5">
                    {product.price_inr ? formatINR(product.price_inr).replace(/\.00$/, '') : '—'}
                  </div>
                </div>
                <div className="rounded bg-bg-surface p-2 border border-[var(--border-subtle)]">
                  <div className="text-[10px] text-content-muted">All-Time High</div>
                  <div className="font-mono font-bold text-brand-rose mt-0.5">
                    {formatINR(product.allTimeHighInr ?? (product.price_inr ? product.price_inr * 1.1 : 0)).replace(/\.00$/, '')}
                  </div>
                </div>
              </div>

              {/* Visual Sparkline Timeline */}
              {product.priceHistory && (
                <div className="mt-3 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-content-muted">
                    Historical Milestones
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {product.priceHistory.map((pt, idx) => (
                      <div key={idx} className="rounded bg-bg-surface p-2 border border-[var(--border-subtle)] text-center text-xs">
                        <div className="text-[10px] text-content-muted">{pt.date}</div>
                        <div className="font-mono font-bold text-content-primary mt-0.5">
                          {formatINR(pt.price_inr).replace(/\.00$/, '')}
                        </div>
                        {pt.event && (
                          <span className="inline-block mt-1 rounded bg-brand-emerald/15 px-1.5 py-0.5 text-[9px] font-bold text-brand-emerald">
                            {pt.event}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: KNOWN ISSUES & FIXES REGISTRY ── */}
        {activeDrillTab === 'issues' && (
          <div className="mt-4 space-y-3 animate-fade-in">
            <div className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-3 text-xs text-content-secondary">
              <span className="font-bold text-content-primary">Crowdsourced Bug & Fix Registry:</span> Confirmed issues reported by verified owners along with tested workarounds.
            </div>

            {(!product.knownIssues || product.knownIssues.length === 0) ? (
              <div className="rounded-button bg-bg-elevated p-5 text-center text-xs text-content-muted border border-[var(--border-subtle)]">
                <CheckCircle2 size={20} className="mx-auto text-brand-emerald mb-2" />
                No major bugs or firmware issues reported for this product. Clean bill of health from verified owners!
              </div>
            ) : (
              product.knownIssues.map((iss) => (
                <div key={iss.id} className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-content-primary flex items-center gap-1.5">
                      <AlertTriangle size={13} className={iss.severity === 'high' ? 'text-brand-rose' : 'text-brand-amber'} />
                      {iss.title}
                    </span>
                    <span className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 bg-brand-amber/15 text-brand-amber">
                      {iss.verifiedCount} Owners Confirmed
                    </span>
                  </div>
                  <div className="text-[11px] text-content-muted">
                    Affected Firmware: <span className="text-content-secondary">{iss.affectedVersions}</span>
                  </div>
                  <div className="rounded bg-brand-emerald/5 border border-brand-emerald/20 p-2 text-[11px] text-brand-emerald">
                    <span className="font-bold">Verified Fix / Workaround:</span> {iss.fixOrWorkaround}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB 5: SPARES & 3-YEAR TCO ── */}
        {activeDrillTab === 'spares' && (
          <div className="mt-4 space-y-4 animate-fade-in">
            <div className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                    Official Out-of-Warranty Spare Parts
                  </h4>
                  <div className="text-[11px] text-content-muted">
                    Turnaround times and pricing from authorized service centers
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-content-muted">3-Year TCO Estimate</div>
                  <div className="font-mono text-sm font-extrabold text-brand-emerald">
                    {formatINR(product.threeYearTcoInr ?? (product.price_inr ? Math.round(product.price_inr * 1.35) : 0)).replace(/\.00$/, '')}
                  </div>
                </div>
              </div>

              {product.spareParts && product.spareParts.length > 0 ? (
                <div className="space-y-2">
                  {product.spareParts.map((sp, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded bg-bg-surface p-2.5 text-xs border border-[var(--border-subtle)]">
                      <div>
                        <div className="font-bold text-content-primary">{sp.partName}</div>
                        <div className="text-[10px] text-content-muted">
                          Turnaround: ~{sp.turnaroundDays} business days · {sp.ratioOfProductPrice}% of product price
                        </div>
                      </div>
                      <div className="font-mono font-bold text-content-primary">
                        {formatINR(sp.costInr).replace(/\.00$/, '')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-content-muted text-center py-2">
                  Spare parts pricing is currently being updated by service sentinels.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 6: REVIEWS LIST ── */}
        {activeDrillTab === 'reviews' && (
          <div className="mt-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-content-secondary">
                Verified Owner Reviews ({product.reviews?.length ?? 0})
              </h4>
              <Button variant="outline" onClick={onOpenReview} className="px-2.5 py-1 text-xs">
                <Plus size={13} /> Write Review
              </Button>
            </div>

            <div className="space-y-3">
              {(!product.reviews || product.reviews.length === 0) ? (
                <div className="rounded-button bg-bg-elevated p-4 text-center text-xs text-content-muted">
                  No detailed reviews yet. Be the first verified owner to rate this product!
                </div>
              ) : (
                product.reviews.map((rev) => (
                  <div key={rev.id} className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-content-primary">
                        <span>@{rev.reviewerName}</span>
                        {rev.isVerifiedOwner ? (
                          <span className="inline-flex items-center gap-1 rounded-pill bg-brand-emerald px-2 py-0.5 text-[11px] font-bold text-[#04110b] shadow-sm">
                            <BadgeCheck size={12} />
                            {rev.reviewerBadge ?? 'Verified Owner · 3× Weight'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-pill border border-[var(--border-subtle)] bg-bg-surface px-2 py-0.5 text-[11px] font-semibold text-content-muted">
                            Community Review · Unverified
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-brand-amber">
                        ★ {rev.overallScore.toFixed(1)} / 10
                      </span>
                    </div>

                    <p className="mt-2 text-content-secondary">{rev.comment}</p>

                    {/* Individual Scores */}
                    <div className="mt-2.5 flex flex-wrap gap-2 text-[10px] text-content-muted">
                      <span className="rounded bg-bg-surface px-1.5 py-0.5">Camera: {rev.scores.camera}/10</span>
                      <span className="rounded bg-bg-surface px-1.5 py-0.5">Battery: {rev.scores.battery}/10</span>
                      <span className="rounded bg-bg-surface px-1.5 py-0.5">Perf: {rev.scores.performance}/10</span>
                      <span className="rounded bg-bg-surface px-1.5 py-0.5">Display: {rev.scores.display}/10</span>
                      <span className="rounded bg-bg-surface px-1.5 py-0.5">Audio: {rev.scores.multimedia}/10</span>
                    </div>

                    {rev.measuredTelemetry && (
                      <div className="mt-2 text-[11px] text-brand-emerald">
                        ⚡ Measured: {rev.measuredTelemetry}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Page Footer Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <Button variant="outline" onClick={onClose}>
            <ArrowLeft size={14} className="mr-1" /> {lang === 'bn' ? 'প্রোডাক্ট হাবে ফিরে যান' : lang === 'hi' ? 'प्रोडक्ट हब पर वापस जाएं' : 'Back to Product Hub'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onOpenReview}>
              <Plus size={14} /> Add Review
            </Button>
            <Button onClick={() => onBuy(product.id)} className="bg-brand-emerald text-[#04110b] font-bold">
              Buy Now <ExternalLink size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Review Submission Page (Full In-Page Experience) ─────────────────────
function ProductReviewPage({
  product,
  onClose,
  onSubmit,
  currentUsername,
  lang = 'en',
}: {
  product: Product;
  onClose: () => void;
  onSubmit: (review: ProductReview) => void;
  currentUsername: string;
  lang?: import('@/lib/types').Lang;
}) {
  const [camera, setCamera] = useState<number>(8);
  const [battery, setBattery] = useState<number>(8);
  const [performance, setPerformance] = useState<number>(8);
  const [display, setDisplay] = useState<number>(8);
  const [multimedia, setMultimedia] = useState<number>(8);
  const [comment, setComment] = useState('');
  const [telemetry, setTelemetry] = useState('');
  const [proText, setProText] = useState('');
  const [conText, setConText] = useState('');
  const [isVerifiedOwner, setIsVerifiedOwner] = useState(true);
  const [evidenceType, setEvidenceType] = useState('None');
  const [evidenceNotes, setEvidenceNotes] = useState('');

  const overall = Number(((camera + battery + performance + display + multimedia) / 5).toFixed(1));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) {
      alert('Please enter a brief review or feedback.');
      return;
    }

    const review: ProductReview = {
      id: `rev-${Date.now()}`,
      productId: product.id,
      reviewerName: currentUsername,
      reviewerBadge: isVerifiedOwner ? 'Verified Owner · GST Invoice' : 'Community Reviewer',
      isVerifiedOwner,
      scores: {
        camera,
        battery,
        performance,
        display,
        multimedia,
      },
      overallScore: overall,
      comment: evidenceType !== 'None' ? `${comment.trim()} [Attached Evidence - ${evidenceType}: ${evidenceNotes}]` : comment.trim(),
      pros: proText ? proText.split(',').map((s) => s.trim()) : undefined,
      cons: conText ? conText.split(',').map((s) => s.trim()) : undefined,
      measuredTelemetry: telemetry.trim() || undefined,
      createdAt: new Date().toISOString().split('T')[0],
    };

    onSubmit(review);
  }

  return (
    <div className="space-y-5 section-enter">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} /> {lang === 'bn' ? 'প্রোডাক্টে ফিরে যান' : lang === 'hi' ? 'उत्पाद पर वापस जाएं' : 'Back to Product'}
        </button>
        <span className="text-xs font-bold text-brand-emerald">
          {product.brand} · {product.name}
        </span>
      </div>

      <div className="rounded-card border border-[var(--border-strong)] bg-bg-surface p-5 sm:p-6 shadow-xl space-y-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-emerald">
            <BadgeCheck size={14} /> Verified Owner Review
          </div>
          <h2 className="text-xl font-black text-content-primary mt-1">Rate {product.name}</h2>
          <p className="mt-0.5 text-xs text-content-muted">
            Rate key metrics on a 1-10 scale. Verified telemetry informs fellow buyers.
          </p>
        </div>

        {/* Live Overall Score */}
        <div className="flex items-center justify-between rounded-button bg-brand-emerald/10 border border-brand-emerald/30 p-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-emerald">
              Overall Calculated Rating
            </div>
            <div className="text-xs text-content-muted">Average of 5 telemetry parameters</div>
          </div>
          <div className="font-mono text-xl font-black text-brand-emerald">
            {overall.toFixed(1)} <span className="text-xs font-normal">/ 10</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Sliders for the 5 metrics */}
          <RatingSlider
            icon={<Camera size={15} />}
            label={product.category === 'bike' || product.category === 'car' ? 'Build Quality' : 'Camera'}
            value={camera}
            onChange={setCamera}
          />
          <RatingSlider
            icon={<Battery size={15} />}
            label={product.category === 'bike' || product.category === 'car' ? 'Mileage / Fuel' : 'Battery Life'}
            value={battery}
            onChange={setBattery}
          />
          <RatingSlider
            icon={<Cpu size={15} />}
            label="Performance & Speed"
            value={performance}
            onChange={setPerformance}
          />
          <RatingSlider
            icon={<Smartphone size={15} />}
            label={product.category === 'bike' || product.category === 'car' ? 'Cockpit / Dashboard' : 'Display Quality'}
            value={display}
            onChange={setDisplay}
          />
          <RatingSlider
            icon={<Volume2 size={15} />}
            label="Multimedia & Audio"
            value={multimedia}
            onChange={setMultimedia}
          />

          {/* Real Telemetry Input */}
          <div>
            <label className="text-xs font-semibold text-content-secondary">
              Real-world measured telemetry (optional):
            </label>
            <input
              type="text"
              value={telemetry}
              onChange={(e) => setTelemetry(e.target.value)}
              placeholder="e.g. 7.2 hours SOT, 52 km/l verified, 0-100% in 45m"
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-elevated px-3 py-2 text-xs text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
            />
          </div>

          {/* Review Text */}
          <div>
            <label className="text-xs font-semibold text-content-secondary">
              Your Review & Real Experience:
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What stands out? How does it perform in real life vs marketing claims?"
              className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-2.5 text-xs text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
              required
            />
          </div>

          {/* Pros & Cons */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-content-secondary">Pros (comma separated)</label>
              <input
                type="text"
                value={proText}
                onChange={(e) => setProText(e.target.value)}
                placeholder="Great OIS, fast charging"
                className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-elevated px-2.5 py-1.5 text-xs text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-content-secondary">Cons (comma separated)</label>
              <input
                type="text"
                value={conText}
                onChange={(e) => setConText(e.target.value)}
                placeholder="Bloatware, plastic frame"
                className="mt-1 w-full rounded-button border border-[var(--border-subtle)] bg-bg-elevated px-2.5 py-1.5 text-xs text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
              />
            </div>
          </div>

          {/* Evidence / Proof Upload */}
          <div className="rounded-button border border-[var(--border-subtle)] bg-bg-elevated p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-content-secondary flex items-center gap-1.5">
                <ImageIcon size={14} className="text-brand-sky" /> Attach Evidence Proof (Optional)
              </span>
              <span className="text-[10px] text-brand-emerald font-bold">+2× Credibility Weight</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[11px] text-content-muted">Proof Type</label>
                <CustomSelect
                  value={evidenceType}
                  onChange={setEvidenceType}
                  variant="card"
                  size="sm"
                  align="left"
                  className="mt-1 w-full"
                  buttonClassName="w-full justify-between"
                  options={[
                    { value: 'None', label: 'None' },
                    { value: 'Battery SOT Screenshot', label: 'Battery SOT Screenshot' },
                    { value: 'Camera RAW Sample', label: 'Camera RAW Sample' },
                    { value: 'Service Center Bill', label: 'Service Center Bill' },
                    { value: 'Odometer Mileage Photo', label: 'Odometer Mileage Photo' },
                    { value: 'GST Purchase Invoice', label: 'GST Purchase Invoice' },
                  ]}
                />
              </div>
              <div>
                <label className="text-[11px] text-content-muted">Proof Details / Notes</label>
                <input
                  type="text"
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="e.g. 7.2h SOT screen capture"
                  className="mt-1 w-full rounded border border-[var(--border-subtle)] bg-bg-surface p-1.5 text-xs text-content-primary focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Owner Status Verification Toggle */}
          <div className="flex items-center justify-between rounded bg-bg-surface p-2.5 text-xs border border-[var(--border-subtle)]">
            <div>
              <div className="font-semibold text-content-primary">Reviewer Credibility Tier</div>
              <div className="text-[10px] text-content-muted">Verified Owners receive 3× weighting</div>
            </div>
            <button
              type="button"
              onClick={() => setIsVerifiedOwner(!isVerifiedOwner)}
              className={`rounded px-2.5 py-1 text-[11px] font-bold ${
                isVerifiedOwner
                  ? 'bg-brand-emerald text-[#04110b]'
                  : 'bg-bg-elevated text-content-muted'
              }`}
            >
              {isVerifiedOwner ? '✓ Verified Owner' : 'Community Reviewer'}
            </button>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-brand-emerald text-[#04110b] font-bold">
              Submit Review
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Interactive 1-10 Rating Control ──────────────────────────────────────
function RatingSlider({
  icon,
  label,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-button bg-bg-elevated/70 p-2.5">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="flex items-center gap-1.5 font-medium text-content-secondary">
          <span className="text-content-muted">{icon}</span>
          {label}
        </span>
        <span className="font-mono text-xs font-bold text-brand-emerald">{value} / 10</span>
      </div>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
          const selected = value === num;
          return (
            <button
              key={num}
              type="button"
              onClick={() => onChange(num)}
              className={cn(
                'flex-1 rounded py-1 font-mono text-[11px] font-bold transition-all',
                selected
                  ? 'bg-brand-emerald text-[#04110b] scale-105 shadow-sm'
                  : 'bg-bg-surface text-content-muted hover:bg-bg-elevated hover:text-content-primary',
              )}
            >
              {num}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Side-by-Side Product Comparison Page (Full In-Page Experience) ──────
function ProductComparePage({
  productIds,
  allProducts,
  onClose,
  onRemove,
  onBuy,
  lang = 'en',
}: {
  productIds: string[];
  allProducts: Product[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onBuy: (id: string) => void;
  lang?: import('@/lib/types').Lang;
}) {
  const products = useMemo(
    () => allProducts.filter((p) => productIds.includes(p.id)),
    [allProducts, productIds],
  );

  if (products.length === 0) {
    return null;
  }

  const cols = `minmax(120px,160px) repeat(${products.length}, minmax(180px,1fr))`;

  const rows: {
    label: string;
    render: (p: Product) => React.ReactNode;
  }[] = [
    {
      label: 'Price',
      render: (p) => (
        <span className="font-mono font-bold text-content-primary">
          {p.price_inr !== null ? formatINR(p.price_inr).replace(/\.00$/, '') : '—'}
        </span>
      ),
    },
    {
      label: 'Overall Score',
      render: (p) => (
        <span className="inline-flex items-center gap-1 font-mono font-bold text-brand-amber">
          <Star size={13} className="fill-brand-amber" /> {p.owner_rating?.toFixed(1) ?? '—'} / 10
        </span>
      ),
    },
    {
      label: 'Verified Owners',
      render: (p) => (
        <span className="inline-flex items-center gap-1 text-content-secondary">
          <BadgeCheck size={13} className="text-brand-emerald" /> {p.verified_owners} verified
        </span>
      ),
    },
    {
      label: 'Camera [1-10]',
      render: (p) => (
        <span className="font-mono font-bold text-brand-emerald">
          {p.scores?.camera?.toFixed(1) ?? '—'}
        </span>
      ),
    },
    {
      label: 'Battery [1-10]',
      render: (p) => (
        <span className="font-mono font-bold text-brand-sky">
          {p.scores?.battery?.toFixed(1) ?? '—'}
        </span>
      ),
    },
    {
      label: 'Performance [1-10]',
      render: (p) => (
        <span className="font-mono font-bold text-brand-amber">
          {p.scores?.performance?.toFixed(1) ?? '—'}
        </span>
      ),
    },
    {
      label: 'Display [1-10]',
      render: (p) => (
        <span className="font-mono font-bold text-brand-emerald">
          {p.scores?.display?.toFixed(1) ?? '—'}
        </span>
      ),
    },
    {
      label: 'Multimedia [1-10]',
      render: (p) => (
        <span className="font-mono font-bold text-brand-sky">
          {p.scores?.multimedia?.toFixed(1) ?? '—'}
        </span>
      ),
    },
    {
      label: 'Claimed Specs',
      render: (p) => (
        <div className="space-y-0.5 text-[11px] text-content-muted">
          {Object.entries(p.claimed_specs).map(([k, v]) => (
            <div key={k}>
              <span className="capitalize">{k}:</span> {v}
            </div>
          ))}
        </div>
      ),
    },
    {
      label: 'Measured Telemetry',
      render: (p) => (
        <div className="space-y-0.5 text-[11px] text-brand-emerald">
          {Object.entries(p.measured_specs).map(([k, v]) => (
            <div key={k}>
              <span className="capitalize">{k}:</span> {v}
            </div>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5 section-enter">
      {/* ── Top Bar with Back Button ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="press-effect flex items-center gap-2 text-sm font-semibold text-content-secondary hover:text-content-primary transition-colors"
        >
          <ArrowLeft size={18} /> {lang === 'bn' ? 'প্রোডাক্ট হাবে ফিরে যান' : lang === 'hi' ? 'प्रोडक्ट हब पर वापस जाएं' : 'Back to Product Hub'}
        </button>
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-brand-emerald" />
          <span className="text-xs font-bold text-content-primary">
            Comparing {products.length} Products
          </span>
        </div>
      </div>

      <div className="rounded-card border border-[var(--border-strong)] bg-bg-surface p-5 sm:p-6 shadow-xl flex flex-col space-y-4">
        <div>
          <h2 className="text-xl font-bold text-content-primary">Side-by-Side Product Comparison</h2>
          <p className="text-xs text-content-muted">Comparing {products.length} products on verified 1-10 telemetry ratings</p>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <div className="grid text-xs border border-[var(--border-subtle)] rounded-lg overflow-hidden" style={{ gridTemplateColumns: cols }}>
            {/* Top row: Product Headers */}
            <div className="border-b border-[var(--border-subtle)] bg-bg-elevated p-3 font-bold text-content-secondary">
              Product
            </div>
            {products.map((p) => (
              <div
                key={p.id}
                className="relative border-b border-l border-[var(--border-subtle)] bg-bg-elevated p-3"
              >
                <button
                  onClick={() => onRemove(p.id)}
                  title="Remove from comparison"
                  className="absolute right-2 top-2 rounded p-0.5 text-content-muted hover:text-brand-rose"
                >
                  <X size={14} />
                </button>
                <div className="text-[10px] uppercase font-bold text-content-muted">{p.brand}</div>
                <div className="font-bold text-content-primary text-sm mt-0.5 pr-4">{p.name}</div>
                <Badge color="var(--brand-sky)" bg="rgba(14,165,233,0.12)" className="mt-1">
                  {p.merchant}
                </Badge>
              </div>
            ))}

            {/* Matrix Data Rows */}
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <div className="border-b border-[var(--border-subtle)] bg-bg-surface/70 p-3 font-semibold text-content-muted">
                  {row.label}
                </div>
                {products.map((p) => (
                  <div
                    key={p.id + row.label}
                    className="border-b border-l border-[var(--border-subtle)] bg-bg-surface p-3"
                  >
                    {row.render(p)}
                  </div>
                ))}
              </div>
            ))}

            {/* Buy Row */}
            <div className="p-3 bg-bg-elevated font-bold text-content-muted">Buy Link</div>
            {products.map((p) => (
              <div key={p.id + 'buy'} className="border-l border-[var(--border-subtle)] bg-bg-elevated p-3">
                <Button className="w-full bg-brand-emerald text-[#04110b] font-bold px-2.5 py-1.5 text-xs" onClick={() => onBuy(p.id)}>
                  Buy <ExternalLink size={13} />
                </Button>
                {p.primary_reviewer && (
                  <div className="mt-1 flex items-center gap-1 text-[10px] text-content-muted">
                    <BadgeCheck size={11} className="text-brand-emerald" />
                    @{p.primary_reviewer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--border-subtle)] pt-4 text-right">
          <Button variant="outline" onClick={onClose} className="px-3.5 py-1.5 text-xs">
            <ArrowLeft size={14} className="mr-1" /> {lang === 'bn' ? 'প্রোডাক্ট হাবে ফিরে যান' : lang === 'hi' ? 'प्रोडक्ट हब पर वापस जाएं' : 'Back to Product Hub'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductFilterBar — sticky, floating chip-filter bar matching NewsHub.
// All of: View (hub tab), Category (with counts), Focus (option), Price
// (slider popup), Sort, Search (icon toggle), Advanced (chip).
// ─────────────────────────────────────────────────────────────────────────────

interface ProductFilterBarProps {
  hubTab: 'browse' | 'battles' | 'copilot' | 'decay' | 'ask_owner' | 'service_radar';
  setHubTab: (t: ProductFilterBarProps['hubTab']) => void;
  selectedCategory: ProductCategory | 'all';
  setSelectedCategory: (c: ProductCategory | 'all') => void;
  categoryCounts: { all: number; mobile: number; bike: number; car: number; laptop: number };
  selectedOption: string;
  setSelectedOption: (o: string) => void;
  optionFilters: { id: string; label: string }[];
  customMinPrice: string;
  setCustomMinPrice: (v: string) => void;
  customMaxPrice: string;
  setCustomMaxPrice: (v: string) => void;
  priceCap: number;
  selectedSort: 'default' | 'rating_desc' | 'owners_desc' | 'price_asc' | 'price_desc' | 'gap_asc' | 'tco_asc' | 'resale_desc' | 'repair_desc';
  setSelectedSort: (s: ProductFilterBarProps['selectedSort']) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isAdvancedFiltersOpen: boolean;
  setIsAdvancedFiltersOpen: (v: boolean) => void;
  lang: Lang;
}

type PBMenu = null | 'view' | 'category' | 'focus' | 'price' | 'sort';

function ProductFilterBar(p: ProductFilterBarProps) {
  const [openMenu, setOpenMenu] = useState<PBMenu>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const hubOptions: { id: ProductFilterBarProps['hubTab']; icon: React.ReactNode; label: string }[] = [
    { id: 'browse', icon: <Search size={13} />, label: 'Browse & Compare' },
    { id: 'battles', icon: <Flame size={13} />, label: 'Head-to-Head Battles' },
    { id: 'copilot', icon: <Sparkles size={13} />, label: 'AI Decision Copilot' },
    { id: 'decay', icon: <Clock size={13} />, label: '6-Mo Decay Index' },
    { id: 'ask_owner', icon: <MessageSquare size={13} />, label: 'Ask a Verified Owner' },
    { id: 'service_radar', icon: <Wrench size={13} />, label: 'Service Center Radar' },
  ];
  const hubLabel = hubOptions.find((o) => o.id === p.hubTab)?.label ?? 'Browse';

  const categoryOptions: { id: ProductCategory | 'all'; icon: React.ReactNode; label: string; count: number }[] = [
    { id: 'all', icon: <Sparkles size={13} />, label: 'All', count: p.categoryCounts.all },
    { id: 'mobile', icon: <Smartphone size={13} />, label: 'Mobiles', count: p.categoryCounts.mobile },
    { id: 'bike', icon: <Bike size={13} />, label: 'Bikes & Scooters', count: p.categoryCounts.bike },
    { id: 'car', icon: <Car size={13} />, label: 'Cars', count: p.categoryCounts.car },
    { id: 'laptop', icon: <Laptop size={13} />, label: 'Laptops', count: p.categoryCounts.laptop },
  ];
  const catMeta = categoryOptions.find((o) => o.id === p.selectedCategory) ?? categoryOptions[0];

  const sortOptions: { value: ProductFilterBarProps['selectedSort']; label: string; icon?: string }[] = [
    { value: 'default', label: 'Recommended' },
    { value: 'rating_desc', label: 'Highest Rated', icon: '⭐' },
    { value: 'owners_desc', label: 'Most Verified Owners', icon: '👥' },
    { value: 'price_asc', label: 'Price: Low → High', icon: '💵' },
    { value: 'price_desc', label: 'Price: High → Low', icon: '💎' },
    { value: 'gap_asc', label: 'Smallest Claim Gap', icon: '🎯' },
    { value: 'tco_asc', label: 'Lowest TCO', icon: '💰' },
    { value: 'resale_desc', label: 'Best Resale', icon: '📈' },
    { value: 'repair_desc', label: 'Easiest to Repair', icon: '🔧' },
  ];
  const sortMeta = sortOptions.find((o) => o.value === p.selectedSort) ?? sortOptions[0];

  const focusMeta = p.optionFilters.find((o) => o.id === p.selectedOption) ?? p.optionFilters[0];

  const activeFilters =
    (p.selectedCategory !== 'mobile' ? 1 : 0) +
    (p.selectedOption !== 'all' ? 1 : 0) +
    ((p.customMinPrice || p.customMaxPrice) ? 1 : 0) +
    (p.searchQuery.trim() ? 1 : 0);

  const priceChipLabel = p.customMinPrice || p.customMaxPrice
    ? `₹${Number(p.customMinPrice || 0).toLocaleString()} – ₹${Number(p.customMaxPrice || p.priceCap).toLocaleString()}`
    : 'Price range';

  return (
    <div
      className="sticky z-20 -mx-4 bg-bg-primary backdrop-blur-md lg:!top-0"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}
    >
      <div className="px-3 py-2">
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-full border border-[var(--border-strong)] bg-bg-elevated/95 px-2 py-1.5 shadow-xl backdrop-blur-xl no-scrollbar">
          <PFChip
            icon={hubOptions.find((o) => o.id === p.hubTab)?.icon}
            label={hubLabel}
            active
            open={openMenu === 'view'}
            onClick={() => setOpenMenu(openMenu === 'view' ? null : 'view')}
          />
          <PFChip
            icon={catMeta.icon}
            label={`${catMeta.label} · ${catMeta.count}`}
            active={p.selectedCategory !== 'mobile'}
            open={openMenu === 'category'}
            onClick={() => setOpenMenu(openMenu === 'category' ? null : 'category')}
          />
          {p.hubTab === 'browse' && p.optionFilters.length > 0 && (
            <PFChip
              icon={<span>{(focusMeta?.label ?? '').slice(0, 2)}</span>}
              label={focusMeta?.label ? focusMeta.label.replace(/^[^\s]+\s/, '') : 'Focus'}
              active={p.selectedOption !== 'all'}
              open={openMenu === 'focus'}
              onClick={() => setOpenMenu(openMenu === 'focus' ? null : 'focus')}
            />
          )}
          {p.hubTab === 'browse' && (
            <>
              <PFChip
                icon={<IndianRupee size={13} />}
                label={priceChipLabel}
                active={Boolean(p.customMinPrice || p.customMaxPrice)}
                open={openMenu === 'price'}
                onClick={() => setOpenMenu(openMenu === 'price' ? null : 'price')}
              />
              <PFChip
                icon={<ArrowUpDown size={13} />}
                label={sortMeta.label}
                open={openMenu === 'sort'}
                onClick={() => setOpenMenu(openMenu === 'sort' ? null : 'sort')}
              />
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                aria-label="Toggle search"
                aria-pressed={searchOpen || p.searchQuery.length > 0}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-xs transition-all focus:outline-none focus:ring-1 focus:ring-brand-sky/50',
                  searchOpen || p.searchQuery.length > 0
                    ? 'border-brand-sky bg-brand-sky/15 text-brand-sky shadow-sm'
                    : 'border-[var(--border-subtle)] bg-bg-surface text-content-primary hover:border-brand-sky/40',
                )}
              >
                <Search size={13} />
                {p.searchQuery.length > 0 ? 'On' : ''}
              </button>
              <button
                onClick={() => p.setIsAdvancedFiltersOpen(!p.isAdvancedFiltersOpen)}
                aria-pressed={p.isAdvancedFiltersOpen}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium shadow-xs transition-all focus:outline-none focus:ring-1 focus:ring-brand-emerald/50',
                  p.isAdvancedFiltersOpen
                    ? 'border-brand-emerald bg-brand-emerald text-[#04110b] shadow-sm'
                    : 'border-[var(--border-subtle)] bg-bg-surface text-content-primary hover:border-brand-emerald/40',
                )}
              >
                <SlidersHorizontal size={13} />
                Advanced
              </button>
            </>
          )}

          {activeFilters > 0 && (
            <button
              onClick={() => {
                p.setSelectedCategory('mobile');
                p.setSelectedOption('all');
                p.setCustomMinPrice('');
                p.setCustomMaxPrice('');
                p.setSearchQuery('');
              }}
              className="ml-auto shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold text-brand-rose hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="px-4 pb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-muted" />
            <input
              autoFocus
              type="text"
              value={p.searchQuery}
              onChange={(e) => p.setSearchQuery(e.target.value)}
              placeholder="Search by name, brand, or option…"
              className="w-full rounded-full border border-[var(--border-subtle)] bg-bg-surface py-2 pl-9 pr-9 text-xs text-content-primary placeholder:text-content-muted focus:border-brand-emerald focus:outline-none"
            />
            {p.searchQuery && (
              <button
                onClick={() => p.setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-primary"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {openMenu === 'view' && (
        <PFDropdown onClose={() => setOpenMenu(null)}>
          {hubOptions.map((o) => (
            <PFRow
              key={o.id}
              selected={p.hubTab === o.id}
              onClick={() => {
                p.setHubTab(o.id);
                setOpenMenu(null);
              }}
              icon={o.icon}
              label={o.label}
            />
          ))}
        </PFDropdown>
      )}

      {openMenu === 'category' && (
        <PFDropdown onClose={() => setOpenMenu(null)}>
          {categoryOptions.map((o) => (
            <PFRow
              key={o.id}
              selected={p.selectedCategory === o.id}
              onClick={() => {
                p.setSelectedCategory(o.id);
                setOpenMenu(null);
              }}
              icon={o.icon}
              label={`${o.label} · ${o.count}`}
            />
          ))}
        </PFDropdown>
      )}

      {openMenu === 'focus' && (
        <PFDropdown onClose={() => setOpenMenu(null)}>
          {p.optionFilters.map((o) => (
            <PFRow
              key={o.id}
              selected={p.selectedOption === o.id}
              onClick={() => {
                p.setSelectedOption(o.id);
                setOpenMenu(null);
              }}
              icon={<span>{o.label.split(' ')[0]}</span>}
              label={o.label.replace(/^[^\s]+\s/, '')}
            />
          ))}
        </PFDropdown>
      )}

      {openMenu === 'sort' && (
        <PFDropdown onClose={() => setOpenMenu(null)}>
          {sortOptions.map((o) => (
            <PFRow
              key={o.value}
              selected={p.selectedSort === o.value}
              onClick={() => {
                p.setSelectedSort(o.value);
                setOpenMenu(null);
              }}
              icon={<span>{o.icon ?? '•'}</span>}
              label={o.label}
            />
          ))}
        </PFDropdown>
      )}

      {openMenu === 'price' && (
        <PFDropdown onClose={() => setOpenMenu(null)}>
          <PriceSlider
            min={Number(p.customMinPrice) || 0}
            max={Number(p.customMaxPrice) || p.priceCap}
            cap={p.priceCap}
            onChange={(mn, mx) => {
              p.setCustomMinPrice(mn > 0 ? String(mn) : '');
              p.setCustomMaxPrice(mx < p.priceCap ? String(mx) : '');
            }}
            onReset={() => {
              p.setCustomMinPrice('');
              p.setCustomMaxPrice('');
            }}
          />
        </PFDropdown>
      )}
    </div>
  );
}

function PFChip({
  icon,
  label,
  active,
  open,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  active?: boolean;
  open?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-haspopup="listbox"
      aria-expanded={open}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium shadow-xs transition-all focus:outline-none focus:ring-1 focus:ring-brand-emerald/50',
        active
          ? 'border-brand-emerald bg-brand-emerald text-[#04110b] shadow-sm'
          : open
            ? 'border-brand-emerald bg-bg-elevated text-content-primary ring-1 ring-brand-emerald/30'
            : 'border-[var(--border-subtle)] bg-bg-surface text-content-primary hover:border-brand-emerald/40',
      )}
    >
      {icon && <span className={cn('shrink-0', !active && 'text-content-muted')}>{icon}</span>}
      <span className="max-w-[11rem] truncate">{label}</span>
      <ChevronDown
        size={12}
        className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180', !active && 'text-content-muted')}
      />
    </button>
  );
}

function PFDropdown({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useListboxKeys({ open: true, containerRef: ref, onClose });
  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  return (
    <div className="px-4 pb-3">
      <div
        ref={ref}
        role="listbox"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="animate-fade-in max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border-strong)] bg-bg-elevated p-1.5 shadow-2xl backdrop-blur-xl"
      >
        {children}
      </div>
    </div>
  );
}

function PFRow({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="option"
      aria-selected={selected}
      tabIndex={0}
      data-listbox-option
      data-active={selected ? 'true' : undefined}
      className={cn(
        'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs transition-colors',
        selected
          ? 'bg-brand-emerald/10 font-bold text-brand-emerald'
          : 'text-content-secondary hover:bg-bg-primary hover:text-content-primary',
      )}
    >
      <span className="flex min-w-0 items-center gap-2 truncate">
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      {selected && <Check size={13} className="shrink-0 text-brand-emerald" />}
    </button>
  );
}

function PriceSlider({
  min,
  max,
  cap,
  onChange,
  onReset,
}: {
  min: number;
  max: number;
  cap: number;
  onChange: (min: number, max: number) => void;
  onReset: () => void;
}) {
  const step = cap > 1_000_000 ? 10_000 : cap > 200_000 ? 2000 : 500;
  const fmt = (n: number) =>
    n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(0)}k` : `₹${n}`;

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between text-xs font-mono font-semibold text-content-primary">
        <span>{fmt(min)}</span>
        <span>{fmt(max)}</span>
      </div>
      <div className="space-y-2">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-content-muted">Min</span>
          <input
            type="range"
            min={0}
            max={cap}
            step={step}
            value={min}
            onChange={(e) => {
              const v = Math.min(Number(e.target.value), max - step);
              onChange(v, max);
            }}
            className="mt-1 w-full accent-brand-emerald"
          />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-content-muted">Max</span>
          <input
            type="range"
            min={0}
            max={cap}
            step={step}
            value={max}
            onChange={(e) => {
              const v = Math.max(Number(e.target.value), min + step);
              onChange(min, v);
            }}
            className="mt-1 w-full accent-brand-emerald"
          />
        </label>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-content-muted">Range 0 – {fmt(cap)}</span>
        <button
          onClick={onReset}
          className="rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-semibold text-content-secondary hover:border-brand-rose/60 hover:text-brand-rose"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
