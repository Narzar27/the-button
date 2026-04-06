import { Injectable, signal, computed, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

const LOCAL_PRESS_KEY = 'the_button_my_presses';

@Injectable({ providedIn: 'root' })
export class CounterService {
  private platformId = inject(PLATFORM_ID);
  private supabase: SupabaseClient;
  private channel: any = null;
  private initPromise: Promise<void>;

  readonly globalCount   = signal<number>(0);
  readonly myPresses     = signal<number>(0);
  readonly isConnected   = signal<boolean>(false);
  readonly isLoading     = signal<boolean>(true);
  readonly formattedCount = computed(() => this.globalCount().toLocaleString('en-US'));

  constructor() {
    this.supabase = createClient(environment.supabase.url, environment.supabase.anonKey);

    if (isPlatformBrowser(this.platformId)) {
      this.myPresses.set(parseInt(localStorage.getItem(LOCAL_PRESS_KEY) ?? '0', 10));
      this.initPromise = this.initSupabase();
    } else {
      this.initPromise = Promise.resolve();
    }
  }

  private async initSupabase(): Promise<void> {
    // Fetch current count
    const { data } = await this.supabase
      .from('button_presses')
      .select('total_count')
      .eq('id', 1)
      .single();

    if (data) this.globalCount.set(data.total_count);
    this.isLoading.set(false);

    // Subscribe to realtime
    this.channel = this.supabase
      .channel('button_count')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'button_presses', filter: 'id=eq.1' },
        (payload: any) => this.globalCount.set(payload.new.total_count)
      )
      .subscribe((status: string) => this.isConnected.set(status === 'SUBSCRIBED'));
  }

  async press(): Promise<void> {
    await this.initPromise; // wait for supabase to be ready

    // Optimistic update
    this.globalCount.update(n => n + 1);
    this.myPresses.update(n => n + 1);
    localStorage.setItem(LOCAL_PRESS_KEY, String(this.myPresses()));

    const { error } = await this.supabase.rpc('increment_button', { amount: 1 });
    if (error) {
      console.error('Press failed:', error.message);
      this.globalCount.update(n => n - 1); // rollback global only
    }
  }

  ngOnDestroy(): void {
    if (this.channel) this.supabase.removeChannel(this.channel);
  }
}
