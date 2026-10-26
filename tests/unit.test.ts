// Unit tests for the pure logic behind §8 acceptance criteria.
// Run: npm test   (Node's built-in runner with type stripping, no deps)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextCredibility, nextStage, voteWeight, type ConsensusStage } from '../src/lib/consensus.ts';
import { clampSummary, enforceSixtyWords, wordCount } from '../src/lib/gemini.ts';
import { ownershipIdentityHash, maskIdentifier } from '../src/lib/crypto.ts';
import type { ReporterDispatch } from '../src/lib/types.ts';

test('consensus: 5 hoax flags from trust>80 users quarantine a fresh story', () => {
  let cred = 50;
  let stage: ConsensusStage = 'tier_1';
  for (let i = 0; i < 5; i++) {
    cred = nextCredibility(cred, 'hoax', voteWeight(82, null, false));
    stage = nextStage(stage, cred);
  }
  assert.ok(cred < 35, `credibility ${cred} should be < 35`);
  assert.equal(stage, 'quarantined');
});

test('consensus: credibility is clamped to [5, 99]', () => {
  assert.equal(nextCredibility(10, 'hoax', 10), 5);
  assert.equal(nextCredibility(95, 'real', 10), 99);
});

test('consensus: weight multipliers (geo 1.5 within 10 km, owner 3x)', () => {
  assert.equal(voteWeight(50, null, false), 1);
  assert.equal(voteWeight(50, 9.9, false), 1.5);
  assert.equal(voteWeight(50, 10.1, false), 1);
  assert.equal(voteWeight(100, 2, true), 9);
});

test('consensus: stage transitions', () => {
  assert.equal(nextStage('tier_1', 50), 'tier_2');
  assert.equal(nextStage('tier_2', 80), 'public');
  assert.equal(nextStage('public', 34.9), 'quarantined');
  assert.equal(nextStage('tier_2', 60), 'tier_2');
});

test('ingestion: summaries are hard-capped at 60 words in every language', () => {
  const long = (w: string) => Array.from({ length: 90 }, () => w).join(' ');
  const out = enforceSixtyWords({ en: long('word'), bn: long('খবর'), hi: long('समाचार') });
  for (const lang of ['en', 'bn', 'hi'] as const) {
    assert.ok(wordCount(out[lang]) <= 60, `${lang} has ${wordCount(out[lang])} words`);
  }
  assert.equal(clampSummary('  short text  '), 'short text');
});

test('ownership hash: normalises spacing/case so the same RC always collides', () => {
  const a = ownershipIdentityHash('vehicle_rc', 'wb 02 ab 1234', 'ma3ewdE1s00123456');
  const b = ownershipIdentityHash('vehicle_rc', 'WB02AB-1234', 'MA3EWDE1S00123456');
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, ownershipIdentityHash('gst_invoice', 'WB02AB1234', 'MA3EWDE1S00123456'));
  assert.equal(maskIdentifier('WB02AB1234'), 'WB••••1234');
});

test('products: mobile > 15-20k > photography filters correct devices and ratings [1-10]', async () => {
  const { DEMO_PRODUCTS } = await import('../src/lib/demoData.ts');

  // Filter: category = mobile, price_range = 15-20k, option = photography
  const matching = DEMO_PRODUCTS.filter(
    (p) =>
      p.category === 'mobile' &&
      p.price_range === '15-20k' &&
      p.options?.includes('photography'),
  );

  assert.ok(matching.length > 0, 'Should find at least one photography phone in 15-20k');
  const realme12Plus = matching.find((p) => p.id === 'realme-12-plus-5g');
  assert.ok(realme12Plus, 'Should include Realme 12+ 5G');
  assert.equal(realme12Plus?.price_inr, 18999);
  assert.ok(realme12Plus?.scores, 'Should have 1-10 scores');
  assert.ok(realme12Plus?.scores.camera && realme12Plus.scores.camera >= 9.0, 'Camera should score >= 9.0');
  assert.ok(realme12Plus?.scores.battery && realme12Plus.scores.battery <= 10, 'Battery should be in [1-10]');
  assert.ok(realme12Plus?.scores.performance && realme12Plus.scores.performance <= 10, 'Performance in [1-10]');
  assert.ok(realme12Plus?.scores.display && realme12Plus.scores.display <= 10, 'Display in [1-10]');
  assert.ok(realme12Plus?.scores.multimedia && realme12Plus.scores.multimedia <= 10, 'Multimedia in [1-10]');
});

