# The Button — Roadmap

## Legend
- ✅ Done
- 🔄 In Progress
- ⏳ Blocked (waiting on external)
- 📋 Planned
- 💡 Idea / Backlog

---

## Phase 0 — MVP Launch ✅
> One button. One counter. The whole world.

- ✅ Angular 19 app scaffolded
- ✅ Big red button with press animations (flash, shake, ripple, burst particles)
- ✅ Global counter via Supabase Realtime
- ✅ Share button (Web Share API + clipboard fallback)
- ✅ Custom cursor (red dot + lagging ring)
- ✅ Dark void aesthetic (Bebas Neue + JetBrains Mono + Syne)
- ✅ Deployed to Vercel: https://the-button-pink.vercel.app
- ✅ Supabase wired: `button_presses` table + `increment_button` RPC
- ✅ Realtime enabled on `button_presses`
- ✅ Terms of Service page at `/terms-and-conditions`

---

## Phase 1 — Monetization Core ⏳ Blocked
> Press limits + Paddle checkout + anonymous purchase persistence

**Blocker:** Waiting for Paddle account approval (1–5 business days)

**Plan:** `docs/superpowers/plans/2026-04-07-plan-a-core-payment.md`

- ⏳ Paddle account approved
- 📋 `AnonIdentityService` — permanent UUID per visitor
- 📋 `purchases` Supabase table + RPCs
- 📋 `PurchaseService` — press limits (1/day free, extra presses persist)
- 📋 `PaddleService` — lazy Paddle.js + checkout
- 📋 `PressLimitModal` — auto-shows when daily limit hit
- 📋 `ShopModal` — full product grid
- 📋 `RestoreModal` — cross-device restore by Paddle email
- 📋 `paddle-webhook` Supabase Edge Function
- 📋 Wire press limit into HomeComponent

**Products (to create in Paddle):**
| Product | Price | Price ID |
|---|---|---|
| 10 Extra Presses | $0.99 one-time | `pri_...` |
| Unlimited Daily | $2.99/month | `pri_...` |
| Presser Legend title | $0.99 one-time | `pri_...` |
| Streak Freeze | $0.99 one-time | `pri_...` |

---

## Phase 2 — Streaks + God Mode 📋 Planned
> Daily habits + competitive auction

**Depends on:** Phase 1 complete

**Plan:** `docs/superpowers/plans/2026-04-07-plan-b-streak-godmode.md`

- 📋 Streak tracking (count + freeze logic in `PurchaseService`)
- 📋 `StreakBadgeComponent` (shows at 3+ day streaks 🔥)
- 📋 `god_mode` Supabase table + `claim_god_mode` RPC
- 📋 `GodModeService` (Realtime subscription to auction)
- 📋 `GodModeSectionComponent` (live god name, bid, countdown, overthrow form)
- 📋 `create-auction-checkout` Edge Function (dynamic Paddle pricing)
- 📋 pg_cron weekly auction reset (every Sunday 00:00 UTC)
- 📋 Streak freeze in shop

---

## Phase 3 — Growth Features 💡 Backlog

- 💡 **Country Wars** — live map, which country pressed most today
- 💡 **Team/Color Wars** — assigned team (Red/Blue/Green/Yellow) on first visit
- 💡 **Milestone events** — special effect when counter hits 1M, 10M, 100M
- 💡 **Certified Presser** — downloadable certificate for milestone press ($1.99)
- 💡 **Button Skin Rental** — brands pay $50-200 to change button color for 24h
- 💡 **Merch** — "I pressed it." t-shirt via Printful (zero inventory)
- 💡 **Tip jar** — "Buy me a press" custom amount ($1/$5/$10)
- 💡 **Multiple titles** — Button God, Presser Legend, Chosen One, etc.

---

## Go-Viral Playbook 📋

**Reddit (biggest lever):**
- Post in: r/mildlyinteresting, r/internetisbeautiful, r/nosurf, r/webdev
- Title: *"I built a website that does one thing. There's a button. You press it. The counter goes up. That's it."*

**TikTok:**
- Open site on camera. Press button. Show counter. Say nothing.
- Caption: *"I made an app that does nothing. Please press it."*

**X/Twitter:**
- *"I spent weeks building a website with one feature. A button. Every time someone presses it the counter goes up. That's it."* + link

---

## Tech Debt / Known Issues
- `dist/` folder is being committed to git (should be in `.gitignore`)
- No error boundary or global error handling in Angular app
- Supabase anon key is in client-side code (acceptable — it's the public anon key, RLS enforced)
