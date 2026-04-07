# The Egg 🥚 — Roadmap

## Legend
- ✅ Done
- ⏳ Blocked (waiting on external)
- 📋 Planned
- 💡 Idea / Backlog

---

## Phase 0 — Concept & Pivot ✅
- ✅ The Button MVP launched
- ✅ Pivoted to The Egg
- ✅ Core mechanic defined (4B clicks → hatch → smaller egg → forever)
- ✅ Monetization model finalized

---

## Phase 1 — MVP ✅
- ✅ Angular 19 full rebuild (The Button → The Egg)
- ✅ 9-stage SVG egg + wiggle/flash/particle animations
- ✅ Global click counter via Supabase Realtime
- ✅ 10 free clicks/day (AnonIdentityService + ClickLimitService)
- ✅ Supabase Auth — Google OAuth + email magic link
- ✅ Auth callback route `/auth/callback` (PKCE flow)
- ✅ Leaderboard page — real Supabase data, 4 tabs, empty state
- ✅ Perk Store UI — 10 perks built
- ✅ AuthModal — email + Google
- ✅ Dark space theme — stars, Fredoka One + Nunito
- ✅ Supabase SQL migrations written (001 + 002)
- ✅ User auto-creation trigger + per-user click tracking
- ✅ Paddle live token + 5 price IDs wired into environment.prod.ts
- ✅ PaddleService — real Paddle.js lazy load + checkout
- ✅ Deployed to Vercel

---

## Phase 2 — Supabase Setup ✅
- ✅ Ran `001_egg_schema.sql`
- ✅ Ran `002_user_tracking.sql`
- ✅ Realtime enabled on `eggs` table
- ✅ Auth redirect URLs configured

---

## Phase 3 — Paddle Go-Live ⏳ Blocked
> Waiting on Paddle account approval

- ⏳ Paddle account approved
- 📋 Flip `environment.ts` dev: `sandbox: false`, use live token
- 📋 Create remaining 5 products in Paddle (Golden Cursor, Crack Badge, Hatch Notif, Certificate, Diamond Skin) → add price IDs
- 📋 Deploy `paddle-webhook` Supabase Edge Function (unlocks perks after payment)
- 📋 Register webhook URL in Paddle dashboard

---

## Phase 4 — Polish 📋
> Before viral push

- 📋 Share button on home page ("I've cracked the egg X times")
- 📋 Leaderboard Today tab — query `daily_clicks` not `users.total_clicks`
- 📋 Mobile test pass (iOS Safari + Android Chrome)
- 📋 OG image for social sharing
- 📋 Domain — buy `theegg.app` or `crackit.app` (~$12), point to Vercel

---

## Phase 5 — Virality 💡
- 💡 Milestone events — animation at 100M, 500M, 1B, 2B, 4B clicks
- 💡 "You were click #N" toast on milestone numbers
- 💡 Auto share card — Instagram story format
- 💡 Friends leaderboard — invite code → private group
- 💡 Country leaderboard map

---

## Phase 6 — Egg #2 Launch Event 💡
- 💡 Live countdown at 99%
- 💡 Email blast to all registered users
- 💡 Confetti + crack → smaller egg reveal
- 💡 "Egg #1 Survivor" badge auto-awarded
- 💡 Auto-insert `eggs` row #2 (target: 3B)

---

## Go-Viral Playbook 📋
- Reddit: r/mildlyinteresting, r/internetisbeautiful, r/webdev
- TikTok: crack the egg on camera, show the count
- X: one tweet + link
- Easter angle: *"It's Easter. There's an egg. Nobody knows what's inside."*

---

## Tech Debt
- `button_presses` + `increment_button` old Supabase objects still exist (harmless)
- Leaderboard Today/Country tabs not differentiated yet
- Remaining 5 Paddle products not created yet
