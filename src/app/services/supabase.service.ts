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
  crack_badge: boolean;
}

export interface UserPerksRow {
  user_id: string;
  extra_clicks: number;
  unlimited_until: string | null;
  golden_cursor: boolean;
  diamond_skin: boolean;
  crack_badge: boolean;
  egg_name: string | null;
}

export interface GuestPerksRow {
  anon_id: string;
  extra_clicks: number;
  unlimited_until: string | null;
  golden_cursor: boolean;
  diamond_skin: boolean;
  crack_badge: boolean;
}

// Near-term goals shown to visitors — round numbers that actually feel
// reachable, instead of a 4-billion bar that never visibly moves. Always
// ends at the real target. Also drives the egg's crack stages below.
const MILESTONES = [
  250, 500, 1_000,
  2_500, 5_000, 10_000,
  25_000, 50_000, 100_000,
  250_000, 500_000, 1_000_000,
  2_500_000, 5_000_000, 10_000_000,
  25_000_000, 50_000_000, 100_000_000,
  250_000_000, 500_000_000, 1_000_000_000,
  2_500_000_000,
  4_000_000_000,
];

// Egg visibly cracks through its 8 stages across the first few milestones,
// then holds at "about to hatch" for the long haul until the real 4B goal.
const CRACK_MILESTONES = [0, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000];

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private platformId = inject(PLATFORM_ID);
  readonly client: SupabaseClient;

  readonly egg = signal<Egg | null>(null);
  readonly isLoading = signal(true);
  readonly isConnected = signal(false);
  readonly currentUser = signal<User | null>(null);

  readonly crackStage = computed(() => {
    const clicks = this.globalClicks();
    let stage = 0;
    for (let i = 1; i < CRACK_MILESTONES.length; i++) {
      if (clicks < CRACK_MILESTONES[i]) break;
      stage = i;
    }
    return stage;
  });

  /** Next round-number goal to show (always ends at the real 4B target) */
  readonly nextMilestone = computed(() => {
    const clicks = this.globalClicks();
    for (const m of MILESTONES) if (clicks < m) return m;
    return this.targetClicks();
  });

  /** Progress toward nextMilestone — what actually looks like it's moving */
  readonly progressPct = computed(() => {
    const next = this.nextMilestone();
    return next > 0 ? Math.min((this.globalClicks() / next) * 100, 100) : 0;
  });

  readonly globalClicks = computed(() => this.egg()?.current_clicks ?? 0);
  readonly targetClicks = computed(() => this.egg()?.target_clicks ?? 4_000_000_000);
  readonly eggNumber = computed(() => this.egg()?.number ?? 1);

  private channel: any = null;
  private syncTimer: any = null;

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
    clearInterval(this.syncTimer);

    // Broadcast channel — all users share one connection instead of N postgres_changes listeners
    this.channel = this.client
      .channel('egg_global', { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'click' }, () => {
        this.egg.update(e => e ? { ...e, current_clicks: e.current_clicks + 1 } : e);
      })
      .subscribe((status: string) => this.isConnected.set(status === 'SUBSCRIBED'));

    // Resync from DB every 60s to correct any drift
    this.syncTimer = setInterval(() => this.loadEgg(), 60_000);
  }

  private broadcastClick(): void {
    this.channel?.send({ type: 'broadcast', event: 'click', payload: {} });
  }

  async incrementEgg(): Promise<void> {
    const { error } = await this.client.rpc('increment_egg', { amount: 1 });
    if (error) throw error;
    this.broadcastClick();
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
      .select('id, display_name, total_clicks, eggs_cracked, crack_badge')
      .order('total_clicks', { ascending: false })
      .limit(20);
    return (data ?? []) as LeaderboardEntry[];
  }

  async getBreaksLeaderboard(): Promise<LeaderboardEntry[]> {
    const { data } = await this.client
      .from('users')
      .select('id, display_name, total_clicks, eggs_cracked, crack_badge')
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

  /** Fetch the signed-in user's lifetime click total (for seeding "My Clicks" on load) */
  async getUserTotalClicks(userId: string): Promise<number> {
    const { data } = await this.client
      .from('users')
      .select('total_clicks')
      .eq('id', userId)
      .maybeSingle();
    return data?.total_clicks ?? 0;
  }

  async incrementUserClicks(): Promise<void> {
    const user = this.currentUser();
    if (!user) return;
    const { error } = await this.client.rpc('increment_user_clicks', { uid: user.id });
    if (error) console.error('increment_user_clicks failed:', error.message);
  }

  /** Fetch the signed-in user's server-side perk state (null if never synced) */
  async getUserPerks(userId: string): Promise<UserPerksRow | null> {
    const { data } = await this.client
      .from('user_perks')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return data as UserPerksRow | null;
  }

  /** Atomically decrement the signed-in user's purchased-click balance */
  async spendExtraClicks(amount: number): Promise<void> {
    if (!this.currentUser()) return;
    const { error } = await this.client.rpc('spend_extra_clicks', { amount });
    if (error) console.error('spend_extra_clicks failed:', error.message);
  }

  /** Guest equivalent of getUserPerks — identified by the device's anon_id */
  async getGuestPerks(anonId: string): Promise<GuestPerksRow | null> {
    const { data } = await this.client
      .from('guest_perks')
      .select('*')
      .eq('anon_id', anonId)
      .maybeSingle();
    return data as GuestPerksRow | null;
  }

  /** Guest equivalent of spendExtraClicks */
  async spendGuestExtraClicks(anonId: string, amount: number): Promise<void> {
    const { error } = await this.client.rpc('spend_guest_extra_clicks', { gid: anonId, amount });
    if (error) console.error('spend_guest_extra_clicks failed:', error.message);
  }

  /** This device's own purchased egg name, if bought as a guest */
  async getGuestEggName(anonId: string): Promise<string | null> {
    const { data } = await this.client
      .from('guest_egg_names')
      .select('name')
      .eq('anon_id', anonId)
      .maybeSingle();
    return data?.name ?? null;
  }

  /** Names purchased via "Name on the Egg" — visible to everyone, signed in or not */
  async getEggNames(): Promise<string[]> {
    const [accounts, guests] = await Promise.all([
      this.client.from('egg_names').select('name, created_at').order('created_at', { ascending: true }).limit(50),
      this.client.from('guest_egg_names').select('name, created_at').order('created_at', { ascending: true }).limit(50),
    ]);
    const rows = [...(accounts.data ?? []), ...(guests.data ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return rows.map(r => r.name as string);
  }

  async getDailyClicks(userId: string, date: string): Promise<number> {
    const { data } = await this.client
      .from('daily_clicks')
      .select('click_count')
      .eq('anon_id', userId)
      .eq('date', date)
      .maybeSingle();
    return data?.click_count ?? 0;
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  getUser(): User | null {
    return this.currentUser();
  }

  ngOnDestroy(): void {
    if (this.channel) this.client.removeChannel(this.channel);
    clearInterval(this.syncTimer);
  }
}
