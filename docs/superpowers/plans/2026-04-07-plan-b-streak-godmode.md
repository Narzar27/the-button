# Streak + God Mode Auction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Prerequisite:** Plan A (Core Payment) must be fully deployed before starting Plan B.

**Goal:** Add daily streak tracking with freeze protection, and a weekly "God of The Button" live auction where the highest bidder's name is displayed on the site.

**Architecture:** Streak state is stored in the existing `purchases` table (new columns) and mirrored in localStorage. GodModeService subscribes to a single-row `god_mode` table via Supabase Realtime, updating live for all visitors. Auction bids go through a Supabase Edge Function (`create-auction-checkout`) that creates a dynamic Paddle checkout URL for the bid amount.

**Tech Stack:** Angular 19 signals, Supabase Realtime, Supabase Edge Functions (Deno), Paddle Billing API (server-side price creation)

---

## File Map

**Create:**
- `src/app/services/god-mode.service.ts`
- `src/app/components/streak-badge/streak-badge.component.ts`
- `src/app/components/streak-badge/streak-badge.component.html`
- `src/app/components/god-mode-section/god-mode-section.component.ts`
- `src/app/components/god-mode-section/god-mode-section.component.html`
- `supabase/functions/create-auction-checkout/index.ts`
- `supabase-godmode-setup.sql`

**Modify:**
- `src/app/services/purchase.service.ts` — add streak logic to `consumePress()`
- `src/app/pages/home/home.component.ts` — inject GodModeService, import new components
- `src/app/pages/home/home.component.html` — add StreakBadge and GodModeSection

---

## Task 1: Add streak columns to purchases table

**Files:**
- Create: `supabase-godmode-setup.sql`

- [ ] **Step 1: Create SQL file**

```sql
-- supabase-godmode-setup.sql
-- Run in: Supabase Dashboard → SQL Editor → New query

-- Add streak columns to purchases
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS streak_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_date TEXT,         -- YYYY-MM-DD
  ADD COLUMN IF NOT EXISTS streak_freezes   INTEGER NOT NULL DEFAULT 0;

-- God mode single-row table
CREATE TABLE IF NOT EXISTS god_mode (
  id             INTEGER PRIMARY KEY DEFAULT 1,
  god_name       TEXT    NOT NULL DEFAULT 'Nobody',
  god_anon_id    TEXT,
  current_bid    NUMERIC NOT NULL DEFAULT 0,
  auction_end_at TIMESTAMPTZ NOT NULL DEFAULT (
    date_trunc('week', now() AT TIME ZONE 'UTC') + interval '7 days'
  ),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the row
INSERT INTO god_mode (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE god_mode ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read god_mode"
  ON god_mode FOR SELECT USING (true);
-- Writes only via Edge Function (service role)

-- Enable Realtime for god_mode
-- (Do this in Supabase Dashboard → Database → Publications → supabase_realtime → Add table)

-- Weekly auction reset via pg_cron
-- Enable pg_cron extension first: Dashboard → Extensions → pg_cron → Enable
SELECT cron.schedule(
  'reset-god-mode-weekly',
  '0 0 * * 0',   -- Every Sunday at 00:00 UTC
  $$
    UPDATE god_mode
    SET god_name       = 'Nobody',
        god_anon_id    = NULL,
        current_bid    = 0,
        auction_end_at = date_trunc('week', now() AT TIME ZONE 'UTC') + interval '7 days',
        updated_at     = now()
    WHERE id = 1;
  $$
);

-- Function: update god if bid is higher (atomic, prevents race conditions)
CREATE OR REPLACE FUNCTION claim_god_mode(
  p_name     TEXT,
  p_anon_id  TEXT,
  p_bid      NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated BOOLEAN := false;
BEGIN
  UPDATE god_mode
  SET god_name    = p_name,
      god_anon_id = p_anon_id,
      current_bid = p_bid,
      updated_at  = now()
  WHERE id = 1
    AND p_bid > current_bid
    AND now() < auction_end_at;

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

-- RPC: add streak freeze (for webhook)
CREATE OR REPLACE FUNCTION add_streak_freezes(
  p_anon_id TEXT,
  p_email   TEXT,
  p_amount  INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO purchases (anon_id, email, streak_freezes)
  VALUES (p_anon_id, p_email, p_amount)
  ON CONFLICT (anon_id)
  DO UPDATE SET
    streak_freezes = purchases.streak_freezes + p_amount,
    email          = COALESCE(NULLIF(p_email, ''), purchases.email),
    updated_at     = now();
END;
$$;
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Open: https://supabase.com/dashboard/project/bxsrcjyguitmkrkqtxdn/sql/new
Paste → Run.

> If pg_cron is not available on your plan, skip the `cron.schedule` call. The auction reset can be triggered manually or via a Vercel cron job later.

- [ ] **Step 3: Enable Realtime for god_mode**

Supabase Dashboard → Database → Publications → supabase_realtime → Tables → Add `god_mode`.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/nizar/Desktop/the-button
git add supabase-godmode-setup.sql
git commit -m "feat: add streak columns to purchases and god_mode table"
```

