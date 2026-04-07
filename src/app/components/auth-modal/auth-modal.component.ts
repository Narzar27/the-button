import { Component, inject, signal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="modal-overlay" (click)="closed.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-title">🥚 Join the Cracking</div>
        <div class="modal-sub">
          Sign in to appear on the leaderboard and track your cracks across devices.
        </div>

        @if (sent()) {
          <div class="sent-msg">
            ✅ Magic link sent! Check your email and click the link to sign in.
          </div>
          <button class="modal-cancel" (click)="closed.emit()">Close</button>
        } @else {
          <input
            class="modal-input"
            type="email"
            placeholder="your@email.com"
            [(ngModel)]="email"
            (keydown.enter)="signInWithEmail()"
          />
          <button class="modal-btn" (click)="signInWithEmail()" [disabled]="loading()">
            {{ loading() ? 'Sending…' : '✉️ Send Magic Link' }}
          </button>

          <div class="modal-divider"><span>or</span></div>

          <button class="google-btn" (click)="signInWithGoogle()" [disabled]="loading()">
            <svg width="18" height="18" viewBox="0 0 48 48" style="flex-shrink:0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }

          <button class="modal-cancel" (click)="closed.emit()">Maybe later</button>
        }
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px); z-index: 1000;
      display: flex; align-items: center; justify-content: center; padding: 20px;
    }
    .modal {
      background: #1a1a2e; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 24px; padding: 36px; width: 100%; max-width: 400px; text-align: center;
    }
    .modal-title {
      font-family: 'Fredoka One', cursive; font-size: 32px;
      color: #FFD93D; margin-bottom: 8px;
    }
    .modal-sub {
      font-size: 14px; color: rgba(255,255,255,0.5);
      font-weight: 600; margin-bottom: 28px; line-height: 1.5;
    }
    .modal-input {
      width: 100%; background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;
      padding: 14px 16px; color: white; font-size: 15px;
      font-family: 'Nunito', sans-serif; font-weight: 600;
      outline: none; margin-bottom: 12px; box-sizing: border-box;
    }
    .modal-input::placeholder { color: rgba(255,255,255,0.3); }
    .modal-input:focus { border-color: #FFD93D; }

    .modal-btn {
      width: 100%; background: linear-gradient(135deg, #FFD93D, #FF9F1C);
      border: none; border-radius: 12px; padding: 15px;
      font-family: 'Fredoka One', cursive; font-size: 20px;
      color: #2D2D2D; cursor: pointer; margin-bottom: 10px; transition: all 0.15s;
    }
    .modal-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255,159,28,0.4); }
    .modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .google-btn {
      width: 100%; background: white; border: none; border-radius: 12px; padding: 13px;
      font-family: 'Nunito', sans-serif; font-size: 15px; font-weight: 800;
      color: #2D2D2D; cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center; gap: 10px;
    }
    .google-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
    .google-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .modal-divider {
      display: flex; align-items: center; gap: 12px; margin: 16px 0;
    }
    .modal-divider::before, .modal-divider::after {
      content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.1);
    }
    .modal-divider span { font-size: 12px; color: rgba(255,255,255,0.3); font-weight: 700; }

    .modal-cancel {
      background: none; border: none; color: rgba(255,255,255,0.4);
      font-size: 13px; font-weight: 700; cursor: pointer;
      font-family: 'Nunito', sans-serif; margin-top: 12px; display: block; width: 100%;
    }
    .modal-cancel:hover { color: white; }

    .sent-msg {
      background: rgba(107,203,119,0.1); border: 1px solid rgba(107,203,119,0.3);
      border-radius: 12px; padding: 16px; color: #6BCB77;
      font-weight: 700; margin-bottom: 16px; line-height: 1.5;
    }
    .error-msg {
      color: #FF6B6B; font-size: 13px; font-weight: 700; margin-top: 8px; margin-bottom: 4px;
    }
  `],
})
export class AuthModalComponent {
  private auth = inject(AuthService);

  readonly closed = output<void>();

  email = '';
  readonly loading = signal(false);
  readonly sent = signal(false);
  readonly error = signal('');

  async signInWithEmail(): Promise<void> {
    if (!this.email.trim()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.signInWithEmail(this.email.trim());
      this.sent.set(true);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Something went wrong. Try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.auth.signInWithGoogle();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Something went wrong. Try again.');
      this.loading.set(false);
    }
  }
}
