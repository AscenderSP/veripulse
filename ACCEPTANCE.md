# Acceptance criteria — status

Mapped to §8 of the architecture document.

```bash
npm test          # unit: consensus math, 60-word clamp, identity hash
npm run test:db   # SQL: real migrations on local Postgres + pgvector + PostGIS
```

`test:db` boots a throwaway Postgres, stubs the Supabase-provided objects
(`auth.uid()`, roles, `storage`, realtime publication) and runs the real
migrations unmodified. Needs `postgresql@17`, `pgvector`, `postgis`
(Homebrew) — or set `PG_BIN`.

| # | Subsystem | Criterion | Status | Evidence |
|---|-----------|-----------|--------|----------|
| 1 | Ingestion | Summaries ≤60 words in EN/BN/HI | ✅ unit · ⚙️ live | `enforceSixtyWords` hard-caps all three (unit test with 90-word EN/BN/HI input). Live Gemini quality check needs `GEMINI_API_KEY`: feed articles to `/api/stories/submit`. |
| 2 | Deduplication | Similar reports merge into one timeline | ✅ db | ~0.99-cosine reports → 1 story + 1 timeline node; more complete report becomes primary; orthogonal report stays separate. |
| 3 | Consensus math | 5 hoax flags (trust>80) → quarantine | ✅ unit + db | Quarantined, author −2.5 trust, readers + voters get retraction notices, voters scored; same-vote replays are no-ops; tier-1 ring gated to sentinels. |
| 4 | Tamper detection | Edited RC fails OCR | ✅ logic · ⚙️ live | `tamper_check_passed=false` → HTTP 400 `TAMPER_DETECTED`, logged to `verification_flags`. Detection itself is Gemini Vision; needs a key + a synthetic altered RC. |
| 5 | Financial security | Concurrent withdrawals can't double-spend | ✅ db | 5 simultaneous `request_upi_payout` calls on a ₹150 wallet → exactly 1 queued, 4 `INSUFFICIENT_BALANCE`. Idempotent replay never re-debits; trust < 70 refused; webhook reversal refunds. |
| 6 | Cross-platform parity | Web + Android + iOS | ✅ web · ✅ Android build · ⚙️ iOS | `npm run build` and `npm run build:mobile` pass; Android project generated with permissions. iOS needs full Xcode + CocoaPods (or Codemagic). |

Also covered by `test:db`: client roles cannot execute service-only RPCs
(ingest, settle, reverse, drain); affiliate ₹1000 → 700/200/100 with replay
protection; sentinel pool paid pro rata to correct voters exactly once;
profile RLS blocks self-edits of wallet/trust/tier/badge.

## Design notes surfaced by testing
- **Late votes aren't rewarded.** Votes cast after a story reaches
  `public`/`quarantined` still move credibility but earn no accuracy or pool
  share — otherwise users could wait for the outcome and farm rewards.
- **HNSW, not ivfflat.** The spec's `ivfflat (lists=100)` built on an empty
  table has very low recall (pgvector warns about this), so dedup would miss
  duplicates on a fresh project. `0003_hardening.sql` replaces it with HNSW.
