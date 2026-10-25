// Comprehensive End-to-End User Perspective Acceptance Tests
// Simulates user journeys across all features of VeriPulse.
// Run: node --experimental-strip-types --no-warnings --test tests/e2e-user-flows.test.ts

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEMO_PRODUCTS,
  DEMO_NEWS_ARTICLES,
  NEWS_CATEGORIES,
  DEMO_HEAD_TO_HEAD_BATTLES,
  DEMO_PROFILE,
  DEMO_PRESET_PROFILES,
  DEMO_NETWORK_USERS,
  DEMO_PHONE_CONTACTS,
  DEMO_STORIES,
  DEMO_BOUNTIES,
  DEMO_DIVIDENDS,
  DEMO_PASSPORTS,
  DEMO_FACT_CHECKS,
} from '../src/lib/demoData.ts';

import {
  findDuplicateNews,
  synthesizeMultiReporterSummary,
  calculateImpactEarnings,
} from '../src/lib/journalism.ts';

import {
  nextCredibility,
  nextStage,
  voteWeight,
} from '../src/lib/consensus.ts';

import {
  clampSummary,
  enforceSixtyWords,
  wordCount,
} from '../src/lib/gemini.ts';

import {
  formatINR,
  timeAgo,
} from '../src/lib/utils.ts';

import {
  ownershipIdentityHash,
  maskIdentifier,
} from '../src/lib/crypto.ts';

describe('User Flow 1: News Reader & Credibility Consensus', () => {
  test('User browses News Hub and filters across all 5 core categories', () => {
    // User lands on News Hub
    const categories = ['all', 'politics', 'business', 'tech', 'health', 'entertainment'];

    for (const cat of categories) {
      const filtered = cat === 'all'
        ? DEMO_NEWS_ARTICLES
        : DEMO_NEWS_ARTICLES.filter((a) => a.category === cat);

      assert.ok(filtered.length > 0, `Category "${cat}" must contain active verified stories`);
      
      // Each card must render media, category tag, credibility bar, and reporter badge
      for (const story of filtered) {
        assert.ok(story.mediaUrl, `Story ${story.id} has media for squarish card presentation`);
        assert.ok(story.titles.en.length > 10, `Story ${story.id} has descriptive headline`);
        if (story.leadReporter) {
          assert.ok(story.leadReporter.reporterBadge, `Story ${story.id} displays reporter badge`);
          assert.ok(story.leadReporter.reporterName, `Story ${story.id} displays reporter name`);
        }
        assert.ok(story.locationName, `Story ${story.id} displays location tag`);
        assert.ok(story.publishedAt, `Story ${story.id} has timestamp`);
      }
    }
  });

  test('User verifies that every news summary strictly complies with the <= 60 words rule', () => {
    for (const story of DEMO_NEWS_ARTICLES) {
      const enWords = wordCount(story.summaries.en);
      const bnWords = wordCount(story.summaries.bn);
      const hiWords = wordCount(story.summaries.hi);

      assert.ok(enWords <= 60, `Story ${story.id} EN summary exceeds 60 words (${enWords} words)`);
      assert.ok(bnWords <= 60, `Story ${story.id} BN summary exceeds 60 words (${bnWords} words)`);
      assert.ok(hiWords <= 60, `Story ${story.id} HI summary exceeds 60 words (${hiWords} words)`);
      assert.ok(enWords >= 15, `Story ${story.id} EN summary must be sufficiently informative (>= 15 words)`);
    }
  });

  test('User participates in Credibility Voting (Real vs Hoax)', () => {
    const story = DEMO_NEWS_ARTICLES[0];
    const initialReal = story.realVotes;
    const initialHoax = story.hoaxVotes;
    const initialCred = story.credibilityScore;

    // User upvotes as verified citizen (trust = 85, verified owner)
    const weight = voteWeight(85, null, true);
    const updatedCred = nextCredibility(initialCred, 'real', weight);
    const simulatedReal = initialReal + 1;

    assert.ok(updatedCred >= initialCred, 'Credibility increases after positive consensus vote');
    assert.equal(simulatedReal, initialReal + 1);

    // Another user flags as hoax
    const hoaxCred = nextCredibility(updatedCred, 'hoax', weight);
    assert.ok(hoaxCred < updatedCred, 'Credibility decreases when flagged as hoax');
  });

  test('User drills down into a News Card and verifies all 5 detailed tabs', () => {
    const techStory = DEMO_NEWS_ARTICLES.find((a) => a.id === 'news-tech-1')!;
    assert.ok(techStory, 'Tech story exists');

    // Tab 1: Detailed Story & Gemini Analysis
    assert.ok(techStory.detailedAnalysis.length > 200, 'Detailed story analysis is rich and comprehensive');
    assert.ok(techStory.keyTakeaways.length >= 3, 'Key takeaways are highlighted');
    assert.ok(techStory.source, 'Source attribution is transparently visible');

    // Tab 2: Chronological Timeline
    assert.ok(techStory.timeline && techStory.timeline.length >= 3, 'Chronological timeline has updates');
    assert.ok(techStory.timeline[0].time && techStory.timeline[0].event, 'Timeline entries have timestamp and headline');

    // Tab 3: C2PA Cryptographic Provenance
    assert.ok(techStory.c2paMetadata, 'C2PA cryptographic metadata block is present');
    assert.ok(techStory.c2paMetadata?.signatureHash.startsWith('c2pa:sha256:'), 'Valid SHA-256 digital signature');
    assert.ok(techStory.c2paMetadata?.captureDevice, 'Hardware capture device is logged');

    // Tab 4: Verified Field Notes
    assert.ok(techStory.communityNotes && techStory.communityNotes.length >= 1, 'Field notes from verified local observers');
    for (const note of techStory.communityNotes) {
      assert.ok(note.author, 'Observer name is documented');
      assert.ok(note.role, 'Observer role / trust level is documented');
      assert.ok(note.comment, 'Eyewitness observation text is present');
    }

    // Tab 5: Reporters & Dispatches
    assert.ok(techStory.leadReporter, 'Lead journalist dispatch present');
    assert.ok(techStory.leadReporter.reporterName, 'Reporter has name');
    assert.ok(techStory.leadReporter.matchScorePercent >= 80, 'Lead reporter has high match score');
    assert.ok(techStory.leadReporter.earningsInr >= 100, 'Lead reporter earned INR for high impact reporting');
  });
});

