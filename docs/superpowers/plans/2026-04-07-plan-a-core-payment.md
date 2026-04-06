# Core Payment System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Paddle checkout, anonymous press limits, purchase persistence via Supabase, and cross-device restore — no user auth required.

**Architecture:** Each visitor gets a permanent UUID in localStorage (`tb_anon_id`). Purchases are stored in Supabase `purchases` table keyed by this UUID. PurchaseService owns all press-limit logic, reading from localStorage instantly on load, then syncing from Supabase. PaddleService loads Paddle.js lazily and opens the checkout overlay. A Supabase Edge Function verifies Paddle webhooks and writes purchases to the DB.

**Tech Stack:** Angular 19 (signals, standalone), Supabase JS v2, Paddle.js v2, Supabase Edge Functions (Deno), Supabase CLI

---

## File Map

**Create:**
- `src/app/services/anon-identity.service.ts` — generates + stores UUID
- `src/app/services/purchase.service.ts` — press limits, extra presses, DB sync
- `src/app/services/paddle.service.ts` — loads Paddle.js, opens checkout
- `src/app/components/press-limit-modal/press-limit-modal.component.ts`
- `src/app/components/press-limit-modal/press-limit-modal.component.html`
- `src/app/components/shop-modal/shop-modal.component.ts`
- `src/app/components/shop-modal/shop-modal.component.html`
- `src/app/components/restore-modal/restore-modal.component.ts`
- `src/app/components/restore-modal/restore-modal.component.html`
- `supabase/functions/paddle-webhook/index.ts` — Deno edge function
- `supabase-payments-setup.sql` — DB migration

**Modify:**
- `src/environments/environment.ts` — add paddle config block
- `src/environments/environment.prod.ts` — same
- `src/app/pages/home/home.component.ts` — inject PurchaseService, block press when limit hit, show modals
- `src/app/pages/home/home.component.html` — add modals + footer links
- `src/index.html` — remove nothing; Paddle.js loaded dynamically in service

---

## Task 1: Supabase purchases table

**Files:**
- Create: `supabase-payments-setup.sql`

- [ ] **Step 1: Create the SQL file**

```sql
-- supabase-payments-setup.sql
-- Run in: Supabase Dashboard → SQL Editor → New query

-- Purchases table
CREATE TABLE IF NOT EXISTS purchases (
  anon_id        TEXT PRIMARY KEY,
  email          TEXT NOT NULL DEFAULT '',
  extra_presses  INTEGER NOT NULL DEFAULT 0,
  is_unlimited   BOOLEAN NOT NULL DEFAULT false,
  active_title   TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Anyone can read any row (anon_id is a private UUID — unguessable)
CREATE POLICY "Read purchases by anon_id"
  ON purchases FOR SELECT
  USING (true);

-- No direct client writes — only Edge Function (service role) writes
-- (no INSERT/UPDATE policies needed for anon role)

-- Function: decrement extra_presses safely (prevents going below 0)
CREATE OR REPLACE FUNCTION consume_extra_press(p_anon_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE purchases
  SET extra_presses = GREATEST(extra_presses - 1, 0),
      updated_at    = now()
  WHERE anon_id = p_anon_id
    AND extra_presses > 0;
END;
$$;
```

- [ ] **Step 2: Run in Supabase**

Open: https://supabase.com/dashboard/project/bxsrcjyguitmkrkqtxdn/sql/new
Paste the entire file above → click Run.
Expected: "Success. No rows returned."

- [ ] **Step 3: Verify table exists**

In Supabase dashboard → Table Editor → confirm `purchases` table appears with correct columns.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/nizar/Desktop/the-button
git add supabase-payments-setup.sql
git commit -m "feat: add purchases table and consume_extra_press function"
```

---

## Task 2: AnonIdentityService

**Files:**
- Create: `src/app/services/anon-identity.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// src/app/services/anon-identity.service.ts
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const KEY = 'tb_anon_id';

@Injectable({ providedIn: 'root' })
export class AnonIdentityService {
  private platformId = inject(PLATFORM_ID);
  private _id: string | null = null;

  get id(): string {
    if (this._id) return this._id;
    if (!isPlatformBrowser(this.platformId)) return 'ssr';

    let stored = localStorage.getItem(KEY);
    if (!stored) {
      stored = crypto.randomUUID();
      localStorage.setItem(KEY, stored);
    }
    this._id = stored;
    return this._id;
  }
}
```

- [ ] **Step 2: Verify it builds**

```bash
cd C:/Users/nizar/Desktop/the-button
node ./node_modules/@angular/cli/bin/ng.js build --configuration development 2>&1 | tail -5
```

Expected: "Application bundle generation complete."

- [ ] **Step 3: Commit**

```bash
git add src/app/services/anon-identity.service.ts
git commit -m "feat: add AnonIdentityService for persistent anonymous UUID"
```

---

## Task 3: Add Paddle config to environments

**Files:**
- Modify: `src/environments/environment.ts`
- Modify: `src/environments/environment.prod.ts`

- [ ] **Step 1: Update environment.ts**

Replace the entire file content:

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  supabase: {
    url: 'https://bxsrcjyguitmkrkqtxdn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4c3JjanlndWl0bWtya3F0eGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM4NDksImV4cCI6MjA5MTA3OTg0OX0.6aV7tNbXERY8aZvicGjZJgnyI4Aj-sh4od1bqvwn0Ik',
  },
  paddle: {
    // Fill these in after Paddle approves your account:
    // Dashboard → Paddle → Developer Tools → Authentication
    clientToken: 'YOUR_PADDLE_CLIENT_TOKEN',
    prices: {
      extraPresses10:     'pri_YOUR_10_PRESSES_PRICE_ID',
      unlimitedMonthly:   'pri_YOUR_UNLIMITED_MONTHLY_PRICE_ID',
      titlePresserLegend: 'pri_YOUR_TITLE_PRICE_ID',
      streakFreeze:       'pri_YOUR_STREAK_FREEZE_PRICE_ID',
    },
  },
};
```

- [ ] **Step 2: Update environment.prod.ts**

Replace the entire file content:

