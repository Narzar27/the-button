import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface Egg {
  id: number;
  number: number;
  target_clicks: number;
  current_clicks: number;
  cracked_at: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  display_name: string;
  total_clicks: number;
  eggs_cracked: number;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private platformId = inject(PLATFORM_ID);
  readonly client: SupabaseClient;

  readonly egg = signal<Egg | null>(null);
  readonly isLoading = signal(true);
  readonly isConnected = signal(false);
  readonly currentUser = signal<User | null>(null);

  readonly crackStage = computed(() => {
    const e = this.egg();
    if (!e || e.target_clicks === 0) return 0;
    const progress = e.current_clicks / e.target_clicks;
    return Math.min(Math.floor(progress * 9), 8);
  });

  readonly progressPct = computed(() => {
    const e = this.egg();
    if (!e || e.target_clicks === 0) return 0;
    return Math.min((e.current_clicks / e.target_clicks) * 100, 100);
  });

  readonly globalClicks = computed(() => this.egg()?.current_clicks ?? 0);
  readonly targetClicks = computed(() => this.egg()?.target_clicks ?? 4_000_000_000);
  readonly eggNumber = computed(() => this.egg()?.number ?? 1);

  private channel: any = null;

  constructor() {
    this.client = createClient(environment.supabase.url, environment.supabase.anonKey);

    if (isPlatformBrowser(this.platformId)) {
      this.init();
    }
  }

  private async init(): Promise<void> {
    await this.loadEgg();
    this.subscribeToEggClicks();
    await this.loadAuthState();
  }

  private async loadEgg(): Promise<void> {
    const { data } = await this.client
      .from('eggs')
      .select('*')
      .order('number', { ascending: false })
      .limit(1)
      .single();

    if (data) this.egg.set(data);
    this.isLoading.set(false);
  }

  private async loadAuthState(): Promise<void> {
    const { data: { session } } = await this.client.auth.getSession();
    this.currentUser.set(session?.user ?? null);

    this.client.auth.onAuthStateChange((_event, session) => {
      this.currentUser.set(session?.user ?? null);
    });
  }

  subscribeToEggClicks(): void {
    if (this.channel) this.client.removeChannel(this.channel);

    const eggId = this.egg()?.id ?? 1;
    this.channel = this.client
      .channel('egg_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'eggs', filter: `id=eq.${eggId}` },
        (payload: any) => {
          this.egg.update(e => e ? { ...e, current_clicks: payload.new.current_clicks } : e);
        }
      )
      .subscribe((status: string) => this.isConnected.set(status === 'SUBSCRIBED'));
  }

  async incrementEgg(): Promise<void> {
    const { error } = await this.client.rpc('increment_egg', { amount: 1 });
    if (error) throw error;
  }

  async syncDailyClick(anonId: string, date: string, count: number): Promise<void> {
    await this.client
      .from('daily_clicks')
      .upsert(
        { anon_id: anonId, date, click_count: count },
        { onConflict: 'anon_id,date' }
      );
  }

  async getLeaderboard(_tab: 'alltime' | 'thisegg' | 'today' | 'country' = 'alltime'): Promise<LeaderboardEntry[]> {
    const { data } = await this.client
      .from('users')
      .select('id, display_name, total_clicks, eggs_cracked')
      .order('total_clicks', { ascending: false })
      .limit(20);
    return (data ?? []) as LeaderboardEntry[];
  }

  async getBreaksLeaderboard(): Promise<LeaderboardEntry[]> {
    const { data } = await this.client
      .from('users')
      .select('id, display_name, total_clicks, eggs_cracked')
      .order('eggs_cracked', { ascending: false })
      .limit(20);
    return (data ?? []) as LeaderboardEntry[];
  }

  async incrementUserBreaks(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    const { error } = await this.client.rpc('increment_user_breaks', { uid: user.id });
    if (error) console.error('incrementUserBreaks failed:', error);
  }

  async signInWithEmail(email: string): Promise<void> {
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }

  async signInWithGoogle(): Promise<void> {
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  }

  async incrementUserClicks(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    const { error } = await this.client.rpc('increment_user_clicks', { uid: user.id });
    if (error) console.error('increment_user_clicks failed:', error.message);
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  getUser(): User | null {
    return this.currentUser();
  }

  ngOnDestroy(): void {
    if (this.channel) this.client.removeChannel(this.channel);
  }
}
