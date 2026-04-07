import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STORAGE_KEY = 'egg_anon_id';

@Injectable({ providedIn: 'root' })
export class AnonIdentityService {
  private platformId = inject(PLATFORM_ID);
  private _anonId = signal<string>('');

  readonly anonId = this._anonId.asReadonly();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      this._anonId.set(stored);
    } else {
      const id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
      this._anonId.set(id);
    }
  }
}
