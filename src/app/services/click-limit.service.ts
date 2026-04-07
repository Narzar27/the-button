import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AnonIdentityService } from './anon-identity.service';
import { SupabaseService } from './supabase.service';

const DAILY_LIMIT = 10;
const EXTRA_CLICKS_KEY = 'egg_extra_clicks';

function todayKey(): string {
  return `egg_daily_${new Date().toISOString().split('T')[0]}`;
}

@Injectable({ providedIn: 'root' })
export class ClickLimitService {
  private platformId = inject(PLATFORM_ID);
  private anon = inject(AnonIdentityService);
  private supabase = inject(SupabaseService);

  readonly DAILY_LIMIT = DAILY_LIMIT;

  private _dailyClicks = signal(0);
  private _extraClicks = signal(0);

  readonly remainingFree = computed(() => Math.max(0, DAILY_LIMIT - this._dailyClicks()));
  readonly totalRemaining = computed(() => this.remainingFree() + this._extraClicks());
  readonly hasExtra = computed(() => this._extraClicks() > 0);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const daily = parseInt(localStorage.getItem(todayKey()) ?? '0', 10);
    this._dailyClicks.set(daily);

    const extra = parseInt(localStorage.getItem(EXTRA_CLICKS_KEY) ?? '0', 10);
    this._extraClicks.set(extra);
  }

  canClick(): boolean {
    return this.totalRemaining() > 0;
  }

  getRemainingClicks(): number {
    return this.totalRemaining();
  }

  getExtraClicks(): number {
    return this._extraClicks();
  }

  async registerClick(): Promise<boolean> {
    if (!this.canClick()) return false;

    const today = new Date().toISOString().split('T')[0];

    if (this.remainingFree() > 0) {
      const newCount = this._dailyClicks() + 1;
      this._dailyClicks.set(newCount);
      localStorage.setItem(todayKey(), String(newCount));

      // Fire-and-forget syncs
      this.supabase.syncDailyClick(this.anon.anonId(), today, newCount).catch(console.error);
      this.supabase.incrementUserClicks().catch(console.error);
    } else {
      // Consume an extra click
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
}
