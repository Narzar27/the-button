import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

declare const LemonSqueezy: any;
declare const window: any;

@Injectable({ providedIn: 'root' })
export class LemonSqueezyService {
  private platformId = inject(PLATFORM_ID);
  private auth = inject(AuthService);
  private _loaded = false;
  private _loading = false;

  async openCheckout(variantId: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    if (!variantId || variantId.includes('REPLACE_ME')) {
      console.warn('[LemonSqueezyService] Variant ID not set for this perk yet.');
      return;
    }

    await this.load();

    const store = environment.lemonSqueezy.storeSlug;
    let url = `https://${store}.lemonsqueezy.com/buy/${variantId}`;

    // Pre-fill email for signed-in users
    const email = this.auth.userEmail();
    if (email) {
      url += `?checkout[email]=${encodeURIComponent(email)}`;
    }

    LemonSqueezy.Url.Open(url);
  }

  private async load(): Promise<void> {
    if (this._loaded) return;
    if (this._loading) {
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (this._loaded) { clearInterval(check); resolve(); }
        }, 50);
      });
      return;
    }

    this._loading = true;

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://app.lemonsqueezy.com/js/lemon.js';
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Lemon Squeezy JS'));
      document.head.appendChild(script);
    });

    window.createLemonSqueezy();

    this._loaded = true;
    this._loading = false;
  }
}
