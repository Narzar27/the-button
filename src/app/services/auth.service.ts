import { Injectable, computed, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);

  readonly currentUser$ = this.supabase.currentUser;
  readonly isSignedIn = computed(() => this.supabase.currentUser() !== null);

  readonly displayName = computed(() => {
    const user = this.supabase.currentUser();
    if (!user) return null;
    return user.user_metadata?.['display_name']
      ?? user.user_metadata?.['full_name']
      ?? user.email?.split('@')[0]
      ?? 'Cracker';
  });

  readonly userEmail = computed(() => this.supabase.currentUser()?.email ?? null);

  readonly initials = computed(() => {
    const name = this.displayName();
    if (!name) return '??';
    return name.slice(0, 2).toUpperCase();
  });

  async signInWithEmail(email: string): Promise<void> {
    return this.supabase.signInWithEmail(email);
  }

  async signInWithGoogle(): Promise<void> {
    return this.supabase.signInWithGoogle();
  }

  async signOut(): Promise<void> {
    return this.supabase.signOut();
  }
}
