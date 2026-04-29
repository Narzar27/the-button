import {
  Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { ClickLimitService } from '../../services/click-limit.service';
import { AuthModalComponent } from '../../components/auth-modal/auth-modal.component';
import { EggComponent } from '../../components/egg/egg.component';

interface Floater { id: number; x: number; y: number; }
interface Particle { id: number; x: number; y: number; tx: string; ty: string; rot: string; color: string; size: number; dur: number; }
interface Star { id: number; x: number; y: number; size: number; duration: number; delay: number; color: string; }

let floaterId = 0;
let particleId = 0;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, AuthModalComponent, EggComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  readonly supabase = inject(SupabaseService);
  readonly clickLimit = inject(ClickLimitService);

  readonly showAuthModal = signal(false);
  readonly showShareToast = signal(false);
  readonly wiggling = signal(false);
  readonly cracking = signal(false);
  readonly toast = signal<string | null>(null);
  readonly floaters = signal<Floater[]>([]);
  readonly particles = signal<Particle[]>([]);
  readonly myClicks = signal(0);

  readonly stars: Star[] = [];

  private wiggleTimer: any;
  private crackTimer: any;
  private toastTimer: any;

  readonly formattedGlobal = computed(() => this.formatNumber(this.supabase.globalClicks()));

  constructor() {
    const easterColors = ['#FFB7C5','#B5EAD7','#C7CEEA','#FFDAC1','#FFD93D','#D4EDBC','#E8C5FF','#AEE6FF'];
    for (let i = 0; i < 60; i++) {
      this.stars.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2.5,
        duration: 2 + Math.random() * 4,
        delay: Math.random() * 4,
        color: easterColors[Math.floor(Math.random() * easterColors.length)],
      });
    }
  }

  ngOnInit(): void {}
  ngOnDestroy(): void {
    clearTimeout(this.wiggleTimer);
    clearTimeout(this.crackTimer);
    clearTimeout(this.toastTimer);
  }

  async onEggClick(event: MouseEvent | TouchEvent): Promise<void> {
    if (event instanceof TouchEvent) {
      event.preventDefault(); // blocks the synthetic click that follows touchend
    }

    if (!this.clickLimit.canClick()) {
      this.showToast('⚡ Daily limit reached! Get more clicks in the store.');
      return;
    }

    const x = event instanceof MouseEvent
      ? event.clientX
      : event.touches[0]?.clientX ?? window.innerWidth / 2;
    const y = event instanceof MouseEvent
      ? event.clientY
      : event.touches[0]?.clientY ?? window.innerHeight / 2;

    // Optimistic local update
    this.supabase.egg.update(e => e ? { ...e, current_clicks: e.current_clicks + 1 } : e);
    this.myClicks.update(n => n + 1);

    // Animate
    this.wiggling.set(true);
    this.cracking.set(true);
    clearTimeout(this.wiggleTimer);
    clearTimeout(this.crackTimer);
    this.wiggleTimer = setTimeout(() => this.wiggling.set(false), 400);
    this.crackTimer = setTimeout(() => this.cracking.set(false), 300);

    this.spawnFloater(x, y);
    this.spawnParticles(x, y);

    // Register click + remote increment
    await this.clickLimit.registerClick();
    try {
      await this.supabase.incrementEgg();
    } catch {
      // Rollback optimistic update
      this.supabase.egg.update(e => e ? { ...e, current_clicks: Math.max(0, e.current_clicks - 1) } : e);
      this.myClicks.update(n => Math.max(0, n - 1));
    }
  }

  private spawnFloater(x: number, y: number): void {
    const f: Floater = { id: ++floaterId, x: x + (Math.random() - 0.5) * 30, y };
    this.floaters.update(arr => [...arr, f]);
    setTimeout(() => this.floaters.update(arr => arr.filter(fl => fl.id !== f.id)), 900);
  }

  private spawnParticles(x: number, y: number): void {
    const colors = ['#FFD93D', '#FF9F1C', '#FF6B6B', '#FFF8DC'];
    const pts: Particle[] = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 40 + Math.random() * 60;
      return {
        id: ++particleId,
        x, y,
        tx: (Math.cos(angle) * dist) + 'px',
        ty: (Math.sin(angle) * dist) + 'px',
        rot: ((Math.random() - 0.5) * 360) + 'deg',
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        dur: 0.4 + Math.random() * 0.3,
      };
    });
    this.particles.update(arr => [...arr, ...pts]);
    setTimeout(() => {
      const ids = new Set(pts.map(p => p.id));
      this.particles.update(arr => arr.filter(p => !ids.has(p.id)));
    }, 800);
  }

  private showToast(msg: string): void {
    this.toast.set(msg);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 2500);
  }

  formatNumber(n: number): string {
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(3) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString('en-US');
  }

  async share(): Promise<void> {
    const count = this.formatNumber(this.supabase.globalClicks());
    const url = 'https://the-button-pink.vercel.app';
    const text = `🥚 The world's most clicked egg has been tapped ${count} times. Join and set the world record! ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'The Egg 🥚', text, url });
      } else {
        await navigator.clipboard.writeText(text);
        this.showShareToast.set(true);
        setTimeout(() => this.showShareToast.set(false), 2000);
      }
    } catch {}
  }

  trackStar(_: number, s: Star) { return s.id; }
  trackFloater(_: number, f: Floater) { return f.id; }
  trackParticle(_: number, p: Particle) { return p.id; }
}