```typescript
// src/environments/environment.prod.ts
export const environment = {
  production: true,
  supabase: {
    url: 'https://bxsrcjyguitmkrkqtxdn.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4c3JjanlndWl0bWtya3F0eGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDM4NDksImV4cCI6MjA5MTA3OTg0OX0.6aV7tNbXERY8aZvicGjZJgnyI4Aj-sh4od1bqvwn0Ik',
  },
  paddle: {
    clientToken: 'YOUR_PADDLE_CLIENT_TOKEN',
    prices: {
      extraPresses10:     'pri_YOUR_10_PRESSES_PRICE_ID',
      unlimitedMonthly:   'pri_YOUR_UNLIMITED_MONTHLY_PRICE_ID',
      titlePresserLegend: 'pri_YOUR_TITLE_PRICE_ID',
      streakFreeze:       'pri_YOUR_STREAK_FREEZE_PRICE_ID',
    },
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/environments/
git commit -m "feat: add Paddle config placeholders to environments"
```

---

## Task 4: PurchaseService

**Files:**
- Create: `src/app/services/purchase.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// src/app/services/purchase.service.ts
import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AnonIdentityService } from './anon-identity.service';
import { environment } from '../../environments/environment';

const LS = {
  extraPresses:  'tb_extra_presses',
  isUnlimited:   'tb_is_unlimited',
  activeTitle:   'tb_active_title',
  dailyUsed:     'tb_daily_used',
  dailyDate:     'tb_daily_date',
};

function today(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function lsGet(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private platformId = inject(PLATFORM_ID);
  private identity  = inject(AnonIdentityService);

  // ── Reactive state ──────────────────────────────────────────
  readonly extraPresses  = signal(0);
  readonly isUnlimited   = signal(false);
  readonly activeTitle   = signal<string | null>(null);
  readonly dailyUsed     = signal(0);

  readonly canPress = computed(() =>
    this.isUnlimited() ||
    this.dailyUsed() < 1 ||
    this.extraPresses() > 0
  );

  readonly dailyRemaining = computed(() =>
    this.isUnlimited() ? Infinity : Math.max(0, 1 - this.dailyUsed())
  );

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadFromLocalStorage();
    this.syncFromSupabase();
  }

  // ── Called by HomeComponent before each press ────────────────
  // Returns true if press is allowed, false if blocked
  consumePress(): boolean {
    if (!isPlatformBrowser(this.platformId)) return true;

    // 1. Unlimited — always allow, no consumption
    if (this.isUnlimited()) return true;

    // 2. Free daily press
    if (this.dailyUsed() < 1) {
      this.dailyUsed.update(n => n + 1);
      localStorage.setItem(LS.dailyUsed, String(this.dailyUsed()));
      localStorage.setItem(LS.dailyDate, today());
      return true;
    }

    // 3. Extra presses
    if (this.extraPresses() > 0) {
      this.extraPresses.update(n => n - 1);
      localStorage.setItem(LS.extraPresses, String(this.extraPresses()));
      this.decrementExtraPressInDB();
      return true;
    }

    // 4. Blocked
    return false;
  }

  // ── Called by PaddleService after checkout.completed ─────────
  async refreshFromSupabase(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.syncFromSupabase();
  }

  // ── Restore by email (RestoreModal) ──────────────────────────
  async restoreByEmail(email: string): Promise<'found' | 'not-found' | 'error'> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(environment.supabase.url, environment.supabase.anonKey);
      const { data, error } = await sb
        .from('purchases')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();
      if (error || !data) return 'not-found';
      this.applyRow(data);
      // Overwrite local anon_id to point at the restored account
      localStorage.setItem('tb_anon_id', data['anon_id']);
      return 'found';
    } catch {
      return 'error';
    }
  }

  // ── Private ────────────────────────────────────────────────────
  private loadFromLocalStorage(): void {
    // Reset daily counter if date changed
    const savedDate = lsGet(LS.dailyDate, '');
    if (savedDate !== today()) {
      localStorage.setItem(LS.dailyUsed, '0');
      localStorage.setItem(LS.dailyDate, today());
    }

    this.extraPresses.set(parseInt(lsGet(LS.extraPresses, '0'), 10));
    this.isUnlimited.set(lsGet(LS.isUnlimited, 'false') === 'true');
    this.activeTitle.set(localStorage.getItem(LS.activeTitle));
    this.dailyUsed.set(parseInt(lsGet(LS.dailyUsed, '0'), 10));
  }

  private async syncFromSupabase(): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(environment.supabase.url, environment.supabase.anonKey);
      const { data, error } = await sb
        .from('purchases')
        .select('*')
        .eq('anon_id', this.identity.id)
        .single();
      if (error || !data) return; // no row yet = no purchases, that's fine
      this.applyRow(data);
    } catch {
      // Network error — localStorage values remain
    }
  }

  private applyRow(row: Record<string, unknown>): void {
    const extra = Number(row['extra_presses'] ?? 0);
    const unlimited = Boolean(row['is_unlimited'] ?? false);
    const title = (row['active_title'] as string | null) ?? null;

    this.extraPresses.set(extra);
    this.isUnlimited.set(unlimited);
    this.activeTitle.set(title);

    localStorage.setItem(LS.extraPresses, String(extra));
    localStorage.setItem(LS.isUnlimited, String(unlimited));
    if (title) localStorage.setItem(LS.activeTitle, title);
    else localStorage.removeItem(LS.activeTitle);
  }

  private async decrementExtraPressInDB(): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(environment.supabase.url, environment.supabase.anonKey);
      await sb.rpc('consume_extra_press', { p_anon_id: this.identity.id });
    } catch {
      // Silent — localStorage already decremented, best effort for DB
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
git add src/app/services/purchase.service.ts
git commit -m "feat: add PurchaseService with press limits and Supabase sync"
```

---

## Task 5: PaddleService

