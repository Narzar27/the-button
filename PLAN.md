# The Egg 🥚 — Current Sprint Plan

_Updated: April 7, 2026_

---

## Status: Code complete. Blocked on Supabase setup + Paddle approval.

Everything is built and deployed. Nothing left to code right now.
All remaining items are either dashboard actions or waiting on Paddle.

---

## Supabase Setup ✅ Done

- [x] SQL Editor → ran `001_egg_schema.sql`
- [x] SQL Editor → ran `002_user_tracking.sql`
- [x] Realtime enabled on `eggs` table
- [x] Auth redirect URLs added

---

## Do Before Viral Push — Polish (~2–3h of code)

- [ ] **Share button** on home page
  - "I've cracked the egg X times. Join me." + link
  - Web Share API with clipboard fallback (same pattern as the old Button)
- [ ] **Leaderboard Today tab** — query `daily_clicks` table instead of `users.total_clicks`
- [ ] **Mobile test** — open on phone, check egg tap, layout, modals, auth flow
- [ ] **OG image** — add `og:image` meta tag (a screenshot or simple egg card)
- [ ] **Domain** — buy `theegg.app` or `crackit.app` (~$12), point to Vercel

---

## When Paddle Approves — (~1h of code)

- [ ] In `environment.ts`: set `sandbox: false`, replace token with live `live_b6242a1fd4e7644a52e6097a54a`
- [ ] Create remaining 5 products in Paddle dashboard:
  - Golden Cursor $1.99
  - Crack Badge $1.99 (limited)
  - Hatch Notification $0.99
  - Cracker Certificate $1.99
  - Diamond Egg Skin $3.99
- [ ] Paste their `pri_` IDs into both `environment.ts` files
- [ ] Build + deploy `paddle-webhook` Supabase Edge Function
- [ ] Register webhook in Paddle → Notifications

---

## Go Viral — When polish + domain done

- [ ] Reddit: r/mildlyinteresting, r/internetisbeautiful, r/webdev
- [ ] TikTok: crack the egg on camera
- [ ] X: one tweet + link
- [ ] Easter angle (April 20 is the window)

---

## Completed ✅

- [x] Full Angular rebuild (The Button → The Egg)
- [x] 9-stage SVG egg + all animations
- [x] Supabase Realtime counter
- [x] 10 free clicks/day (anon UUID tracking)
- [x] Google OAuth + email magic link auth
- [x] Auth callback route (PKCE)
- [x] Leaderboard (real data, empty state)
- [x] Perk Store UI (10 perks)
- [x] PaddleService (real Paddle.js, lazy load)
- [x] Paddle live token wired (`environment.prod.ts`)
- [x] 5 live price IDs wired
- [x] Supabase SQL migrations written
- [x] User auto-creation trigger written
- [x] CLAUDE.md / ROADMAP.md / PLAN.md updated
- [x] Payoneer set up
- [x] Vercel auto-deploy on push

---

## Blocked
| Item | Waiting on |
|---|---|
| Real Paddle checkout | Account approval |
| Remaining 5 perk price IDs | Create products in Paddle |
| Supabase fully wired | You run the SQL + dashboard steps above |
