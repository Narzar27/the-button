import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { LemonSqueezyService } from '../../services/lemon-squeezy.service';
import { AuthModalComponent } from '../../components/auth-modal/auth-modal.component';
import { environment } from '../../../environments/environment';

interface Perk {
  id: number;
  variantId: string;
  icon: string;
  name: string;
  desc: string;
  price: string;
  type: 'one-time' | 'subscription';
  limited: boolean;
}

const v = environment.lemonSqueezy.variants;

const PERKS: Perk[] = [
  { id: 1,  variantId: v.clicks10,       icon: '⚡', name: '10 Extra Clicks',     desc: 'Get 10 bonus clicks right now',                   price: '$0.99',    type: 'one-time',     limited: false },
  { id: 2,  variantId: v.clicks100,      icon: '💯', name: '100 Extra Clicks',    desc: 'Get 100 bonus clicks — go wild',                  price: '$4.99',    type: 'one-time',     limited: false },
  { id: 3,  variantId: v.unlimited24h,   icon: '🌙', name: 'Unlimited 24h',       desc: 'Click as much as you want for 24 hours',         price: '$1.99',    type: 'one-time',     limited: false },
  { id: 4,  variantId: v.unlimitedMonth, icon: '♾️', name: 'Monthly Unlimited',   desc: 'Unlimited clicks every day this month',          price: '$4.99/mo', type: 'subscription', limited: false },
  { id: 5,  variantId: v.crackBadge,     icon: '🏅', name: '"I Cracked Egg #1"', desc: 'Exclusive badge for Egg #1 crackers only',       price: '$1.99',    type: 'one-time',     limited: true  },
  { id: 6,  variantId: v.nameOnEgg,      icon: '👑', name: 'Name on the Egg',    desc: 'Your name scrolls across the egg forever',       price: '$2.99',    type: 'one-time',     limited: false },
  { id: 7,  variantId: v.hatchNotif,     icon: '🔔', name: 'Hatch Notification', desc: 'Front row alert when the egg finally cracks',    price: '$0.99',    type: 'one-time',     limited: false },
  { id: 8,  variantId: v.certificate,    icon: '📜', name: 'Cracker Certificate',desc: 'Official downloadable PDF certificate',          price: '$1.99',    type: 'one-time',     limited: false },
  { id: 9,  variantId: v.goldenCursor,   icon: '✨', name: 'Golden Cursor',      desc: 'Your cursor glows gold while clicking',          price: '$1.99',    type: 'one-time',     limited: false },
  { id: 10, variantId: v.diamondSkin,    icon: '💎', name: 'Diamond Egg Skin',   desc: 'The egg shimmers with diamonds for you',         price: '$3.99',    type: 'one-time',     limited: false },
];

@Component({
  selector: 'app-perks',
  standalone: true,
  imports: [AuthModalComponent],
  template: `
    <!-- Stars -->
    <div class="stars">
      @for (s of stars; track s.id) {
        <div class="star" [style.left.%]="s.x" [style.top.%]="s.y"
             [style.width.px]="s.size" [style.height.px]="s.size"
             [style.animation-duration.s]="s.dur" [style.animation-delay.s]="s.delay"></div>
      }
    </div>

    @if (showAuthModal()) {
      <app-auth-modal (closed)="showAuthModal.set(false)" />
    }

    @if (toast()) {
      <div class="toast">{{ toast() }}</div>
    }

    <div class="content">
      <div class="section-header">
        <div class="section-title">⚡ Perk Store</div>
        <div class="section-sub">Click more, flex harder, crack faster</div>
      </div>

      @if (!auth.isSignedIn()) {
        <div class="perks-notice">
          🔒 <strong>Sign in</strong> to purchase perks and track them across devices.
        </div>
      }

      <div class="perks-grid">
        @for (perk of perks; track perk.id) {
          <div class="perk-card" (click)="onBuy(perk)">
            @if (perk.limited) {
              <div class="perk-limited">Limited</div>
            }
            <div class="perk-icon">{{ perk.icon }}</div>
            <div class="perk-name">{{ perk.name }}</div>
            <div class="perk-desc">{{ perk.desc }}</div>
            <div class="perk-price">{{ perk.price }}</div>
          </div>
        }
      </div>

      <div class="perks-footer">
        Payments powered by Lemon Squeezy · Secure & global · VAT handled automatically
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .perks-notice {
      background: rgba(255,217,61,0.08); border: 1px solid rgba(255,217,61,0.2);
      border-radius: 12px; padding: 12px 16px; margin-bottom: 20px;
      font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.7);
    }
    .perks-footer {
      text-align: center; margin-top: 28px; font-size: 12px;
      color: rgba(255,255,255,0.2); font-weight: 600;
    }
  `],
})
export class PerkStoreComponent {
  readonly auth = inject(AuthService);
  readonly ls = inject(LemonSqueezyService);

  readonly perks = PERKS;
  readonly showAuthModal = signal(false);
  readonly toast = signal<string | null>(null);

  readonly stars = Array.from({ length: 40 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100,
    size: 1 + Math.random() * 2, dur: 2 + Math.random() * 4, delay: Math.random() * 4,
  }));

  private toastTimer: any;

  onBuy(perk: Perk): void {
    if (!this.auth.isSignedIn()) {
      this.showAuthModal.set(true);
      return;
    }
    this.ls.openCheckout(perk.variantId);
    this.showToast(`🛒 Opening checkout for "${perk.name}"…`);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2500);
  }
}
