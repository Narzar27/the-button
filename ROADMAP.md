# The Egg 🥚 — Roadmap

## Legend
- ✅ Done
- 🔄 In Progress
- ⏳ Blocked (waiting on external)
- 📋 Planned
- 💡 Idea / Backlog

---

## Phase 0 — Concept & Pivot ✅
> From The Button → The Egg

- ✅ The Button MVP launched at the-button-pink.vercel.app
- ✅ Pivoted concept to The Egg
- ✅ Core mechanic defined (4B clicks → hatch → smaller egg → forever)
- ✅ Monetization model finalized
- ✅ Roadmap written

---

## Phase 1 — MVP ✅
> The egg. The counter. The leaderboard.

- ✅ Angular 19 full rebranding / rebuild (The Button → The Egg)
- ✅ 9-stage SVG egg with crack progression + wiggle/flash animations
- ✅ Global click counter via Supabase Realtime
- ✅ Floating +1 indicators + shell particle burst on click
- ✅ Egg progress bar (% toward 4B)
- ✅ Supabase Auth — Google OAuth + email magic link
- ✅ Auth callback route (`/auth/callback`) — PKCE flow handled correctly
- ✅ AnonIdentityService — UUID in localStorage for anonymous tracking
- ✅ ClickLimitService — 10 free clicks/day, local + Supabase sync
- ✅ Leaderboard page — real data, empty state, 4 tabs
- ✅ Perk Store UI — 10 perks, Paddle scaffold
- ✅ AuthModalComponent — email magic link + Google sign-in
- ✅ Dark space theme — stars, Fredoka One + Nunito, egg-yellow palette
- ✅ Supabase schema SQL (`supabase/migrations/001_egg_schema.sql`)
- ✅ User auto-creation trigger + click tracking (`supabase/migrations/002_user_tracking.sql`)
- ✅ Deployed to Vercel

**Still needs wiring (one-time Supabase setup):**
- 📋 Run `002_user_tracking.sql` in Supabase SQL Editor
- 📋 Enable Realtime on `eggs` table (Dashboard → Database → Publications)
- 📋 Add `https://the-button-pink.vercel.app/auth/callback` to Supabase redirect URLs

---

## Phase 2 — Polish & Share ✅ / 📋
> Make it feel alive and spreadable

- 📋 **Share button** — "I've cracked the egg X times. Join me." (Web Share API)
- 📋 **Leaderboard: Today tab** — query `daily_clicks` table instead of `total_clicks`
- 📋 **Leaderboard: Country tab** — add country field to `users` table, detect on signup
- 📋 **User display name editing** — let user change their leaderboard name
- 📋 **Crack stage badge** on leaderboard row (show stage at time of joining)
- 📋 **Mobile responsiveness pass** — test on iOS Safari + Android Chrome
- 📋 **OG image** — custom social preview card
- 📋 **Domain** — buy `theegg.app` or `crackit.app` (~$12)

---

## Phase 3 — Monetization ⏳ Blocked
> Paddle approved → wire in payments

**Blocker:** Waiting for Paddle account verification

- ⏳ Paddle account approved
- 📋 Create products in Paddle dashboard (get `pri_...` price IDs)
- 📋 Add price IDs + client token to `environment.ts`
- 📋 Wire real `Paddle.js` checkout in `PaddleService.openCheckout()`
- 📋 `paddle-webhook` Supabase Edge Function — unlock perks on payment confirmation
- 📋 Wire extra clicks to `ClickLimitService.addExtraClicks()` after purchase
- 📋 "Name on egg" perk — scrolling ticker on egg SVG

**Paddle products to create:**
| Product | Price | Type |
|---|---|---|
| 10 Extra Clicks | $0.99 | One-time |
| 100 Extra Clicks | $4.99 | One-time |
| Unlimited 24h | $1.99 | One-time |
| Monthly Unlimited | $4.99/mo | Subscription |
| Name on the Egg | $2.99 | One-time |
| Golden Cursor | $1.99 | One-time |
| Crack Badge (Egg #1) | $1.99 | One-time (limited) |
| Hatch Notification | $0.99 | One-time |
| Cracker Certificate | $1.99 | One-time |
| Diamond Egg Skin | $3.99 | One-time |

---

## Phase 4 — Virality Features 💡
> Make it spread itself

- 💡 **Milestone events** — special animation + confetti at 100M, 500M, 1B, 2B, 4B clicks
- 💡 **"I was click #N"** — toast when you hit a milestone number (1M, 10M, etc.)
- 💡 **Auto share card** — "I've cracked the egg 847 times. Join me." → Instagram story format
- 💡 **Easter egg skin** — limited time visual (next Easter)
- 💡 **Friends leaderboard** — invite code → private group leaderboard
- 💡 **Country leaderboard map** — world map heatmap of clicks by country today

---

## Phase 5 — Egg #2 Launch Event 💡
> When Egg #1 cracks — make it a moment

- 💡 Live countdown when egg reaches 99%
- 💡 Live visitor counter on crack day
- 💡 Email blast to all registered users
- 💡 Confetti + crack animation → smaller egg reveal
- 💡 "Egg #1 Survivor" badge auto-awarded
- 💡 Automatically create `eggs` row #2 with 3B target

---

## Go-Viral Playbook 📋

**Reddit (biggest lever):**
- r/mildlyinteresting: *"I made a website where everyone in the world is cracking one egg. We're at 0. Help."*
- r/internetisbeautiful
- r/webdev

**TikTok:**
- Film the egg. Tap it. Show the crack appear. Caption: *"We need 4 billion clicks to crack this egg. Current count: 1."*

**X/Twitter:**
- *"I built a website with one goal: crack an egg. It needs 4,000,000,000 clicks. We just started. Come help."*

**Easter angle:**
- *"It's Easter. There's an egg. Nobody knows what's inside. Click it."*

---

## Tech Debt / Known Issues
- `button_presses` + `increment_button` old Supabase objects still exist (harmless, can clean up later)
- Leaderboard Today/Country tabs currently query same data as All Time — needs dedicated views
- No error boundary or global error handling in Angular app
- Domain still on `the-button-pink.vercel.app`