**Files:**
- Create: `src/app/services/paddle.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// src/app/services/paddle.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AnonIdentityService } from './anon-identity.service';
import { PurchaseService } from './purchase.service';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    Paddle: any;
  }
}

@Injectable({ providedIn: 'root' })
export class PaddleService {
  private platformId  = inject(PLATFORM_ID);
  private identity    = inject(AnonIdentityService);
  private purchases   = inject(PurchaseService);

  private initialized = false;
  private loading     = false;

  async openCheckout(priceId: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.ensureLoaded();

    window.Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: { anon_id: this.identity.id },
    });
  }

  private async ensureLoaded(): Promise<void> {
    if (this.initialized) return;
    if (this.loading) {
      // Wait for the existing load
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (this.initialized) { clearInterval(check); resolve(); }
        }, 100);
      });
      return;
    }

    this.loading = true;
    await this.loadScript();

    window.Paddle.Initialize({
      token: environment.paddle.clientToken,
      eventCallback: (event: any) => {
        if (event.name === 'checkout.completed') {
          // Refresh purchases from Supabase after successful payment
          this.purchases.refreshFromSupabase();
        }
      },
    });

    this.initialized = true;
    this.loading = false;
  }

  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.Paddle) { resolve(); return; }
      const script = document.createElement('script');
      script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Paddle.js'));
      document.head.appendChild(script);
    });
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
git add src/app/services/paddle.service.ts
git commit -m "feat: add PaddleService with lazy Paddle.js loading and checkout"
```

---

## Task 6: PressLimitModal

**Files:**
- Create: `src/app/components/press-limit-modal/press-limit-modal.component.ts`
- Create: `src/app/components/press-limit-modal/press-limit-modal.component.html`

- [ ] **Step 1: Create the component**

```typescript
// src/app/components/press-limit-modal/press-limit-modal.component.ts
import { Component, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { PaddleService } from '../../services/paddle.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-press-limit-modal',
  standalone: true,
  templateUrl: './press-limit-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PressLimitModalComponent {
  private paddle = inject(PaddleService);

  readonly closed = output<void>();

  async buy10Presses(): Promise<void> {
    await this.paddle.openCheckout(environment.paddle.prices.extraPresses10);
  }

  async buyUnlimited(): Promise<void> {
    await this.paddle.openCheckout(environment.paddle.prices.unlimitedMonthly);
  }

  dismiss(): void {
    this.closed.emit();
  }
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/components/press-limit-modal/press-limit-modal.component.html -->
<!-- Backdrop -->
<div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
     style="background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);">

  <!-- Card -->
  <div class="relative w-full sm:max-w-sm mx-4 mb-6 sm:mb-0 rounded-2xl overflow-hidden"
       style="background: #0d0d0d; border: 1px solid rgba(204,17,0,0.25);">

    <!-- Red top accent line -->
    <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, rgba(204,17,0,0.8), transparent);"></div>

    <div class="px-8 pt-8 pb-6 text-center">

      <!-- Icon -->
      <div class="text-4xl mb-4">⏰</div>

      <!-- Title -->
      <h2 class="font-display text-3xl tracking-widest mb-2" style="color: white;">
        LIMIT REACHED
      </h2>

      <p class="font-body text-sm mb-8" style="color: rgba(255,255,255,0.4);">
        You've used your free press for today.<br>Get more presses or come back tomorrow.
      </p>

      <!-- Primary CTA -->
      <button (click)="buy10Presses()"
              class="w-full rounded-xl py-4 mb-3 font-display text-lg tracking-widest transition-all duration-200"
              style="
                background: radial-gradient(circle at 40% 40%, #ff3300, #cc1100);
                color: white;
                box-shadow: 0 0 30px rgba(204,17,0,0.4);
                cursor: pointer;
                border: none;
              "
              onmouseover="this.style.boxShadow='0 0 50px rgba(255,34,0,0.6)'"
              onmouseout="this.style.boxShadow='0 0 30px rgba(204,17,0,0.4)'">
        10 PRESSES — $0.99
      </button>

      <!-- Secondary CTA -->
      <button (click)="buyUnlimited()"
              class="w-full rounded-xl py-3 mb-6 font-display text-base tracking-widest transition-all duration-200"
              style="
                background: transparent;
                color: rgba(255,100,60,0.8);
                border: 1px solid rgba(204,17,0,0.35);
                cursor: pointer;
              "
              onmouseover="this.style.borderColor='rgba(204,17,0,0.7)'; this.style.color='rgba(255,100,60,1)'"
              onmouseout="this.style.borderColor='rgba(204,17,0,0.35)'; this.style.color='rgba(255,100,60,0.8)'">
        UNLIMITED — $2.99/mo
      </button>

      <!-- Dismiss -->
      <button (click)="dismiss()"
              class="font-body text-xs tracking-widest transition-colors duration-200"
              style="color: rgba(255,255,255,0.2); background: none; border: none; cursor: pointer;"
              onmouseover="this.style.color='rgba(255,255,255,0.5)'"
              onmouseout="this.style.color='rgba(255,255,255,0.2)'">
        come back tomorrow →
      </button>

    </div>

    <!-- Bottom accent line -->
    <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, rgba(204,17,0,0.2), transparent);"></div>
  </div>
</div>
```

- [ ] **Step 3: Verify build**

```bash
node ./node_modules/@angular/cli/bin/ng.js build --configuration development 2>&1 | tail -5
```

Expected: "Application bundle generation complete."

- [ ] **Step 4: Commit**

```bash
git add src/app/components/press-limit-modal/
git commit -m "feat: add PressLimitModal with 10-presses and unlimited CTAs"
```

---

## Task 7: ShopModal

**Files:**
- Create: `src/app/components/shop-modal/shop-modal.component.ts`
- Create: `src/app/components/shop-modal/shop-modal.component.html`

- [ ] **Step 1: Create the component**