---

## Task 2: Add streak logic to PurchaseService

**Files:**
- Modify: `src/app/services/purchase.service.ts`

- [ ] **Step 1: Read the current file**

Read `src/app/services/purchase.service.ts` to confirm current state before editing.

- [ ] **Step 2: Add streak constants and signals**

Add to the `LS` constant object (after `dailyDate`):
```typescript
  streakCount:  'tb_streak_count',
  streakLast:   'tb_streak_last',
  streakFreezes: 'tb_streak_freezes',
```

Add signals after `readonly dailyUsed`:
```typescript
readonly streakCount   = signal(0);
readonly streakFreezes = signal(0);
```

- [ ] **Step 3: Load streak from localStorage**

In `loadFromLocalStorage()`, add after the existing lines:
```typescript
this.streakCount.set(parseInt(lsGet(LS.streakCount, '0'), 10));
this.streakFreezes.set(parseInt(lsGet(LS.streakFreezes, '0'), 10));
```

- [ ] **Step 4: Apply streak from Supabase row**

In `applyRow()`, add after the title lines:
```typescript
const streak  = Number(row['streak_count']   ?? 0);
const freezes = Number(row['streak_freezes'] ?? 0);

this.streakCount.set(streak);
this.streakFreezes.set(freezes);

localStorage.setItem(LS.streakCount,   String(streak));
localStorage.setItem(LS.streakFreezes, String(freezes));
```

- [ ] **Step 5: Add updateStreak() private method**

Add after `decrementExtraPressInDB()`:

```typescript
private updateStreak(): void {
  const todayStr     = today();
  const lastDate     = localStorage.getItem(LS.streakLast) ?? '';
  const yesterday    = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (lastDate === todayStr) {
    // Already pressed today — no change
    return;
  }

  if (lastDate === yesterdayStr || lastDate === '') {
    // Consecutive day (or first press ever) — increment streak
    this.streakCount.update(n => n + 1);
  } else {
    // Missed a day — check for freeze
    if (this.streakFreezes() > 0) {
      this.streakFreezes.update(n => n - 1);
      localStorage.setItem(LS.streakFreezes, String(this.streakFreezes()));
      this.decrementStreakFreezeInDB();
      // streak_count preserved
    } else {
      // Streak broken
      this.streakCount.set(1);
    }
  }

  localStorage.setItem(LS.streakCount, String(this.streakCount()));
  localStorage.setItem(LS.streakLast,  todayStr);
}

private async decrementStreakFreezeInDB(): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(environment.supabase.url, environment.supabase.anonKey);
    // Use an RPC to safely decrement without going below 0
    await sb.rpc('consume_streak_freeze', { p_anon_id: this.identity.id });
  } catch { /* silent */ }
}
```

- [ ] **Step 6: Call updateStreak() from consumePress()**

In `consumePress()`, after each `return true` (all three allowed cases), call `this.updateStreak()` before returning. Example for the free daily press case:

```typescript
if (this.dailyUsed() < 1) {
  this.dailyUsed.update(n => n + 1);
  localStorage.setItem(LS.dailyUsed, String(this.dailyUsed()));
  localStorage.setItem(LS.dailyDate, today());
  this.updateStreak();  // ← add this
  return true;
}
```

