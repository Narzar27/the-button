# The Button — Project Summary

**Live at:** https://the-button-pink.vercel.app  
**Repo:** https://github.com/Narzar27/the-button  
**Built by:** Nizar · Beirut, Lebanon 🇱🇧  
**Started:** April 6, 2026  

---

## What It Is
A website with one feature: a big red button. Every press increments a live global counter visible to everyone in real-time. No purpose. No explanation. Humans cannot resist.

Inspired by Reddit's 2015 "The Button" experiment, the Yo app ($1.5M raised), and the "Nothing" app (Top 10 App Store).

---

## Current State (April 7, 2026)

### Live & Working
- Big red button with full press animations (flash, shake, ripple, particle burst)
- Live global counter via Supabase Realtime (updates across all open tabs/browsers instantly)
- Custom red cursor + lagging ring follower
- Share button (Web Share API + clipboard fallback)
- Press rank system: Peasant → Presser → Addict → Legend → God
- Terms of Service page at `/terms-and-conditions`
- Vercel auto-deploy on every git push to `main`

### Pending
- Paddle account under review (payment system ready to wire in the moment it's approved)
- All payment UI code written, planned, and documented — just needs Paddle credentials

---

## Monetization Plan

| Feature | Price | Status |
|---|---|---|
| 10 Extra Presses | $0.99 | Planned (Plan A) |
| Unlimited Daily Presses | $2.99/month | Planned (Plan A) |
| Presser Legend Title | $0.99 | Planned (Plan A) |
| Streak Freeze | $0.99 | Planned (Plan B) |
| God Mode Auction | Variable (min $1, weekly) | Planned (Plan B) |

**Payment stack:** Paddle (Merchant of Record) → Payoneer (virtual US account, already set up) → Lebanese USD bank

---

## Architecture

```
User Browser
    │
    ├── Angular 19 SPA (Vercel)
    │       ├── Button press → Supabase RPC (increment_button)
    │       ├── Counter ← Supabase Realtime subscription
    │       └── Paddle checkout (when payment added)
    │
    └── Supabase (PostgreSQL + Realtime + Edge Functions)
            ├── button_presses (global counter)
            ├── purchases (per-user, keyed by anon UUID)
            ├── god_mode (auction state)
            └── Edge Functions (paddle-webhook, create-auction-checkout)
```

---

## Cost to Run
| Item | Cost |
|---|---|
| Domain | ~$12/year (not yet purchased) |
| Supabase | $0 (free tier) |
| Vercel | $0 (free tier) |
| Paddle | $0 + 5% per transaction |
| Payoneer | $0 (already set up) |
| **Total** | **~$12/year** |

---

## Revenue Projection
If 500K users and 5% pay $1.99/month:
```
25,000 × $1.99 = $49,750 MRR
After Paddle 5%: ~$47,260 net
```

---

## Key Files
| File | Purpose |
|---|---|
| `CLAUDE.md` | Instructions for Claude (dev context, commands, gotchas) |
| `ROADMAP.md` | Feature phases, status, backlog |
| `SUMMARY.md` | This file — project overview |
| `PLAN.md` | Current sprint tracking |
| `docs/superpowers/specs/2026-04-06-payment-system-design.md` | Full payment system design |
| `docs/superpowers/plans/2026-04-07-plan-a-core-payment.md` | Implementation plan: press limits + Paddle |
| `docs/superpowers/plans/2026-04-07-plan-b-streak-godmode.md` | Implementation plan: streaks + God Mode |
| `supabase-setup.sql` | Initial DB schema (run once) |
| `supabase-payments-setup.sql` | Payments schema (run for Plan A) |
| `supabase-godmode-setup.sql` | God Mode schema (run for Plan B) |
| `vercel.json` | Vercel build config (uses node to invoke ng) |