test('products: categories cover mobile, bike, car, laptop', async () => {
  const { DEMO_PRODUCTS } = await import('../src/lib/demoData.ts');
  const categories = new Set(DEMO_PRODUCTS.map((p) => p.category));
  assert.ok(categories.has('mobile'), 'Should have mobile');
  assert.ok(categories.has('bike'), 'Should have bike');
  assert.ok(categories.has('car'), 'Should have car');
  assert.ok(categories.has('laptop'), 'Should have laptop');
});

test('bounties & earning: open tasks provide real rewards', async () => {
  const { DEMO_BOUNTIES, DEMO_DIVIDENDS, DEMO_PASSPORTS, DEMO_FACT_CHECKS } = await import('../src/lib/demoData.ts');
  
  // Bounties
  const openBounties = DEMO_BOUNTIES.filter((b) => b.status === 'open');
  assert.ok(openBounties.length >= 3, 'Should have at least 3 active open bounties');
  assert.ok(openBounties.every((b) => b.rewardInr >= 10), 'All bounties have positive reward');

  // Dividends
  assert.ok(DEMO_DIVIDENDS.length >= 7, 'Should have 7 days of dividend history');
  const latest = DEMO_DIVIDENDS[0];
  assert.ok(latest.streak >= 7, 'Current streak should be >= 7');
  assert.ok(latest.streakMultiplier >= 1.5, 'Streak multiplier is 1.5x');

  // Resale Passports
  assert.ok(DEMO_PASSPORTS.length >= 3, 'Should have resale passports');
  const macPassport = DEMO_PASSPORTS.find((p) => p.productId === 'macbook-air-m2');
  assert.ok(macPassport?.estimatedPremiumInr && macPassport.estimatedPremiumInr >= 5000, 'MacBook gets certified premium');

  // Fact-Checks
  assert.ok(DEMO_FACT_CHECKS.length >= 3, 'Should have viral hoax checks');
  const freeLaptop = DEMO_FACT_CHECKS.find((fc) => fc.id === 'fc-1');
  assert.equal(freeLaptop?.verdict, 'false');
  assert.ok(freeLaptop?.confidence && freeLaptop.confidence >= 95);
});

test('profile & network: verified identity, followers, and social links integrity', async () => {
  const { DEMO_PROFILE, DEMO_PRESET_PROFILES, DEMO_NETWORK_USERS } = await import('../src/lib/demoData.ts');

  // Active user profile integrity
  assert.ok(DEMO_PROFILE.username, 'Should have username');
  assert.ok(DEMO_PROFILE.full_name, 'Should have full name');
  assert.equal(DEMO_PROFILE.is_id_verified, true, 'Should be ID verified');
  assert.ok(DEMO_PROFILE.followers_count && DEMO_PROFILE.followers_count > 0, 'Should have follower count');
  assert.ok(DEMO_PROFILE.social_links?.twitter, 'Should have Twitter social handle');

  // Preset profiles for instant switching
  assert.ok(DEMO_PRESET_PROFILES.length >= 3, 'Should have at least 3 preset profiles');
  const aris = DEMO_PRESET_PROFILES.find((p) => p.username === 'aris_thorne');
  assert.ok(aris, 'Should have Aris Thorne profile');
  assert.equal(aris?.tier, 'sentinel_t1');
  assert.ok(aris?.trust_score && aris.trust_score >= 95);

  // Network users / followers
  assert.ok(DEMO_NETWORK_USERS.length >= 5, 'Should have network users');
  const rohan = DEMO_NETWORK_USERS.find((u) => u.username === 'rohan_tech');
  assert.ok(rohan, 'Should have Rohan Mehta');
  assert.equal(rohan?.isOwnerVerified, true);
  assert.ok(rohan?.followersCount && rohan.followersCount > 1000);
});

