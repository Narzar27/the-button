import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

// ─── Supabase types (dynamic import so app still works without credentials) ───
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

  // ─── Reactive state ───
  readonly globalCount = signal<number>(0);
  readonly myPresses = signal<number>(0);
  readonly isConnected = signal<boolean>(false);
  readonly isLoading = signal<boolean>(true);

  readonly formattedCount = computed(() =>
    this.globalCount().toLocaleString('en-US')
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.myPresses.set(parseInt(localStorage.getItem(LOCAL_PRESS_KEY) ?? '0', 10));
      this.init();
    }
  }

  private async init(): Promise<void> {
    if (SUPABASE_CONFIGURED) {
      await this.initSupabase();
    } else {
      // ─── Offline / demo mode ───
      const saved = parseInt(localStorage.getItem(LOCAL_TOTAL_KEY) ?? '42137', 10);
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
      const saved = parseInt(localStorage.getItem(LOCAL_TOTAL_KEY) ?? '42137', 10);
      this.globalCount.set(saved);
      this.isLoading.set(false);
    }
  }

  async press(): Promise<void> {
    if (SUPABASE_CONFIGURED && this.supabase) {
      // Optimistic update
      this.globalCount.update(n => n + 1);
      this.myPresses.update(n => n + 1);
      this.saveMy();

      const { error } = await this.supabase.rpc('increment_button', { amount: 1 });
      if (error) {
        console.error('Press failed:', error);
        this.globalCount.update(n => n - 1); // rollback
        this.myPresses.update(n => n - 1);
        this.saveMy();
      }
    } else {
      // Demo mode
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
