export interface LiveNewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  image: string | null;
  publishedAt: string;
  category: string;
}

// Shared domain types for VeriPulse.

export type Lang = 'en' | 'bn' | 'hi';
export type UserTier = 'sentinel_t1' | 'validator_t2' | 'public';
export type StoryStage = 'tier_1' | 'tier_2' | 'public' | 'quarantined';
export type AccountType = 'reader' | 'citizen_reporter' | 'pro_reporter' | 'journalist';
export type SubscriptionTier = 'free' | 'pro' | 'press';
export type JournalistVerificationStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type AuthProvider = 'email' | 'google' | 'phone' | 'digilocker' | 'preset';
export type VoteAction = 'real' | 'hoax' | 'needs_context';
export type DocType = 'vehicle_rc' | 'gst_invoice';
export type PayoutStatus =
  | 'queued'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'reversed';

export interface LocalizedText {
  en: string;
  bn: string;
  hi: string;
}

export interface SocialLinks {
  twitter?: string;
  instagram?: string;
  youtube?: string;
  linkedin?: string;
  whatsapp?: string;
  telegram?: string;
  website?: string;
}

export interface UserContact {
  id: string;
  name: string;
  phoneOrEmail: string;
  avatar?: string;
  isRegistered: boolean;
  username?: string;
  trustScore?: number;
  isFollowing?: boolean;
  isInvited?: boolean;
}

export interface NetworkUser {
  id: string;
  name: string;
  username: string;
  avatar: string;
  role: string;
  trustScore: number;
  isVerified: boolean;
  isOwnerVerified: boolean;
  followersCount: number;
  mutualFollowers?: number;
  isFollowing: boolean;
  bio: string;
  city: string;
  socials?: SocialLinks;
}

