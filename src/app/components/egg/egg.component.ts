import { Component, input, computed } from '@angular/core';

interface CrackStage {
  cracks: string[];
  color: string;
  shine: string;
}

const CRACK_STAGES: CrackStage[] = [
  // Stage 0 — pristine
  { cracks: [], color: '#FFF8DC', shine: '#FFFACD' },
  // Stage 1 — hairline crack
  { cracks: ['M 120 80 L 115 95'], color: '#FFF5C8', shine: '#FFF8DC' },
  // Stage 2 — small crack network
  { cracks: ['M 120 80 L 115 95', 'M 115 95 L 125 110', 'M 140 100 L 145 115 L 138 125'], color: '#FFF0B8', shine: '#FFF5C8' },
  // Stage 3 — visible fractures
  { cracks: ['M 120 80 L 115 95 L 125 110 L 118 130', 'M 140 100 L 145 115 L 138 125 L 148 140', 'M 100 130 L 95 145'], color: '#FFEA99', shine: '#FFF0B8' },
  // Stage 4 — deep cracks, wobbles
  { cracks: ['M 120 80 L 115 95 L 125 110 L 118 130 L 128 150', 'M 140 100 L 145 115 L 138 125 L 148 140', 'M 100 130 L 95 145 L 105 158', 'M 155 130 L 162 145'], color: '#FFE070', shine: '#FFEA99' },
  // Stage 5 — shell fragmenting
  { cracks: ['M 120 80 L 115 95 L 125 110 L 118 130 L 128 150 L 120 165', 'M 140 100 L 145 115 L 138 125 L 148 140 L 142 155', 'M 100 130 L 95 145 L 105 158 L 98 170', 'M 155 130 L 162 145 L 158 160', 'M 80 110 L 75 125'], color: '#FFD93D', shine: '#FFE070' },
  // Stage 6 — pieces falling off
  { cracks: ['M 120 80 L 115 95 L 125 110 L 118 130 L 128 150 L 120 165 L 130 175', 'M 140 100 L 145 115 L 138 125 L 148 140 L 142 155 L 152 165', 'M 100 130 L 95 145 L 105 158 L 98 170 L 108 178', 'M 155 130 L 162 145 L 158 160 L 165 172', 'M 80 110 L 75 125 L 82 138'], color: '#FFCA28', shine: '#FFD93D' },
  // Stage 7 — barely holding
  { cracks: ['M 120 80 L 115 95 L 125 110 L 118 130 L 128 150 L 120 165 L 130 175', 'M 140 100 L 145 115 L 138 125 L 148 140 L 142 155 L 152 165', 'M 100 130 L 95 145 L 105 158 L 98 170 L 108 178', 'M 155 130 L 162 145 L 158 160 L 165 172', 'M 80 110 L 75 125 L 82 138 L 76 150', 'M 160 90 L 168 105 L 162 118'], color: '#FFB300', shine: '#FFCA28' },
  // Stage 8 — one click away (pulsing glow)
  { cracks: ['M 120 80 L 115 95 L 125 110 L 118 130 L 128 150 L 120 165 L 130 175', 'M 140 100 L 145 115 L 138 125 L 148 140 L 142 155 L 152 165 L 145 178', 'M 100 130 L 95 145 L 105 158 L 98 170 L 108 178 L 102 188', 'M 155 130 L 162 145 L 158 160 L 165 172 L 160 182', 'M 80 110 L 75 125 L 82 138 L 76 150 L 84 162', 'M 160 90 L 168 105 L 162 118 L 170 130', 'M 105 90 L 100 105 L 108 115'], color: '#FF8F00', shine: '#FFB300' },
];

@Component({
  selector: 'app-egg',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size() * 1.25"
      viewBox="0 0 240 300"
      [class.hatching]="stage() >= 8"
    >
      <defs>
        <radialGradient [attr.id]="gradId" cx="38%" cy="32%" r="65%">
          <stop offset="0%" [attr.stop-color]="stageData().shine" />
          <stop offset="60%" [attr.stop-color]="stageData().color" />
          <stop offset="100%" stop-color="#E8C84A" />
        </radialGradient>
        <radialGradient [attr.id]="shineId" cx="30%" cy="25%" r="35%">
          <stop offset="0%" stop-color="rgba(255,255,255,0.7)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      <!-- Egg body -->
      <ellipse cx="120" cy="155" rx="95" ry="120" [attr.fill]="'url(#' + gradId + ')'" />

      <!-- Cracks -->
      @for (crack of stageData().cracks; track $index) {
        <g>
          <path [attr.d]="crack" stroke="rgba(0,0,0,0.15)" stroke-width="5" fill="none" stroke-linecap="round" />
          <path [attr.d]="crack" stroke="rgba(0,0,0,0.3)" stroke-width="3" fill="none" stroke-linecap="round" />
        </g>
      }

      <!-- Shine -->
      <ellipse cx="88" cy="105" rx="32" ry="22" [attr.fill]="'url(#' + shineId + ')'" />

      <!-- Stage 8 glow ring -->
      @if (stage() >= 8) {
        <ellipse cx="120" cy="155" rx="95" ry="120" fill="none" stroke="rgba(255,107,0,0.3)" stroke-width="4" />
      }
    </svg>
  `,
  styles: [`
    :host { display: inline-block; }
    svg { display: block; }

    @keyframes hatch-shake {
      0%, 100% { transform: rotate(0deg); }
      15% { transform: rotate(-8deg) scale(1.05); }
      30% { transform: rotate(8deg) scale(1.08); }
      45% { transform: rotate(-6deg) scale(1.05); }
      60% { transform: rotate(6deg) scale(1.03); }
      75% { transform: rotate(-3deg); }
    }
    .hatching { animation: hatch-shake 0.6s ease infinite; }
  `],
})
export class EggComponent {
  readonly stage = input<number>(0);
  readonly size = input<number>(200);

  // Unique gradient IDs so multiple instances don't conflict
  readonly gradId = 'eggGrad-' + Math.random().toString(36).slice(2, 7);
  readonly shineId = 'eggShine-' + Math.random().toString(36).slice(2, 7);

  readonly stageData = computed(() => CRACK_STAGES[Math.min(this.stage(), 8)]);
}
