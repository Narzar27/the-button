import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div style="
      min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 16px;
      font-family: 'Nunito', sans-serif; color: rgba(255,255,255,0.6);
    ">
      <div style="font-size: 48px;">🥚</div>
      <div style="font-size: 16px; font-weight: 700;">Signing you in...</div>
    </div>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private router = inject(Router);
  private supabase = inject(SupabaseService);

  async ngOnInit(): Promise<void> {
    // Supabase JS client automatically exchanges the ?code= param for a session.
    // Calling getSession() triggers that exchange.
    await this.supabase.client.auth.getSession();
    this.router.navigate(['/'], { replaceUrl: true });
  }
}
