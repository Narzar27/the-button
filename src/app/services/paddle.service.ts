import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { SupabaseService } from './supabase.service';

declare const Paddle: any;

@Injectable({ providedIn: 'root' })
export class PaddleService {
  private platformId = inject(PLATFORM_ID);
  private supabase = inject(SupabaseService);
  private _loaded = false;
  private _loading = false;

  isLoaded(): boolean {
    return this._loaded;
  }

  async openCheckout(priceId: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    if (priceId.includes('REPLACE_ME')) {
      console.warn('[PaddleService] Price ID not set for this perk yet.');
      return;
    }

    await this.load();

    const userId = this.supabase.currentUser()?.id ?? null;

    Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: userId ? { user_id: userId } : undefined,
    });
  }

  private async load(): Promise<void> {
    if (this._loaded) return;
    if (this._loading) {
      // Wait for existing load to finish
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
      script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Paddle.js'));
      document.head.appendChild(script);
    });

    if (environment.paddle.sandbox) {
      Paddle.Environment.set('sandbox');
    }

    Paddle.Setup({ token: environment.paddle.clientToken });

    this._loaded = true;
    this._loading = false;
  }
}
