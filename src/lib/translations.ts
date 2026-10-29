import type { Lang } from './types';

export const UI_STRINGS: Record<string, Record<Lang, string>> = {
  // Brand & Chrome
  tagline: {
    en: 'verified news & owners',
    bn: 'যাচাইকৃত খবর ও মালিকানা',
    hi: 'सत्यापित समाचार और मालिक',
  },
  verifyOwnership: {
    en: 'Verify ownership',
    bn: 'মালিকানা যাচাই করুন',
    hi: 'स्वामित्व सत्यापित करें',
  },
  signInRegister: {
    en: 'Sign In / Register',
    bn: 'সাইন ইন / নিবন্ধন',
    hi: 'साइन इन / रजिस्टर',
  },
  signOut: {
    en: 'Sign Out',
    bn: 'সাইন আউট',
    hi: 'साइन आउट',
  },
  viewProfile: {
    en: 'View Profile',
    bn: 'প্রোফাইল দেখুন',
    hi: 'प्रोफ़ाइल देखें',
  },

  // Navigation Items
  nav_feed: {
    en: 'Live Circle',
    bn: 'লাইভ সার্কেল',
    hi: 'लाइव सर्कल',
  },
  nav_news: {
    en: 'News Hub',
    bn: 'নিউজ হাব',
    hi: 'न्यूज़ हब',
  },
  nav_compare: {
    en: 'Product Hub',
    bn: 'প্রোডাক্ট হাব',
    hi: 'प्रोडक्ट हब',
  },
  nav_earn: {
    en: 'Bounties & Earn',
    bn: 'বাউন্টি ও উপার্জন',
    hi: 'इनाम और कमाई',
  },
  nav_cinema: {
    en: 'Cinema Sentinel',
    bn: 'সিনেমা সেন্টিনেল',
    hi: 'सिनेमा सेंटिनल',
  },
  nav_scanner: {
    en: 'WhatsApp Shield',
    bn: 'হোয়াটসঅ্যাপ শিল্ড',
    hi: 'व्हाट्सएप शील्ड',
  },
  nav_passport: {
    en: 'Resale Passport',
    bn: 'রিসেল পাসপোর্ট',
    hi: 'रीसेल पासपोर्ट',
  },
  nav_vault: {
    en: 'Quarantine Vault',
    bn: 'কোয়ারেন্টাইন ভল্ট',
    hi: 'क्वारंटाइन वॉल्ट',
  },
  nav_sentinel: {
    en: 'Sentinel Desk',
    bn: 'সেন্টিনেল ডেস্ক',
    hi: 'सेंटिनल डेस्क',
  },
  nav_wallet: {
    en: 'Wallet',
    bn: 'ওয়ালেট',
    hi: 'वॉलेट',
  },
  nav_profile: {
    en: 'Citizen Profile',
    bn: 'নাগরিক প্রোফাইল',
    hi: 'नागरिक प्रोफ़ाइल',
  },

  // Mobile Bottom Nav
  tab_circle: {
    en: 'Circle',
    bn: 'সার্কেল',
    hi: 'सर्कल',
  },
  tab_news: {
    en: 'News',
    bn: 'খবর',
    hi: 'समाचार',
  },
  tab_product: {
    en: 'Product',
    bn: 'প্রোডাক্ট',
    hi: 'प्रोडक्ट',
  },
  tab_profile: {
    en: 'Profile',
    bn: 'প্রোফাইল',
    hi: 'प्रोफ़ाइल',
  },

  // Section Subtitles
  sub_feed: {
    en: 'Post, verify and earn — citizen reports in 60 words or less',
    bn: 'পোস্ট করুন, যাচাই করুন ও উপার্জন করুন — ৬০ শব্দে নাগরিক রিপোর্ট',
    hi: 'पोस्ट करें, सत्यापित करें और कमाएं — 60 शब्दों में नागरिक रिपोर्ट',
  },
  sub_news: {
    en: 'Curated wire from accredited reporters — read, vote or file your own dispatch',
    bn: 'স্বীকৃত সাংবাদিকদের কিউরেটেড ওয়্যার — পড়ুন, ভোট দিন বা নিজের ডিসপ্যাচ ফাইল করুন',
    hi: 'मान्यताप्राप्त रिपोर्टरों की क्यूरेटेड वायर — पढ़ें, वोट करें या अपना डिस्पैच दाखिल करें',
  },
  sub_vault: {
    en: 'Consensus-flagged reports under review — help verify or debunk',
    bn: 'পর্যালোচনাধীন সন্দেহজনক রিপোর্ট — যাচাই বা খণ্ডনে সাহায্য করুন',
    hi: 'समीक्षाधीन संदिग्ध रिपोर्ट — सत्यापन या खंडन में मदद करें',
  },
  sub_compare: {
    en: 'Real owner data, honest scores and smart recommendations before you buy',
    bn: 'কেনার আগে প্রকৃত মালিকের ডেটা, সৎ স্কোর এবং স্মার্ট সুপারিশ',
    hi: 'खरीदने से पहले असली मालिक डेटा, ईमानदार स्कोर और स्मार्ट सिफारिशें',
  },
  sub_earn: {
    en: 'Complete quests, climb the leaderboard and withdraw real earnings via UPI',
    bn: 'কোয়েস্ট সম্পন্ন করুন, লিডারবোর্ডে উঠুন এবং ইউপিআই-তে উপার্জন তুলুন',
    hi: 'क्वेस्ट पूरा करें, लीडरबोर्ड पर चढ़ें और UPI से कमाई निकालें',
  },
  sub_cinema: {
    en: 'Ticket-verified movie reviews — no bots, no pirate clips, no paid review farms',
    bn: 'টিকিট-যাচাইকৃত মুভি রিভিউ — কোনো বট, পাইরেট ক্লিপ বা পেইড রিভিউ ফার্ম নয়',
    hi: 'टिकट-सत्यापित मूवी समीक्षाएँ — न बॉट, न पायरेट क्लिप, न पेड समीक्षा फ़ार्म',
  },
  sub_scanner: {
    en: 'Paste any WhatsApp forward and get an instant AI fact-check',
    bn: 'যেকোনো হোয়াটসঅ্যাপ ফরোয়ার্ড পেস্ট করুন, তাৎক্ষণিক এআই ফ্যাক্ট-চেক পান',
    hi: 'कोई भी व्हाट्सएप फॉरवर्ड पेस्ट करें, तुरंत AI फैक्ट-चेक पाएं',
  },
  sub_passport: {
    en: 'Prove ownership, log battery health and boost your resale price',
    bn: 'মালিকানা প্রমাণ করুন, ব্যাটারি স্বাস্থ্য লগ করুন, রিসেল মূল্য বাড়ান',
    hi: 'मालिकाना साबित करें, बैटरी स्वास्थ्य लॉग करें, रीसेल कीमत बढ़ाएं',
  },
  sub_sentinel: {
    en: 'Track your fact-check accuracy, rank among verifiers and manage alerts',
    bn: 'আপনার ফ্যাক্ট-চেক নির্ভুলতা ট্র্যাক করুন, যাচাইকারীদের মধ্যে র‍্যাংক দেখুন',
    hi: 'अपनी फैक्ट-चेक सटीकता ट्रैक करें, सत्यापनकर्ताओं में रैंक देखें',
  },
  sub_wallet: {
    en: 'View your balance, track payouts and withdraw to any UPI ID',
    bn: 'ব্যালেন্স দেখুন, পেআউট ট্র্যাক করুন এবং যেকোনো ইউপিআই আইডিতে তুলুন',
    hi: 'बैलेंस देखें, पेआउट ट्रैक करें और किसी भी UPI ID पर निकालें',
  },
  sub_profile: {
    en: 'Your identity, trust score, badges and account settings',
    bn: 'আপনার পরিচয়, বিশ্বস্ততা স্কোর, ব্যাজ এবং অ্যাকাউন্ট সেটিংস',
    hi: 'आपकी पहचान, विश्वास स्कोर, बैज और खाता सेटिंग्स',
  },

  // Area Switcher
  area_global: {
    en: 'Global',
    bn: 'গ্লোবাল',
    hi: 'ग्लोबल',
  },
  area_hyperlocal: {
    en: 'Hyperlocal',
    bn: 'হাইপারলোকাল',
    hi: 'हाइपरलोकल',
  },
  area_all_regions: {
    en: 'All regions · wire + citizen',
    bn: 'সমস্ত অঞ্চল · ওয়্যার + নাগরিক',
    hi: 'सभी क्षेत्र · वायर + नागरिक',
  },
  area_within_10km: {
    en: 'Within 10 km',
    bn: '১০ কিমি এর মধ্যে',
    hi: '10 किमी के भीतर',
  },
  location_denied: {
    en: 'Location permission denied.',
    bn: 'অবস্থান অনুমতি প্রত্যাখ্যাত।',
    hi: 'स्थान अनुमति अस्वीकृत।',
  },

  // Right Rail Widgets
  liveNotifications: {
    en: 'Live Activity',
    bn: 'সরাসরি কার্যকলাপ',
    hi: 'लाइव गतिविधि',
  },
  liveWire: {
    en: 'Live Wire',
    bn: 'সরাসরি সংবাদ',
    hi: 'लाइव वायर',
  },
  viewAll: {
    en: 'View all',
    bn: 'সব দেখুন',
    hi: 'सब देखें',
  },
  openBounties: {
    en: 'Open Bounties (+₹)',
    bn: 'উন্মুক্ত বাউন্টি (+₹)',
    hi: 'खुले इनाम (+₹)',
  },
  earnViaUpi: {
    en: 'Earn via UPI',
    bn: 'ইউপিআই-এ আয় করুন',
    hi: 'यूपीआई से कमाएं',
  },
  onlineCheck: {
    en: 'Online check',
    bn: 'অনলাইন যাচাই',
    hi: 'ऑनलाइन जांच',
  },
  available: {
    en: 'Available',
    bn: 'উপলব্ধ',
    hi: 'उपलब्ध',
  },
  sentinelLeaderboard: {
    en: 'Sentinel Leaderboard',
    bn: 'সেন্টিনেল লিডারবোর্ড',
    hi: 'सेंटिनल लीडरबोर्ड',
  },
  noSentinels: {
    en: 'No sentinels yet.',
    bn: 'এখনও কোনো সেন্টিনেল নেই।',
    hi: 'अभी तक कोई सेंटिनल नहीं।',
  },
  accurateChecks: {
    en: 'accurate checks',
    bn: 'সঠিক যাচাই',
    hi: 'सटीक जांच',
  },
  distributedThisMonth: {
    en: 'Distributed this month',
    bn: 'এই মাসে প্রদান করা হয়েছে',
    hi: 'इस महीने वितरित',
  },
  communityDividendPool: {
    en: 'Community Dividend Pool',
    bn: 'কমিউনিটি লভ্যাংশ পুল',
    hi: 'कम्युनिटी लाभांश पूल',
  },
  instantUpiPayouts: {
    en: 'RazorpayX instant UPI payouts',
    bn: 'রেজারপে-এক্স তাত্ক্ষণিক ইউপিআই পেআউট',
    hi: 'रेज़रपे-एक्स तत्काल यूपीआई भुगतान',
  },
  liveNewsFeeds: {
    en: 'Live News Feeds',
    bn: 'লাইভ নিউজ ফিড',
    hi: 'लाइव न्यूज़ फ़ीड',
  },
  wireSourcesHealthy: {
    en: 'wire sources healthy',
    bn: 'ওয়্যার উৎস সক্রিয়',
    hi: 'वायर स्रोत सक्रिय',
  },
  lastRun: {
    en: 'Last run',
    bn: 'সর্বশেষ রান',
    hi: 'अंतिम रन',
  },

  // Live Feed & Cards
  liveCircleFeed: {
    en: 'Live Circle Feed',
    bn: 'লাইভ সার্কেল ফিড',
    hi: 'लाइव सर्कल फ़ीड',
  },
  incidentHeatmap: {
    en: 'Incident Heatmap',
    bn: 'ঘটনা হিটম্যাপ',
    hi: 'घटना हीटमैप',
  },
  noQuarantined: {
    en: 'No quarantined items. The feed is clean.',
    bn: 'কোনো কোয়ারেন্টাইন করা পোস্ট নেই। ফিড পরিচ্ছন্ন।',
    hi: 'कोई क्वारंटाइन सामग्री नहीं। फ़ीड स्वच्छ है।',
  },
  nothingNearby: {
    en: 'Nothing reported within 10 km yet.',
    bn: '১০ কিমি এর মধ্যে এখনও কিছু রিপোর্ট করা হয়নি।',
    hi: '10 किमी के भीतर अभी तक कोई रिपोर्ट नहीं है।',
  },
  noStoriesYet: {
    en: 'No stories yet.',
    bn: 'এখনও কোনো পোস্ট নেই।',
    hi: 'अभी तक कोई कहानी नहीं।',
  },
  publicVerified: {
    en: 'Public Verified',
    bn: 'সর্বজনীন যাচাইকৃত',
    hi: 'सार्वजनिक सत्यापित',
  },
  ring1Review: {
    en: 'Ring 1 Review',
    bn: 'রিং ১ পর্যালোচনা',
    hi: 'रिंग 1 समीक्षा',
  },
  ring2Review: {
    en: 'Ring 2 Review',
    bn: 'রিং ২ পর্যালোচনা',
    hi: 'रिंग 2 समीक्षा',
  },
  quarantinedHoax: {
    en: 'Quarantined Hoax',
    bn: 'কোয়ারেন্টাইন ভুয়া',
    hi: 'क्वारंटाइन अफवाह',
  },
  credibility: {
    en: 'Credibility',
    bn: 'বিশ্বাসযোগ্যতা',
    hi: 'विश्वसनीयता',
  },
  verifyReal: {
    en: 'Verify Real',
    bn: 'সত্য যাচাই',
    hi: 'सत्य सत्यापित करें',
  },
  needsContext: {
    en: 'Needs Context',
    bn: 'প্রসঙ্গ প্রয়োজন',
    hi: 'संदर्भ चाहिए',
  },
  flagHoax: {
    en: 'Flag Hoax',
    bn: 'ভুয়া চিহ্নিত',
    hi: 'अफवाह चिह्नित करें',
  },
  timeline: {
    en: 'Timeline',
    bn: 'টাইমলাইন',
    hi: 'टाइमलाइन',
  },
  share: {
    en: 'Share',
    bn: 'শেয়ার',
    hi: 'शेयर',
  },
  primaryReport: {
    en: 'Primary report',
    bn: 'প্রাথমিক রিপোর্ট',
    hi: 'प्राथमिक रिपोर्ट',
  },
  completeness: {
    en: 'completeness',
    bn: 'সম্পূর্ণতা',
    hi: 'पूर्णता',
  },
  loadingUpdates: {
    en: 'Loading updates…',
    bn: 'আপডেট লোড হচ্ছে…',
    hi: 'अपडेट लोड हो रहे हैं…',
  },
  noCorroborating: {
    en: 'No corroborating reports yet.',
    bn: 'এখনও কোনো সমর্থনমূলক রিপোর্ট নেই।',
    hi: 'अभी तक कोई पुष्टिकरण रिपोर्ट नहीं है।',
  },
  wireSource: {
    en: 'wire',
    bn: 'ওয়্যার',
    hi: 'वायर',
  },
  citizenSource: {
    en: 'citizen',
    bn: 'নাগরিক',
    hi: 'नागरिक',
  },

  // Feed & Composer
  composerTitle: {
    en: 'Report an incident or claim',
    bn: 'একটি ঘটনা বা দাবি রিপোর্ট করুন',
    hi: 'किसी घटना या दावे की रिपोर्ट करें',
  },
  composerPlaceholder: {
    en: 'What happened? Write verified factual updates up to 60 words...',
    bn: 'কী ঘটেছে? ৬০ শব্দ পর্যন্ত যাচাইকৃত তথ্যমূলক আপডেট লিখুন...',
    hi: 'क्या हुआ? 60 शब्दों तक सत्यापित तथ्यात्मक अपडेट लिखें...',
  },
  selectCategory: {
    en: 'Select category',
    bn: 'বিভাগ নির্বাচন করুন',
    hi: 'श्रेणी चुनें',
  },
  cameraVerifyPrompt: {
    en: 'Snap with camera to verify C2PA authenticity',
    bn: 'সি২পিএ সত্যতা নিশ্চিত করতে ক্যামেরা দিয়ে তুলুন',
    hi: 'सी2पीए प्रामाणिकता के लिए कैमरे से फोटो लें',
  },
  wordsMax60: {
    en: 'words (max 60)',
    bn: 'শব্দ (সর্বোচ্চ ৬০)',
    hi: 'शब्द (अधिकतम 60)',
  },
  postReport: {
    en: 'Post Report',
    bn: 'রিপোর্ট পোস্ট করুন',
    hi: 'रिपोर्ट पोस्ट करें',
  },
  posting: {
    en: 'Posting...',
    bn: 'পোস্ট হচ্ছে...',
    hi: 'पोस्ट हो रहा है...',
  },
  postUpdate: {
    en: 'Post Report',
    bn: 'রিপোর্ট পোস্ট করুন',
    hi: 'रिपोर्ट पोस्ट करें',
  },
  submitReport: {
    en: 'Submit Verified Dispatch',
    bn: 'যাচাইকৃত সংবাদ জমা দিন',
    hi: 'सत्यापित रिपोर्ट जमा करें',
  },

  // News Hub
  fileDispatch: {
    en: 'File News Dispatch',
    bn: 'সংবাদ জমা দিন',
    hi: 'समाचार रिपोर्ट दर्ज करें',
  },
  pressPassActive: {
    en: 'Press Pass Active',
    bn: 'প্রেস পাস সক্রিয়',
    hi: 'प्रेस पास सक्रिय',
  },
  multiReporterConsensus: {
    en: 'Multi-Reporter Consensus',
    bn: 'মাল্টি-রিপোর্টার ঐক্যমত্য',
    hi: 'मल्टी-रिपोर्टर सर्वसम्मति',
  },
  categories: {
    en: 'Categories',
    bn: 'বিভাগসমূহ',
    hi: 'श्रेणियाँ',
  },
  allCategories: {
    en: 'All',
    bn: 'সমস্ত',
    hi: 'सभी',
  },
  curatedReports: {
    en: 'curated verified reports',
    bn: 'যাচাইকৃত সংগৃহীত রিপোর্ট',
    hi: 'क्यूरेट की गई सत्यापित रिपोर्ट',
  },
  realVotes: {
    en: 'Real',
    bn: 'সত্য',
    hi: 'सत्य',
  },
  hoaxVotes: {
    en: 'Hoax',
    bn: 'ভুয়া',
    hi: 'अफवाह',
  },
  credibilityConsensus: {
    en: 'Consensus',
    bn: 'ঐক্যমত্য',
    hi: 'सर्वसम्मति',
  },
  readTime: {
    en: 'min read',
    bn: 'মিনিট পড়া',
    hi: 'मिनट का पठन',
  },

  // Product Hub & Compare
  allProducts: {
    en: 'All Products',
    bn: 'সমস্ত প্রোডাক্ট',
    hi: 'सभी उत्पाद',
  },
  mobile: {
    en: 'Mobiles',
    bn: 'মোবাইল',
    hi: 'मोबाइल',
  },
  bike: {
    en: 'Bikes & Scooters',
    bn: 'বাইক ও স্কুটার',
    hi: 'बाइक और स्कूटर',
  },
  car: {
    en: 'Cars',
    bn: 'গাড়ি',
    hi: 'कारें',
  },
  laptop: {
    en: 'Laptops',
    bn: 'ল্যাপটপ',
    hi: 'लैपटॉप',
  },
  browseAndCompare: {
    en: 'Browse & Compare',
    bn: 'ব্রাউজ ও তুলনা',
    hi: 'ब्राउज़ और तुलना',
  },
  headToHeadBattles: {
    en: 'Head-to-Head Battles',
    bn: 'মুখোমুখি দ্বৈরথ',
    hi: 'आमने-सामने मुकाबला',
  },
  aiDecisionCopilot: {
    en: 'AI Decision Copilot',
    bn: 'এআই সিদ্ধান্ত কোপাইলট',
    hi: 'एआई निर्णय कोपायलट',
  },
  sixMoDecayIndex: {
    en: '6-Mo Decay Index',
    bn: '৬ মাসের ক্ষয় ইনডেক্স',
    hi: '6-महीने का क्षय सूचकांक',
  },
  askVerifiedOwner: {
    en: 'Ask a Verified Owner',
    bn: 'যাচাইকৃত মালিককে জিজ্ঞাসা',
    hi: 'सत्यापित मालिक से पूछें',
  },
  serviceCenterRadar: {
    en: 'Service Center Radar',
    bn: 'সার্ভিস সেন্টার রাডার',
    hi: 'सर्विस सेंटर रडार',
  },
  searchProducts: {
    en: 'Search by model, brand, spec...',
    bn: 'মডেল, ব্র্যান্ড, স্পেক দিয়ে খুঁজুন...',
    hi: 'मॉडल, ब्रांड, स्पेक द्वारा खोजें...',
  },
  filterBudget: {
    en: 'Budget',
    bn: 'বাজেট',
    hi: 'बजट',
  },
  filterUseCases: {
    en: 'Use Case',
    bn: 'ব্যবহারের ধরন',
    hi: 'उपयोग का प्रकार',
  },
  sortBy: {
    en: 'Sort By',
    bn: 'সাজান',
    hi: 'क्रमबद्ध करें',
  },
  sort_default: {
    en: 'Featured Default',
    bn: 'বৈশিষ্ট্যযুক্ত ডিফল্ট',
    hi: 'फीचर्ड डिफ़ॉल्ट',
  },
  sort_rating: {
    en: 'Highest Telemetry Score',
    bn: 'সর্বোচ্চ টেলিমেট্রি স্কোর',
    hi: 'उच्चतम टेलीमेट्री स्कोर',
  },
  sort_owners: {
    en: 'Most Verified Owners',
    bn: 'সর্বাধিক যাচাইকৃত মালিক',
    hi: 'सर्वाधिक सत्यापित मालिक',
  },
  sort_price_low: {
    en: 'Price: Low to High',
    bn: 'দাম: কম থেকে বেশি',
    hi: 'कीमत: कम से अधिक',
  },
  sort_price_high: {
    en: 'Price: High to Low',
    bn: 'দাম: বেশি থেকে কম',
    hi: 'कीमत: अधिक से कम',
  },
  sort_gap: {
    en: 'Lowest Reality Gap (Most Honest)',
    bn: 'ন্যূনতম বাস্তবতার ব্যবধান (সর্বাধিক সৎ)',
    hi: 'न्यूनतम रियलिटी गैप (सर्वाधिक ईमानदार)',
  },
  sort_tco: {
    en: 'Lowest 3-Year TCO',
    bn: 'সর্বনিম্ন ৩ বছরের মোট খরচ',
    hi: 'न्यूनतम 3-वर्षीय कुल खर्च',
  },
  sort_resale: {
    en: 'Best Resale Value Retention',
    bn: 'সেরা রিসেল মূল্য স্থায়িত্ব',
    hi: 'सर्वश्रेष्ठ रीसेल मूल्य',
  },
  sort_repair: {
    en: 'Best Repairability Score',
    bn: 'সেরা মেরামতযোগ্যতা স্কোর',
    hi: 'सर्वश्रेष्ठ मरम्मत स्कोर',
  },
  verifiedOwners: {
    en: 'verified owners',
    bn: 'যাচাইকৃত মালিক',
    hi: 'सत्यापित मालिक',
  },
  stealDeal: {
    en: 'Steal Deal',
    bn: 'সেরা ডিল',
    hi: 'शानदार सौदा',
  },
  fairMarket: {
    en: 'Fair Market',
    bn: 'ন্যায্য বাজার',
    hi: 'उचित बाज़ार मूल्य',
  },
  overpriced: {
    en: 'Overpriced',
    bn: 'অতিরিক্ত দাম',
    hi: 'अधिक कीमत',
  },
  theGood: {
    en: 'THE GOOD',
    bn: 'ভালো দিক',
    hi: 'अच्छी बातें',
  },
  theBad: {
    en: 'THE BAD',
    bn: 'সীমাবদ্ধতা',
    hi: 'कमियां',
  },
  realityGap: {
    en: 'Reality Gap',
    bn: 'বাস্তব বনাম দাবি',
    hi: 'रियलिटी गैप',
  },
  threeYearTco: {
    en: '3-Year TCO',
    bn: '৩ বছরের মোট খরচ',
    hi: '3-वर्षीय कुल खर्च',
  },
  resaleRetention: {
    en: 'Resale Value',
    bn: 'রিসেল মূল্য',
    hi: 'रीसेल मूल्य',
  },
  compareSelected: {
    en: 'Compare Selected',
    bn: 'নির্বাচিত পণ্য তুলনা করুন',
    hi: 'चयनित उत्पादों की तुलना करें',
  },
  addReview: {
    en: 'Add Verified Review',
    bn: 'যাচাইকৃত রিভিউ যোগ করুন',
    hi: 'सत्यापित समीक्षा जोड़ें',
  },
  viewDetails: {
    en: 'View Details',
    bn: 'বিস্তারিত দেখুন',
    hi: 'विवरण देखें',
  },

  // Earn & Bounties
  tab_bounties: {
    en: 'Bounties & Tasks',
    bn: 'বাউন্টি ও কাজ',
    hi: 'इनाम और कार्य',
  },
  tab_dividends: {
    en: 'Daily Sentinel Pool',
    bn: 'দৈনিক সেন্টিনেল পুল',
    hi: 'दैनिक सेंटिनल पूल',
  },
  tab_grants: {
    en: 'Milestone Grants',
    bn: 'মাইলস্টোন অনুদান',
    hi: 'माइलस्टोन अनुदान',
  },
  tab_passport: {
    en: 'Resale Passport',
    bn: 'রিসেল পাসপোর্ট',
    hi: 'रीसेल पासपोर्ट',
  },
  tab_badges: {
    en: 'Badges',
    bn: 'ব্যাজ',
    hi: 'बैज',
  },
  bountyQuests: {
    en: 'Citizen Bounty Quests',
    bn: 'নাগরিক বাউন্টি কোয়েস্ট',
    hi: 'नागरिक इनाम कार्य',
  },
  claimBounty: {
    en: 'Claim Bounty',
    bn: 'বাউন্টি দাবি করুন',
    hi: 'इनाम का दावा करें',
  },
  submitProof: {
    en: 'Submit Proof',
    bn: 'প্রমাণ জমা দিন',
    hi: 'प्रमाण जमा करें',
  },
  bountyCompleted: {
    en: 'Bounty Completed',
    bn: 'বাউন্টি সম্পন্ন',
    hi: 'इनाम पूर्ण',
  },

  // WhatsApp Shield / Fact Check Scanner
  scannerTitle: {
    en: 'WhatsApp & Viral Misinformation Shield',
    bn: 'হোয়াটসঅ্যাপ ও ভাইরাল ভুল তথ্য শিল্ড',
    hi: 'व्हाट्सएप और वायरल गलत सूचना शील्ड',
  },
  scannerSubtitle: {
    en: 'Real-time multi-source AI verification for forwarded claims, viral audio & text',
    bn: 'ফরোয়ার্ড বার্তা, ভাইরাল অডিও ও লেখার রিয়েল-টাইম বহু-উৎস এআই যাচাইকরণ',
    hi: 'फॉरवर्ड किए गए संदेशों, वायरल ऑडियो और टेक्स्ट का रीयल-टाइम एआई सत्यापन',
  },
  pastePlaceholder: {
    en: 'Paste viral WhatsApp message, tweet, or claim here...',
    bn: 'ভাইরাল হোয়াটসঅ্যাপ বার্তা, টুইট বা দাবি এখানে পেস্ট করুন...',
    hi: 'वायरल व्हाट्सएप संदेश, ट्वीट या दावा यहाँ पेस्ट करें...',
  },
  analyzeClaim: {
    en: 'Analyze & Verify',
    bn: 'বিশ্লেষণ ও যাচাই করুন',
    hi: 'विश्लेषण और सत्यापित करें',
  },
  analyzing: {
    en: 'Scanning PIB & wire archives...',
    bn: 'পিআইবি ও ওয়্যার আর্কাইভ স্ক্যান হচ্ছে...',
    hi: 'पीआईबी और वायर अभिलेखागार स्कैन हो रहे हैं...',
  },
  quickExamples: {
    en: 'Quick Test Examples',
    bn: 'দ্রুত পরীক্ষার উদাহরণ',
    hi: 'त्वरित परीक्षण उदाहरण',
  },
  verdictConfirmedReal: {
    en: 'CONFIRMED REAL',
    bn: 'নিশ্চিত সত্য',
    hi: 'पुष्टि की गई: सत्य',
  },
  verdictConfirmedHoax: {
    en: 'CONFIRMED HOAX',
    bn: 'নিশ্চিত ভুয়া',
    hi: 'पुष्टि की गई: अफवाह',
  },
  verdictMisleading: {
    en: 'MISLEADING CONTEXT',
    bn: 'বিভ্রান্তিকর তথ্য',
    hi: 'भ्रामक संदर्भ',
  },
  verdictMostlyTrue: {
    en: 'MOSTLY TRUE',
    bn: 'অধিকাংশই সত্য',
    hi: 'अधिकांश सत्य',
  },
  verdictSatire: {
    en: 'SATIRE / PARODY',
    bn: 'ব্যঙ্গ / প্যারোডি',
    hi: 'व्यंग्य / पैरोडी',
  },
  verdictUnverifiable: {
    en: 'UNVERIFIED CLAIM',
    bn: 'অযাচাইকৃত দাবি',
    hi: 'असत्यापित दावा',
  },
  confidence: {
    en: 'Confidence',
    bn: 'নির্ভুলতার মাত্রা',
    hi: 'विश्वास स्तर',
  },
  copyVerdict: {
    en: 'Copy Fact-Check Verdict',
    bn: 'ফলাফল কপি করুন',
    hi: 'सत्यापन परिणाम कॉपी करें',
  },
  copied: {
    en: 'Copied!',
    bn: 'কপি করা হয়েছে!',
    hi: 'कॉपी हो गया!',
  },
  recentScans: {
    en: 'Recent Community Scans',
    bn: 'সাম্প্রতিক কমিউনিটি স্ক্যান',
    hi: 'हालिया कम्युनिटी स्कैन',
  },

  // Wallet
  walletBalance: {
    en: 'Wallet Balance',
    bn: 'ওয়ালেট ব্যালেন্স',
    hi: 'वॉलेट बैलेंस',
  },
  walletDesc: {
    en: 'Earnings from citizen fact-checking & verified ownership',
    bn: 'নাগরিক তথ্য-যাচাই ও মালিকানা যাচাইয়ের উপার্জন',
    hi: 'नागरिक तथ्य-जांच और सत्यापित स्वामित्व से कमाई',
  },
  instantWithdrawal: {
    en: 'Instant UPI Withdrawal',
    bn: 'তাত্ক্ষণিক ইউপিআই উত্তোলন',
    hi: 'तत्काल यूपीआई निकासी',
  },
  enterUpiId: {
    en: 'Enter UPI ID (e.g. name@okhdfcbank)',
    bn: 'ইউপিআই আইডি দিন (উদাঃ name@okhdfcbank)',
    hi: 'यूपीआई आईडी दर्ज करें (उदा. name@okhdfcbank)',
  },
  transferAmount: {
    en: 'Amount in ₹ (Min ₹100)',
    bn: 'টাকার পরিমাণ (নূন্যতম ₹১০০)',
    hi: 'राशि ₹ में (न्यूनतम ₹100)',
  },
  withdrawUpi: {
    en: 'Withdraw via UPI',
    bn: 'ইউপিআই দিয়ে তুলুন',
    hi: 'यूपीआई से निकालें',
  },
  processing: {
    en: 'Processing...',
    bn: 'প্রক্রিয়াধীন...',
    hi: 'प्रक्रिया जारी...',
  },
  earningsBreakdown: {
    en: 'Earnings Breakdown',
    bn: 'উপার্জনের বিবরণ',
    hi: 'कमाई का विवरण',
  },
  payoutHistory: {
    en: 'Payout History',
    bn: 'উত্তোলনের ইতিহাস',
    hi: 'निकासी का इतिहास',
  },
  instantTransfer: {
    en: 'Instant UPI Transfer',
    bn: 'তাত্ক্ষণিক ইউপিআই ট্রান্সফার',
    hi: 'तत्काल यूपीआई ट्रांसफर',
  },
  statusProcessed: {
    en: 'Processed',
    bn: 'সম্পন্ন',
    hi: 'संपन्न',
  },
  statusProcessing: {
    en: 'Processing',
    bn: 'প্রক্রিয়াধীন',
    hi: 'प्रक्रियाधीन',
  },
  statusQueued: {
    en: 'Queued',
    bn: 'অপেক্ষমান',
    hi: 'कतार में',
  },

  // Profile
  tabOverview: {
    en: 'Overview',
    bn: 'সংক্ষিপ্ত বিবরণ',
    hi: 'अवलोकन',
  },
  tabVerify: {
    en: 'Verify Identity',
    bn: 'পরিচয় যাচাই',
    hi: 'पहचान सत्यापन',
  },
  tabNetwork: {
    en: 'Network & Friends',
    bn: 'নেটওয়ার্ক ও বন্ধু',
    hi: 'नेटवर्क और मित्र',
  },
  tabSocial: {
    en: 'Social Links',
    bn: 'সোশ্যাল লিংক',
    hi: 'सोशल लिंक',
  },
  tabSettings: {
    en: 'Settings',
    bn: 'সেটিংস',
    hi: 'सेटिंग्स',
  },
  trustScore: {
    en: 'Trust Score',
    bn: 'বিশ্বাসযোগ্যতা স্কোর',
    hi: 'विश्वसनीयता स्कोर',
  },
  followers: {
    en: 'Followers',
    bn: 'অনুগামী',
    hi: 'फॉलोअर्स',
  },
  following: {
    en: 'Following',
    bn: 'অনুসরণ করছেন',
    hi: 'फॉलोइंग',
  },
  follow: {
    en: 'Follow',
    bn: 'অনুসরণ করুন',
    hi: 'फॉलो करें',
  },
  unfollow: {
    en: 'Unfollow',
    bn: 'আনফলো করুন',
    hi: 'अनफॉलो करें',
  },
  editProfile: {
    en: 'Edit Profile',
    bn: 'প্রোফাইল সম্পাদনা',
    hi: 'प्रोफ़ाइल संपादित करें',
  },
  saveChanges: {
    en: 'Save Changes',
    bn: 'পরিবর্তন সংরক্ষণ করুন',
    hi: 'बदलाव सुरक्षित करें',
  },
  shareProfile: {
    en: 'Share Profile',
    bn: 'প্রোফাইল শেয়ার',
    hi: 'प्रोफ़ाइल साझा करें',
  },
  syncContacts: {
    en: 'Sync Phone Contacts',
    bn: 'ফোন পরিচিতি সিঙ্ক করুন',
    hi: 'फ़ोन संपर्क सिंक करें',
  },
  verifyWithDigilocker: {
    en: 'Verify with DigiLocker / Aadhaar',
    bn: 'ডিজিলকার / আধার দিয়ে যাচাই করুন',
    hi: 'डिजीलॉकर / आधार से सत्यापित करें',
  },
};

/**
 * Returns localized translation or falls back to English.
 */
export function t(key: string, lang: Lang): string {
  const item = UI_STRINGS[key];
  if (!item) return key;
  return item[lang] ?? item.en ?? key;
}
