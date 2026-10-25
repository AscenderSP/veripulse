# VeriPulse

Crowdsourced, fact-checked news **and** verified-owner product intelligence —
one codebase across Web, Android, and iOS.

Next.js 15 (App Router) · Supabase (PostgreSQL + pgvector + PostGIS) ·
Capacitor 6 · Google Gemini 2.5 Flash · RazorpayX · Surepass/Cashfree Vahan.

> **Status:** complete, build-ready source. It runs in **demo mode** out of the
> box (seeded feed, simulated flows) and switches to live mode the moment you
> add real credentials to `.env.local`. See *Setup*.

---

## What's in the box

```
veripulse/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx, page.tsx, globals.css   # shell + design tokens
│  │  └─ api/
│  │     ├─ stories/submit      # Gemini → dedup → ingest
│  │     ├─ verify/rc-invoice   # OCR + tamper + Vahan + hash
│  │     ├─ affiliate/postback  # idempotent 70/20/10 split
│  │     ├─ affiliate/click     # sub-id logging + merchant redirect
│  │     ├─ payouts/upi         # atomic debit + RazorpayX
│  │     └─ votes/cast          # weighted consensus RPC
│  ├─ components/                # shell, feed, compare, verify, wallet, ui
│  ├─ lib/                       # supabase, gemini, vahan, razorpayx,
│  │                             # nativeHardware, admob, crypto, utils, api
│  ├─ hooks/useLang.tsx, useSession.tsx  # language; auth + live profile
│  └─ middleware.ts              # session refresh + CORS for the native shell
├─ supabase/
│  ├─ migrations/0001_schema.sql      # tables, enums, RLS, PostGIS, triggers
│  ├─ migrations/0002_functions.sql   # consensus, dedup, payout, split RPCs
│  ├─ migrations/0003_hardening.sql   # grants, tiered rings, vote resolution,
│  │                                  # retractions, pool, products, storage
│  ├─ migrations/0004_platform_stats.sql
│  ├─ seed.sql                        # optional demo rows + products
│  └─ functions/
│     ├─ cron-rss-crawler/            # 30-min RSS → Gemini → ingest (Deno)
│     ├─ razorpayx-payout/            # drains stuck payouts (idempotent)
│     └─ razorpayx-webhook/           # signed payout.* events → UTR / refund
├─ android/                      # Capacitor Android project (permissions applied)
├─ tests/unit.test.ts            # npm test
├─ scripts/db-acceptance.sh      # npm run test:db
├─ capacitor.config.ts
├─ codemagic.yaml                # Android AAB/APK + iOS IPA CI
├─ scripts/mobile-export.mjs     # static export for Capacitor
├─ NATIVE_PERMISSIONS.md         # manifest / Info.plist snippets
└─ .env.example
```

---

## Setup

### 0. Prerequisites
Node 20+ (22 recommended), npm, a Supabase project, and — for live mode — API
keys for Gemini, RazorpayX, and a Vahan provider.

### 1. Install & run (demo mode)
```bash
npm install
cp .env.example .env.local      # leave placeholders to stay in demo mode
npm run dev                     # http://localhost:3000
```
You'll get the full UI with a seeded multilingual feed, working vote/credibility
animations, the product matrix, the OCR drawer (simulated), and the wallet.

### 2. Database
In the Supabase SQL editor, run in order:
```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_functions.sql
supabase/migrations/0003_hardening.sql
supabase/migrations/0004_platform_stats.sql
supabase/seed.sql                     # optional
```
(or `supabase db push` / `supabase db reset` with the CLI). Enable `pg_cron`
first if you want tier recompute and pool distribution scheduled automatically.
Enable Email (or your chosen) auth. A `profiles` row is auto-created on signup.

### 3. Go live
Fill `.env.local` (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `VAHAN_PROVIDER` + that provider's keys
- `RAZORPAYX_*`
- `AFFILIATE_POSTBACK_SECRET`
- `NEXT_PUBLIC_ADSENSE_CLIENT` / `NEXT_PUBLIC_ADMOB_*`

Once `NEXT_PUBLIC_SUPABASE_URL` is a real URL, the app leaves demo mode
automatically.

### 4. Edge functions
```bash
supabase functions deploy cron-rss-crawler
supabase functions deploy razorpayx-payout
supabase functions deploy razorpayx-webhook --no-verify-jwt
```
Schedule the crawler every 30 min and the payout drainer every 5 min (the
`cron.schedule` snippets are in each function's header). Point the RazorpayX
webhook (payout.processed / reversed / failed / updated) at
`razorpayx-webhook`.

### 5. Mobile
```bash
npm run build:mobile            # static export → ./out (API routes auto-excluded)
npx cap sync android            # android/ is already generated with permissions
npx cap run android             # needs JDK 17 (JAVA_HOME) + Android SDK
npx cap add ios                 # needs full Xcode + CocoaPods; then apply
                                # NATIVE_PERMISSIONS.md to Info.plist
```
CI for store artifacts is in `codemagic.yaml`.

---

## How the invariants are enforced

| Invariant | Where |
| --- | --- |
| **≤60-word summaries, EN/BN/HI** | `lib/gemini.ts` prompt + hard `clampSummary` trim |
| **Zero client-side trust** | All credibility/wallet/payout writes are `SECURITY DEFINER` RPCs with explicit `EXECUTE` grants (service-only RPCs revoked from anon/authenticated); RLS freezes `trust_score`, `tier`, `badge`, `wallet_balance_inr` on self-update; payout policy, affiliate reviewer and C2PA flag are decided server-side |
| **No double-spend** | `request_upi_payout` locks the profile row `FOR UPDATE`, debits inside the lock, then calls RazorpayX; reversal on failure |
| **Idempotency / replay** | Per-user `idempotency_key` (payouts; payout id doubles as the RazorpayX idempotency key), `processed_webhooks` hash (postbacks + RazorpayX events), `document_hash` (ownership) |
| **Vector dedup** | `find_duplicate_story` cosine search ≥0.84 in 24h → timeline merge / primary swap |
| **Weighted consensus** | `cast_weighted_vote` implements `W=(T/50)·M_geo·M_owner`, clamps C to [5,99], promotes ≥80 / quarantines <35, gates tier-1/tier-2 rings by voter tier, notifies prior readers on quarantine |
| **Cross-platform core** | `lib/nativeHardware.ts` one API over Capacitor + Web fallbacks; never breaks desktop |

`npm test` and `npm run test:db` verify these against the spec's acceptance
criteria on a real Postgres + pgvector + PostGIS (see `ACCEPTANCE.md`).

---

## Credentials you must supply yourself

These involve real money, government data, or store identities, so they run on
**your** verified business accounts via env vars — the code is complete and
calls them correctly:

- **Gemini** (summaries, OCR, embeddings)
- **Supabase** project (DB, auth, storage, edge functions)
- **RazorpayX** (UPI payouts — requires KYC-verified business)
- **Surepass / Cashfree** (Vahan RC lookups)
- **AdSense / AdMob** and **Cuelinks / Amazon Associates**
- **Apple Developer + Google Play** signing for store builds

---

## Security notes
- Never ship `SUPABASE_SERVICE_ROLE_KEY` to the client; it's server-only.
- The affiliate postback is secret-gated and idempotent — rotate the secret if leaked.
- RazorpayX webhook signatures are HMAC-verified (`lib/razorpayx.ts`).
- Raw RC/invoice numbers are hashed + masked; the plaintext is never stored.