Add `this.updateStreak()` before all three `return true` statements (unlimited, daily, and extra presses cases).

- [ ] **Step 7: Add consume_streak_freeze RPC to Supabase**

Run in SQL Editor:

```sql
CREATE OR REPLACE FUNCTION consume_streak_freeze(p_anon_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE purchases
  SET streak_freezes = GREATEST(streak_freezes - 1, 0),
      updated_at     = now()
  WHERE anon_id = p_anon_id
    AND streak_freezes > 0;
END;
$$;
```

- [ ] **Step 8: Verify build**

```bash
node ./node_modules/@angular/cli/bin/ng.js build --configuration development 2>&1 | tail -5
```

Expected: "Application bundle generation complete."

- [ ] **Step 9: Commit**

```bash
git add src/app/services/purchase.service.ts
git commit -m "feat: add streak tracking and freeze logic to PurchaseService"
```

---

## Task 3: StreakBadgeComponent

**Files:**
- Create: `src/app/components/streak-badge/streak-badge.component.ts`
- Create: `src/app/components/streak-badge/streak-badge.component.html`

- [ ] **Step 1: Create the component**

```typescript
// src/app/components/streak-badge/streak-badge.component.ts
import { Component, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-streak-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './streak-badge.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreakBadgeComponent {
  readonly streak = input.required<number>();

  readonly emoji = computed(() => {
    const s = this.streak();
    if (s >= 30) return '👑';
    if (s >= 7)  return '🔥🔥';
    if (s >= 3)  return '🔥';
    return '';
  });

  readonly visible = computed(() => this.streak() >= 3);
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/components/streak-badge/streak-badge.component.html -->
<span *ngIf="visible()"
      class="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded-full"
      style="
        background: rgba(255,80,20,0.12);
        border: 1px solid rgba(255,80,20,0.25);
        color: rgba(255,120,60,0.9);
      ">
  {{ emoji() }} {{ streak() }}d
</span>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/components/streak-badge/
git commit -m "feat: add StreakBadgeComponent (shows at 3+ day streaks)"
```

---

## Task 4: GodModeService

**Files:**
- Create: `src/app/services/god-mode.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// src/app/services/god-mode.service.ts
import { Injectable, signal, computed, inject, PLATFORM_ID, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

export interface GodModeState {
  godName:      string;
  currentBid:   number;
  auctionEndAt: Date;
}

@Injectable({ providedIn: 'root' })
export class GodModeService implements OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private supabase: any = null;
  private channel:  any = null;

  readonly godName      = signal('Nobody');
  readonly currentBid   = signal(0);
  readonly auctionEndAt = signal<Date>(this.nextSunday());
  readonly isLoading    = signal(true);

  readonly timeRemaining = computed(() => {
    const end  = this.auctionEndAt();
    const now  = new Date();
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return 'Auction ended';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000)  / 60000);
    return `${d}d ${h}h ${m}m`;
  });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.init();
  }

  private async init(): Promise<void> {
    const { createClient } = await import('@supabase/supabase-js');
    this.supabase = createClient(environment.supabase.url, environment.supabase.anonKey);

    // Initial fetch
    const { data } = await this.supabase
      .from('god_mode')
      .select('*')
      .eq('id', 1)
      .single();

    if (data) this.applyRow(data);
    this.isLoading.set(false);

    // Realtime subscription
    this.channel = this.supabase
      .channel('god_mode_changes')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'god_mode', filter: 'id=eq.1' },
        (payload: any) => this.applyRow(payload.new),
      )
      .subscribe();
  }

  private applyRow(row: any): void {
    this.godName.set(row.god_name ?? 'Nobody');
    this.currentBid.set(Number(row.current_bid ?? 0));
    this.auctionEndAt.set(new Date(row.auction_end_at));
  }

  private nextSunday(): Date {
    const d   = new Date();
    const day = d.getDay(); // 0=Sun
    d.setDate(d.getDate() + (7 - day) % 7 || 7);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  ngOnDestroy(): void {
    if (this.channel && this.supabase) {
      this.supabase.removeChannel(this.channel);
    }
  }
}
```

