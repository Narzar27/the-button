# The Button — Current Sprint Plan

_Updated: April 7, 2026_

---

## Status: Waiting on Paddle Approval ⏳

All code for Phase 1 (payments) is planned and documented. Nothing to build until Paddle approves.

---

## Immediate Next Steps (in order)

### 1. When Paddle approves your account
- [ ] Log into Paddle Dashboard
- [ ] Create 4 products + get price IDs:
  - `10 Extra Presses` ($0.99 one-time) → copy `pri_...`
  - `Unlimited Daily` ($2.99/month subscription) → copy `pri_...`
  - `Presser Legend` ($0.99 one-time) → copy `pri_...`
  - `Streak Freeze` ($0.99 one-time) → copy `pri_...`
  - `God Mode Bid` (no price — product container only) → copy product ID
- [ ] Get Client-side token: Developer Tools → Authentication
- [ ] Get API key: Developer Tools → Authentication → Secret key
- [ ] Paste into `src/environments/environment.ts` + `environment.prod.ts`

### 2. Execute Plan A (Core Payment)
Full plan: `docs/superpowers/plans/2026-04-07-plan-a-core-payment.md`

- [ ] Task 1: Run `supabase-payments-setup.sql` in Supabase
- [ ] Task 2: Create `AnonIdentityService`
- [ ] Task 3: Add Paddle config to environments
- [ ] Task 4: Create `PurchaseService`
- [ ] Task 5: Create `PaddleService`
- [ ] Task 6: Create `PressLimitModal`
- [ ] Task 7: Create `ShopModal`
- [ ] Task 8: Create `RestoreModal`
- [ ] Task 9: Wire `HomeComponent`
- [ ] Task 10: Deploy `paddle-webhook` Edge Function + set secrets
- [ ] Task 11: Register webhook in Paddle + deploy

### 3. Execute Plan B (Streak + God Mode)
Full plan: `docs/superpowers/plans/2026-04-07-plan-b-streak-godmode.md`

- [ ] Task 1: Run `supabase-godmode-setup.sql` in Supabase
- [ ] Task 2: Add streak logic to `PurchaseService`
- [ ] Task 3: Create `StreakBadgeComponent`
- [ ] Task 4: Create `GodModeService`
- [ ] Task 5: Create `GodModeSectionComponent`
- [ ] Task 6: Deploy `create-auction-checkout` Edge Function
- [ ] Task 7: Wire streak + God Mode into `HomeComponent`
- [ ] Task 8: Deploy

### 4. Go viral
- [ ] Buy domain (`thebutton.app` or `pressthebutton.com`) ~$12
- [ ] Post on Reddit: r/internetisbeautiful, r/mildlyinteresting, r/webdev
- [ ] Post on TikTok: open site, press button, say nothing
- [ ] Post on X: one tweet + link

---

## Completed ✅

- [x] Angular 19 project scaffolded
- [x] Button UI with full animations (flash, shake, ripple, burst)
- [x] Supabase counter with Realtime sync
- [x] Vercel deployment (auto-deploy on push)
- [x] Custom cursor + dark void aesthetic
- [x] Share functionality
- [x] Terms of Service page at `/terms-and-conditions`
- [x] Payoneer account set up
- [x] Paddle account applied (under review)
- [x] Payment system designed (spec + 2 implementation plans)
- [x] `CLAUDE.md`, `ROADMAP.md`, `SUMMARY.md`, `PLAN.md` created

---

## Blocked / Waiting
| Item | Waiting on | ETA |
|---|---|---|
| Payment system | Paddle approval | 1–5 business days |
| Domain purchase | Your decision on name | — |

---

## Decisions Log
| Date | Decision | Reason |
|---|---|---|
| Apr 6 | No auth for MVP | Friction kills virality; anonymous UUID is good enough |
| Apr 6 | Paddle over Stripe | Lebanese individuals can't create Stripe accounts |
| Apr 6 | Extra presses never reset | User feedback: paid presses should persist across days |
| Apr 6 | God Mode auction weekly | Weekly reset creates recurring excitement and FOMO |
| Apr 7 | Streak freeze $0.99 | Duolingo psychology: loss aversion drives purchase |