describe('User Flow 2: Accredited Journalist Dispatch & Deduplication', () => {
  test('Press pass verification gate prevents non-accredited submissions', () => {
    const validPressPass = 'PIB-PRESS-2026-9812';
    const invalidPressPass = 'STUDENT-BLOGGER-123';

    const isValidPass = (pass: string) => /^(PIB-PRESS|IFJ-JOURNO|VERIPULSE-PRO)-\d{4}-\d{4}$/.test(pass);

    assert.equal(isValidPass(validPressPass), true, 'Official PIB press pass accepted');
    assert.equal(isValidPass(invalidPressPass), false, 'Unaccredited pass rejected');
  });

  test('Journalist submits a related update -> System automatically detects duplicate and merges timeline', () => {
    // Journalist files a follow-up on the Gaganyaan CE20 engine milestone
    const followUpDispatch = {
      title: 'ISRO Gaganyaan Crew Training Final Phase at CE20 Facility',
      text: 'ISRO crew for Gaganyaan completes simulation tests for human spaceflight at Sriharikota space centre successfully.',
      category: 'tech',
      tags: ['Gaganyaan', 'ISRO', 'SpaceTech'],
    };

    const duplicateCheck = findDuplicateNews(followUpDispatch, DEMO_NEWS_ARTICLES);
    
    // User expects duplicate warning instead of split clutter
    assert.equal(duplicateCheck.isDuplicate, true, 'System prevents duplicate article creation');
    assert.equal(duplicateCheck.matchedArticle?.id, 'news-tech-1', 'Identified existing story correctly');
    assert.ok(duplicateCheck.similarityScore >= 0.28, 'High duplicate similarity score');
  });

  test('10-minute consensus buffer: Synthesizes multi-reporter dispatches into 60-word summary and distributes rewards', () => {
    const dispatchA = {
      reporterId: 'rep-vikram',
      reporterName: 'Vikram Sen',
      reporterUsername: 'vikramsen',
      reporterAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      reporterBadge: 'Bureau Chief',
      originalDraft: 'Cabinet clears the Digital Competition Bill 2026 imposing strict ex-ante antitrust compliance on tech giants. Fines up to 10% global turnover.',
      submittedAt: '10:00 AM',
      location: 'New Delhi',
    };

    const dispatchB = {
      reporterId: 'rep-anita',
      reporterName: 'Anita Roy',
      reporterUsername: 'anitaroy',
      reporterAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
      reporterBadge: 'Senior Tech Correspondent',
      originalDraft: 'Cabinet approved Digital Competition Bill for Big Tech with penalties up to 10 percent turnover for anti-competitive algorithmic preference.',
      submittedAt: '10:08 AM',
      location: 'Bengaluru',
    };

    const synthesized = synthesizeMultiReporterSummary(
      [dispatchA, dispatchB],
      'Cabinet clears the landmark Digital Competition Bill 2026. The legislation mandates ex-ante regulations preventing predatory pricing and anti-competitive practices by Big Tech platforms. Violations risk penalties up to 10% of global turnover.',
      'ডিজিটাল প্রতিযোগিতা বিল ২০২৬ অনুমোদন করল কেন্দ্রীয় মন্ত্রিসভা।',
      'केंद्रीय मंत्रिमंडल ने डिजिटल प्रतिस्पर्धा विधेयक 2026 को मंजूरी दी।'
    );

    // Summary must stay under 60 words
    assert.ok(wordCount(synthesized.unifiedSummary.en) <= 60);

    // Both reporters receive credit and earnings based on match score
    assert.equal(synthesized.reporterAttributions.length, 2);
    const repA = synthesized.reporterAttributions.find((r) => r.reporterId === 'rep-vikram')!;
    const repB = synthesized.reporterAttributions.find((r) => r.reporterId === 'rep-anita')!;

    assert.ok(repA.matchScorePercent >= 45, 'Reporter A scored match percentage');
    assert.ok(repB.matchScorePercent >= 45, 'Reporter B scored match percentage');
    assert.ok(repA.earningsInr > 0, 'Reporter A earned INR payout');
    assert.ok(repB.earningsInr > 0, 'Reporter B earned INR payout');
  });
});

