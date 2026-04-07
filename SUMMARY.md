# The Egg 🥚 — Project Summary

**Live at:** https://the-button-pink.vercel.app  
**Repo:** https://github.com/Narzar27/the-button  
**Built by:** Nizar · Beirut, Lebanon 🇱🇧  
**Started:** April 6, 2026 (pivoted April 7, 2026)

---

## What It Is

A global egg that everyone in the world cracks together. Each click adds a crack. The egg has 9 visual crack stages. At 4 billion clicks it fully cracks and a slightly smaller egg appears. Then another. Then another. Nobody knows what's inside the last one.

---

## Current State (April 7, 2026)

### Live & Working ✅
- 9-stage SVG egg with crack progression, wiggle animation, particle bursts
- Live global click counter via Supabase Realtime
- 10 free clicks per day per visitor (anonymous UUID tracking)
- Supabase Auth — Google OAuth + email magic link (PKCE flow, `/auth/callback` route)
- Leaderboard page — real data from Supabase, empty state, 4 tabs
- Perk Store UI — 10 perks built, Paddle scaffold wired (logs to console)
- Auth modal — email magic link + Google sign-in
- Dark space theme — stars, Fredoka One + Nunito, egg-yellow palette
- Vercel auto-deploy on push to `main`
- Terms of Service at `/terms-and-conditions`

### Needs Supabase Setup (not code — just dashboard actions) 📋
- Run `supabase/migrations/001_egg_schema.sql` in SQL Editor
- Run `supabase/migrations/002_user_tracking.sql` in SQL Editor
- Enable Realtime on `eggs` table
- Add redirect URL `https://the-button-pink.vercel.app/auth/callback`

### Pending / Blocked ⏳
- Paddle account under review → perk purchases log to console only
- Share button not yet built
- Leaderboard Today/Country tabs not differentiated yet
- Domain not purchased yet

---

## Architecture

```
User Browser
    │
    ├── Angular 19 SPA (Vercel CDN)
    │       ├── HomeComponent (/): egg + counter + click limit
    │       ├── LeaderboardComponent (/leaderboard): top crackers
    │       ├── PerkStoreComponent (/perks): 10 perks, Paddle scaffold
    │       ├── AuthCallbackComponent (/auth/callback): PKCE exchange
    │       │
    │       ├── AnonIdentityService: UUID in localStorage
    │       ├── ClickLimitService: 10/day limit + extra clicks
    │       ├── SupabaseService: egg data, realtime, auth, leaderboard
    │       ├── AuthService: sign-in signals + methods
    │       └── PaddleService: scaffold (TODO: real checkout)
    │
    └── Supabase (PostgreSQL + Realtime + Auth + Edge Functions)
            ├── eggs: current egg state (number, target, current_clicks)
            ├── users: leaderboard (display_name, total_clicks)
            ├── daily_clicks: anon daily tracking (anon_id, date, count)
            ├── purchases: payment records (wired after Paddle approval)
            ├── increment_egg() RPC: atomic click counter
            └── increment_user_clicks() RPC: per-user leaderboard tracking
```

---

## Monetization Plan

| Perk | Price | Status |
|---|---|---|
| 10 Extra Clicks | $0.99 | UI built, Paddle pending |
| 100 Extra Clicks | $4.99 | UI built, Paddle pending |
| Unlimited 24h | $1.99 | UI built, Paddle pending |
| Monthly Unlimited | $4.99/mo | UI built, Paddle pending |
| Name on the Egg | $2.99 | UI built, Paddle pending |
| Golden Cursor | $1.99 | UI built, Paddle pending |
| Crack Badge (limited) | $1.99 | UI built, Paddle pending |
| Hatch Notification | $0.99 | UI built, Paddle pending |
| Cracker Certificate | $1.99 | UI built, Paddle pending |
| Diamond Egg Skin | $3.99 | UI built, Paddle pending |

**Payment stack:** Paddle (MoR, 5%) → Payoneer (virtual USD account, set up) → Lebanese USD bank

---

## Cost to Run
| Item | Cost |
|---|---|
| Domain | ~$12/year (not yet purchased) |
| Supabase | $0 (free tier) |
| Vercel | $0 (free tier) |
| Paddle | $0 + 5% per transaction |
| Payoneer | $0 (set up) |
| **Total** | **~$12/year** |

---

## Key Files
| File | Purpose |
|---|---|
| `CLAUDE.md` | Dev context, commands, architecture, gotchas |
| `ROADMAP.md` | Feature phases, status, backlog |
| `SUMMARY.md` | This file — project overview |
| `PLAN.md` | Current sprint tracking + next steps |
| `supabase/migrations/001_egg_schema.sql` | Core schema: eggs, users, daily_clicks, purchases, RPCs |
| `supabase/migrations/002_user_tracking.sql` | User auto-creation trigger + increment_user_clicks RPC |
