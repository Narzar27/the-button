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
    const serverCount = await this.supabase.getDailyClicks(userId, todayDate());
    // Take the higher of local vs server (never reset clicks the user already spent)
    if (serverCount > this._dailyClicks()) {
      this._dailyClicks.set(serverCount);
      localStorage.setItem(todayKey(), String(serverCount));
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
    }

    return true;
  }

  addExtraClicks(amount: number): void {
    const newExtra = this._extraClicks() + amount;
    this._extraClicks.set(newExtra);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(EXTRA_CLICKS_KEY, String(newExtra));
    }
  }

  /** Activate (or extend) an unlimited-clicks window, e.g. 24h or 30 days. */
  activateUnlimited(hours: number): void {
    const base = Math.max(this._unlimitedUntil(), Date.now());
    const until = base + hours * 3_600_000;
    this._unlimitedUntil.set(until);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(UNLIMITED_UNTIL_KEY, String(until));
    }
  }
}