export interface Profile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  trust_score: number;
  tier: UserTier;
  badge: string;
  correct_votes: number;
  total_votes: number;
  wallet_balance_inr: number;
  wallet_balance_vpcoins?: number; // 10 VPcoins = 1 INR
  upi_id: string | null;
  home_lat: number | null;
  home_lng: number | null;
  preferred_lang: Lang;
  social_links?: SocialLinks;
  is_id_verified?: boolean;
  is_ownership_verified?: boolean;
  is_sentinel_verified?: boolean;
  is_journalist_verified?: boolean;
  is_press_pass_paid?: boolean;
  press_pass_expiry?: string;
  press_credential_id?: string;
  journalist_earnings_inr?: number;
  account_type?: AccountType;
  subscription_tier?: SubscriptionTier;
  subscription_expires_at?: string;
  daily_post_limit?: number; // 0 = none, -1 = unlimited
  posts_today?: number;
  journalist_verification_status?: JournalistVerificationStatus;
  journalist_employer?: string;
  auth_provider?: AuthProvider;
  is_admin?: boolean;
  followers_count?: number;
  following_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Story {
  id: string;
  author_id: string | null;
  category: string;
  location_name: string;
  lat: number | null;
  lng: number | null;
  titles: LocalizedText;
  summaries: LocalizedText;
  media_url: string | null;
  media_type: 'image' | 'video';
  c2pa_verified: boolean;
  ai_probability_score: number;
  credibility_score: number;
  rollout_stage: StoryStage;
  completeness_score: number;
  ad_impressions: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface StoryTimelineNode {
  id: string;
  story_id: string;
  contributor_id: string | null;
  update_text: LocalizedText;
  media_url: string | null;
  is_verified: boolean;
  created_at: string;
}

export type NewsCategory =
  | 'politics'
  | 'business'
  | 'tech'
  | 'health'
  | 'entertainment';

export interface NewsCategoryMeta {
  id: NewsCategory;
  name: string;
  description: string;
  iconName: string;
  popularTags: string[];
}

export interface NewsTimelineEvent {
  time: string;
  event: string;
  verifiedBy: string;
}

export interface NewsC2PAMetadata {
  issuer: string;
  algorithm: string;
  signatureHash: string;
  captureDevice: string;
  tamperProofStatus: string;
}

export interface NewsCommunityNote {
  author: string;
  role: string;
  comment: string;
  trustScore: number;
  timestamp: string;
}

export interface ReporterDispatch {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterUsername: string;
  reporterAvatar: string;
  reporterBadge: string;
  pressIdNumber?: string;
  submittedAt: string;
  originalDraft: string;
  matchScorePercent: number;
  pointsAwarded: number;
  earningsInr: number;
  location: string;
  c2paProofHash?: string;
  status: 'lead' | 'corroborating';
}

export interface NewsArticle {
  id: string;
  category: NewsCategory;
  categoryName: string;
  tags: string[];
  titles: LocalizedText;
  summaries: LocalizedText;
  source: string;
  sourceUrl?: string;
  publishedAt: string;
  mediaUrl?: string;
  c2paVerified: boolean;
  credibilityScore: number;
  aiProbabilityScore: number;
  readingTimeMinutes: number;
  locationName: string;
  keyTakeaways: string[];
  realVotes?: number;
  hoaxVotes?: number;
  contextVotes?: number;
  stage?: StoryStage;
  detailedAnalysis?: string;
  timeline?: NewsTimelineEvent[];
  c2paMetadata?: NewsC2PAMetadata;
  communityNotes?: NewsCommunityNote[];

  // Multi-reporter attribution & impact earnings:
  leadReporter?: ReporterDispatch;
  contributors?: ReporterDispatch[];
  impactScore?: number;
  totalImpactEarningsInr?: number;
  ingestionStatus?: 'buffer_active' | 'synthesized' | 'published';
  bufferExpiresAt?: string;
  dispatchesCount?: number;
}

export interface OwnershipVerification {
  id: string;
  user_id: string;
  document_type: DocType;
  product_category: string;
  brand_model: string;
  document_hash: string;
  masked_identifier: string;
  purchase_date: string | null;
  ocr_confidence: number;
  tamper_check_passed: boolean;
  created_at: string;
}

export interface PayoutRequest {
  id: string;
  user_id: string;
  amount_inr: number;
  amount_paise: number;
  upi_vpa: string;
  idempotency_key: string;
  razorpay_payout_id: string | null;
  bank_utr: string | null;
  status: PayoutStatus;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type ProductCategory = 'mobile' | 'bike' | 'car' | 'laptop';

export interface ProductMetricScores {
  camera: number;      // 1-10
  battery: number;     // 1-10 (battery life / mileage / range)
  performance: number; // 1-10
  display: number;     // 1-10
  multimedia: number;  // 1-10
  [key: string]: number | undefined;
}

export interface ProductReview {
  id: string;
  productId: string;
  reviewerName: string;
  reviewerBadge?: string;
  isVerifiedOwner: boolean;
  ownershipDocType?: 'gst_invoice' | 'vehicle_rc' | 'imei_serial';
  scores: ProductMetricScores;
  overallScore: number; // 1-10
  comment: string;
  pros?: string[];
  cons?: string[];
  measuredTelemetry?: string; // e.g. "6.8h SOT real usage", "48 km/l verified"
  createdAt: string;
}

export interface PriceHistoryPoint {
  date: string;
  price_inr: number;
  event?: string;
}

export interface KnownIssue {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  affectedVersions: string;
  fixOrWorkaround: string;
  verifiedCount: number;
}

export interface SparePartPrice {
  partName: string;
  costInr: number;
  turnaroundDays: number;
  ratioOfProductPrice: number;
}

export interface HardwareFeatures {
  headphoneJack?: boolean;
  microSdSlot?: boolean;
  waterResistance?: string;
  esimSupport?: boolean;
  cleanOs?: boolean;
  upgradableRam?: boolean;
  oledDisplay?: boolean;
  colorAccuracy?: string;
  usbCPowerDelivery?: boolean;
  dualChannelAbs?: boolean;
  fastCharging?: boolean;
  adasLevel?: string;
  realRangeKm?: number;
  realMileageKmpl?: number;
}

export interface HeadToHeadBattle {
  id: string;
  category: string;
  productAId: string;
  productBId: string;
  title: string;
  votes: {
    productA: number;
    productB: number;
  };
  metrics: {
    name: string;
    winnerId: string;
    note: string;
  }[];
}

export interface Product {
  id: string;
  name: string;
  brand?: string;
  category: string; // 'mobile' | 'bike' | 'car' | 'laptop'
  merchant: string;
  merchantUrl: string;
  price_inr: number | null;
  price_range?: string; // e.g. '<10k', '10-15k', '15-20k', '20-30k', '>30k'
  options?: string[]; // e.g. ['gaming', 'photography', 'casual', 'all-rounder']
  verified_owners: number;
  owner_rating: number | null; // 1-10 scale
  scores?: ProductMetricScores;
  claimed_specs: Record<string, string>;
  measured_specs: Record<string, string>;
  primary_reviewer: string | null;
  imageUrl?: string;
  summary?: string;
  reviews?: ProductReview[];

  // ── Advanced Transparency & Longevity Fields ──
  realityGapScore?: number; // % gap between marketing and measured telemetry (e.g. 18%)
  marketingDisputed?: boolean; // Exposed exaggeration flag
  threeYearTcoInr?: number; // Total Cost of Ownership across 3 years
  resaleRetentionPercent?: number; // 1-year resale value retention percentage (e.g. 68%)
  repairabilityIndex?: number; // 1-10 repairability score
  softwareSupport?: {
    promisedYears: number;
    securityPatchGrade: 'A+' | 'A' | 'B+' | 'B' | 'C';
    isPunctual: boolean;
  };
  spareParts?: SparePartPrice[];
  priceHistory?: PriceHistoryPoint[];
  fairPriceStatus?: 'steal_deal' | 'fair_market' | 'overpriced';
  allTimeLowInr?: number;
  allTimeHighInr?: number;
  hardwareFeatures?: HardwareFeatures;
  knownIssues?: KnownIssue[];
  reliableSummary?: string; // Consensus verdict synthesized from verified owners
  theGood?: string[]; // Verified real-world strengths
  theBad?: string[]; // Verified shortcomings and quirks
  betterAlternativeId?: string; // Link to better value device
  betterAlternativeReason?: string;
  reliabilityGrade?: 'A+' | 'A' | 'B+' | 'B' | 'C';
}

// ── Decay Index (6-month / 1-year long-term health tracking) ─────────
export interface DecayCheckIn {
  id: string;
  productId: string;
  ownerName: string;
  milestone: '3-month' | '6-month' | '1-year' | '2-year';
  batteryHealth?: number;       // percentage e.g. 92
  performanceScore?: number;    // 1-10
  issuesReported?: string[];    // e.g. ['Green line on display', 'Speaker rattle']
  repairHistory?: string;       // e.g. 'Screen replaced under warranty'
  serviceCost?: number;         // INR
  photos?: string[];            // base64 or URLs of battery screenshots / damage
  overallSatisfaction: number;  // 1-10
  comment: string;
  earnedAmount?: number;        // INR milestone grant earned
  createdAt: string;
}

export interface DecayTimeline {
  productId: string;
  productName: string;
  checkIns: DecayCheckIn[];
  avgDecayScore: number;        // 1-10 average satisfaction over time
  reliabilityGrade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F';
}

// ── Ask a Verified Owner (Q&A + Micro-consultations) ────────────────
export interface OwnerQuestion {
  id: string;
  productId: string;
  askerName: string;
  question: string;
  fee?: number;                 // INR micro-consultation fee (0 = free)
  isAnswered: boolean;
  answers: OwnerAnswer[];
  createdAt: string;
}

export interface OwnerAnswer {
  id: string;
  questionId: string;
  ownerName: string;
  ownerBadge: string;
  isVerifiedOwner: boolean;
  answer: string;
  helpfulCount: number;
  earnedAmount?: number;        // INR earned from answering
  createdAt: string;
}

// ── Service Center Truth Radar ──────────────────────────────────────
export interface ServiceCenterReview {
  id: string;
  brand: string;
  centerName: string;
  city: string;
  area?: string;
  category: string;             // 'mobile' | 'bike' | 'car' | 'laptop'
  reviewerName: string;
  isVerifiedOwner: boolean;
  issueType: string;            // e.g. 'Screen replacement', 'Battery swap', 'First service'
  turnaroundDays: number;
  costInr: number;
  warrantyHonored: boolean;
  rating: number;               // 1-10
  comment: string;
  createdAt: string;
}

// ── Bounty Quests & 2-Hour Expiration ───────────────────────────────
export type BountyType = 'news_verification' | 'product_telemetry' | 'service_center' | 'price_check';
export type BountyStatus = 'open' | 'claimed' | 'completed' | 'expired';

export interface BountyQuest {
  id: string;
  title: string;
  description: string;
  type: BountyType;
  rewardInr: number;
  rewardVpCoins?: number; // 10 VPcoins = 1 INR
  postedBy: string;
  location?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  productId?: string;
  expiresAt: string; // Hard 2-hour limit from creation
  status: BountyStatus;
  claimedBy?: string;
  proofRequired: string;
  createdAt: string;
}

// ── 24-Hour Bounty Leaderboard & Past Cycles ─────────────────────────
export interface BountyLeaderboardUser {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  tier: 'sentinel_t1' | 'validator_t2' | 'citizen_t3';
  bountiesCompleted: number;
  vpCoinsEarned: number;
  inrEarned: number;
  accuracyPercent: number;
  proofBadges: string[];
}

export interface BountyLeaderboardCycle {
  cycleId: string;
  cycleNumber: number;
  cycleName: string;
  cycleDate: string; // ISO date YYYY-MM-DD
  startsAt: string;
  endsAt: string; // 24 hours after startsAt
  status: 'active' | 'archived';
  totalBountiesCompleted: number;
  totalVpDistributed: number;
  totalInrDistributed: number;
  podiumWinners: BountyLeaderboardUser[];
  rankings: BountyLeaderboardUser[];
}

// ── Master Transaction Database Ledger ───────────────────────────────
export type MasterTransactionType =
  | 'bounty_reward'
  | 'bounty_creation'
  | 'sentinel_dividend'
  | 'journalist_reward'
  | 'upi_withdrawal'
  | 'upi_reversal'
  | 'voucher_redemption'
  | 'affiliate_commission'
  | 'referral_bonus'
  | 'consensus_vote';

export type MasterTransactionStatus = 'settled' | 'pending' | 'reversed' | 'failed';

export interface MasterTransaction {
  id: string;
  userId: string;
  type: MasterTransactionType;
  deltaInr: number;
  deltaVp: number;
  balanceAfterInr: number;
  balanceAfterVp: number;
  status: MasterTransactionStatus;
  description: string;
  referenceId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

// ── Sentinel Dividend Pool ──────────────────────────────────────────
export interface SentinelDividend {
  date: string;
  poolAmountInr: number;
  yourShareInr: number;
  poolVpCoins?: number;
  yourShareVpCoins?: number;
  accuracy: number;             // percentage
  streak: number;               // consecutive days
  streakMultiplier: number;     // e.g. 1.0, 1.25, 1.5
  storiesReviewed: number;
}

// ── Redeemed Vouchers (Amazon & Flipkart) ───────────────────────────
export type VoucherVendor = 'amazon' | 'flipkart';
export interface RedeemedVoucher {
  id: string;
  vendor: VoucherVendor;
  amountInr: number;
  vpCoinsSpent: number;
  code: string;
  pin?: string;
  claimedAt: string;
  expiresAt: string;
  status: 'active' | 'used';
}

// ── Ownership Passport (Resale Certificate) ─────────────────────────
export interface OwnershipPassport {
  id: string;
  productId: string;
  productName: string;
  productCategory: string;
  ownerName: string;
  purchaseDate: string;
  verificationMethod: string;   // 'GST Invoice' | 'Vahan RC' | 'IMEI'
  batteryHealth?: number;       // current %
  totalCheckIns: number;
  repairCount: number;
  crashFree: boolean;
  decayGrade: string;           // 'A+', 'A', 'B+', etc.
  estimatedPremiumInr: number;  // premium over market price
  verifiedAt: string;
  qrCode?: string;              // base64 QR code
}

// ── Price Alert Tracker ─────────────────────────────────────────────
export interface PriceAlert {
  id: string;
  productId: string;
  productName: string;
  targetPriceInr: number;
  currentPriceInr: number;
  isTriggered: boolean;
  createdAt: string;
}

// ── Fact-Check Scanner ──────────────────────────────────────────────
export type FactCheckVerdict = 'true' | 'mostly_true' | 'misleading' | 'false' | 'satire' | 'unverifiable';

export interface FactCheckResult {
  id: string;
  inputText: string;
  verdict: FactCheckVerdict;
  confidence: number;           // 0-100
  explanation: string;
  sources: string[];
  pibFactCheckUrl?: string;
  matchedStoryId?: string;
  createdAt: string;
}

// ── Reputation Badges ───────────────────────────────────────────────
export interface ReputationBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedAt?: string;
  progress?: number;            // 0-100
  requirement: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

// ── Milestone Grants ────────────────────────────────────────────────
export interface MilestoneGrant {
  id: string;
  productId: string;
  productName: string;
  milestone: string;            // '3-month', '6-month', '1-year'
  rewardInr: number;
  status: 'available' | 'claimed' | 'expired';
  requiresUpload: string;       // 'battery_screenshot' | 'service_bill' | 'endurance_review'
  expiresAt: string;
}

export interface AppNotification {
  id: string;
  kind: string;
  story_id: string | null;
  body: LocalizedText;
  read_at: string | null;
  created_at: string;
}

// ── Gemini pipeline output ──────────────────────────────────────────────
export interface GeminiStoryAnalysis {
  titles: LocalizedText;
  summaries: LocalizedText; // each <= 60 words
  completeness_score: number; // 0-100
  ai_probability_score: number; // 0-100
  category: string;
}

export interface GeminiOcrResult {
  doc_type: DocType;
  registration_or_invoice_no: string;
  chassis_or_gstin: string;
  make: string;
  model: string;
  purchase_date: string | null;
  product_category: string;
  tamper_check_passed: boolean;
  tamper_notes: string;
  ocr_confidence: number; // 0-100
}
