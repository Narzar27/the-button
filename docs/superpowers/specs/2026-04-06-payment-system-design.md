# Payment System Design — The Button
**Date:** 2026-04-06  
**Status:** Approved  
**Scope:** Paddle checkout integration, press limits, anonymous purchase persistence, streaks, God Mode auction

---

## Overview

Add monetization to The Button via Paddle checkout. Users get 1 free press per day. Purchased extra presses persist forever across refreshes. Cross-device restore via Paddle email. No auth required.

---

## Products

| Product | Price | Type | Effect |
|---|---|---|---|
| 10 Extra Presses | $0.99 | One-time | +10 to `extra_presses` |
| Unlimited Daily | $2.99/mo | Subscription | Sets `is_unlimited = true` |
| Presser Legend Title | $0.99 | One-time | Unlocks title display |
| Streak Freeze | $0.99 | One-time | +1 freeze token, consumes instead of breaking streak |
| God Mode Bid | Variable (min $1, user sets amount) | One-time | Become current God if highest bid |

---

## Data Layer

### Supabase Table: `purchases`

```sql
anon_id          TEXT PRIMARY KEY
email            TEXT NOT NULL
extra_presses    INTEGER DEFAULT 0
is_unlimited     BOOLEAN DEFAULT false
active_title     TEXT NULLABLE
streak_count     INTEGER DEFAULT 0
streak_last_date TEXT NULLABLE        -- YYYY-MM-DD of last press
streak_freezes   INTEGER DEFAULT 0
updated_at       TIMESTAMPTZ DEFAULT now()
```

- `extra_presses` only increases on purchase, only decreases when consumed (never resets)
- `is_unlimited` set true on subscription purchase, false on cancellation via webhook
- `streak_count` increments each day user presses, resets to 0 if they miss a day with no freezes
- `streak_freezes` decrements when used to protect a streak, increments on purchase
- RLS: anon select by `anon_id` only, no direct insert/update (Edge Function only)

### Supabase Table: `god_mode`

```sql
id               INTEGER PRIMARY KEY DEFAULT 1  -- single row
god_name         TEXT NOT NULL DEFAULT 'Nobody'
god_anon_id      TEXT NULLABLE
current_bid      NUMERIC DEFAULT 0
auction_end_at   TIMESTAMPTZ NOT NULL           -- next Sunday 00:00 UTC
updated_at       TIMESTAMPTZ DEFAULT now()
CONSTRAINT single_row CHECK (id = 1)
```

- Single row, updated each time someone outbids the current God
- `auction_end_at` is always the coming Sunday at 00:00 UTC
- On auction end: row resets for new week (handled by webhook + Supabase cron)
- Realtime enabled so the displayed name/bid updates live for all visitors

### localStorage Cache

```
tb_anon_id        → UUID v4 (permanent, generated on first visit)
tb_extra_presses  → integer (mirrors DB)
tb_is_unlimited   → boolean
tb_active_title   → string | null
tb_daily_used     → integer (resets when date changes)
tb_daily_date     → YYYY-MM-DD
tb_streak_count   → integer
tb_streak_last    → YYYY-MM-DD
tb_streak_freezes → integer
```

localStorage is the fast layer (instant on load). Supabase is the source of truth (synced on init + after purchase).

---

## Press Logic

On each press attempt:
1. If `is_unlimited` → allow
2. Else if `daily_used < 1` → allow (consume free press, increment `daily_used`)
3. Else if `extra_presses > 0` → allow (decrement `extra_presses` in DB + localStorage)
4. Else → block, show `PressLimitModal`

Daily reset: if `tb_daily_date !== today`, reset `tb_daily_used = 0` and update date.

---

## Streak Logic

On each successful press:
1. If `streak_last_date === yesterday` → `streak_count++`, update `streak_last_date = today`
2. If `streak_last_date === today` → already pressed today, no change
3. If `streak_last_date < yesterday` → streak broken: check `streak_freezes > 0`
   - If freeze available: `streak_freezes--`, `streak_last_date = today` (streak preserved)
   - If no freeze: `streak_count = 1`, `streak_last_date = today`

Streak badge shown on home page next to press count:
- 3+ days: 🔥 small flame
- 7+ days: 🔥🔥 double flame  
- 30+ days: 👑 crown (special)

---

## God Mode Auction

### Flow
1. Home page shows a live "God of The Button" section with current god's name, bid, and countdown to Sunday reset
2. Any user can click "Overthrow" to enter their name + bid amount (must be > current bid, min $1)
3. Clicking confirm opens Paddle checkout for that custom amount with `{ anon_id, bid_name, bid_amount }` in customData
4. On `transaction.completed` webhook: if bid is still highest (guard against race), upsert `god_mode` row
5. Previous god is dethroned silently (no refund — they knew the rules)
6. Every Sunday 00:00 UTC: Supabase cron resets the row for a new week

