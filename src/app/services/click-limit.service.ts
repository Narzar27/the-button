import { Injectable, signal, computed, inject, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AnonIdentityService } from './anon-identity.service';
import { SupabaseService } from './supabase.service';

const DAILY_LIMIT = 5;
const EXTRA_CLICKS_KEY = 'egg_extra_clicks';
const UNLIMITED_UNTIL_KEY = 'egg_unlimited_until';

function todayKey(): string {
  return `egg_daily_${new Date().toISOString().split('T')[0]}`;
}

function todayDate(): string {
  return new Date().toISOString().split('T')[0];
}

@Injectable({ providedIn: 'root' })
export class ClickLimitService {
  private platformId = inject(PLATFORM_ID);
  private anon = inject(AnonIdentityService);
  private supabase = inject(SupabaseService);

  readonly DAILY_LIMIT = DAILY_LIMIT;

  private _dailyClicks = signal(0);
  private _extraClicks = signal(0);
  private _unlimitedUntil = signal(0);

  readonly remainingFree = computed(() => Math.max(0, DAILY_LIMIT - this._dailyClicks()));
  readonly totalRemaining = computed(() => this.remainingFree() + this._extraClicks());
  readonly hasExtra = computed(() => this._extraClicks() > 0);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadFromStorage();

    // When a user signs in, pull their server click count so it syncs across devices
    effect(() => {
      const user = this.supabase.currentUser();
      if (user) {
        this.syncFromServer(user.id);
      }
    });
  }

  private loadFromStorage(): void {
    const daily = parseInt(localStorage.getItem(todayKey()) ?? '0', 10);
    this._dailyClicks.set(daily);
    const extra = parseInt(localStorage.getItem(EXTRA_CLICKS_KEY) ?? '0', 10);
    this._extraClicks.set(extra);
    const unlimitedUntil = parseInt(localStorage.getItem(UNLIMITED_UNTIL_KEY) ?? '0', 10);
    this._unlimitedUntil.set(unlimitedUntil);
  }

  private async syncFromServer(userId: string): Promise<void> {
    const [serverCount, perksRow] = await Promise.all([
      this.supabase.getDailyClicks(userId, todayDate()),
      this.supabase.getUserPerks(userId),
    ]);

    // Take the higher of local vs server (never reset clicks the user already spent)
    if (serverCount > this._dailyClicks()) {
      this._dailyClicks.set(serverCount);
      localStorage.setItem(todayKey(), String(serverCount));
    }

    if (perksRow) {
      // The server balance is authoritative (webhook credits, spend RPC debits).
      // Right after a purchase the local optimistic credit may briefly lead the
      // server (webhook still in flight) — take the higher value in that window.
      const server = perksRow.extra_clicks;
      const next = Date.now() < this.optimisticUntil ? Math.max(this._extraClicks(), server) : server;
      this._extraClicks.set(next);
      localStorage.setItem(EXTRA_CLICKS_KEY, String(next));

      // Unlimited window only ever extends, so the later timestamp wins
      const serverUntil = perksRow.unlimited_until ? Date.parse(perksRow.unlimited_until) : 0;
      if (serverUntil > this._unlimitedUntil()) {
        this._unlimitedUntil.set(serverUntil);
        localStorage.setItem(UNLIMITED_UNTIL_KEY, String(serverUntil));
      } else if (this._unlimitedUntil() > serverUntil && Date.now() >= this.optimisticUntil) {
        this.seedServerBalance();
      }
    } else if (this._extraClicks() > 0 || this._unlimitedUntil() > Date.now()) {
      // No server row yet: seed it from purchases made before the webhook era
      this.seedServerBalance();
    }
  }

  isUnlimited(): boolean {
    return this._unlimitedUntil() > Date.now();
  }

  canClick(): boolean {
    return this.isUnlimited() || this.totalRemaining() > 0;
  }

  getRemainingClicks(): number {
    return this.totalRemaining();
  }

  getExtraClicks(): number {
    return this._extraClicks();
  }

  async registerClick(): Promise<boolean> {
    if (!this.canClick()) return false;

    const today = todayDate();
    const userId = this.supabase.currentUser()?.id;
    const syncId = userId ?? this.anon.anonId();

    if (this.isUnlimited()) {
      // Unlimited pass active — nothing to consume, still count toward the leaderboard
      this.supabase.incrementUserClicks().catch(console.error);
    } else if (this.remainingFree() > 0) {
      const newCount = this._dailyClicks() + 1;
      this._dailyClicks.set(newCount);
      localStorage.setItem(todayKey(), String(newCount));
      this.supabase.syncDailyClick(syncId, today, newCount).catch(console.error);
      this.supabase.incrementUserClicks().catch(console.error);
    } else {
      const newExtra = Math.max(0, this._extraClicks() - 1);
      this._extraClicks.set(newExtra);
      localStorage.setItem(EXTRA_CLICKS_KEY, String(newExtra));
      this.supabase.incrementUserClicks().catch(console.error);
      this.queueSpend();
    }

    return true;
  }

  /**
   * Optimistic local credit for instant UX. The paddle-webhook Edge Function
   * is the authoritative source — it credits user_perks server-side, and the
   * scheduled resyncs below pick that up.
   */
  addExtraClicks(amount: number): void {
    const newExtra = this._extraClicks() + amount;
    this._extraClicks.set(newExtra);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(EXTRA_CLICKS_KEY, String(newExtra));
    }
    this.beginOptimisticWindow();
  }

  /** Activate (or extend) an unlimited-clicks window, e.g. 24h or 30 days. */
  activateUnlimited(hours: number): void {
    const base = Math.max(this._unlimitedUntil(), Date.now());
    const until = base + hours * 3_600_000;
    this._unlimitedUntil.set(until);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(UNLIMITED_UNTIL_KEY, String(until));
    }
    this.beginOptimisticWindow();
  }

  // ── Server reconciliation ──

  private optimisticUntil = 0;
  private spendTimer: any;
  private pendingSpends = 0;

  /** After a purchase: trust local for 60s, then resync once the webhook landed */
  private beginOptimisticWindow(): void {
    this.optimisticUntil = Date.now() + 60_000;
    const user = this.supabase.currentUser();
    if (!user) return;
    setTimeout(() => this.syncFromServer(user.id).catch(console.error), 6_000);
    setTimeout(() => this.syncFromServer(user.id).catch(console.error), 25_000);
  }

  /** Batch extra-click spends into one atomic decrement RPC */
  private queueSpend(): void {
    this.pendingSpends++;
    clearTimeout(this.spendTimer);
    this.spendTimer = setTimeout(() => {
      const n = this.pendingSpends;
      this.pendingSpends = 0;
      this.supabase.spendExtraClicks(n).catch(console.error);
    }, 1500);
  }

  /** One-time seeding of the server row from pre-webhook local purchases */
  private seedServerBalance(): void {
    const until = this._unlimitedUntil();
    this.supabase.upsertUserPerks({
      extra_clicks: this._extraClicks(),
      // Only send the window when we have one, so a device that never bought
      // unlimited can't null out a pass purchased elsewhere
      ...(until > 0 ? { unlimited_until: new Date(until).toISOString() } : {}),
    }).catch(console.error);
  }
}
