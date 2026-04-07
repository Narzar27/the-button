# CLAUDE.md — The Egg

## Project
Global egg-cracking web app. One egg, 4 billion clicks, everyone in the world together.
Nobody knows what's inside the last one.
Built by Nizar (Beirut, Lebanon 🇱🇧). Solo project, $15 budget, global ambitions.

## Stack
- **Framework:** Angular 19 standalone components, signals-based reactivity
- **Styling:** Tailwind CSS v3 + custom CSS in `src/styles.css` (Fredoka One + Nunito fonts)
- **Database:** Supabase (PostgreSQL) at `bxsrcjyguitmkrkqtxdn.supabase.co`
- **Realtime:** Supabase Realtime (subscribed to `eggs` table)
- **Auth:** Supabase Auth — Google OAuth + email magic link
- **Payments:** Paddle Billing (awaiting account approval — scaffolded in PaddleService)
- **Hosting:** Vercel — auto-deploys on push to `main`
- **Repo:** https://github.com/Narzar27/the-button

## Build Commands
```bash
# Dev server
npm start   # → http://localhost:4200

# Build (use this, not `ng build` directly)
node ./node_modules/@angular/cli/bin/ng.js build --configuration development
node ./node_modules/@angular/cli/bin/ng.js build --configuration production

# Deploy
git push    # Vercel auto-deploys from main
```

## Project Structure
```
src/
  app/
    pages/
      home/           ← main egg page (HomeComponent)
      leaderboard/    ← /leaderboard
      perks/          ← /perks (PerkStoreComponent)
      terms/          ← /terms-and-conditions
    components/
      egg/            ← EggComponent — SVG egg with 9 crack stages
      nav/            ← NavComponent — header + tabs
      auth-modal/     ← AuthModalComponent — email + Google sign in
    services/
      supabase.service.ts       ← Supabase client + egg data + auth methods
      anon-identity.service.ts  ← UUID in localStorage (egg_anon_id)
      click-limit.service.ts    ← daily click tracking (10/day, extra clicks)
      paddle.service.ts         ← Paddle scaffold (openCheckout logs to console)
      auth.service.ts           ← wraps Supabase Auth, exposes signals
  environments/
    environment.ts       ← Supabase credentials
    environment.prod.ts  ← same
  styles.css             ← global styles, egg theme, animations
```

## Key Design Decisions
- **Anon identity** — UUID in localStorage (`egg_anon_id`) used for daily click tracking
- **Daily limit** — 10 free clicks/day, tracked locally + synced to Supabase `daily_clicks`
- **Extra clicks** — stored in localStorage (`egg_extra_clicks`), added via Paddle purchases (wired later)
- **Realtime** — Supabase Realtime on `eggs` table, optimistic local updates on click
- **Paddle** — scaffold only; `PaddleService.openCheckout()` logs to console until account approved

## Supabase Tables
| Table | Purpose |
|---|---|
| `eggs` | Current egg — number, target_clicks, current_clicks, cracked_at |
| `users` | Authenticated users — id, display_name, total_clicks |
| `daily_clicks` | Per-anon daily click counts — anon_id, date, click_count |
| `purchases` | Payment records — anon_id, user_id, product_type, quantity |

## RPC Functions
| Function | Purpose |
|---|---|
| `increment_egg(amount)` | Atomic egg click counter increment |

## Supabase SQL to run (one-time setup)
See `supabase/migrations/001_egg_schema.sql` — run this in Supabase SQL editor.

## Design / Theme
- Background: dark navy gradient (`#1a1a2e → #16213e → #0f3460`) with star particles
- Primary: egg yellow `#FFD93D`, accent: orange `#FF9F1C`
- Fonts: `Fredoka One` (headings/counters), `Nunito` (body)
- Egg: 9 SVG crack stages (0 = pristine, 8 = barely holding together)
- Animations: egg-wiggle on click, egg-crack-flash on stage change, floating +1 indicators

## Gotchas
- Build with `node ./node_modules/@angular/cli/bin/ng.js build` not `npx ng build`
- Vercel output dir: `dist/the-button/browser`
- Supabase Realtime must be enabled per-table in Dashboard → Database → Publications → `supabase_realtime` (enable the `eggs` table)
- `dist/` is in `.gitignore`
- Tailwind `/` opacity classes work in templates but NOT in `[class.text-white/50]` bindings

## Paddle (pending)
Once Paddle account is approved:
1. Create products in Paddle dashboard
2. Add price IDs to `environment.ts` under `paddle.prices`
3. Replace console.log in `PaddleService.openCheckout()` with real Paddle.js checkout call
4. Deploy Supabase Edge Function `paddle-webhook` to unlock purchases