### UI on Home Page
```
┌─────────────────────────────────────────┐
│  👑  GOD OF THE BUTTON                  │
│  [Name] reigns with $X.xx               │
│  Auction ends in 3d 14h 22m             │
│  [ OVERTHROW FOR $X.01+ ]               │
└─────────────────────────────────────────┘
```
- Realtime: name + bid update live for everyone when someone outbids
- Countdown computed client-side from `auction_end_at`
- Collapsed by default on mobile, expandable

### Custom Paddle Checkout for Auction
Paddle Billing supports ad-hoc pricing via `items[].quantity` tricks or custom amounts. We pass the bid amount as a custom price created via Paddle's API server-side in the Edge Function, then return a checkout URL. Alternative: use a Paddle product with a price of $0.01 and pass quantity = bid_in_cents (capped at reasonable max). Implementation detail resolved during build.

---

## Services

### `AnonIdentityService`
- Generates UUID v4 on first visit, persists in localStorage as `tb_anon_id`
- Returns the same ID on every subsequent visit

### `PurchaseService`
- Signals: `canPress`, `extraPresses`, `isUnlimited`, `dailyRemaining`, `activeTitle`, `streakCount`, `streakFreezes`
- On init: read localStorage (instant), then fetch Supabase row by `anon_id` (sync)
- `consumePress()`: updates daily counter or decrements extra presses + handles streak logic
- `refreshFromSupabase()`: called after `checkout.completed` event

### `PaddleService`
- Lazy-loads Paddle.js from CDN on first call
- `initialize()`: sets client token, registers `eventCallback`
- `openCheckout(priceId, customData?)`: opens Paddle overlay with `anon_id` in customData
- `openAuctionCheckout(name, bidAmount)`: calls Supabase Edge Function to get a checkout URL for the custom bid amount, then opens it
- On `checkout.completed`: calls `PurchaseService.refreshFromSupabase()`

### `GodModeService`
- Fetches and subscribes to `god_mode` table via Supabase Realtime
- Signals: `godName`, `currentBid`, `auctionEndsAt`, `timeRemaining` (computed)
- `placeBid(name, amount)`: calls `PaddleService.openAuctionCheckout(name, amount)`

---

## Components

### `PressLimitModalComponent`
- Auto-triggered when `canPress` is false and press is attempted
- Products shown: 10 presses ($0.99), Unlimited ($2.99/mo), Streak Freeze ($0.99)
- Dismiss: "Come back tomorrow"

### `ShopModalComponent`
- All products + current user state
- Includes streak freeze and God Mode auction link

### `RestoreModalComponent`
- Email input → Supabase lookup → restore localStorage

### `GodModeSectionComponent`
- Embedded in home page between counter and button
- Live god name, bid, countdown
- "Overthrow" CTA opens bid input inline

### `StreakBadgeComponent`
- Small inline badge next to "You: X presses"
- Shows flame emoji + streak count if streak >= 3

---

## Supabase Edge Functions

### `paddle-webhook`
- Verifies Paddle signature
- `transaction.completed`:
  - Extra presses → `extra_presses += 10`
  - Unlimited → `is_unlimited = true`
  - Title → `active_title = 'presser-legend'`
  - Streak freeze → `streak_freezes += 1`
  - God mode bid → upsert `god_mode` if bid > current_bid
- `subscription.canceled` → `is_unlimited = false`

### `create-auction-checkout`
- Called by client to generate a Paddle custom checkout URL for a specific bid amount
- Creates ad-hoc Paddle price via Paddle API, returns checkout URL
- Validates: bid > current_bid, name not empty, amount >= $1

### Supabase Cron (pg_cron)
- Runs every Sunday 00:00 UTC
- Resets `god_mode` row: `god_name = 'Nobody'`, `current_bid = 0`, advance `auction_end_at` by 7 days

---

## Environment Config (placeholders)

```typescript
paddle: {
  clientToken: 'YOUR_PADDLE_CLIENT_TOKEN',
  apiKey: 'YOUR_PADDLE_API_KEY',           // server-side only, in Supabase secrets
  prices: {
    extraPresses10: 'pri_YOUR_10_PRESSES_PRICE_ID',
    unlimitedMonthly: 'pri_YOUR_UNLIMITED_MONTHLY_PRICE_ID',
    titlePresserLegend: 'pri_YOUR_TITLE_PRICE_ID',
    streakFreeze: 'pri_YOUR_STREAK_FREEZE_PRICE_ID',
    // God mode uses dynamic pricing, no fixed price ID
  },
  webhookSecret: 'YOUR_PADDLE_WEBHOOK_SECRET',  // Supabase secret
}
```

---

## What Stays Out of Scope

- User authentication / accounts
- Country wars / team features
- Milestone notifications
- Multiple title options (just one for MVP)
- Refunds for God Mode (by design — rules shown before bidding)
- Stripe / any other payment processor