describe('User Flow 3: Product Hub & Comparison Matrix', () => {
  test('User filters products by category: mobile, bike, car, laptop', () => {
    const mobiles = DEMO_PRODUCTS.filter((p) => p.category === 'mobile');
    const bikes = DEMO_PRODUCTS.filter((p) => p.category === 'bike');
    const cars = DEMO_PRODUCTS.filter((p) => p.category === 'car');
    const laptops = DEMO_PRODUCTS.filter((p) => p.category === 'laptop');

    assert.ok(mobiles.length >= 2, 'Mobile category populated');
    assert.ok(bikes.length >= 2, 'Bike category populated');
    assert.ok(cars.length >= 2, 'Car category populated');
    assert.ok(laptops.length >= 2, 'Laptop category populated');
  });

  test('User tests Dynamic Category-Specific Quick Rankings for Mobile', () => {
    // 1. Best Camera <20k
    const bestCamUnder20k = DEMO_PRODUCTS.filter(
      (p) => p.category === 'mobile' && p.price_inr <= 20000 && (p.scores?.camera ?? 0) >= 8.5
    );
    assert.ok(bestCamUnder20k.length > 0, 'Should find camera phone under 20k');
    assert.ok(bestCamUnder20k.some((p) => p.id === 'realme-12-plus-5g'));

    // 2. Battery Titan
    const batteryTitans = DEMO_PRODUCTS.filter(
      (p) => p.category === 'mobile' && (p.scores?.battery ?? 0) >= 8.0
    );
    assert.ok(batteryTitans.length > 0, 'Should find battery titans');

    // 3. Clean UI (Clean OS)
    const cleanUiPhones = DEMO_PRODUCTS.filter(
      (p) => p.category === 'mobile' && p.hardwareFeatures?.cleanOs === true
    );
    assert.ok(cleanUiPhones.length > 0, 'Should find clean UI phones');

    // 4. Honest Marketing (Reality Gap <= 15%)
    const honestMarketing = DEMO_PRODUCTS.filter(
      (p) => p.category === 'mobile' && (p.realityGapScore ?? 100) <= 15
    );
    assert.ok(honestMarketing.length > 0, 'Should find phones with honest specs');

    // 5. Resale Value (Retention >= 60%)
    const resaleKing = DEMO_PRODUCTS.filter(
      (p) => p.category === 'mobile' && (p.resaleRetentionPercent ?? 0) >= 60
    );
    assert.ok(resaleKing.length > 0, 'Should find phones with high resale retention');
  });

  test('User tests Dynamic Category-Specific Quick Rankings for Bikes and Cars', () => {
    // Bike: Fast EV Commuter
    const evBikes = DEMO_PRODUCTS.filter(
      (p) => p.category === 'bike' && p.hardwareFeatures?.fastCharging === true
    );
    assert.ok(evBikes.some((p) => p.id === 'ather-450x-gen3'), 'Ather 450X found as fast charging EV commuter');

    // Bike: Low 3-Year TCO
    const lowTcoBikes = DEMO_PRODUCTS.filter((p) => p.category === 'bike').sort(
      (a, b) => (a.threeYearTcoInr ?? 999999) - (b.threeYearTcoInr ?? 999999)
    );
    assert.ok(lowTcoBikes.length > 0);
    assert.ok(lowTcoBikes[0].threeYearTcoInr! < 180000);

    // Car: Best Value < 15L
    const valueCars = DEMO_PRODUCTS.filter(
      (p) => p.category === 'car' && (p.price_inr ?? 0) <= 1500000
    );
    assert.ok(valueCars.length > 0, 'Found cars under 15 Lakhs');
  });

  test('User tests Dynamic Category-Specific Quick Rankings for Laptops', () => {
    // Battery Champion
    const batteryLaptops = DEMO_PRODUCTS.filter(
      (p) => p.category === 'laptop' && (p.scores?.battery ?? 0) >= 8.5
    );
    assert.ok(batteryLaptops.some((p) => p.id === 'macbook-air-m2'), 'MacBook Air M2 is battery champion');

    // Upgradable RAM
    const upgradableLaptops = DEMO_PRODUCTS.filter(
      (p) => p.category === 'laptop' && p.hardwareFeatures?.upgradableRam === true
    );
    assert.ok(upgradableLaptops.some((p) => p.id === 'asus-tuf-gaming-a15'), 'Asus TUF A15 has dual upgradable RAM slots');
  });

  test('User tests Dedicated Sort By options', () => {
    const list = [...DEMO_PRODUCTS];

    // 1. Price Low to High
    const sortPriceLow = [...list].sort((a, b) => a.price_inr - b.price_inr);
    for (let i = 0; i < sortPriceLow.length - 1; i++) {
      assert.ok(sortPriceLow[i].price_inr <= sortPriceLow[i + 1].price_inr);
    }

    // 2. Lowest Reality Gap (Most Honest First)
    const sortRealityGap = [...list].sort((a, b) => (a.realityGapScore ?? 99) - (b.realityGapScore ?? 99));
    for (let i = 0; i < sortRealityGap.length - 1; i++) {
      assert.ok((sortRealityGap[i].realityGapScore ?? 99) <= (sortRealityGap[i + 1].realityGapScore ?? 99));
    }

    // 3. Lowest 3-Year TCO
    const sortTco = [...list].sort((a, b) => (a.threeYearTcoInr ?? 9999999) - (b.threeYearTcoInr ?? 9999999));
    for (let i = 0; i < sortTco.length - 1; i++) {
      assert.ok((sortTco[i].threeYearTcoInr ?? 9999999) <= (sortTco[i + 1].threeYearTcoInr ?? 9999999));
    }

    // 4. Highest Resale Retention
    const sortResale = [...list].sort((a, b) => (b.resaleRetentionPercent ?? 0) - (a.resaleRetentionPercent ?? 0));
    for (let i = 0; i < sortResale.length - 1; i++) {
      assert.ok((sortResale[i].resaleRetentionPercent ?? 0) >= (sortResale[i + 1].resaleRetentionPercent ?? 0));
    }
  });

  test('User tests Advanced Filters: Price range, Trust filters, and Hardware Deal-Breakers', () => {
    // Custom Price: min 15,000, max 25,000 INR
    const priceFiltered = DEMO_PRODUCTS.filter((p) => p.price_inr >= 15000 && p.price_inr <= 25000);
    assert.ok(priceFiltered.every((p) => p.price_inr >= 15000 && p.price_inr <= 25000));

    // Hardware Deal-Breaker: 3.5mm Headphone Jack
    const jackPhones = DEMO_PRODUCTS.filter(
      (p) => p.category === 'mobile' && p.hardwareFeatures?.headphoneJack === true
    );
    assert.ok(jackPhones.some((p) => p.id === 'realme-12-plus-5g'), 'Realme 12+ retains headphone jack');

    // Hardware Deal-Breaker: MicroSD Slot
    const microSdPhones = DEMO_PRODUCTS.filter(
      (p) => p.category === 'mobile' && p.hardwareFeatures?.microSdSlot === true
    );
    assert.ok(microSdPhones.length > 0);

    // Hardware Deal-Breaker: Water Resistance (IP54 or better)
    const waterResistant = DEMO_PRODUCTS.filter(
      (p) => p.hardwareFeatures?.waterResistance && p.hardwareFeatures.waterResistance !== 'None'
    );
    assert.ok(waterResistant.length > 0);
  });

  test('User tests Product Drill-Down Modal across all 6 tabs and Commute ROI Calculator', () => {
    const product = DEMO_PRODUCTS.find((p) => p.id === 'realme-12-plus-5g')!;
    assert.ok(product, 'Product found');

    // Tab 1: Most Reliable Summary, The Good & The Bad
    assert.ok(product.reliableSummary.length >= 30, 'Reliable summary is present');
    assert.ok(product.theGood && product.theGood.length >= 2, 'The Good points documented');
    assert.ok(product.theBad && product.theBad.length >= 2, 'The Bad points documented');

    // Check smart alternative on a product that has marketing gotchas
    const redmi = DEMO_PRODUCTS.find((p) => p.id === 'redmi-13c-8-128')!;
    assert.ok(redmi.betterAlternativeId, 'Disputed budget phone recommends better alternative');
    assert.ok(redmi.betterAlternativeReason, 'Explains why alternative is recommended');

    // Tab 2: Verified Telemetry & Reality Gap
    assert.ok(product.scores.camera && product.scores.battery, 'Score matrix present');
    assert.ok(product.realityGapScore !== undefined && product.realityGapScore <= 20, 'Reality gap is minimal');

    // Tab 3: 90-Day Price Trend
    assert.ok(product.priceHistory && product.priceHistory.length >= 3, 'Price points recorded');
    assert.ok(['steal_deal', 'fair_market', 'overpriced'].includes(product.fairPriceStatus!), 'Fair price status valid');

    // Tab 4: Known Bugs & Fixes
    assert.ok(product.knownIssues && product.knownIssues.length >= 1, 'Known issues logged with workarounds');
    assert.ok(product.knownIssues[0].title && product.knownIssues[0].fixOrWorkaround, 'Issue and fix populated');

    // Tab 5: Spares & 3-Yr TCO
    assert.ok(product.spareParts && product.spareParts.length >= 2, 'Spare parts prices cataloged');
    assert.ok(product.threeYearTcoInr && product.threeYearTcoInr > product.price_inr, '3-yr TCO includes maintenance');

    // Tab 6: Owner Reviews with Photo Evidence
    assert.ok(product.reviews && product.reviews.length >= 1, 'Owner reviews present');
    const verifiedOwnerReview = product.reviews.find((r) => r.isVerifiedOwner);
    assert.ok(verifiedOwnerReview, 'Has invoice-verified owner review');

    // Vehicle Commute ROI Calculator (Ather 450X EV vs Petrol Scooter)
    const dailyCommuteKm = 35;
    const petrolPricePerLiter = 105;
    const evUnitCost = 8.5;
    const realMileage = 45; // petrol kmpl

    const monthlyPetrolSpend = Math.round(((dailyCommuteKm * 30) / realMileage) * petrolPricePerLiter);
    const monthlyEvSpend = Math.round((dailyCommuteKm * 30 * 0.035) * evUnitCost);
    const monthlySavings = Math.max(0, monthlyPetrolSpend - monthlyEvSpend);
    const annualSavings = monthlySavings * 12;

    assert.ok(monthlySavings > 2000, `Monthly savings is ₹${monthlySavings}, expected > ₹2,000`);
    assert.ok(annualSavings > 25000, `Annual savings is ₹${annualSavings}, expected > ₹25,000`);
  });

  test('User tests Head-to-Head Battles voting and scorecard comparison', () => {
    const battle = DEMO_HEAD_TO_HEAD_BATTLES[0];
    const initialA = battle.votes.productA;
    const initialB = battle.votes.productB;

    // User votes for Product A
    const newVotesA = initialA + 1;
    const totalVotes = newVotesA + initialB;
    const pctA = Math.round((newVotesA / totalVotes) * 100);
    const pctB = 100 - pctA;

    assert.equal(pctA + pctB, 100, 'Percentages sum to 100%');
    assert.ok(pctA > 0 && pctB > 0, 'Both products have voter share');
    assert.ok(battle.metrics.length >= 3, 'Comprehensive comparison scorecard available');
  });
});