- [ ] **Step 2: Verify build**

```bash
node ./node_modules/@angular/cli/bin/ng.js build --configuration development 2>&1 | tail -5
```

Expected: "Application bundle generation complete."

- [ ] **Step 3: Commit**

```bash
git add src/app/services/god-mode.service.ts
git commit -m "feat: add GodModeService with Realtime subscription"
```

---

## Task 5: GodModeSectionComponent

**Files:**
- Create: `src/app/components/god-mode-section/god-mode-section.component.ts`
- Create: `src/app/components/god-mode-section/god-mode-section.component.html`

- [ ] **Step 1: Create the component**

```typescript
// src/app/components/god-mode-section/god-mode-section.component.ts
import { Component, inject, signal, computed, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GodModeService } from '../../services/god-mode.service';
import { AnonIdentityService } from '../../services/anon-identity.service';

@Component({
  selector: 'app-god-mode-section',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './god-mode-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GodModeSectionComponent implements OnInit, OnDestroy {
  readonly godMode  = inject(GodModeService);
  readonly identity = inject(AnonIdentityService);

  readonly showBidForm  = signal(false);
  readonly bidName      = signal('');
  readonly bidAmount    = signal('');
  readonly bidState     = signal<'idle' | 'loading' | 'error'>('idle');
  readonly bidError     = signal('');
  private timer: any;

  // Refresh time remaining every minute
  readonly tick = signal(0);
  ngOnInit():    void { this.timer = setInterval(() => this.tick.update(n => n + 1), 60000); }
  ngOnDestroy(): void { clearInterval(this.timer); }

  readonly minBid = computed(() =>
    Math.max(1, Math.ceil((this.godMode.currentBid() + 0.01) * 100) / 100)
  );

  openBidForm(): void {
    this.showBidForm.set(true);
    this.bidAmount.set(String(this.minBid().toFixed(2)));
    this.bidName.set('');
    this.bidState.set('idle');
    this.bidError.set('');
  }

  async submitBid(): Promise<void> {
    const name   = this.bidName().trim();
    const amount = parseFloat(this.bidAmount());

    if (!name) { this.bidError.set('Enter your name.'); return; }
    if (isNaN(amount) || amount < this.minBid()) {
      this.bidError.set(`Minimum bid is $${this.minBid().toFixed(2)}.`);
      return;
    }

    this.bidState.set('loading');
    this.bidError.set('');

    try {
      // Call Edge Function to get Paddle checkout URL for this bid amount
      const resp = await fetch(
        `${this._supabaseUrl()}/functions/v1/create-auction-checkout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anon_id:    this.identity.id,
            bid_name:   name,
            bid_amount: amount,
          }),
        },
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        this.bidError.set(err.error ?? 'Something went wrong. Try again.');
        this.bidState.set('error');
        return;
      }

      const { checkout_url } = await resp.json();
      this.showBidForm.set(false);
      window.location.href = checkout_url;
    } catch {
      this.bidError.set('Network error. Try again.');
      this.bidState.set('error');
    }
  }

  cancel(): void {
    this.showBidForm.set(false);
  }

  private _supabaseUrl(): string {
    return 'https://bxsrcjyguitmkrkqtxdn.supabase.co';
  }
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/components/god-mode-section/god-mode-section.component.html -->
<div class="w-full max-w-xs mx-auto mb-10">
  <div class="rounded-2xl overflow-hidden"
       style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,200,0,0.15);">

    <div class="h-px w-full"
         style="background: linear-gradient(90deg, transparent, rgba(255,180,0,0.5), transparent);"></div>

    <div class="px-5 py-4 text-center">

      <!-- Loading -->
      <ng-container *ngIf="godMode.isLoading()">
        <div class="font-mono text-xs" style="color: rgba(255,255,255,0.2);">Loading auction...</div>
      </ng-container>

      <!-- Loaded -->
      <ng-container *ngIf="!godMode.isLoading() && !showBidForm()">
        <div class="font-mono text-xs tracking-widest mb-1" style="color: rgba(255,180,0,0.5);">👑 GOD OF THE BUTTON</div>

        <div class="font-display text-2xl tracking-widest mb-1" style="color: white;">
          {{ godMode.godName() }}
        </div>

        <div class="font-mono text-xs mb-3" style="color: rgba(255,255,255,0.3);">
          <span *ngIf="godMode.currentBid() > 0">Reigning with ${{ godMode.currentBid().toFixed(2) }}</span>
          <span *ngIf="godMode.currentBid() === 0">No bids yet</span>
          · ends {{ godMode.timeRemaining() }}
        </div>

        <button (click)="openBidForm()"
                class="w-full rounded-xl py-2.5 font-display text-sm tracking-widest transition-all duration-200"
                style="
                  background: rgba(255,180,0,0.1);
                  border: 1px solid rgba(255,180,0,0.25);
                  color: rgba(255,200,80,0.8);
                  cursor: pointer;
                "
                onmouseover="this.style.background='rgba(255,180,0,0.2)'; this.style.borderColor='rgba(255,180,0,0.5)'"
                onmouseout="this.style.background='rgba(255,180,0,0.1)'; this.style.borderColor='rgba(255,180,0,0.25)'">
          OVERTHROW · ${{ minBid().toFixed(2) }}+
        </button>
      </ng-container>

      <!-- Bid form -->
      <ng-container *ngIf="showBidForm()">
        <div class="font-display text-xl tracking-widest mb-4" style="color: white;">PLACE YOUR BID</div>

        <input [ngModel]="bidName()"
               (ngModelChange)="bidName.set($event)"
               type="text"
               placeholder="Your name (displayed publicly)"
               maxlength="30"
               class="w-full rounded-xl px-4 py-2.5 mb-2 font-body text-sm outline-none"
               style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:white;"/>

        <div class="flex items-center gap-2 mb-3">
          <span class="font-mono text-sm" style="color: rgba(255,255,255,0.4);">$</span>
          <input [ngModel]="bidAmount()"
                 (ngModelChange)="bidAmount.set($event)"
                 type="number"
                 [min]="minBid()"
                 step="0.01"
                 class="flex-1 rounded-xl px-3 py-2.5 font-mono text-sm outline-none"
                 style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:white;"/>
        </div>

        <p *ngIf="bidError()"
           class="font-mono text-xs mb-2"
           style="color: rgba(255,80,40,0.8);">{{ bidError() }}</p>

        <p class="font-mono text-xs mb-4" style="color: rgba(255,255,255,0.2);">
          Min bid: ${{ minBid().toFixed(2) }} · No refunds — winner takes all
        </p>

        <button (click)="submitBid()"
                [disabled]="bidState() === 'loading'"
                class="w-full rounded-xl py-2.5 mb-2 font-display text-sm tracking-widest"
                style="
                  background: rgba(255,180,0,0.15);
                  border: 1px solid rgba(255,180,0,0.35);
                  color: rgba(255,200,80,0.9);
                  cursor: pointer;
                ">
          {{ bidState() === 'loading' ? 'Opening checkout...' : 'BID & CLAIM THRONE' }}
        </button>

        <button (click)="cancel()"
                class="font-body text-xs"
                style="color:rgba(255,255,255,0.2);background:none;border:none;cursor:pointer;"
                onmouseover="this.style.color='rgba(255,255,255,0.5)'"
                onmouseout="this.style.color='rgba(255,255,255,0.2)'">
          cancel
        </button>
      </ng-container>

    </div>

    <div class="h-px w-full"
         style="background: linear-gradient(90deg, transparent, rgba(255,180,0,0.2), transparent);"></div>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/components/god-mode-section/