```typescript
// src/app/components/shop-modal/shop-modal.component.ts
import { Component, output, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaddleService } from '../../services/paddle.service';
import { PurchaseService } from '../../services/purchase.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-shop-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shop-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopModalComponent {
  private paddle = inject(PaddleService);
  readonly purchases = inject(PurchaseService);

  readonly closed = output<void>();

  readonly products = [
    {
      id: 'extra10',
      icon: '⚡',
      name: '10 Extra Presses',
      desc: 'Persist forever. Use them any day.',
      price: '$0.99',
      priceKey: 'extraPresses10' as const,
      badge: null,
    },
    {
      id: 'unlimited',
      icon: '∞',
      name: 'Unlimited Daily',
      desc: 'Press as much as you want, every day.',
      price: '$2.99/mo',
      priceKey: 'unlimitedMonthly' as const,
      badge: 'BEST VALUE',
    },
    {
      id: 'title',
      icon: '👑',
      name: 'Presser Legend',
      desc: 'Display the title next to your press count.',
      price: '$0.99',
      priceKey: 'titlePresserLegend' as const,
      badge: null,
    },
  ];

  async buy(priceKey: keyof typeof environment.paddle.prices): Promise<void> {
    this.closed.emit();
    await this.paddle.openCheckout(environment.paddle.prices[priceKey]);
  }

  close(): void {
    this.closed.emit();
  }
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/components/shop-modal/shop-modal.component.html -->
<div class="fixed inset-0 z-50 flex items-center justify-center px-4"
     style="background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);"
     (click)="close()">

  <div class="relative w-full max-w-sm rounded-2xl overflow-hidden"
       style="background: #0d0d0d; border: 1px solid rgba(255,255,255,0.08);"
       (click)="$event.stopPropagation()">

    <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, rgba(204,17,0,0.8), transparent);"></div>

    <div class="px-6 py-6">

      <!-- Header -->
      <div class="flex items-center justify-between mb-1">
        <h2 class="font-display text-3xl tracking-widest" style="color: white;">THE SHOP</h2>
        <button (click)="close()"
                class="font-mono text-xs transition-colors"
                style="color: rgba(255,255,255,0.25); background: none; border: none; cursor: pointer;"
                onmouseover="this.style.color='white'"
                onmouseout="this.style.color='rgba(255,255,255,0.25)'">✕</button>
      </div>

      <!-- Status -->
      <p class="font-mono text-xs mb-6" style="color: rgba(255,100,60,0.6);">
        <span *ngIf="purchases.isUnlimited()">∞ Unlimited active</span>
        <span *ngIf="!purchases.isUnlimited() && purchases.extraPresses() > 0">
          {{ purchases.extraPresses() }} extra presses remaining
        </span>
        <span *ngIf="!purchases.isUnlimited() && purchases.extraPresses() === 0">
          1 free press/day
        </span>
      </p>

      <!-- Products -->
      <div class="space-y-3">
        <div *ngFor="let p of products"
             class="rounded-xl p-4 relative"
             style="border: 1px solid rgba(255,255,255,0.07); background: rgba(255,255,255,0.02);">

          <!-- Badge -->
          <span *ngIf="p.badge"
                class="absolute top-3 right-3 font-mono text-xs px-2 py-0.5 rounded-full"
                style="background: rgba(204,17,0,0.2); color: rgba(255,80,40,0.9); border: 1px solid rgba(204,17,0,0.3);">
            {{ p.badge }}
          </span>

          <div class="flex items-start gap-3">
            <span class="text-2xl">{{ p.icon }}</span>
            <div class="flex-1 min-w-0">
              <div class="font-display tracking-widest text-sm" style="color: white;">{{ p.name }}</div>
              <div class="font-body text-xs mt-0.5" style="color: rgba(255,255,255,0.35);">{{ p.desc }}</div>
            </div>
            <button (click)="buy(p.priceKey)"
                    class="shrink-0 font-mono text-xs px-3 py-2 rounded-lg transition-all duration-200"
                    style="
                      background: rgba(204,17,0,0.15);
                      border: 1px solid rgba(204,17,0,0.3);
                      color: rgba(255,100,60,0.9);
                      cursor: pointer;
                    "
                    onmouseover="this.style.background='rgba(204,17,0,0.3)'; this.style.borderColor='rgba(204,17,0,0.6)'"
                    onmouseout="this.style.background='rgba(204,17,0,0.15)'; this.style.borderColor='rgba(204,17,0,0.3)'">
              {{ p.price }}
            </button>
          </div>
        </div>
      </div>

    </div>

    <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, rgba(204,17,0,0.2), transparent);"></div>
  </div>
</div>
```

- [ ] **Step 3: Verify build**

```bash
node ./node_modules/@angular/cli/bin/ng.js build --configuration development 2>&1 | tail -5
```

Expected: "Application bundle generation complete."

- [ ] **Step 4: Commit**

```bash
git add src/app/components/shop-modal/
git commit -m "feat: add ShopModal with all products"
```

---

## Task 8: RestoreModal

**Files:**
- Create: `src/app/components/restore-modal/restore-modal.component.ts`
- Create: `src/app/components/restore-modal/restore-modal.component.html`

- [ ] **Step 1: Create the component**

```typescript
// src/app/components/restore-modal/restore-modal.component.ts
import { Component, output, signal, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PurchaseService } from '../../services/purchase.service';

type State = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

@Component({
  selector: 'app-restore-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './restore-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RestoreModalComponent {
  private purchaseService = inject(PurchaseService);

  readonly closed = output<void>();

  email = '';
  state = signal<State>('idle');

  async restore(): Promise<void> {
    if (!this.email.trim()) return;
    this.state.set('loading');
    const result = await this.purchaseService.restoreByEmail(this.email);
    this.state.set(result === 'found' ? 'found' : result === 'not-found' ? 'not-found' : 'error');
    if (result === 'found') {
      setTimeout(() => this.closed.emit(), 1800);
    }
  }

  close(): void {
    this.closed.emit();
  }
}
```

- [ ] **Step 2: Create the template**

