import { Injectable, signal, computed, inject, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseService } from './supabase.service';

export type CosmeticPerk = 'goldenCursor' | 'diamondSkin' | 'crackBadge' | 'nameOnEgg';

const OWNED_PERKS_KEY = 'egg_owned_perks';

/**
 * Owned cosmetic perks. localStorage keeps them instant/offline;
 * signed-in users pull down the `user_perks` row (written only by the
 * Paddle webhook) so perks survive cleared browsers and follow the
 * account across devices. Stored shape: { goldenCursor: true, ... }
 */
@Injectable({ providedIn: 'root' })
export class PerksService {
  private platformId = inject(PLATFORM_ID);
  private supabase = inject(SupabaseService);

  private _owned = signal<Record<string, boolean | string>>({});

  readonly hasGoldenCursor = computed(() => !!this._owned()['goldenCursor']);
  readonly hasDiamondSkin = computed(() => !!this._owned()['diamondSkin']);
  readonly hasCrackBadge = computed(() => !!this._owned()['crackBadge']);
  /** Name to scroll across the egg, or null if not purchased */
  readonly eggName = computed(() => {
    const v = this._owned()['nameOnEgg'];
    return typeof v === 'string' && v.length > 0 ? v : null;
  });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this._owned.set(JSON.parse(localStorage.getItem(OWNED_PERKS_KEY) ?? '{}'));
    } catch {
      this._owned.set({});
    }

    // On sign-in, merge server-side perks (bought on other devices) with local ones
    effect(() => {
      const user = this.supabase.currentUser();
      if (user) {
        this.syncWithServer(user.id).catch(console.error);
      }
    });
  }

  has(perk: CosmeticPerk): boolean {
    return !!this._owned()[perk];
  }

  /**
   * Optimistic local grant only — right after checkout, for instant UI. The
   * server row is the real source of truth (written solely by the verified
   * Paddle webhook); syncWithServer() below reconciles this on sign-in.
   */
  grant(perk: CosmeticPerk, value: boolean | string = true): void {
    this.setLocal(perk, value);
  }

  private setLocal(perk: CosmeticPerk, value: boolean | string): void {
    const next = { ...this._owned(), [perk]: value };
    this._owned.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(OWNED_PERKS_KEY, JSON.stringify(next));
    }
  }

  /** Pull down whatever the server actually has — it's the only writer now. */
  private async syncWithServer(userId: string): Promise<void> {
    const row = await this.supabase.getUserPerks(userId);
    if (row?.golden_cursor) this.setLocal('goldenCursor', true);
    if (row?.diamond_skin) this.setLocal('diamondSkin', true);
    if (row?.crack_badge) this.setLocal('crackBadge', true);
    if (row?.egg_name) this.setLocal('nameOnEgg', row.egg_name);
  }
}
