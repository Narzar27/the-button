# CLAUDE.md — The Egg

## Project
Global egg-cracking web app. One egg, 4 billion clicks, everyone in the world together.
Nobody knows what's inside the last one.
Built by Nizar (Beirut, Lebanon 🇱🇧). Solo project, ~$12/year cost, global ambitions.

## Stack
- **Framework:** Angular 19 standalone components, signals-based reactivity
- **Styling:** Tailwind CSS v3 + custom CSS in `src/styles.css` (Fredoka One + Nunito fonts)
- **Database:** Supabase (PostgreSQL) at `bxsrcjyguitmkrkqtxdn.supabase.co`
- **Realtime:** Supabase Realtime (subscribed to `eggs` table)
- **Auth:** Supabase Auth — Google OAuth + email magic link (PKCE, `/auth/callback` route)
- **Payments:** Paddle Billing — live token wired, 5 price IDs set, awaiting account approval
- **Hosting:** Vercel — auto-deploys on push to `main`

## Build Commands
```bash
# Dev server
npm start   # → http://localhost:4200

# Build
node ./node_modules/@angular/cli/bin/ng.js build --configuration development
node ./node_modules/@angular/cli/bin/ng.js build --configuration production
```

## Project Structure
```
src/
  app/
    pages/
      home/              ← egg, counter, click button, stats (HomeComponent)
      leaderboard/       ← /leaderboard (LeaderboardComponent)
      perks/             ← /perks (PerkStoreComponent)
      auth-callback/     ← /auth/callback — PKCE code exchange then → /
      terms/             ← /terms-and-conditions
    components/
      egg/               ← EggComponent — SVG egg, 9 crack stages, input: [stage] [size]
      nav/               ← NavComponent — header logo + router tabs + user pill
      auth-modal/        ← AuthModalComponent — email magic link + Google sign-in
    services/
      supabase.service.ts       ← Supabase client + egg signals + realtime + auth + leaderboard
      anon-identity.service.ts  ← UUID in localStorage (key: egg_anon_id)
      click-limit.service.ts    ← 10/day free + extra clicks (localStorage + Supabase sync)
      paddle.service.ts         ← Lazy loads Paddle.js, openCheckout(priceId)
      auth.service.ts           ← Wraps Supabase Auth, exposes isSignedIn/displayName signals
  environments/
    environment.ts       ← DEV: sandbox=true, test token placeholder
    environment.prod.ts  ← PROD: live token + 5 real price IDs wired
  styles.css             ← Global styles + egg theme + all animations
```

## Key Signals & Data Flow
- `SupabaseService.egg` — signal<Egg> updated by Realtime + optimistic on click
- `SupabaseService.crackStage` — computed (0–8) from egg.current_clicks / target
- `SupabaseService.progressPct` — computed % toward 4B
- `ClickLimitService.totalRemaining` — computed free + extra clicks left today
- `AuthService.isSignedIn` / `displayName` / `initials` — computed from Supabase auth state

## Supabase Tables
| Table | Purpose |
|---|---|
| `eggs` | Current egg — number, target_clicks, current_clicks, cracked_at |
| `users` | Leaderboard — id (auth.users FK), display_name, total_clicks |
| `daily_clicks` | Anon daily tracking — anon_id, date, click_count |
| `purchases` | Payment records — wired after Paddle webhook done |

## RPCs
| Function | Purpose |
|---|---|
| `increment_egg(amount)` | Atomic egg counter increment |
| `increment_user_clicks(uid)` | Increment total_clicks for signed-in user |

## Supabase Setup Checklist (one-time)
- [ ] Run `supabase/migrations/001_egg_schema.sql`
- [ ] Run `supabase/migrations/002_user_tracking.sql`
- [ ] Run `supabase/migrations/006_user_perks.sql` — perk sync (`user_perks`) + global egg names (`egg_names`)
- [ ] Enable Realtime on `eggs` table: Dashboard → Database → Publications → supabase_realtime
- [ ] Add redirect URLs: Auth → URL Configuration:
  - `https://the-button-pink.vercel.app/auth/callback`
  - `http://localhost:4200/auth/callback`

## Paddle Status
- Live token: `live_b6242a1fd4e7644a52e6097a54a` (in environment.prod.ts)
- Account: APPROVED — live checkout works in prod
- 8 price IDs wired (clicks10, clicks100, unlimited24h, unlimitedMonth, nameOnEgg, goldenCursor, crackBadge, diamondSkin)
- Webhook: `supabase/functions/paddle-webhook` — verifies Paddle-Signature, records `purchases`, credits `user_perks` via `credit_purchase` RPC (requires migrations 006 + 007)
- Deploy: `npx supabase functions deploy paddle-webhook --project-ref bxsrcjyguitmkrkqtxdn --no-verify-jwt`
- Secret: `npx supabase secrets set PADDLE_WEBHOOK_SECRET=pdl_ntf... --project-ref bxsrcjyguitmkrkqtxdn`
- Paddle dashboard: Developer Tools → Notifications → destination `https://bxsrcjyguitmkrkqtxdn.supabase.co/functions/v1/paddle-webhook`, event `transaction.completed`
- Dev environment stays `sandbox: true` with a placeholder token — grab a sandbox token from Paddle to test checkout locally

## Gotchas
- Build with `node ./node_modules/@angular/cli/bin/ng.js build` not `npx ng build`
- Vercel output dir: `dist/the-button/browser`
- Supabase Realtime must be enabled per-table in the dashboard (not via SQL)
- `dist/` is in `.gitignore`
- Dev environment has `sandbox: true` — checkout won't fire real payments locally
- Tailwind opacity slash syntax (e.g. `text-white/50`) doesn't work in Angular `[class]` bindings