```html
<!-- src/app/components/restore-modal/restore-modal.component.html -->
<div class="fixed inset-0 z-50 flex items-center justify-center px-4"
     style="background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);"
     (click)="close()">

  <div class="w-full max-w-sm rounded-2xl overflow-hidden"
       style="background: #0d0d0d; border: 1px solid rgba(255,255,255,0.08);"
       (click)="$event.stopPropagation()">

    <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, rgba(204,17,0,0.8), transparent);"></div>

    <div class="px-8 py-8 text-center">

      <h2 class="font-display text-3xl tracking-widest mb-2" style="color: white;">RESTORE</h2>
      <p class="font-body text-sm mb-6" style="color: rgba(255,255,255,0.35);">
        Enter the email you used when purchasing.<br>We'll restore your presses on this device.
      </p>

      <ng-container *ngIf="state() === 'idle' || state() === 'loading' || state() === 'not-found' || state() === 'error'">
        <input [(ngModel)]="email"
               type="email"
               placeholder="your@email.com"
               [disabled]="state() === 'loading'"
               class="w-full rounded-xl px-4 py-3 mb-3 font-mono text-sm outline-none"
               style="
                 background: rgba(255,255,255,0.04);
                 border: 1px solid rgba(255,255,255,0.1);
                 color: white;
               "/>

        <button (click)="restore()"
                [disabled]="state() === 'loading'"
                class="w-full rounded-xl py-3 font-display tracking-widest transition-all duration-200"
                style="
                  background: rgba(204,17,0,0.15);
                  border: 1px solid rgba(204,17,0,0.3);
                  color: rgba(255,100,60,0.9);
                  cursor: pointer;
                ">
          {{ state() === 'loading' ? 'Restoring...' : 'RESTORE PURCHASES' }}
        </button>

        <p *ngIf="state() === 'not-found'"
           class="mt-4 font-mono text-xs"
           style="color: rgba(255,80,40,0.7);">
          No purchases found for that email.
        </p>

        <p *ngIf="state() === 'error'"
           class="mt-4 font-mono text-xs"
           style="color: rgba(255,80,40,0.7);">
          Something went wrong. Try again.
        </p>
      </ng-container>

      <ng-container *ngIf="state() === 'found'">
        <div class="py-4">
          <div class="text-4xl mb-3">✓</div>
          <p class="font-display text-xl tracking-widest" style="color: rgba(255,100,60,0.9);">RESTORED</p>
          <p class="font-body text-sm mt-2" style="color: rgba(255,255,255,0.35);">Your purchases are back.</p>
        </div>
      </ng-container>

    </div>

    <div class="h-px w-full" style="background: linear-gradient(90deg, transparent, rgba(204,17,0,0.2), transparent);"></div>
  </div>
</div>
```

- [ ] **Step 3: Verify build**

```bash
node ./node_modules/@angular/cli/bin/ng.js build --configuration development 2>&1 | tail -5
```

Expected: "Application bundle generation complete."

- [ ] **Step 4: Commit**

```bash
git add src/app/components/restore-modal/
git commit -m "feat: add RestoreModal for cross-device purchase recovery"
```

---

## Task 9: Wire HomeComponent

**Files:**
- Modify: `src/app/pages/home/home.component.ts`
- Modify: `src/app/pages/home/home.component.html`

- [ ] **Step 1: Update home.component.ts**

Replace the entire file:

```typescript
// src/app/pages/home/home.component.ts
import {
  Component, inject, signal, computed, OnInit, OnDestroy,
  PLATFORM_ID, ElementRef, ViewChild, ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CounterService } from '../../services/counter.service';
import { PurchaseService } from '../../services/purchase.service';
import { PressLimitModalComponent } from '../../components/press-limit-modal/press-limit-modal.component';
import { ShopModalComponent } from '../../components/shop-modal/shop-modal.component';
import { RestoreModalComponent } from '../../components/restore-modal/restore-modal.component';

interface BurstParticle {
  id: number;
  x: string;
  y: string;
  color: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, PressLimitModalComponent, ShopModalComponent, RestoreModalComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  readonly counter   = inject(CounterService);
  readonly purchases = inject(PurchaseService);

  readonly isPressed       = signal(false);
  readonly isShaking       = signal(false);
  readonly isFlashing      = signal(false);
  readonly showRipple      = signal(false);
  readonly burstParticles  = signal<BurstParticle[]>([]);
  readonly justPressed     = signal(false);
  readonly showShareToast  = signal(false);
  readonly showLimitModal  = signal(false);
  readonly showShopModal   = signal(false);
  readonly showRestoreModal = signal(false);

  cursorX      = signal(0);
  cursorY      = signal(0);
  cursorRingX  = signal(0);
  cursorRingY  = signal(0);

  digits = computed(() => this.counter.formattedCount().split(''));

  @ViewChild('btnEl') btnEl!: ElementRef<HTMLButtonElement>;

  readonly currentYear = new Date().getFullYear();
  private particleId = 0;
  private ringRaf: number | null = null;
  private ringX = 0;
  private ringY = 0;
  private mouseMoveHandler!: (e: MouseEvent) => void;
  private rippleTimeout: any;
  private shakeTimeout: any;
  private flashTimeout: any;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.mouseMoveHandler = (e: MouseEvent) => {
      this.cursorX.set(e.clientX);
      this.cursorY.set(e.clientY);
      this.animateRing(e.clientX, e.clientY);
    };
    document.addEventListener('mousemove', this.mouseMoveHandler);
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    if (this.ringRaf) cancelAnimationFrame(this.ringRaf);
  }

  private animateRing(tx: number, ty: number): void {
    if (this.ringRaf) cancelAnimationFrame(this.ringRaf);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const tick = () => {
      this.ringX = lerp(this.ringX, tx, 0.12);
      this.ringY = lerp(this.ringY, ty, 0.12);
      this.cursorRingX.set(this.ringX);
      this.cursorRingY.set(this.ringY);
      if (Math.abs(this.ringX - tx) > 0.5 || Math.abs(this.ringY - ty) > 0.5) {
        this.ringRaf = requestAnimationFrame(tick);
      }
    };
    this.ringRaf = requestAnimationFrame(tick);
  }

  async onPress(event: MouseEvent | TouchEvent): Promise<void> {
    if (this.isPressed()) return;

    // Check press limit
    const allowed = this.purchases.consumePress();
    if (!allowed) {
      this.showLimitModal.set(true);
      return;
    }

    this.isPressed.set(true);
    this.isFlashing.set(true);
    this.isShaking.set(true);
    this.showRipple.set(true);
    this.justPressed.set(true);
    this.spawnBurst(event);

    await this.counter.press();

    clearTimeout(this.flashTimeout);
    this.flashTimeout = setTimeout(() => this.isFlashing.set(false), 350);
    clearTimeout(this.shakeTimeout);
    this.shakeTimeout = setTimeout(() => this.isShaking.set(false), 400);
    clearTimeout(this.rippleTimeout);
    this.rippleTimeout = setTimeout(() => this.showRipple.set(false), 700);
    setTimeout(() => this.isPressed.set(false), 350);
    setTimeout(() => this.justPressed.set(false), 1200);
  }

  private spawnBurst(_event: MouseEvent | TouchEvent): void {
    const colors = ['#ff2200', '#ff4400', '#ff6600', '#ffaa00', '#ffffff'];
    const particles: BurstParticle[] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const dist  = 50 + Math.random() * 60;
      particles.push({
        id:    ++this.particleId,
        x:     `${Math.cos(angle) * dist}px`,
        y:     `${Math.sin(angle) * dist}px`,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    this.burstParticles.set(particles);
    setTimeout(() => this.burstParticles.set([]), 650);
  }

  async share(): Promise<void> {
    const count = this.counter.globalCount();
    const url   = window.location.href;
    const text  = `The Button has been pressed ${count.toLocaleString('en-US')} times and counting. Can you resist? ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'The Button', text, url });
      } else {
        await navigator.clipboard.writeText(text);
        this.showShareToast.set(true);
        setTimeout(() => this.showShareToast.set(false), 2500);
      }
    } catch (_) {}
  }

  trackParticle(_: number, p: BurstParticle) { return p.id; }
  trackDigit(i: number, d: string) { return `${i}-${d}`; }
}
```

- [ ] **Step 2: Update home.component.html**

Replace the entire file. Key changes: add modal triggers to footer, add modal components at the bottom, add press status line showing extra presses.

```html
<!-- src/app/pages/home/home.component.html -->
<!-- ── Custom cursor ── -->
<div class="cursor" [style.left.px]="cursorX()" [style.top.px]="cursorY()"></div>
<div class="cursor-ring" [style.left.px]="cursorRingX()" [style.top.px]="cursorRingY()"></div>

