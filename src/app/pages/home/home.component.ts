import {
  Component, inject, signal, computed, OnInit, OnDestroy,
  PLATFORM_ID, ElementRef, ViewChild, ChangeDetectionStrategy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CounterService } from '../../services/counter.service';

interface BurstParticle {
  id: number;
  x: string;
  y: string;
  color: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  readonly counter = inject(CounterService);

  readonly isPressed = signal(false);
  readonly isShaking = signal(false);
  readonly isFlashing = signal(false);
  readonly showRipple = signal(false);
  readonly burstParticles = signal<BurstParticle[]>([]);
  readonly justPressed = signal(false);
  readonly showShareToast = signal(false);

  cursorX = signal(0);
  cursorY = signal(0);
  cursorRingX = signal(0);
  cursorRingY = signal(0);

  prevCount = signal(0);
  digits = computed(() => this.counter.formattedCount().split(''));

  @ViewChild('btnEl') btnEl!: ElementRef<HTMLButtonElement>;
  @ViewChild('pageEl') pageEl!: ElementRef<HTMLDivElement>;

  readonly currentYear = new Date().getFullYear();
  private particleId = 0;
  private ringRaf: number | null = null;
  private ringX = 0;
  private ringY = 0;
  private mouseMoveHandler!: (e: MouseEvent) => void;
  private rippleTimeout: any;
  private shakeTimeout: any;
  private flashTimeout: any;

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.mouseMoveHandler = (e: MouseEvent) => {
      this.cursorX.set(e.clientX);
      this.cursorY.set(e.clientY);
      this.animateRing(e.clientX, e.clientY);
    };
    document.addEventListener('mousemove', this.mouseMoveHandler);
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.removeEventListener('mousemove', this.mouseMoveHandler);
    if (this.ringRaf) cancelAnimationFrame(this.ringRaf);
  }

  private animateRing(tx: number, ty: number): void {
    if (this.ringRaf) cancelAnimationFrame(this.ringRaf);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const tick = () => {
      this.ringX = lerp(this.ringX, tx, 0.12);
      this.ringY = lerp(this.ringY, ty, 0.12);
      this.cursorRingX.set(this.ringX);
      this.cursorRingY.set(this.ringY);
      if (Math.abs(this.ringX - tx) > 0.5 || Math.abs(this.ringY - ty) > 0.5) {
        this.ringRaf = requestAnimationFrame(tick);
      }
    };
    this.ringRaf = requestAnimationFrame(tick);
  }

  async onPress(event: MouseEvent | TouchEvent): Promise<void> {
    if (this.isPressed()) return;
    this.isPressed.set(true);
    this.isFlashing.set(true);
    this.isShaking.set(true);
    this.showRipple.set(true);
    this.justPressed.set(true);
    this.spawnBurst(event);
    await this.counter.press();
    clearTimeout(this.flashTimeout);
    this.flashTimeout = setTimeout(() => this.isFlashing.set(false), 350);
    clearTimeout(this.shakeTimeout);
    this.shakeTimeout = setTimeout(() => this.isShaking.set(false), 400);
    clearTimeout(this.rippleTimeout);
    this.rippleTimeout = setTimeout(() => this.showRipple.set(false), 700);
    setTimeout(() => this.isPressed.set(false), 350);
    setTimeout(() => this.justPressed.set(false), 1200);
  }

  private spawnBurst(_event: MouseEvent | TouchEvent): void {
    const colors = ['#ff2200', '#ff4400', '#ff6600', '#ffaa00', '#ffffff'];
    const count = 12;
    const particles: BurstParticle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 50 + Math.random() * 60;
      particles.push({
        id: ++this.particleId,
        x: `${Math.cos(angle) * dist}px`,
        y: `${Math.sin(angle) * dist}px`,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    this.burstParticles.set(particles);
    setTimeout(() => this.burstParticles.set([]), 650);
  }

  async share(): Promise<void> {
    const count = this.counter.globalCount();
    const url = window.location.href;
    const text = `The Button has been pressed ${count.toLocaleString('en-US')} times and counting. Can you resist? ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'The Button', text, url });
      } else {
        await navigator.clipboard.writeText(text);
        this.showShareToast.set(true);
        setTimeout(() => this.showShareToast.set(false), 2500);
      }
    } catch (_) {}
  }

  trackParticle(_: number, p: BurstParticle) { return p.id; }
  trackDigit(i: number, d: string) { return `${i}-${d}`; }
}