git commit -m "feat: add GodModeSectionComponent with live bid display and form"
```

---

## Task 6: Supabase Edge Function — create-auction-checkout

**Files:**
- Create: `supabase/functions/create-auction-checkout/index.ts`

> This function creates a Paddle checkout session for a dynamic bid amount using Paddle's Transactions API.

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/create-auction-checkout/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PADDLE_API_KEY     = Deno.env.get('PADDLE_API_KEY')!;
const SUPABASE_URL       = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Your Paddle catalog product ID for "God Mode Bid" (create one in Paddle → no price needed)
const GOD_MODE_PRODUCT_ID = Deno.env.get('PADDLE_GOD_MODE_PRODUCT_ID')!;
// Your site URL for the success redirect
const SITE_URL           = Deno.env.get('SITE_URL') ?? 'https://the-button-pink.vercel.app';

const PADDLE_BASE = 'https://api.paddle.com'; // Use https://sandbox-api.paddle.com for testing

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Allow CORS from your site
  const headers = {
    'Access-Control-Allow-Origin': SITE_URL,
    'Content-Type': 'application/json',
  };

  let body: { anon_id: string; bid_name: string; bid_amount: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers });
  }

  const { anon_id, bid_name, bid_amount } = body;

  if (!anon_id || !bid_name || !bid_amount || bid_amount < 1) {
    return new Response(
      JSON.stringify({ error: 'anon_id, bid_name, and bid_amount (min $1) are required' }),
      { status: 400, headers },
    );
  }

  // Guard: check current bid in DB to prevent race conditions
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE);
  const { data: godRow } = await sb.from('god_mode').select('current_bid, auction_end_at').eq('id', 1).single();
  if (godRow && bid_amount <= godRow.current_bid) {
    return new Response(
      JSON.stringify({ error: `Bid must exceed current bid of $${godRow.current_bid.toFixed(2)}` }),
      { status: 409, headers },
    );
  }
  if (godRow && new Date(godRow.auction_end_at) <= new Date()) {
    return new Response(JSON.stringify({ error: 'Auction has ended.' }), { status: 410, headers });
  }

  // Create Paddle transaction with ad-hoc price
  const paddleResp = await fetch(`${PADDLE_BASE}/transactions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PADDLE_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      items: [{
        price: {
          product_id:      GOD_MODE_PRODUCT_ID,
          description:     `God Mode Bid — "${bid_name}"`,
          unit_price: {
            amount:        String(Math.round(bid_amount * 100)), // Paddle uses cents as string
            currency_code: 'USD',
          },
          quantity: { minimum: 1, maximum: 1 },
          billing_cycle: null,
          trial_period:  null,
          tax_mode:      'account_setting',
        },
        quantity: 1,
      }],
      collection_mode:    'automatic',
      custom_data: {
        anon_id,
        bid_name,
        bid_amount: bid_amount.toString(),
        type:       'god_mode_bid',
      },
      checkout: {
        url: SITE_URL,
      },
    }),
  });

  if (!paddleResp.ok) {
    const err = await paddleResp.json().catch(() => ({}));
    console.error('Paddle error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout. Try again.' }),
      { status: 502, headers },
    );
  }

  const paddleData = await paddleResp.json();
  const checkoutUrl = paddleData.data?.checkout?.url;

  if (!checkoutUrl) {
    return new Response(
      JSON.stringify({ error: 'No checkout URL returned from Paddle.' }),
      { status: 502, headers },
    );
  }

  return new Response(JSON.stringify({ checkout_url: checkoutUrl }), { status: 200, headers });
});
```

- [ ] **Step 2: Update paddle-webhook to handle god_mode bids**

In `supabase/functions/paddle-webhook/index.ts`, add handling for `type === 'god_mode_bid'` inside `transaction.completed`:

```typescript
// After the existing items loop, add:
const customData = event.data?.custom_data ?? {};
if (customData.type === 'god_mode_bid') {
  const bidName   = customData.bid_name   as string;
  const bidAmount = parseFloat(customData.bid_amount as string);
  const bidAnonId = customData.anon_id    as string;

  await sb.rpc('claim_god_mode', {
    p_name:    bidName,
    p_anon_id: bidAnonId,
    p_bid:     bidAmount,
  });
}
```

- [ ] **Step 3: Deploy both Edge Functions**

In Supabase Dashboard → Edge Functions:
- Deploy `create-auction-checkout` (paste code → Deploy)
- Re-deploy `paddle-webhook` with the god_mode bid handling added

- [ ] **Step 4: Set secrets for create-auction-checkout**

In Supabase Dashboard → Edge Functions → create-auction-checkout → Secrets:
```
PADDLE_API_KEY            = (from Paddle Dashboard → Developer Tools → Authentication → API key)
PADDLE_GOD_MODE_PRODUCT_ID = (create a product in Paddle called "God Mode Bid", copy its ID)
SITE_URL                  = https://the-button-pink.vercel.app
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/
git commit -m "feat: add create-auction-checkout Edge Function for dynamic bid pricing"
```

---

## Task 7: Wire streak and God Mode into HomeComponent

**Files:**
- Modify: `src/app/pages/home/home.component.ts`
- Modify: `src/app/pages/home/home.component.html`

- [ ] **Step 1: Update home.component.ts imports**

Add to the import block:
```typescript
import { StreakBadgeComponent }    from '../../components/streak-badge/streak-badge.component';
import { GodModeSectionComponent } from '../../components/god-mode-section/god-mode-section.component';
import { GodModeService }          from '../../services/god-mode.service';
```

Add to the `imports` array in `@Component`:
```typescript
imports: [CommonModule, RouterLink, PressLimitModalComponent, ShopModalComponent, RestoreModalComponent, StreakBadgeComponent, GodModeSectionComponent],
```

Add to the class body:
```typescript
readonly godMode = inject(GodModeService);
```

- [ ] **Step 2: Add StreakBadge next to press count in home.component.html**

Find the press status line (starts with `You: {{ counter.myPresses() }}`). Add the badge inline after the presses count, before the extra presses span:

```html
<app-streak-badge [streak]="purchases.streakCount()" class="inline-block ml-2"></app-streak-badge>
```

- [ ] **Step 3: Add GodModeSection between counter and button**

In `home.component.html`, find the `<!-- THE BUTTON -->` comment. Insert `<app-god-mode-section>` just before it:

```html
<!-- God Mode Auction -->
<app-god-mode-section></app-god-mode-section>

