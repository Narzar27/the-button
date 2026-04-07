import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="nav-header">
      <a routerLink="/" class="logo">The <span>Egg</span> 🥚</a>

      <div class="header-right">
        @if (auth.isSignedIn()) {
          <div class="user-pill">
            <div class="avatar-sm">{{ auth.initials() }}</div>
            {{ auth.displayName() }}
          </div>
          <button class="sign-out-btn" (click)="signOut()">Sign out</button>
        } @else {
          <button class="auth-btn" (click)="showAuthModal.set(true)">Sign in → Leaderboard</button>
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
  `,
  styles: [`
    .nav-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 24px;
      background: rgba(255,255,255,0.05);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .logo {
      font-family: 'Fredoka One', cursive; font-size: 24px;
      color: #FFD93D; letter-spacing: 0.5px; text-decoration: none;
    }
    .logo span { color: white; }
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
    }
    .avatar-sm {
      width: 28px; height: 28px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800; background: #FFD93D; color: #2D2D2D;
    }

    .tabs {
      display: flex; gap: 4px; padding: 12px 24px;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .tab {
      padding: 8px 18px; border-radius: 99px; font-size: 13px; font-weight: 700;
      cursor: pointer; color: rgba(255,255,255,0.5); transition: all 0.15s;
      border: 1px solid transparent; text-decoration: none;
      font-family: 'Nunito', sans-serif;
    }
    .tab:hover { color: white; }
    .tab.active {
      background: rgba(255,255,255,0.1); color: white;
      border-color: rgba(255,255,255,0.15);
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
