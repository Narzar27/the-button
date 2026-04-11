import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="content" style="max-width:720px;padding-top:40px;padding-bottom:60px;">
      <div class="section-header">
        <div class="section-title">📜 Terms & Conditions</div>
        <div class="section-sub">Last updated: April 7, 2026</div>
      </div>

      <div class="terms-body">
        <h2>1. The Egg</h2>
        <p>The Egg is a global collaborative experience. Everyone in the world clicks together toward a shared goal of 4 billion clicks. You are clicking a website, not entering into a contract with a chicken.</p>

        <h2>2. Free Clicks</h2>
        <p>All users receive 10 free clicks per day. Daily limits reset at midnight UTC. Anonymous users are tracked by a UUID stored in localStorage. We do not store personally identifiable information for anonymous users.</p>

        <h2>3. Purchases</h2>
        <p>Extra click packs and perks are available for purchase via Lemon Squeezy (our Merchant of Record). Lemon Squeezy handles all payments, VAT, and refunds in accordance with their terms. All purchases are final unless required otherwise by law in your jurisdiction.</p>

        <h2>4. Leaderboard</h2>
        <p>To appear on the leaderboard, you must sign in with a valid email or Google account. Your display name and click count are public. You may not use offensive, impersonating, or misleading display names.</p>

        <h2>5. Accounts</h2>
        <p>Authentication is handled by Supabase. We store your email address and click count. We do not sell your data. You may request account deletion by contacting us.</p>

        <h2>6. Acceptable Use</h2>
        <p>You may not use automated tools, bots, or scripts to generate clicks. Cheating undermines the global experience and your account will be removed. We want real humans cracking this egg — no exceptions.</p>

        <h2>7. Availability</h2>
        <p>We make no guarantees about uptime. The egg will crack when it cracks. The new egg will appear when it appears. We are one person with $15 and a dream.</p>

        <h2>8. Contact</h2>
        <p>Questions? Feedback? Think you deserve a refund because the egg is too hard? Email us. We're based in Beirut, Lebanon 🇱🇧.</p>
      </div>

      <a routerLink="/" class="back-link">← Back to the Egg</a>
    </div>
  `,
  styles: [`
    .terms-body { font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.7); font-family: 'Nunito', sans-serif; }
    .terms-body h2 { font-family: 'Fredoka One', cursive; font-size: 20px; color: #FFD93D; margin: 28px 0 8px; }
    .terms-body p { margin-bottom: 12px; }
    .back-link {
      display: inline-block; margin-top: 32px; color: rgba(255,255,255,0.4);
      text-decoration: none; font-size: 14px; font-weight: 700;
      transition: color 0.15s; font-family: 'Nunito', sans-serif;
    }
    .back-link:hover { color: #FFD93D; }
  `],
})
export class TermsComponent {}