test('contacts & referrals: sync contacts list and invitation capability', async () => {
  const { DEMO_PHONE_CONTACTS } = await import('../src/lib/demoData.ts');
  assert.ok(DEMO_PHONE_CONTACTS.length >= 4, 'Should have phone contacts');

  const registered = DEMO_PHONE_CONTACTS.filter((c) => c.isRegistered);
  const unregistered = DEMO_PHONE_CONTACTS.filter((c) => !c.isRegistered);

  assert.ok(registered.length >= 2, 'Should have registered contacts on VeriPulse');
  assert.ok(unregistered.length >= 2, 'Should have contacts available to invite');
  assert.ok(registered.every((c) => c.username && c.trustScore), 'Registered contacts have username and trust score');
});

test('news hub: categories cover Politics, Business, Science/Tech, Health/Environment, Sports/Entertainment', async () => {
  const { NEWS_CATEGORIES, DEMO_NEWS_ARTICLES } = await import('../src/lib/demoData.ts');

  assert.equal(NEWS_CATEGORIES.length, 5, 'Should have exactly 5 core news categories');
  const catIds = NEWS_CATEGORIES.map((c) => c.id);
  assert.ok(catIds.includes('politics'), 'Should have Politics & Government');
  assert.ok(catIds.includes('business'), 'Should have Business & Economy');
  assert.ok(catIds.includes('tech'), 'Should have Science & Technology');
  assert.ok(catIds.includes('health'), 'Should have Health & Environment');
  assert.ok(catIds.includes('entertainment'), 'Should have Sports & Entertainment');

  // Verify category descriptions
  const pol = NEWS_CATEGORIES.find((c) => c.id === 'politics');
  assert.ok(pol?.description.includes('Elections'), 'Politics description mentions elections');
  const biz = NEWS_CATEGORIES.find((c) => c.id === 'business');
  assert.ok(biz?.description.includes('Financial markets'), 'Business description mentions markets');
  const tech = NEWS_CATEGORIES.find((c) => c.id === 'tech');
  assert.ok(tech?.description.includes('Breakthrough research'), 'Tech description mentions research');
  const hlt = NEWS_CATEGORIES.find((c) => c.id === 'health');
  assert.ok(hlt?.description.includes('Public health'), 'Health description mentions public health');
  const ent = NEWS_CATEGORIES.find((c) => c.id === 'entertainment');
  assert.ok(ent?.description.includes('Athletic events'), 'Entertainment description mentions athletic events');

  // Verify articles
  assert.ok(DEMO_NEWS_ARTICLES.length >= 10, 'Should have at least 10 news articles');
  assert.ok(DEMO_NEWS_ARTICLES.every((a) => a.tags.length >= 2), 'Each article has multiple tags');
  assert.ok(DEMO_NEWS_ARTICLES.every((a) => a.credibilityScore >= 90), 'All articles have high credibility');
});

test('news hub: articles adhere to 60-word caps across all languages', async () => {
  const { DEMO_NEWS_ARTICLES } = await import('../src/lib/demoData.ts');
  const { wordCount } = await import('../src/lib/gemini.ts');

  for (const article of DEMO_NEWS_ARTICLES) {
    const enCount = wordCount(article.summaries.en);
    assert.ok(enCount <= 60, `Article ${article.id} en has ${enCount} words (must be <= 60)`);
    assert.ok(article.c2paVerified !== undefined, 'Article specifies C2PA status');
    assert.ok(article.keyTakeaways && article.keyTakeaways.length > 0, 'Article has key takeaways');
  }
});