<div class="noise"></div>
<div class="scanlines"></div>
<div class="vignette"></div>

<div class="flash-overlay" [class.flashing]="isFlashing()"></div>

<div class="relative z-10 min-h-screen flex flex-col items-center justify-center select-none"
     [class.shaking]="isShaking()">

  <!-- Ambient glow -->
  <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div class="w-[600px] h-[600px] rounded-full"
         style="background: radial-gradient(circle, rgba(180,10,0,0.08) 0%, transparent 70%); filter: blur(40px);"></div>
  </div>

  <!-- Header -->
  <header class="absolute top-0 left-0 right-0 flex items-center justify-between px-8 pt-8">
    <div class="font-display text-white/20 tracking-[0.3em] text-xs uppercase">EST. {{ currentYear }}</div>
    <div class="flex items-center gap-2">
      <span class="relative flex h-2 w-2" *ngIf="counter.isConnected()">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
      </span>
      <span class="font-body text-xs tracking-widest uppercase"
            [style.color]="counter.isConnected() ? 'rgba(239,68,68,0.6)' : 'rgba(255,255,255,0.25)'">
        {{ counter.isConnected() ? 'Live' : 'Demo' }}
      </span>
    </div>
  </header>

  <!-- Title -->
  <div class="text-center mb-16 relative">
    <h1 class="font-display text-white/10 tracking-[0.5em] text-sm uppercase mb-3" style="letter-spacing: 0.6em;">
      The Internet's Button
    </h1>
    <p class="font-body text-white/20 text-xs tracking-widest uppercase">
      one button · one counter · the whole world
    </p>
  </div>

  <!-- Counter -->
  <div class="text-center mb-14 relative">
    <div class="font-body text-white/20 text-xs tracking-[0.4em] uppercase mb-4">Times Pressed</div>
    <div class="relative">
      <div *ngIf="counter.isLoading(); else countDisplay"
           class="font-mono text-7xl font-bold text-white/20 tracking-tight"
           style="font-variant-numeric: tabular-nums;">···</div>
      <ng-template #countDisplay>
        <div class="font-mono text-7xl font-bold tracking-tight"
             style="font-variant-numeric: tabular-nums; line-height: 1;"
             [style.text-shadow]="justPressed() ? '0 0 40px rgba(255,60,0,0.8), 0 0 80px rgba(255,30,0,0.4)' : '0 0 20px rgba(255,30,0,0.2)'">
          <span *ngFor="let d of digits(); trackBy: trackDigit"
                class="digit-flip"
                [class.animating]="justPressed() && d !== ','"
                [style.color]="d === ',' ? 'rgba(255,255,255,0.2)' : 'white'">{{ d }}</span>
        </div>
      </ng-template>
      <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 w-48 h-1 rounded-full"
           style="background: linear-gradient(90deg, transparent, rgba(255,30,0,0.3), transparent);"></div>
    </div>

    <!-- Press status -->
    <div class="mt-6 font-mono text-xs tracking-widest"
         [style.color]="counter.myPresses() > 0 ? 'rgba(255,100,60,0.7)' : 'rgba(255,255,255,0.15)'">
      You: {{ counter.myPresses() }} {{ counter.myPresses() === 1 ? 'press' : 'presses' }}

      <span *ngIf="purchases.isUnlimited()" class="ml-2" style="color: rgba(255,150,80,0.8);">· ∞ unlimited</span>
      <span *ngIf="!purchases.isUnlimited() && purchases.extraPresses() > 0"
            class="ml-2" style="color: rgba(255,120,60,0.7);">
        · {{ purchases.extraPresses() }} extra
      </span>

      <span *ngIf="counter.myPresses() >= 100000" class="ml-2 text-yellow-400/80">God</span>
      <span *ngIf="counter.myPresses() >= 10000 && counter.myPresses() < 100000" class="ml-2 text-orange-400/80">Legend</span>
      <span *ngIf="counter.myPresses() >= 1000 && counter.myPresses() < 10000" class="ml-2 text-red-400/80">Addict</span>
      <span *ngIf="counter.myPresses() >= 100 && counter.myPresses() < 1000" class="ml-2 text-white/50">Presser</span>
      <span *ngIf="counter.myPresses() > 0 && counter.myPresses() < 100" class="ml-2 text-white/30">Peasant</span>

      <span *ngIf="purchases.activeTitle()" class="ml-2" style="color: rgba(255,180,80,0.8);">
        · {{ purchases.activeTitle() }}
      </span>
    </div>
  </div>

  <!-- THE BUTTON -->
  <div class="relative flex items-center justify-center mb-14">
    <div class="absolute rounded-full pointer-events-none"
         style="width: 320px; height: 320px; border: 1px solid rgba(200,17,0,0.08); animation: glowBreathe 3s ease-in-out infinite;"></div>
    <div class="absolute rounded-full pointer-events-none"
         style="width: 260px; height: 260px; border: 1px solid rgba(200,17,0,0.15); animation: glowBreathe 3s ease-in-out infinite; animation-delay: 0.5s;"></div>

    <div *ngIf="showRipple()" class="ripple-container absolute"
         style="width: 180px; height: 180px; top: 50%; left: 50%; transform: translate(-50%,-50%);">
      <div class="ripple"></div>
    </div>

    <div *ngFor="let p of burstParticles(); trackBy: trackParticle"
         class="burst-particle absolute top-1/2 left-1/2"
         [style.--bx]="p.x" [style.--by]="p.y" [style.background]="p.color"
         style="margin: -2px 0 0 -2px;"></div>

    <button #btnEl
            (click)="onPress($event)"
            [class.btn-pressing]="isPressed()"
            class="relative rounded-full outline-none focus:outline-none border-0"
            style="
              width: 180px; height: 180px; cursor: none;
              background: radial-gradient(circle at 38% 35%, #ff3300 0%, #cc1100 45%, #880800 100%);
              box-shadow: 0 0 50px 15px rgba(204,17,0,0.35), 0 0 100px 30px rgba(204,17,0,0.12),
                          inset 0 -6px 24px rgba(0,0,0,0.5), inset 0 6px 12px rgba(255,80,40,0.25);
              animation: glowBreathe 3s ease-in-out infinite;
            "
            aria-label="Press the button">
      <div class="absolute rounded-full pointer-events-none"
           style="top:12%;left:16%;width:40%;height:30%;
                  background:radial-gradient(ellipse,rgba(255,140,100,0.35) 0%,transparent 80%);filter:blur(4px);"></div>
      <span class="relative font-display text-white/90 tracking-widest pointer-events-none"
            style="font-size:1rem;letter-spacing:0.25em;text-shadow:0 1px 4px rgba(0,0,0,0.5);">PRESS</span>
    </button>
  </div>

  <!-- Tagline -->
  <div class="text-center mb-10">
    <p class="font-body text-white/20 text-xs tracking-[0.3em] uppercase">No reason needed.</p>
  </div>

  <!-- Share -->
  <div class="relative">
    <button (click)="share()"
            class="font-body text-xs tracking-widest uppercase px-8 py-3 rounded-full transition-all duration-300"
            style="cursor:none;border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);background:rgba(255,255,255,0.03);"
            onmouseover="this.style.borderColor='rgba(255,34,0,0.4)';this.style.color='rgba(255,100,60,0.8)';this.style.background='rgba(204,17,0,0.08)';"
            onmouseout="this.style.borderColor='rgba(255,255,255,0.1)';this.style.color='rgba(255,255,255,0.3)';this.style.background='rgba(255,255,255,0.03)';">
      Share the madness
    </button>
    <div *ngIf="showShareToast()"
         class="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-xs px-4 py-2 rounded-full"
         style="background:rgba(204,17,0,0.15);border:1px solid rgba(204,17,0,0.3);color:rgba(255,100,60,0.9);">
      Copied to clipboard
    </div>
  </div>

  <!-- Footer -->
  <footer class="absolute bottom-0 left-0 right-0 pb-6 flex items-center justify-center gap-6 flex-wrap">
    <span class="font-body text-white/15 text-xs tracking-widest">Built by Nizar · Beirut 🇱🇧</span>

    <button (click)="showShopModal.set(true)"
            class="font-body text-xs tracking-widest transition-colors duration-200"
            style="color:rgba(255,255,255,0.12);background:none;border:none;cursor:pointer;"
            onmouseover="this.style.color='rgba(255,100,60,0.7)'"
            onmouseout="this.style.color='rgba(255,255,255,0.12)'">Shop</button>

    <button (click)="showRestoreModal.set(true)"
            class="font-body text-xs tracking-widest transition-colors duration-200"
            style="color:rgba(255,255,255,0.12);background:none;border:none;cursor:pointer;"
            onmouseover="this.style.color='rgba(255,255,255,0.4)'"
            onmouseout="this.style.color='rgba(255,255,255,0.12)'">Restore</button>

    <a routerLink="/terms-and-conditions"
       class="font-body text-xs tracking-widest transition-colors duration-200"
       style="color:rgba(255,255,255,0.12);"
       onmouseover="this.style.color='rgba(255,255,255,0.4)'"
       onmouseout="this.style.color='rgba(255,255,255,0.12)'">Terms</a>
  </footer>

</div>

<!-- ── Modals ── -->
<app-press-limit-modal
  *ngIf="showLimitModal()"
  (closed)="showLimitModal.set(false)">
</app-press-limit-modal>

<app-shop-modal
  *ngIf="showShopModal()"
  (closed)="showShopModal.set(false)">
</app-shop-modal>

<app-restore-modal
  *ngIf="showRestoreModal()"
  (closed)="showRestoreModal.set(false)">
</app-restore-modal>
```

- [ ] **Step 3: Verify build**

```bash
node ./node_modules/@angular/cli/bin/ng.js build --configuration development 2>&1 | tail -8
```

Expected: "Application bundle generation complete." with no errors.

- [ ] **Step 4: Smoke test locally**

```bash
npx ng serve --port 4200
```

Open http://localhost:4200. Verify:
- Button loads and counter shows
- Clicking button works (first click = free daily press)
- After using the free press, clicking again shows PressLimitModal
- Footer shows Shop, Restore, Terms links
- Shop modal opens and closes
- Restore modal opens with email input

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/home/
git commit -m "feat: wire HomeComponent with press limits, modals, and shop footer"
```

---

## Task 10: Supabase Edge Function — paddle-webhook

**Files:**
- Create: `supabase/functions/paddle-webhook/index.ts`

> **Note:** This Edge Function runs on Deno. Deploy it via Supabase CLI or paste into Supabase Dashboard → Edge Functions. The Paddle API key and webhook secret must be stored as Supabase secrets (not in code).

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/paddle-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PADDLE_WEBHOOK_SECRET = Deno.env.get('PADDLE_WEBHOOK_SECRET')!;
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Paddle price IDs → what they grant (fill after Paddle approval)
const PRICE_GRANTS: Record<string, { type: string; value: unknown }> = {
  'pri_YOUR_10_PRESSES_PRICE_ID':        { type: 'extra_presses', value: 10 },
  'pri_YOUR_UNLIMITED_MONTHLY_PRICE_ID': { type: 'unlimited',     value: true },
  'pri_YOUR_TITLE_PRICE_ID':             { type: 'title',         value: 'Presser Legend' },
  'pri_YOUR_STREAK_FREEZE_PRICE_ID':     { type: 'streak_freeze', value: 1 },
};

async function verifyPaddleSignature(
  body: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Paddle signature format: ts=<timestamp>;h1=<hmac>
  const parts = Object.fromEntries(
    signatureHeader.split(';').map(p => p.split('=')),
  );
  const ts   = parts['ts'];
  const h1   = parts['h1'];
  if (!ts || !h1) return false;

  const payload = `${ts}:${body}`;
  const key     = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return computed === h1;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody  = await req.text();
  const sigHeader = req.headers.get('Paddle-Signature') ?? '';

  const valid = await verifyPaddleSignature(rawBody, sigHeader, PADDLE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const sb    = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── transaction.completed ───────────────────────────────────
  if (event.event_type === 'transaction.completed') {
    const anonId = event.data?.custom_data?.anon_id as string | undefined;
    const email  = (event.data?.customer?.email as string | undefined)?.toLowerCase() ?? '';
    const items: Array<{ price: { id: string } }> = event.data?.items ?? [];

    if (!anonId) {
      return new Response('Missing anon_id in custom_data', { status: 400 });
    }

    // Build the upsert patch
    const patch: Record<string, unknown> = {
      anon_id:    anonId,
      email,
      updated_at: new Date().toISOString(),
    };

    for (const item of items) {
      const priceId = item.price?.id;
      const grant   = PRICE_GRANTS[priceId];
      if (!grant) continue;

      if (grant.type === 'extra_presses') {
        // Increment via RPC to avoid race conditions
        await sb.rpc('add_extra_presses', {
          p_anon_id: anonId,
          p_email:   email,
          p_amount:  grant.value as number,
        });
        continue;
      }

      if (grant.type === 'unlimited')     patch['is_unlimited'] = true;
      if (grant.type === 'title')         patch['active_title'] = grant.value;
      if (grant.type === 'streak_freeze') {
        await sb.rpc('add_streak_freezes', {
          p_anon_id: anonId,
          p_email:   email,
          p_amount:  1,
        });
        continue;
      }
    }

    if (Object.keys(patch).length > 3) {
      // Has fields beyond anon_id/email/updated_at — upsert
      await sb.from('purchases').upsert(patch, { onConflict: 'anon_id' });
    }
  }

  // ── subscription.canceled ──────────────────────────────────
  if (event.event_type === 'subscription.canceled') {
    const anonId = event.data?.custom_data?.anon_id as string | undefined;
    if (anonId) {
      await sb.from('purchases')
        .update({ is_unlimited: false, updated_at: new Date().toISOString() })
        .eq('anon_id', anonId);
    }
  }

  return new Response('OK', { status: 200 });
});
```

- [ ] **Step 2: Add helper RPCs to Supabase**

Run in Supabase SQL Editor:

```sql
-- Add extra presses (upserts row if missing)
CREATE OR REPLACE FUNCTION add_extra_presses(
  p_anon_id TEXT,
  p_email   TEXT,
  p_amount  INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO purchases (anon_id, email, extra_presses)
  VALUES (p_anon_id, p_email, p_amount)
  ON CONFLICT (anon_id)
  DO UPDATE SET
    extra_presses = purchases.extra_presses + p_amount,
    email         = COALESCE(NULLIF(p_email, ''), purchases.email),
    updated_at    = now();
END;
$$;

-- Add streak freezes (upserts row if missing)
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

> Note: The `purchases` table needs a `streak_freezes` column. This is added in Plan B. Skip the `add_streak_freezes` RPC for now — it will be added in Plan B Task 1.

- [ ] **Step 3: Deploy the Edge Function**

Option A — Supabase Dashboard:
- Go to: https://supabase.com/dashboard/project/bxsrcjyguitmkrkqtxdn/functions
- Click "New Function" → name it `paddle-webhook`
- Paste the function code → Deploy

Option B — Supabase CLI (if installed):
```bash
npx supabase functions deploy paddle-webhook --project-ref bxsrcjyguitmkrkqtxdn
```

- [ ] **Step 4: Set Supabase secrets**

In Supabase Dashboard → Edge Functions → paddle-webhook → Secrets:
```
PADDLE_WEBHOOK_SECRET = (from Paddle Dashboard → Developer Tools → Notifications → webhook secret)
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically available in Edge Functions.

- [ ] **Step 5: Register webhook in Paddle**

After Paddle approves your account:
- Paddle Dashboard → Developer Tools → Notifications → New destination
- URL: `https://bxsrcjyguitmkrkqtxdn.supabase.co/functions/v1/paddle-webhook`
- Events: `transaction.completed`, `subscription.canceled`

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: add paddle-webhook Edge Function for purchase fulfillment"
```

---

## Task 11: Final build and deploy

- [ ] **Step 1: Production build**

```bash
node ./node_modules/@angular/cli/bin/ng.js build --configuration production 2>&1 | tail -8
```

Expected: "Application bundle generation complete."

- [ ] **Step 2: Push to deploy**

```bash
git push
```

Vercel auto-deploys. Watch: https://vercel.com/dashboard

- [ ] **Step 3: Verify live site**

Open https://the-button-pink.vercel.app
- Press the button once → works (free daily press)
- Press again → PressLimitModal appears
- Click "Shop" in footer → ShopModal opens
- Click "Restore" → RestoreModal opens with email input
- Click "Terms" → navigates to /terms-and-conditions

- [ ] **Step 4: Fill in Paddle credentials when approved**

Once Paddle approves your account:
1. Get your client-side token: Paddle Dashboard → Developer Tools → Authentication → Client-side token
2. Create 4 products in Paddle (10 presses, unlimited monthly, title, streak freeze) and get their price IDs
3. Update `src/environments/environment.ts` and `environment.prod.ts` with real values
4. Push → Vercel deploys → payments are live

---

## After Plan A: Proceed to Plan B

Plan B covers: streak system (badge, freeze logic) and God Mode auction (bidding UI, GodModeService, god_mode table, auction Edge Function).
