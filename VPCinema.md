 **"VeriPulse Cinema Sentinel" — Genuine, Anti-Bot Movie Reviews**.

This fits directly into VeriPulse’s core philosophy: **replacing fake PR hype and paid review bombing with cryptographic hardware proof and physical presence verification.**

---

### 1. The Core Problem It Solves
- **Paid Critic Hype vs. Review Bombing**: On BookMyShow, IMDb, and Google Reviews, bot farms manipulate ratings before movies even release or run coordinated smear campaigns.
- **Armchair Opinions**: Anyone who watched a 2-minute pirated clip on Instagram/Twitter can rate a film 1/10 or 10/10 without having sat in the theater.

---

### 2. The 3-Pillar Verification Gate ("Proof of Attendance")

To guarantee **100% genuine reviews**, a user must pass **all 3 verification checkpoints**:

```
 ┌──────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
 │ 1. Ticket Ownership  │ ───► │ 2. Temporal Gate        │ ───► │ 3. 500m Geo-Fence Ring  │
 │ • BookMyShow/PVR/INOX│      │ • Must be AFTER         │      │ • GPS lock within 500m  │
 │   QR code / PDF      │      │   showtime + runtime    │      │   of specific cinema    │
 │ • Cryptographic Hash │      │ • Max 3-hour post-show  │      │ • Prevents post-hoc     │
 │   prevents re-use    │      │   early review window   │      │   remote review farms   │
 └──────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
                                                                             │
                                                                             ▼
                                                               ┌─────────────────────────┐
                                                               │  Verified Review Ticket │
                                                               │  + Dynamic Early VPcoin │
                                                               └─────────────────────────┘
```

#### Pillar 1: Valid Ticket Ownership (Cryptographic Anti-Duplication)
- **OCR & QR Decoding**: User uploads their ticket (BookMyShow, PVR INOX, Cinepolis, or physical counter paper ticket photo).
- **Data Extracted**:
  - Cinema Hall Name & Location
  - Movie Title
  - Date & Show Time (e.g., `29 Oct 2026, 06:45 PM`)
  - Screen / Audi & Seat Number (e.g., `Audi 3, Row F, Seat 14`)
  - Booking ID / PNR Number
- **One Ticket = Exactly One Review Hash**:
  - We hash `SHA-256(movie_id + cinema_id + show_time + seat_no + booking_id)` into a unique `ticket_claim_hash`.
  - Stored in the database with a `UNIQUE` constraint. Nobody else (and no shared screenshot) can review twice using the same seat ticket.

#### Pillar 2: Temporal Gate (Post-Showtime Only)
- **Constraint**: The user **cannot** submit a review before the movie finishes.
- **Formula**:
  $$\text{Unlock Time} = \text{Show Start Time} + \text{Movie Runtime (e.g., 150 min)} + 15\text{ min interval buffer}$$
- **Window**: The review submission window opens at $\text{Unlock Time}$ and stays open while they are in proximity (typically up to 3–4 hours after the show).

#### Pillar 3: 500m Cinema Hall Geo-Fence (`st_dwithin`)
- Uses native Capacitor Geolocation + Web Geolocation API:
  - Fetches high-accuracy GPS coordinates (`{ enableHighAccuracy: true }`).
  - Calculates physical distance from the cinema's known lat/long coordinate:
    $$\text{Distance} \le 500\text{ meters}$$
- **Why this works**: If someone sends their ticket PDF to a friend across the country, their friend cannot submit the review because they are not physically at the multiplex. The review must be submitted right as they walk out of the auditorium!

---

### 3. Movie Rating Parameters (Multi-Dimensional Scorecard)

Instead of a generic 1–5 star rating, users rate on 5 transparent parameters (scored 1–10):

| Parameter | What It Measures | Why It Matters |
| :--- | :--- | :--- |
| **Pacing & Screenplay** | Story coherence, interval hook, climax | Filters out films with strong trailers but weak second halves. |
| **Theater Experience & Scale** | Sound design (Dolby Atmos/IMAX), visual effects, cinematography | Tells viewers if it's worth the ₹400 ticket or better suited for OTT. |
| **Acting & Performances** | Lead & supporting cast execution | Objective critique beyond star-fan loyalty. |
| **Re-Watchability / Value-for-Money** | Entertainment per rupee spent | Crucial for middle-class family audience decisions. |
| **"Hype vs Reality" (Reality Gap)** | Did the film meet promotional promises? | Flagging deceptive marketing or excessive paid PR. |

- **One-Sentence Verdict**: (Hard-capped at 25 words — punchy and to the point).
- **Optional Proof**: Selfie with theater marquee or ticket stub for an extra **Verified Cine-Pass** badge.

---

### 4. "First-Day First-Show" Early Review Incentive Engine

To motivate prompt, honest reviews right as audiences leave the theater, rewards decay over time:

| Submission Window | Incentive (VPcoins) | Multiplier / Perks |
| :--- | :---: | :--- |
| **FDFS (First 30 min post-credits)** | **50 VPcoins (₹5.00)** | **"First Sentinel"** Gold Badge on movie timeline |
| **Day 1 Post-Show (within 2 hours)** | **30 VPcoins (₹3.00)** | Silver Verified Attendee Tag |
| **Day 2–3 (within 500m of cinema)** | **15 VPcoins (₹1.50)** | Standard Verified Ticket Badge |
| **Beyond 4 hours / Remote** | *Locked / Rejected* | *(Cannot submit without 500m geo-fence lock)* |

- **Master Transaction Ledger Integration**:
  - Reward disbursements are automatically logged into `public.master_transactions` under type `movie_critic_reward` with reference to the `ticket_claim_hash`.
  - VPcoins can be converted to UPI cashout or movie voucher codes (BookMyShow/PVR gift cards) in the VeriPulse Wallet.

---

### 5. Proposed Architecture & Implementation Plan

```
supabase/migrations/0007_cinema_sentinel.sql
  ├── public.cinemas (id, name, chain, lat, lng, city)
  ├── public.movies (id, title, duration_minutes, release_date, poster_url)
  ├── public.movie_tickets (id, user_id, ticket_claim_hash, show_time, status)
  └── public.movie_reviews (id, movie_id, user_id, ratings jsonb, reality_gap, distance_meters, vp_reward)
```

1. **OCR / QR Scanner Helper**: Accepts ticket image $\rightarrow$ extracts cinema, showtime, seat, and movie.
2. **Geo-Location Checker**: Computes haversine distance between device GPS and cinema GPS (validating $\le 500\text{m}$).
3. **UI Component (`CinemaReviews.tsx`)**:
   - Movie carousel showing **"Crowd Reality Score"** vs **"Critic Hype Score"**.
   - "Verify My Ticket & Review" action button with camera ticket scanner.
   - Live countdown timer: *"Your show unlocks for review at 09:30 PM (Audi 2)"*.
   - Live GPS proximity beacon: *"You are 85m from PVR South City — Ready to Review"*.