test('news hub: drill-down details and credibility voting logic', async () => {
  const { DEMO_NEWS_ARTICLES } = await import('../src/lib/demoData.ts');
  const { voteWeight, nextCredibility } = await import('../src/lib/consensus.ts');

  // Verify drill-down data structures on articles
  const gaganyaan = DEMO_NEWS_ARTICLES.find((a) => a.id === 'news-tech-1');
  assert.ok(gaganyaan, 'Should have Gaganyaan article');
  assert.ok(gaganyaan?.detailedAnalysis && gaganyaan.detailedAnalysis.length > 100, 'Detailed analysis present');
  assert.ok(gaganyaan?.timeline && gaganyaan.timeline.length >= 3, 'Chronological timeline has updates');
  assert.ok(gaganyaan?.c2paMetadata?.signatureHash, 'Cryptographic C2PA metadata signature present');
  assert.ok(gaganyaan?.communityNotes && gaganyaan.communityNotes.length > 0, 'Has verified community field notes');
  assert.ok(gaganyaan?.realVotes && gaganyaan.realVotes > 0, 'Has active vote counters');

  // Test live credibility voting recalculation
  const initialCred = 80;
  const weight = voteWeight(90, null, true); // Trust 90, verified owner
  const updatedCred = nextCredibility(initialCred, 'real', weight);
  assert.ok(updatedCred > initialCred, 'Credibility increases with positive consensus vote');
  const hoaxCred = nextCredibility(initialCred, 'hoax', weight);
  assert.ok(hoaxCred < initialCred, 'Credibility drops on hoax flag');
});

test('journalism: duplicate detection correctly identifies developing story dispatches', async () => {
  const { findDuplicateNews } = await import('../src/lib/journalism.ts');
  const { DEMO_NEWS_ARTICLES } = await import('../src/lib/demoData.ts');

  // Related dispatch about Gaganyaan astronaut training
  const relatedDispatch = {
    title: 'ISRO Gaganyaan Crew Training Final Phase at CE20 Facility',
    text: 'ISRO crew for Gaganyaan completes simulation tests for human spaceflight at Sriharikota space centre successfully.',
    category: 'tech',
    tags: ['Gaganyaan', 'ISRO', 'SpaceTech'],
  };

  const matchResult = findDuplicateNews(relatedDispatch, DEMO_NEWS_ARTICLES);
  assert.equal(matchResult.isDuplicate, true, 'Should detect duplicate / related story for Gaganyaan');
  assert.equal(matchResult.matchedArticle?.id, 'news-tech-1');

  // Completely unrelated dispatch
  const uniqueDispatch = {
    title: 'Rare Deep Sea Coral Species Discovered in Andaman Trench',
    text: 'Marine biologists uncover glowing coral reef structures thriving at 3000m depths with unique bioluminescent properties.',
    category: 'health',
    tags: ['MarineLife', 'DeepSea', 'Oceanography'],
  };

  const unmatched = findDuplicateNews(uniqueDispatch, DEMO_NEWS_ARTICLES);
  assert.equal(unmatched.isDuplicate, false, 'Unrelated story should not be flagged as duplicate');
  assert.equal(unmatched.matchedArticle, undefined);
});

