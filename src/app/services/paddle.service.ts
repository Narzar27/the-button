import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';
import { SupabaseService } from './supabase.service';
import { ClickLimitService } from './click-limit.service';

declare const Paddle: any;

@Injectable({ providedIn: 'root' })
export class PaddleService {
  private platformId = inject(PLATFORM_ID);
  private supabase = inject(SupabaseService);
  private clickLimit = inject(ClickLimitService);
  private _loadPromise: Promise<void> | null = null;

  readonly purchaseComplete = signal<{ priceId: string } | null>(null);
  readonly loadError = signal(false);

  async openCheckout(priceId: string): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (priceId.includes('REPLACE_ME')) return;

    try {
      await this.load();
    } catch {
      this.loadError.set(true);
      return;
    }

    const userId = this.supabase.currentUser()?.id ?? null;
    Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customData: userId ? { userId } : undefined,
    });
  }

  private load(): Promise<void> {
    // Share one in-flight load between callers instead of polling
    if (!this._loadPromise) {
      this._loadPromise = this.doLoad().catch(err => {
        this._loadPromise = null; // allow retry after a failed load
        throw err;
      });
    }
    return this._loadPromise;
  }

  private async doLoad(): Promise<void> {
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

    Paddle.Initialize({
      token: environment.paddle.clientToken,
      eventCallback: (event: any) => {
        if (event.name === 'checkout.completed') {
          const priceId = event.data?.items?.[0]?.price_id ?? '';
          this.creditPurchase(priceId);
          this.purchaseComplete.set({ priceId });
        }
      },
    });

  }

  /** Apply the perk locally as soon as checkout completes so it's usable immediately. */
  private creditPurchase(priceId: string): void {
    const p = environment.paddle.prices;
    switch (priceId) {
      case p.clicks10:       this.clickLimit.addExtraClicks(10); break;
      case p.clicks100:      this.clickLimit.addExtraClicks(100); break;
      case p.unlimited24h:   this.clickLimit.activateUnlimited(24); break;
      case p.unlimitedMonth: this.clickLimit.activateUnlimited(24 * 30); break;
    }
  }
}
