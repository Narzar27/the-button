import { Component, inject, signal, OnInit } from '@angular/core';
import { SupabaseService, LeaderboardEntry } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { AuthModalComponent } from '../../components/auth-modal/auth-modal.component';

const AVATAR_COLORS = ['#FFD93D', '#FF6B6B', '#4D96FF', '#C77DFF', '#6BCB77', '#FF9F1C'];

@Component({
  selector: 'app-leaderboard',
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

    <div class="content">
      <div class="section-header">
        <div class="section-title">🏆 Global Leaderboard</div>
        <div class="section-sub">The world's most dedicated crackers</div>
      </div>

      @if (!auth.isSignedIn()) {
        <div class="lb-join-banner">
          <div>
            <div style="font-weight:800;font-size:15px;">🥚 Want to appear here?</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:3px;">Sign in to track your clicks and join the leaderboard</div>
          </div>
          <button class="auth-btn" (click)="showAuthModal.set(true)">Sign In Free</button>
        </div>
      }

      <div class="lb-grid">

        <!-- Presses table -->
        <div class="leaderboard">
          <div class="lb-header">
            <div class="lb-title">👆 Top Pressers</div>
            <div class="lb-subtitle">Most clicks</div>
          </div>
          @if (loadingPresses()) {
            <div class="lb-empty">Loading...</div>
          } @else if (pressEntries().length === 0) {
            <div class="lb-empty-full">
              <div style="font-size:36px;margin-bottom:10px;">🥚</div>
              <div style="font-weight:800;font-size:15px;margin-bottom:4px;">No one yet</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.4);">Sign in and start pressing!</div>
            </div>
          } @else {
            @for (entry of pressEntries(); track entry.id; let i = $index) {
              <div class="lb-row" [class.lb-row-me]="isCurrentUser(entry.id)">
                <div class="lb-rank" [class]="rankClass(i)">{{ rankLabel(i) }}</div>
                <div class="lb-avatar" [style.background]="avatarBg(i)" [style.color]="avatarColor(i)">
                  {{ entry.display_name.slice(0, 2).toUpperCase() }}
                </div>
                <div class="lb-name-wrap">
                  <span class="lb-name">{{ entry.display_name }}</span>
                  @if (isCurrentUser(entry.id)) {
                    <span class="lb-you">(you)</span>
                  }
                </div>
                <div class="lb-clicks">{{ fmt(entry.total_clicks) }}</div>
              </div>
            }
          }
        </div>

        <!-- Breaks table -->
        <div class="leaderboard">
          <div class="lb-header">
            <div class="lb-title">💥 Top Breakers</div>
            <div class="lb-subtitle">Most crack stages triggered</div>
          </div>
          @if (loadingBreaks()) {
            <div class="lb-empty">Loading...</div>
          } @else if (breakEntries().length === 0) {
            <div class="lb-empty-full">
              <div style="font-size:36px;margin-bottom:10px;">🥚</div>
              <div style="font-weight:800;font-size:15px;margin-bottom:4px;">No breakers yet</div>
              <div style="font-size:12px;color:rgba(255,255,255,0.4);">Be the first to crack a stage!</div>
            </div>
          } @else {
            @for (entry of breakEntries(); track entry.id; let i = $index) {
              <div class="lb-row" [class.lb-row-me]="isCurrentUser(entry.id)">
                <div class="lb-rank" [class]="rankClass(i)">{{ rankLabel(i) }}</div>
                <div class="lb-avatar" [style.background]="avatarBg(i)" [style.color]="avatarColor(i)">
                  {{ entry.display_name.slice(0, 2).toUpperCase() }}
                </div>
                <div class="lb-name-wrap">
                  <span class="lb-name">{{ entry.display_name }}</span>
                  @if (isCurrentUser(entry.id)) {
                    <span class="lb-you">(you)</span>
                  }
                </div>
                <div class="lb-clicks">{{ fmt(entry.eggs_cracked) }}</div>
              </div>
            }
          }
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }

    .lb-join-banner {
      background: rgba(255,217,61,0.1); border: 1px solid rgba(255,217,61,0.2);
      border-radius: 16px; padding: 16px 20px; margin-bottom: 20px;
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: 12px; font-family: 'Nunito', sans-serif; color: white;
    }
    .auth-btn {
      padding: 8px 18px; border-radius: 99px; font-size: 13px; font-weight: 800;
      cursor: pointer; border: none; background: #FFD93D; color: #2D2D2D;
      font-family: 'Nunito', sans-serif; transition: all 0.15s;
    }
    .auth-btn:hover { transform: translateY(-1px); }

    .lb-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 640px) {
      .lb-grid { grid-template-columns: 1fr; }
    }

    .lb-subtitle {
      font-size: 11px; color: rgba(255,255,255,0.4);
      font-family: 'Nunito', sans-serif; font-weight: 700;
      margin-top: 2px;
    }

    .lb-empty {
      padding: 40px; text-align: center;
      color: rgba(255,255,255,0.3); font-weight: 700;
      font-family: 'Nunito', sans-serif;
    }
    .lb-empty-full {
      padding: 40px; text-align: center;
      font-family: 'Nunito', sans-serif; color: white;
    }

    .lb-name-wrap { flex: 1; min-width: 0; }
    .lb-name {
      display: block; font-weight: 800; font-size: 14px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .lb-you {
      font-size: 11px; color: rgba(255,217,61,0.7); font-weight: 700;
    }
    .lb-row-me {
      background: rgba(255,217,61,0.07) !important;
      border-left: 3px solid rgba(255,217,61,0.5);
    }
  `],
})
export class LeaderboardComponent implements OnInit {
  readonly supabase = inject(SupabaseService);
  readonly auth = inject(AuthService);

  readonly pressEntries = signal<LeaderboardEntry[]>([]);
  readonly breakEntries = signal<LeaderboardEntry[]>([]);
  readonly loadingPresses = signal(false);
  readonly loadingBreaks = signal(false);
  readonly showAuthModal = signal(false);

  readonly stars = Array.from({ length: 40 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100,
    size: 1 + Math.random() * 2, dur: 2 + Math.random() * 4, delay: Math.random() * 4,
  }));

  ngOnInit(): void {
    this.loadBoth();
  }

  private async loadBoth(): Promise<void> {
    this.loadingPresses.set(true);
    this.loadingBreaks.set(true);
    const [presses, breaks] = await Promise.allSettled([
      this.supabase.getLeaderboard(),
      this.supabase.getBreaksLeaderboard(),
    ]);
    this.pressEntries.set(presses.status === 'fulfilled' ? presses.value : []);
    this.breakEntries.set(breaks.status === 'fulfilled' ? breaks.value : []);
    this.loadingPresses.set(false);
    this.loadingBreaks.set(false);
  }

  isCurrentUser(id: string): boolean {
    return this.supabase.currentUser()?.id === id;
  }

  rankClass(i: number): string {
    if (i === 0) return 'lb-rank gold';
    if (i === 1) return 'lb-rank silver';
    if (i === 2) return 'lb-rank bronze';
    return 'lb-rank other';
  }

  rankLabel(i: number): string {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `#${i + 1}`;
  }

  avatarBg(i: number): string {
    return AVATAR_COLORS[i % AVATAR_COLORS.length] + '33';
  }

  avatarColor(i: number): string {
    return AVATAR_COLORS[i % AVATAR_COLORS.length];
  }

  fmt(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString('en-US');
  }
}