test('journalism: multi-reporter synthesis enforces <= 60 words and rewards highest match', async () => {
  const { synthesizeMultiReporterSummary, calculateImpactEarnings } = await import('../src/lib/journalism.ts');
  const { wordCount } = await import('../src/lib/gemini.ts');

  const dispatch1 = {
    reporterId: 'rep-1',
    reporterName: 'Vikram Sen',
    reporterUsername: 'vikramsen',
    reporterAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    reporterBadge: 'Bureau Chief',
    originalDraft: 'Cabinet clears the Digital Competition Bill 2026 imposing strict ex-ante antitrust compliance on tech giants. Fines up to 10% global turnover.',
    submittedAt: '10:00 AM',
    location: 'New Delhi',
  };

  const dispatch2 = {
    reporterId: 'rep-2',
    reporterName: 'Anita Roy',
    reporterUsername: 'anitaroy',
    reporterAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
    reporterBadge: 'Tech Correspondent',
    originalDraft: 'Cabinet approved Digital Competition Bill for Big Tech with penalties up to 10 percent turnover for anti-competitive algorithmic preference.',
    submittedAt: '10:08 AM',
    location: 'Bengaluru',
  };

  const result = synthesizeMultiReporterSummary(
    [dispatch1, dispatch2],
    'Cabinet clears the landmark Digital Competition Bill 2026. The legislation mandates ex-ante regulations preventing predatory pricing and anti-competitive practices by Big Tech platforms. Violations risk penalties up to 10% of global turnover.',
    'ডিজিটাল প্রতিযোগিতা বিল ২০২৬ অনুমোদন করল কেন্দ্রীয় মন্ত্রিসভা।',
    'केंद्रीय मंत्रिमंडल ने डिजिटल प्रतिस्पर्धा विधेयक 2026 को मंजूरी दी।'
  );

  // 1. Strict <= 60 words check
  assert.ok(wordCount(result.unifiedSummary.en) <= 60, `Unified summary must be <= 60 words, got ${wordCount(result.unifiedSummary.en)}`);
  assert.ok(wordCount(result.unifiedSummary.bn) <= 60, 'Bengali summary <= 60 words');
  assert.ok(wordCount(result.unifiedSummary.hi) <= 60, 'Hindi summary <= 60 words');

  // 2. Both dispatches scored and awarded points & earnings
  assert.equal(result.reporterAttributions.length, 2);
  assert.ok(result.reporterAttributions[0].matchScorePercent > 0, 'Lead reporter has positive match score');
  assert.ok(result.reporterAttributions[1].matchScorePercent > 0, 'Corroborating reporter has positive match score');
  assert.ok(result.reporterAttributions[0].pointsAwarded >= 50, 'Lead reporter awarded points');
  assert.ok(result.reporterAttributions[0].earningsInr >= 100, 'Lead reporter received INR earnings');

  // 3. Impact earnings formula check
  const earningsResult = calculateImpactEarnings({
    credibilityScore: 94,
    realVotes: 120,
    c2paVerified: true,
  });
  assert.ok(earningsResult.impactScore >= 50, 'Impact score calculated');
  assert.ok(earningsResult.earningsInr >= 400, `High-impact verified article should earn >= 400 INR, got ${earningsResult.earningsInr}`);
});

test('products: drill down contains reliable summary, the good & the bad, and reality gap', async () => {
  const { DEMO_PRODUCTS } = await import('../src/lib/demoData.ts');

  // Verify all products possess rich transparency and drill-down metadata
  for (const product of DEMO_PRODUCTS) {
    assert.ok(product.reliableSummary && product.reliableSummary.length > 20, `${product.id} has reliable summary`);
    assert.ok(product.theGood && product.theGood.length >= 1, `${product.id} has at least 1 verified strength in theGood`);
    assert.ok(product.theBad && product.theBad.length >= 1, `${product.id} has at least 1 verified shortcoming in theBad`);
    assert.ok(product.realityGapScore !== undefined && product.realityGapScore >= 0, `${product.id} has realityGapScore`);
    assert.ok(product.fairPriceStatus, `${product.id} has fairPriceStatus`);
    assert.ok(product.threeYearTcoInr && product.threeYearTcoInr > 0, `${product.id} has 3-year TCO`);
    assert.ok(product.resaleRetentionPercent && product.resaleRetentionPercent > 0, `${product.id} has resale retention`);
    assert.ok(product.priceHistory && product.priceHistory.length >= 2, `${product.id} has price history milestones`);
  }

  // Showcase product check: Realme 12+ 5G
  const realme = DEMO_PRODUCTS.find((p) => p.id === 'realme-12-plus-5g');
  assert.ok(realme?.theGood?.some((g) => g.includes('Sony LYT-600')), 'Mentions Sony sensor');
  assert.ok(realme?.theBad?.some((b) => b.includes('Glance') || b.includes('ultra-wide')), 'Mentions verified catches');
  assert.equal(realme?.fairPriceStatus, 'steal_deal');

  // Showcase product check: Ather 450X EV
  const ather = DEMO_PRODUCTS.find((p) => p.id === 'ather-450x-gen3');
  assert.ok(ather?.hardwareFeatures?.fastCharging, 'Ather EV marked with fast charging');
  assert.equal(ather?.hardwareFeatures?.realRangeKm, 105);
});

