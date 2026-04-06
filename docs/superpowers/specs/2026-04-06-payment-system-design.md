# Payment System Design — The Button
**Date:** 2026-04-06  
**Status:** Approved  
**Scope:** Paddle checkout integration, press limits, anonymous purchase persistence

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

---

## Data Layer

### Supabase Table: `purchases`

```sql
anon_id        TEXT PRIMARY KEY
email          TEXT NOT NULL
extra_presses  INTEGER DEFAULT 0
is_unlimited   BOOLEAN DEFAULT false
active_title   TEXT NULLABLE
updated_at     TIMESTAMPTZ DEFAULT now()
```

- `extra_presses` only increases on purchase, only decreases when consumed (never resets)
- `is_unlimited` set true on subscription purchase, false on cancellation via webhook
- RLS: anon select by `anon_id` only, no direct insert/update (Edge Function only)

### localStorage Cache

```
tb_anon_id        → UUID v4 (permanent, generated on first visit)
tb_extra_presses  → integer (mirrors DB)
tb_is_unlimited   → boolean
tb_active_title   → string | null
tb_daily_used     → integer (resets when date changes)
tb_daily_date     → YYYY-MM-DD
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

## Services

### `AnonIdentityService`
- Generates UUID v4 on first visit, persists in localStorage as `tb_anon_id`
- Returns the same ID on every subsequent visit
- Provided at root level

### `PurchaseService`
- Signals: `canPress`, `extraPresses`, `isUnlimited`, `dailyRemaining`, `activeTitle`
- On init: read localStorage (instant), then fetch Supabase row by `anon_id` (sync)
- `consumePress()`: updates daily counter or decrements extra presses, writes both layers
- `refreshFromSupabase()`: called after `checkout.completed` event

### `PaddleService`
- Lazy-loads Paddle.js from CDN on first call
- `initialize()`: sets client token, registers `eventCallback`
- `openCheckout(priceId)`: opens Paddle overlay with `anon_id` in `customData`
- On `checkout.completed`: calls `PurchaseService.refreshFromSupabase()`

---

## Components

### `PressLimitModalComponent`
- Auto-triggered when `PurchaseService.canPress` is false and press is attempted
- Products shown: 10 presses ($0.99), Unlimited ($2.99/mo)
- Dismiss option: "Come back tomorrow" (closes modal, no purchase)
- Design: full-screen dark overlay, matches existing void aesthetic

### `ShopModalComponent`
- Opened voluntarily from footer "Shop" link
- Shows all 3 products with current user state ("You have 7 extra presses")
- Same overlay style as limit modal

### `RestoreModalComponent`
- Opened from footer "Restore" link
- Email input → Supabase lookup by email → if found, write to localStorage
- States: idle, loading, success, not-found

---

## Supabase Edge Function: `paddle-webhook`

- Endpoint: `POST /functions/v1/paddle-webhook`
- Verifies Paddle signature header
- On `transaction.completed`:
  - Extracts `anon_id` from `customData`
  - Extracts `email` from `customer.email`
  - Upserts `purchases` row based on `price_id`:
    - Extra presses price → `extra_presses += 10`
    - Unlimited price → `is_unlimited = true`
    - Title price → `active_title = 'presser-legend'`
- On `subscription.canceled`:
  - Sets `is_unlimited = false`

---

## Environment Config (placeholders)

```typescript
paddle: {
  clientToken: 'YOUR_PADDLE_CLIENT_TOKEN',
  prices: {
    extraPresses10: 'pri_YOUR_10_PRESSES_PRICE_ID',
    unlimitedMonthly: 'pri_YOUR_UNLIMITED_MONTHLY_PRICE_ID',
    titlePresserLegend: 'pri_YOUR_TITLE_PRICE_ID',
  }
}
```

---

## What Stays Out of Scope

- User authentication / accounts
- Country wars / team features
- Milestone notifications
- Multiple title options (just one for MVP)
- Stripe / any other payment processor
