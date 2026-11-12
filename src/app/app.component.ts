import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavComponent } from './components/nav/nav.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavComponent],
  template: `
    @if (showInAppWarning()) {
      <div class="inapp-banner">
        📱 Sign-in won't work in TikTok's browser. Tap <strong>⋯</strong> at the top and choose <strong>Open in browser</strong>.
        <button class="inapp-close" (click)="showInAppWarning.set(false)" aria-label="Dismiss">✕</button>
      </div>
    }
    <div class="app">
      <app-nav />
      <router-outlet />
    </div>
  `,
  styles: [`
    .inapp-banner {
      /* static, not sticky — .nav-shell right below is already sticky top:0,
         and two stacked sticky elements at the same offset would collide */
      position: relative; z-index: 2000;
      background: #FFD93D; color: #2D2D2D;
      font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 13px;
      padding: 10px 40px 10px 16px; text-align: center; line-height: 1.4;
    }
    .inapp-close {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      background: none; border: none; cursor: pointer; font-size: 16px;
      color: #2D2D2D; opacity: 0.6; padding: 4px;
    }
    .inapp-close:hover { opacity: 1; }
  `],
})
export class AppComponent {
  private platformId = inject(PLATFORM_ID);

  /** TikTok's in-app webview blocks Google OAuth and can break magic-link redirects */
  readonly showInAppWarning = signal(
    isPlatformBrowser(this.platformId) && /TikTok|BytedanceWebview|musical_ly/i.test(navigator.userAgent),
  );
}