test('products: head-to-head battles and category-specific rankings integrity', async () => {
  const { DEMO_HEAD_TO_HEAD_BATTLES, DEMO_PRODUCTS } = await import('../src/lib/demoData.ts');

  assert.ok(DEMO_HEAD_TO_HEAD_BATTLES.length >= 3, 'Should have at least 3 curated battles');
  
  for (const battle of DEMO_HEAD_TO_HEAD_BATTLES) {
    const productA = DEMO_PRODUCTS.find((p) => p.id === battle.productAId);
    const productB = DEMO_PRODUCTS.find((p) => p.id === battle.productBId);
    assert.ok(productA, `Battle ${battle.id} productA exists`);
    assert.ok(productB, `Battle ${battle.id} productB exists`);
    assert.ok(battle.votes.productA > 0 && battle.votes.productB > 0, 'Battle has votes');
    assert.ok(battle.metrics.length >= 3, 'Battle has at least 3 scorecard metrics');
  }
});

test('bounties: strict 2-hour expiration rule and time remaining formatting', async () => {
  const { DEMO_BOUNTIES } = await import('../src/lib/demoData.ts');
  const { isBountyExpired, formatBountyTimeRemaining, BOUNTY_EXPIRY_MS } = await import('../src/lib/bounties.ts');

  assert.equal(BOUNTY_EXPIRY_MS, 2 * 60 * 60 * 1000, 'Bounty expiration is exactly 2 hours');

  // Verify active bounty within 2 hours
  const activeBounty = DEMO_BOUNTIES.find((b) => b.id === 'b-1')!;
  assert.equal(isBountyExpired(activeBounty), false, 'b-1 is active');
  assert.ok(formatBountyTimeRemaining(activeBounty).includes('left'), 'b-1 shows time remaining');

  // Verify expired bounty older than 2 hours
  const expiredBounty = DEMO_BOUNTIES.find((b) => b.id === 'b-5')!;
  assert.equal(isBountyExpired(expiredBounty), true, 'b-5 is expired after 2 hours');
  assert.equal(formatBountyTimeRemaining(expiredBounty), 'Expired');
});

test('bounty leaderboard: 24-hour active cycle and past historical archive', async () => {
  const { DEMO_BOUNTY_CYCLES } = await import('../src/lib/demoData.ts');

  assert.ok(DEMO_BOUNTY_CYCLES.length >= 3, 'Should have at least 3 leaderboard cycles');

  // Active cycle
  const activeCycle = DEMO_BOUNTY_CYCLES.find((c) => c.status === 'active')!;
  assert.ok(activeCycle, 'Active cycle exists');
  const activeDurationMs = new Date(activeCycle.endsAt).getTime() - new Date(activeCycle.startsAt).getTime();
  assert.equal(activeDurationMs, 24 * 60 * 60 * 1000, 'Active cycle is exactly 24 hours');
  assert.ok(activeCycle.rankings.length >= 3, 'Active cycle has ranked participants');
  assert.ok(activeCycle.podiumWinners.length === 3, 'Active cycle has top 3 podium winners');

  // Past cycles
  const pastCycles = DEMO_BOUNTY_CYCLES.filter((c) => c.status === 'archived');
  assert.ok(pastCycles.length >= 2, 'Past cycles are preserved for historical reference');
  for (const pc of pastCycles) {
    assert.ok(pc.totalBountiesCompleted > 0, 'Past cycle records verified bounties');
    assert.ok(pc.totalVpDistributed > 0, 'Past cycle records distributed rewards');
    assert.ok(pc.podiumWinners[0].rank === 1, 'Past cycle has Champion');
  }
});

test('master database: records and tracks all transactions in a unified ledger', async () => {
  const { recordMasterTransaction, getMasterTransactions } = await import('../src/lib/transactions.ts');

  const initialCount = getMasterTransactions().length;
  assert.ok(initialCount >= 5, 'Master DB contains pre-existing transaction history');

  // Record a new bounty reward
  const tx = await recordMasterTransaction({
    userId: 'user-test',
    type: 'bounty_reward',
    deltaInr: 100,
    deltaVp: 1000,
    description: 'Verified test bounty claim',
    referenceId: 'b-test-99',
  });

  assert.equal(tx.type, 'bounty_reward');
  assert.equal(tx.deltaInr, 100);
  assert.equal(tx.deltaVp, 1000);
  assert.equal(tx.status, 'settled');

  const afterCount = getMasterTransactions().length;
  assert.equal(afterCount, initialCount + 1, 'Transaction recorded in master ledger');
});
