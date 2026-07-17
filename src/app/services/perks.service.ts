import { Injectable, signal, computed, inject, PLATFORM_ID, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SupabaseService, UserPerksRow } from './supabase.service';

export type CosmeticPerk = 'goldenCursor' | 'diamondSkin' | 'crackBadge' | 'nameOnEgg';

const OWNED_PERKS_KEY = 'egg_owned_perks';

const PERK_COLUMNS: Record<Exclude<CosmeticPerk, 'nameOnEgg'>, keyof UserPerksRow> = {
  goldenCursor: 'golden_cursor',
  diamondSkin: 'diamond_skin',
  crackBadge: 'crack_badge',
};

/**
 * Owned cosmetic perks. localStorage keeps them instant/offline;
 * signed-in users also sync to the `user_perks` table so perks
 * survive cleared browsers and follow the account across devices.
 * Stored shape: { goldenCursor: true, nameOnEgg: "Nizar", ... }
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

  grant(perk: CosmeticPerk, value: boolean | string = true): void {
    this.setLocal(perk, value);
    this.pushToServer(perk, value);
  }

  private setLocal(perk: CosmeticPerk, value: boolean | string): void {
    const next = { ...this._owned(), [perk]: value };
    this._owned.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(OWNED_PERKS_KEY, JSON.stringify(next));
    }
  }

  private pushToServer(perk: CosmeticPerk, value: boolean | string): void {
    if (perk === 'nameOnEgg') {
      const name = typeof value === 'string' ? value : '';
      if (!name) return;
      this.supabase.upsertUserPerks({ egg_name: name }).catch(console.error);
      this.supabase.upsertEggName(name).catch(console.error);
    } else {
      this.supabase.upsertUserPerks({ [PERK_COLUMNS[perk]]: true }).catch(console.error);
    }
  }

  /** Merge: cosmetics are never revoked (OR), the name prefers the server copy. */
  private async syncWithServer(userId: string): Promise<void> {
    const row = await this.supabase.getUserPerks(userId);
    const local = this._owned();

    // Pull down anything owned server-side
    if (row?.golden_cursor) this.setLocal('goldenCursor', true);
    if (row?.diamond_skin) this.setLocal('diamondSkin', true);
    if (row?.crack_badge) this.setLocal('crackBadge', true);
    if (row?.egg_name) this.setLocal('nameOnEgg', row.egg_name);

    // Push up anything only granted locally (e.g. server row missing)
    for (const perk of ['goldenCursor', 'diamondSkin', 'crackBadge'] as const) {
      if (local[perk] && !row?.[PERK_COLUMNS[perk]]) this.pushToServer(perk, true);
    }
    const localName = typeof local['nameOnEgg'] === 'string' ? local['nameOnEgg'] : '';
    if (localName && !row?.egg_name) this.pushToServer('nameOnEgg', localName);
  }
}