<!-- THE BUTTON -->
```

- [ ] **Step 4: Verify build**

```bash
node ./node_modules/@angular/cli/bin/ng.js build --configuration development 2>&1 | tail -8
```

Expected: "Application bundle generation complete."

- [ ] **Step 5: Smoke test locally**

```bash
npx ng serve --port 4200
```

Verify:
- God Mode section shows "Nobody" with countdown and Overthrow button
- Clicking Overthrow shows bid form with name + amount inputs
- After pressing button, streak badge appears after 3 consecutive days (test by temporarily setting `tb_streak_count` to 3 in localStorage)

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/home/
git commit -m "feat: add streak badge and God Mode section to home page"
```

---

## Task 8: Final build and deploy

- [ ] **Step 1: Production build**

```bash
node ./node_modules/@angular/cli/bin/ng.js build --configuration production 2>&1 | tail -8
```

Expected: "Application bundle generation complete."

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Verify live**

Open https://the-button-pink.vercel.app
- God Mode auction section is visible
- Streak badge appears for users with 3+ day streaks
- Streak freeze available in shop modal
- Overthrow button opens bid form

---

## Final Checklist: Things to do in Paddle after approval

1. Create 5 products in Paddle:
   - "10 Extra Presses" → copy price ID → `prices.extraPresses10`
   - "Unlimited Daily" (monthly subscription) → `prices.unlimitedMonthly`
   - "Presser Legend" → `prices.titlePresserLegend`
   - "Streak Freeze" → `prices.streakFreeze`
   - "God Mode Bid" (no price — used as product container) → copy product ID → `PADDLE_GOD_MODE_PRODUCT_ID`
2. Update `environment.ts` and `environment.prod.ts` with all price IDs
3. Register webhook URL in Paddle (both events: `transaction.completed`, `subscription.canceled`)
4. Set `PADDLE_WEBHOOK_SECRET` in Supabase secrets
5. Set `PADDLE_API_KEY` + `PADDLE_GOD_MODE_PRODUCT_ID` + `SITE_URL` in `create-auction-checkout` secrets
6. Push → deploy → test with a real $1 bid
