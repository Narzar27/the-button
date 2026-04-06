import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

type SupabaseClient = any;

const LOCAL_PRESS_KEY = 'the_button_my_presses';
const LOCAL_TOTAL_KEY = 'the_button_total_offline';
const SUPABASE_CONFIGURED =
  environment.supabase.url !== 'YOUR_SUPABASE_URL' &&
  environment.supabase.anonKey !== 'YOUR_SUPABASE_ANON_KEY';

@Injectable({ providedIn: 'root' })
export class CounterService {
  private platformId = inject(PLATFORM_ID);
  private supabase: SupabaseClient | null = null;
  private channel: any = null;

  // Promise that resolves once Supabase is ready (or failed)
  // Presses that arrive before init completes will wait on this
  private initPromise: Promise<void> | null = null;

  readonly globalCount  = signal<number>(0);
  readonly myPresses    = signal<number>(0);
  readonly isConnected  = signal<boolean>(false);
  readonly isLoading    = signal<boolean>(true);

  readonly formattedCount = computed(() =>
    this.globalCount().toLocaleString('en-US')
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Load myPresses from localStorage immediately so it shows on render
      this.myPresses.set(parseInt(localStorage.getItem(LOCAL_PRESS_KEY) ?? '0', 10));
      this.initPromise = this.init();
    }
  }

  private async init(): Promise<void> {
    if (SUPABASE_CONFIGURED) {
      await this.initSupabase();
    } else {
      const saved = parseInt(localStorage.getItem(LOCAL_TOTAL_KEY) ?? '0', 10);
      this.globalCount.set(saved);
      this.isLoading.set(false);
    }
  }

  private async initSupabase(): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      this.supabase = createClient(
        environment.supabase.url,
        environment.supabase.anonKey
      );

      // Fetch current count
      const { data, error } = await this.supabase
        .from('button_presses')
        .select('total_count')
        .eq('id', 1)
        .single();

      if (!error && data) {
        this.globalCount.set(data.total_count);
      }

      // Subscribe to realtime changes
      this.channel = this.supabase
        .channel('button_count')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'button_presses', filter: 'id=eq.1' },
          (payload: any) => {
            this.globalCount.set(payload.new.total_count);
          }
        )
        .subscribe((status: string) => {
          this.isConnected.set(status === 'SUBSCRIBED');
        });

      this.isLoading.set(false);
    } catch (err) {
      console.warn('Supabase init failed, running in demo mode:', err);
      const saved = parseInt(localStorage.getItem(LOCAL_TOTAL_KEY) ?? '0', 10);
      this.globalCount.set(saved);
      this.isLoading.set(false);
    }
  }

  async press(): Promise<void> {
    // ── Wait for init to complete before pressing ──────────────
    // Fixes race condition where user presses before Supabase client is ready
    if (this.initPromise) {
      await this.initPromise;
    }

    if (SUPABASE_CONFIGURED && this.supabase) {
      // Optimistic update
      this.globalCount.update(n => n + 1);
      this.myPresses.update(n => n + 1);
      this.saveMy();

      const { error } = await this.supabase.rpc('increment_button', { amount: 1 });
      if (error) {
        // RPC failed — rollback global count only, never rollback myPresses
        // myPresses is localStorage-only and always reflects what the user pressed
        console.error('Press RPC failed:', error.message ?? error);
        this.globalCount.update(n => n - 1);
      }
    } else {
      // Demo / offline mode
      this.globalCount.update(n => n + 1);
      this.myPresses.update(n => n + 1);
      this.saveMy();
      localStorage.setItem(LOCAL_TOTAL_KEY, String(this.globalCount()));
    }
  }

  private saveMy(): void {
    localStorage.setItem(LOCAL_PRESS_KEY, String(this.myPresses()));
  }

  ngOnDestroy(): void {
    if (this.channel && this.supabase) {
      this.supabase.removeChannel(this.channel);
    }
  }
}
