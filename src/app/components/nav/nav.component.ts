import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AuthModalComponent } from '../auth-modal/auth-modal.component';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, AuthModalComponent],
  template: `
    <div class="nav-shell">
      <header class="nav-header">
        <a routerLink="/" class="logo"><span class="logo-muted">The</span> Egg 🥚</a>

        <div class="header-right">
          @if (auth.isSignedIn()) {
            <div class="user-pill">
              <div class="avatar-sm">{{ auth.initials() }}</div>
              {{ auth.displayName() }}
            </div>
            <button class="sign-out-btn" (click)="signOut()">Sign out</button>
          } @else {
            <button class="auth-btn" (click)="showAuthModal.set(true)">🏆 Sign In</button>
          }
        </div>
      </header>

      <nav class="tabs">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="tab">
          🥚 The Egg
        </a>
        <a routerLink="/leaderboard" routerLinkActive="active" class="tab">
          🏆 Leaderboard
        </a>
        <a routerLink="/perks" routerLinkActive="active" class="tab">
          ⚡ Perk Store
        </a>
      </nav>
    </div>

    @if (showAuthModal()) {
      <app-auth-modal (closed)="showAuthModal.set(false)" />
    }
  `,
  styles: [`
    .nav-shell {
      position: sticky; top: 0; z-index: 50;
      background: rgba(32,15,8,0.72);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: 0 1px 0 rgba(255,255,255,0.06), 0 12px 30px -18px rgba(0,0,0,0.6);
    }
    .nav-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 24px; flex-wrap: wrap; gap: 10px;
    }
    .logo {
      display: inline-flex; align-items: baseline; gap: 5px;
      font-family: 'Fredoka One', cursive; font-size: 24px;
      color: #FFD93D; letter-spacing: 0.5px; text-decoration: none;
    }
    .logo-muted { font-size: 15px; color: rgba(255,255,255,0.45); }
    .header-right { display: flex; align-items: center; gap: 10px; }

    .auth-btn, .sign-out-btn {
      padding: 8px 18px; border-radius: 99px; font-size: 13px; font-weight: 800;
      cursor: pointer; border: none; transition: all 0.15s;
      font-family: 'Nunito', sans-serif;
    }
    .auth-btn {
      background: #FFD93D; color: #2D2D2D;
    }
    .auth-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(255,217,61,0.4); }
    .sign-out-btn {
      background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .sign-out-btn:hover { color: white; }

    .user-pill {
      display: flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.1); border-radius: 99px;
      padding: 6px 14px 6px 6px; font-size: 13px; font-weight: 700;
      font-family: 'Nunito', sans-serif; color: white;
      max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .avatar-sm {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800; background: #FFD93D; color: #2D2D2D;
    }

    .tabs {
      display: flex; gap: 6px; padding: 10px 24px 14px;
      border-top: 1px solid rgba(255,255,255,0.06);
    }
    .tab {
      padding: 8px 18px; border-radius: 99px; font-size: 13px; font-weight: 700;
      cursor: pointer; color: rgba(255,255,255,0.5); transition: all 0.15s ease-out;
      border: 1px solid transparent; text-decoration: none;
      font-family: 'Nunito', sans-serif;
    }
    .tab:hover { color: white; background: rgba(255,255,255,0.06); transform: translateY(-1px); }
    .tab.active {
      background: rgba(255,217,61,0.14); color: #FFD93D;
      border-color: rgba(255,217,61,0.35);
    }
    .tab.active:hover { background: rgba(255,217,61,0.2); }
    @media (prefers-reduced-motion: reduce) {
      .tab:hover { transform: none; }
    }
  `],
})
export class NavComponent {
  readonly auth = inject(AuthService);
  readonly showAuthModal = signal(false);

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
