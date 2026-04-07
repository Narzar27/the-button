# The Egg 🥚 — Current Sprint Plan

_Updated: April 7, 2026_

---

## Status: MVP Live, Supabase wiring pending ✅ / 📋

The Angular app is fully built and deployed. The remaining blockers are all Supabase dashboard actions (not code) and Paddle approval.

---

## Immediate Next Steps (in order)

### 1. Run Supabase migrations (now)
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Run `supabase/migrations/001_egg_schema.sql`
- [ ] Run `supabase/migrations/002_user_tracking.sql`

### 2. Enable Realtime on eggs table (now)
- [ ] Supabase Dashboard → Database → Publications → `supabase_realtime`
- [ ] Toggle on the `eggs` table
- [ ] Save

### 3. Fix redirect URLs (now)
- [ ] Supabase Dashboard → Auth → URL Configuration → Redirect URLs
- [ ] Add `https://the-button-pink.vercel.app/auth/callback`
- [ ] Add `http://localhost:4200/auth/callback`

### 4. Phase 2 polish tasks (before viral push)
- [ ] **Share button** — add "Share" button to HomeComponent (Web Share API + clipboard fallback)
- [ ] **Today leaderboard tab** — query `daily_clicks` table for today's top crackers
- [ ] **Mobile test** — open on iOS Safari, check egg tap, layout, modals
- [ ] **OG image** — add a proper `og:image` meta tag (egg screenshot or simple generated card)
- [ ] **Domain** — buy `theegg.app` or `crackit.app`, point to Vercel (~$12)

### 5. When Paddle approves (blocked)
- [ ] Log into Paddle Dashboard → create 10 products from ROADMAP.md list
- [ ] Copy all `pri_...` price IDs
- [ ] Add to `src/environments/environment.ts`:
  ```ts
  paddle: {
    clientToken: 'live_...',
    prices: {
      clicks10: 'pri_...',
      clicks100: 'pri_...',
      unlimited24h: 'pri_...',
      unlimitedMonth: 'pri_...',
      nameOnEgg: 'pri_...',
      goldenCursor: 'pri_...',
      crackBadge: 'pri_...',
      hatchNotif: 'pri_...',
      certificate: 'pri_...',
      diamondSkin: 'pri_...',
    }
  }
  ```
- [ ] Wire real Paddle.js in `PaddleService`:
  - Load `https://cdn.paddle.com/paddle/v2/paddle.js` lazily
  - Call `Paddle.Setup({ token: environment.paddle.clientToken })`
  - Replace `console.log` in `openCheckout()` with `Paddle.Checkout.open(...)`
- [ ] Deploy `paddle-webhook` Supabase Edge Function
- [ ] Register webhook URL in Paddle dashboard

### 6. Go viral (after Polish + domain)
- [ ] Post on Reddit: r/mildlyinteresting, r/internetisbeautiful, r/webdev
- [ ] Post on TikTok: crack the egg on camera
- [ ] Post on X: one tweet + link

---

## Completed ✅

- [x] The Button MVP (Angular 19 + Supabase Realtime + Vercel)
- [x] Pivoted concept to The Egg
- [x] Full Angular refactor — all components, services, pages
- [x] 9-stage SVG egg with wiggle/flash/particle animations
- [x] Global click counter via Supabase Realtime
- [x] 10 free clicks/day (AnonIdentityService + ClickLimitService)
- [x] Supabase Auth — Google OAuth + email magic link
- [x] Auth callback route (PKCE flow)
- [x] Leaderboard page (real data, empty state, 4 tabs)
- [x] Perk Store UI (10 perks, Paddle scaffold)
- [x] AuthModal (email + Google)
- [x] Dark space theme (stars, Fredoka One + Nunito)
- [x] Supabase SQL migrations written (001 + 002)
- [x] User auto-creation trigger + click tracking SQL written
- [x] CLAUDE.md, ROADMAP.md, SUMMARY.md, PLAN.md updated
- [x] Payoneer account set up
- [x] Paddle account applied (under review)

---

## Blocked / Waiting
| Item | Waiting on | ETA |
|---|---|---|
| Real Paddle checkout | Paddle account approval | 1–5 business days |
| Supabase setup complete | You run the SQL + dashboard steps | Now |
| Domain | Your decision on name | — |

---

## Decisions Log
| Date | Decision | Reason |
|---|---|---|
| Apr 6 | Paddle over Stripe | Lebanese individuals can't create Stripe accounts |
| Apr 6 | Payoneer as payout | Best option for Lebanese USD bank transfer |
| Apr 7 | Pivoted to The Egg | Better virality mechanics, more shareable concept |
| Apr 7 | 10 free clicks/day | Low enough to create FOMO, high enough to feel generous |
| Apr 7 | Anonymous UUID tracking | No auth friction for basic clicking |
| Apr 7 | Leaderboard requires sign-in | Incentivizes auth without forcing it |
| Apr 7 | Extra clicks stored in localStorage | Simple, no server needed for non-paying users |
