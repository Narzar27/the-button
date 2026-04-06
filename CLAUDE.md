# CLAUDE.md — The Button

## Project
Viral "press the button" web app. One button, one global counter, the whole world pressing it.
Built by Nizar (Beirut, Lebanon). Solo project, $15 budget, global ambitions.

## Stack
- **Framework:** Angular 19 standalone components, signals-based reactivity
- **Styling:** Tailwind CSS v3 + custom CSS (in `src/styles.css`)
- **Database:** Supabase (PostgreSQL) at `bxsrcjyguitmkrkqtxdn.supabase.co`
- **Realtime:** Supabase Realtime (subscribed to `button_presses` and `god_mode` tables)
- **Payments:** Paddle Billing (awaiting account approval)
- **Hosting:** Vercel — auto-deploys on push to `main`
- **Repo:** https://github.com/Narzar27/the-button

## Build Commands
```bash
# Dev server
npm start                          # → http://localhost:4200

# Build (use this, not `ng build` directly — Vercel permission issue workaround)
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
      home/          ← main button page (HomeComponent)
      terms/         ← /terms-and-conditions (for Paddle)
    components/      ← (to be created in Plan A/B)
      press-limit-modal/
      shop-modal/
      restore-modal/
      streak-badge/
      god-mode-section/
    services/
      counter.service.ts       ← global press counter + Supabase Realtime
      anon-identity.service.ts ← (Plan A) permanent UUID per visitor
      purchase.service.ts      ← (Plan A) press limits, extra presses, streak
      paddle.service.ts        ← (Plan A) Paddle.js checkout
      god-mode.service.ts      ← (Plan B) auction state + Realtime
  environments/
    environment.ts             ← dev config (Supabase + Paddle placeholders)
    environment.prod.ts        ← prod config (same)
  styles.css                   ← global styles, animations, custom cursor
supabase/
  functions/
    paddle-webhook/            ← (Plan A) Paddle webhook handler (Deno)
    create-auction-checkout/   ← (Plan B) dynamic Paddle checkout for bids
docs/
  superpowers/
    specs/    ← design documents
    plans/    ← implementation plans (Plan A, Plan B)
```

## Key Design Decisions
- **No auth** — anonymous UUID in localStorage (`tb_anon_id`) is the user identity
- **Persistence** — purchases stored in Supabase `purchases` table keyed by `anon_id`
- **Cross-device restore** — email lookup from Paddle receipt
- **Press limit** — 1 free press/day; purchased extra presses persist forever (never reset)
- **Paddle** — Merchant of Record; handles VAT, fraud, global tax
- **Payoneer** — receives Paddle payouts → Lebanese USD bank account

## Supabase Tables
| Table | Purpose |
|---|---|
| `button_presses` | Single row, global counter (id=1) |
| `purchases` | Per-user purchases keyed by `anon_id` |
| `god_mode` | Single row, current God + bid + auction timer (id=1) |

## RPC Functions
| Function | Purpose |
|---|---|
| `increment_button(amount)` | Atomic press counter increment |
| `consume_extra_press(p_anon_id)` | Safely decrement extra presses (floor 0) |
| `consume_streak_freeze(p_anon_id)` | Safely decrement streak freezes (floor 0) |
| `add_extra_presses(anon_id, email, amount)` | Upsert + add extra presses after purchase |
| `add_streak_freezes(anon_id, email, amount)` | Upsert + add streak freezes after purchase |
| `claim_god_mode(name, anon_id, bid)` | Atomic: update God only if bid is highest |

## Environment Variables (Paddle — fill after approval)
In `src/environments/environment.ts` and `environment.prod.ts`:
```typescript
paddle: {
  clientToken: 'YOUR_PADDLE_CLIENT_TOKEN',
  prices: {
    extraPresses10:     'pri_...',
    unlimitedMonthly:   'pri_...',
    titlePresserLegend: 'pri_...',
    streakFreeze:       'pri_...',
  }
}
```

In Supabase Edge Function secrets:
```
PADDLE_WEBHOOK_SECRET
PADDLE_API_KEY
PADDLE_GOD_MODE_PRODUCT_ID
SITE_URL = https://the-button-pink.vercel.app
```

## Style / Aesthetic Rules
- Dark void aesthetic: `#050505` background, deep red (`#cc1100`) accent
- Fonts: `Bebas Neue` (display), `JetBrains Mono` (numbers), `Syne` (body)
- Custom cursor (red dot + lagging ring) — don't add `cursor: default` anywhere
- All animations in `src/styles.css` — add new ones there
- Tailwind `/` opacity classes (e.g. `text-white/50`) work in templates but NOT in `[class.text-white/50]` bindings — use `[style.color]` instead

## Gotchas
- Build with `node ./node_modules/@angular/cli/bin/ng.js build` not `npx ng build` (permission issue on Vercel CI)
- Vercel output dir: `dist/the-button/browser` (Angular 19 app builder)
- Supabase Realtime must be enabled per-table in Dashboard → Database → Publications → `supabase_realtime`
- `dist/` is NOT in `.gitignore` — avoid committing it (add it if needed)