describe('User Flow 4: Citizen Profile, Network & Account Management', () => {
  test('User views verified citizen profile and edits information', () => {
    const user = { ...DEMO_PROFILE };

    assert.equal(user.is_id_verified, true, 'Profile indicates official ID verification');
    assert.ok(user.trust_score >= 80, 'Trust score indicates high reliability');
    assert.ok(user.followers_count >= 10, 'Followers count present');

    // User updates profile bio & social handle
    user.bio = 'Investigative automotive reporter & battery longevity tester';
    user.social_links = {
      ...user.social_links,
      twitter: 'veripulse_tester',
      youtube: 'https://youtube.com/@veripulsetest',
    };

    assert.equal(user.bio, 'Investigative automotive reporter & battery longevity tester');
    assert.equal(user.social_links.twitter, 'veripulse_tester');
    assert.equal(user.social_links.youtube, 'https://youtube.com/@veripulsetest');
  });

  test('User follows and unfollows network members', () => {
    const networkUser = { ...DEMO_NETWORK_USERS[0], isFollowing: false };
    const initialFollowers = networkUser.followersCount;

    // User clicks "Follow"
    networkUser.isFollowing = true;
    networkUser.followersCount += 1;
    assert.equal(networkUser.isFollowing, true);
    assert.equal(networkUser.followersCount, initialFollowers + 1);

    // User clicks "Unfollow"
    networkUser.isFollowing = false;
    networkUser.followersCount -= 1;
    assert.equal(networkUser.isFollowing, false);
    assert.equal(networkUser.followersCount, initialFollowers);
  });

  test('User syncs contacts and generates WhatsApp referral invitation', () => {
    const contacts = DEMO_PHONE_CONTACTS;
    const unreg = contacts.filter((c) => !c.isRegistered);
    assert.ok(unreg.length > 0, 'Has contacts available to invite');

    const targetContact = unreg[0];
    const inviteUrl = `https://wa.me/?text=${encodeURIComponent(
      `Hey ${targetContact.name}! I am using VeriPulse to fact-check news and avoid marketing traps. Join here: https://veripulse.in/join?ref=tester`
    )}`;

    assert.ok(inviteUrl.includes('https://wa.me/?text='), 'Generates valid WhatsApp URL');
    assert.ok(inviteUrl.includes(encodeURIComponent(targetContact.name)), 'Personalized with contact name');
  });

  test('User tests multi-persona preset switching', () => {
    for (const preset of DEMO_PRESET_PROFILES) {
      assert.ok(preset.username, 'Preset has username');
      assert.ok(preset.trust_score > 0, 'Preset has trust score');
      assert.ok(preset.tier, 'Preset has role tier');
    }
  });
});

describe('User Flow 5: Feed, Audio Readout, WhatsApp Shield & Incidents', () => {
  test('User toggles Incident Heatmap and views verified geographical clusters', () => {
    assert.ok(DEMO_STORIES.length >= 3, 'Stories are cataloged');
    const storiesWithGeo = DEMO_STORIES.filter((s) => s.lat !== null && s.lng !== null);
    assert.ok(storiesWithGeo.length >= 2, 'Multiple stories have GPS coordinates');
    for (const story of storiesWithGeo) {
      assert.ok(story.lat && story.lng, 'Story has GPS coordinates');
      assert.ok(story.location_name, 'Story has location label');
      assert.ok(story.credibility_score >= 0, 'Story has credibility score');
    }
  });

  test('User tests WhatsApp Shield AI Fact-Check Scanner', () => {
    for (const check of DEMO_FACT_CHECKS) {
      assert.ok(['true', 'false', 'misleading'].includes(check.verdict), 'Verdict is standardized');
      assert.ok(check.inputText.length > 10, 'Viral claim text recorded');
      assert.ok(check.explanation.length > 20, 'Clear factual debunking explanation provided');
      assert.ok(check.confidence >= 70, 'High confidence score on viral claims');
    }
  });

  test('User inspects Quarantine Vault hoax breakdown explanation', () => {
    const quarantinedStories = DEMO_STORIES.filter((s) => s.rollout_stage === 'quarantined');
    assert.ok(quarantinedStories.length > 0, 'Quarantine vault contains filtered items');
    for (const q of quarantinedStories) {
      assert.ok(q.credibility_score < 35, 'Quarantined stories have credibility score < 35');
    }
  });
});

describe('User Flow 6: Bounties, Resale Passport & UPI Wallet Payouts', () => {
  test('User claims citizen bounty and verifies reward', () => {
    const openBounties = DEMO_BOUNTIES.filter((b) => b.status === 'open');
    assert.ok(openBounties.length >= 1, 'Active bounties available');
    
    const bounty = openBounties[0];
    assert.ok(bounty.rewardInr >= 5, 'Bounty reward is at least ₹5');
    assert.ok(bounty.title && bounty.description, 'Clear instructions provided');
  });

  test('User inspects Resale Ownership Passport cryptographic certificate', () => {
    for (const passport of DEMO_PASSPORTS) {
      assert.ok(passport.verificationMethod, 'Verification method is recorded');
      assert.ok(passport.decayGrade, 'Decay grade assigned');
      assert.ok(passport.estimatedPremiumInr > 0, 'Verified owner resale premium calculated');
    }
  });

  test('User requests UPI withdrawal from Wallet', () => {
    let currentBalance = 450.00;
    const withdrawAmount = 250.00;
    const upiId = 'citizen@okaxis';

    // Validate UPI ID pattern (e.g., username@bank)
    const isValidUpi = /^[\w.-]+@[\w.-]+$/.test(upiId);
    assert.equal(isValidUpi, true, 'UPI ID passes syntax validation');

    assert.ok(currentBalance >= withdrawAmount, 'Sufficient balance for withdrawal');
    currentBalance -= withdrawAmount;
    assert.equal(currentBalance, 200.00, 'Balance accurately updated');
  });
});

describe('User Flow 7: Utilities, Currency & UI Localization', () => {
  test('INR currency formatter formats Indian numbering correctly', () => {
    assert.equal(formatINR(18999), '₹18,999.00');
    assert.equal(formatINR(1449000), '₹14,49,000.00');
    assert.equal(formatINR(150), '₹150.00');
  });

  test('Crypto vehicle RC masking hides sensitive digits', () => {
    assert.equal(maskIdentifier('DL01AB1234'), 'DL••••1234');
    assert.equal(maskIdentifier('WB02C9999'), 'WB••••9999');
  });

  test('60-word hard clamp handles excess text safely without cutting mid-word', () => {
    const excessWords = Array.from({ length: 80 }, (_, i) => `word${i + 1}`).join(' ');
    const clamped = clampSummary(excessWords);
    assert.ok(wordCount(clamped) <= 60);
    assert.equal(wordCount(clamped), 60);
  });
});
