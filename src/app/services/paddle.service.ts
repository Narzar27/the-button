import { Injectable } from '@angular/core';

// TODO: Load Paddle.js lazily from CDN when Paddle account is approved.
// Script URL: https://cdn.paddle.com/paddle/v2/paddle.js
// Initialize with: Paddle.Setup({ token: environment.paddle.clientToken })

@Injectable({ providedIn: 'root' })
export class PaddleService {
  private _loaded = false;

  isLoaded(): boolean {
    return this._loaded;
  }

  openCheckout(priceId: string): void {
    // TODO: Replace with real Paddle.js checkout call once account is approved.
    // Paddle.Checkout.open({ items: [{ priceId, quantity: 1 }] });
    console.log('[PaddleService] openCheckout called — priceId:', priceId);
    console.log('[PaddleService] Paddle integration pending account approval.');
  }
}
