import { Container, Graphics, Text } from 'pixi.js';
import { isoProject } from '../data/topology';

// Holographic color palette (magenta → pink → cyan → magenta)
const HOLO_COLORS = [0xff00ff, 0xff69b4, 0x00fff5, 0xff00ff];

// Large figure: 12x22 standing silhouette with flowing hair
const FIGURE_LARGE: number[][] = [
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,0,1,1,1,1,0,1,1,0],
  [1,1,0,0,1,1,1,1,0,0,1,1],
  [1,0,0,0,1,1,1,1,0,0,0,1],
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,0,0,0],
  [0,0,0,1,1,0,0,1,1,0,0,0],
  [0,0,0,1,1,0,0,1,1,0,0,0],
  [0,0,1,1,0,0,0,0,1,1,0,0],
  [0,0,1,1,0,0,0,0,1,1,0,0],
  [0,1,1,0,0,0,0,0,0,1,1,0],
  [0,1,1,0,0,0,0,0,0,1,1,0],
  [1,1,1,0,0,0,0,0,0,1,1,1],
];

// Small figure: 8x14 simplified silhouette
const FIGURE_SMALL: number[][] = [
  [0,0,0,1,1,0,0,0],
  [0,0,1,1,1,1,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,0],
  [1,1,0,1,1,0,1,1],
  [1,0,0,1,1,0,0,1],
  [0,0,0,1,1,0,0,0],
  [0,0,0,1,1,0,0,0],
  [0,0,1,1,1,1,0,0],
  [0,0,1,0,0,1,0,0],
  [0,1,1,0,0,1,1,0],
  [0,1,0,0,0,0,1,0],
  [1,1,0,0,0,0,1,1],
];

interface BillboardConfig {
  gridX: number;
  gridY: number;
  pixelSize: number;
  liftY: number;
  figure: number[][];
  tagline: string;
  labelSize: number;
  tagSize: number;
}

const BILLBOARDS: BillboardConfig[] = [
  {
    gridX: 5, gridY: 1, pixelSize: 3, liftY: 50,
    figure: FIGURE_LARGE, tagline: 'Everything you want to see',
    labelSize: 9, tagSize: 7,
  },
  {
    gridX: 0, gridY: 4, pixelSize: 2.5, liftY: 30,
    figure: FIGURE_SMALL, tagline: 'A perfect companion',
    labelSize: 7, tagSize: 5,
  },
];

interface RowGlitch {
  timer: number;
  interval: number;
  offsetX: number;
  framesLeft: number;
}

interface BillboardState {
  rowGlitches: RowGlitch[];
  flickerTimer: number;
  flickerInterval: number;
  flickerFrames: number;
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class HoloAd extends Container {
  private gfx = new Graphics();
  private labels: Text[] = [];
  private taglines: Text[] = [];
  private elapsed = 0;
  private centerX = 0;
  private centerY = 0;
  private states: BillboardState[] = [];

  constructor() {
    super();
    this.addChild(this.gfx);

    for (const bb of BILLBOARDS) {
      const label = new Text({
        text: 'JOI',
        style: {
          fontFamily: 'Orbitron, sans-serif',
          fontSize: bb.labelSize,
          fill: 0xff69b4,
          letterSpacing: 2,
        },
      });
      label.anchor.set(0.5, 1);
      label.alpha = 0.2;
      this.addChild(label);
      this.labels.push(label);

      const tag = new Text({
        text: bb.tagline,
        style: {
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: bb.tagSize,
          fontStyle: 'italic',
          fill: 0xff69b4,
          letterSpacing: 1,
        },
      });
      tag.anchor.set(0.5, 0);
      tag.alpha = 0.15;
      this.addChild(tag);
      this.taglines.push(tag);

      // Init per-billboard state
      const rows = bb.figure.length;
      const rowGlitches: RowGlitch[] = [];
      for (let r = 0; r < rows; r++) {
        rowGlitches.push({
          timer: randomRange(0, 5),
          interval: randomRange(3, 8),
          offsetX: 0,
          framesLeft: 0,
        });
      }
      this.states.push({
        rowGlitches,
        flickerTimer: randomRange(0, 8),
        flickerInterval: randomRange(8, 15),
        flickerFrames: 0,
      });
    }
  }

  init(centerX: number, centerY: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    this.positionLabels();
  }

  reposition(centerX: number, centerY: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    this.positionLabels();
  }

  private positionLabels(): void {
    for (let i = 0; i < BILLBOARDS.length; i++) {
      const bb = BILLBOARDS[i];
      const pos = isoProject(bb.gridX, bb.gridY, this.centerX, this.centerY);
      const figH = bb.figure.length * bb.pixelSize;
      const figW = bb.figure[0].length * bb.pixelSize;
      const baseX = pos.x - figW / 2;
      const baseY = pos.y - bb.liftY - figH;

      this.labels[i].position.set(baseX + figW / 2, baseY - 4);
      this.taglines[i].position.set(baseX + figW / 2, pos.y - bb.liftY + 4);
    }
  }

  update(dt: number): void {
    this.elapsed += dt * 0.02;
    this.gfx.clear();

    // Color cycling: lerp through HOLO_COLORS over ~10s
    const cyclePos = (this.elapsed * 0.3) % (HOLO_COLORS.length - 1);
    const segIdx = Math.floor(cyclePos);
    const segT = cyclePos - segIdx;
    const color = lerpColor(HOLO_COLORS[segIdx], HOLO_COLORS[segIdx + 1], segT);

    // Global alpha pulse
    const baseAlpha = 0.2 + Math.sin(this.elapsed * 1.2) * 0.08;

    for (let i = 0; i < BILLBOARDS.length; i++) {
      const bb = BILLBOARDS[i];
      const state = this.states[i];
      const pos = isoProject(bb.gridX, bb.gridY, this.centerX, this.centerY);
      const figH = bb.figure.length * bb.pixelSize;
      const figW = bb.figure[0].length * bb.pixelSize;
      const originX = pos.x - figW / 2;
      const originY = pos.y - bb.liftY - figH;

      // Full flicker check
      state.flickerTimer += dt * 0.02;
      let flickerAlpha = 1;
      if (state.flickerFrames > 0) {
        flickerAlpha = 0.03 / baseAlpha; // Result in ~0.03 effective alpha
        state.flickerFrames--;
      } else if (state.flickerTimer >= state.flickerInterval) {
        state.flickerTimer = 0;
        state.flickerInterval = randomRange(8, 15);
        state.flickerFrames = 8;
      }

      // Update row glitches
      for (const rg of state.rowGlitches) {
        rg.timer += dt * 0.02;
        if (rg.framesLeft > 0) {
          rg.framesLeft--;
          if (rg.framesLeft === 0) rg.offsetX = 0;
        } else if (rg.timer >= rg.interval) {
          rg.timer = 0;
          rg.interval = randomRange(3, 8);
          rg.offsetX = (Math.random() > 0.5 ? 1 : -1) * 4;
          rg.framesLeft = Math.floor(randomRange(3, 6));
        }
      }

      // Draw projection base triangle (faint)
      this.gfx
        .poly([
          originX + figW * 0.3, pos.y - bb.liftY,
          originX + figW * 0.7, pos.y - bb.liftY,
          pos.x + 15, pos.y + 8,
          pos.x - 15, pos.y + 8,
        ])
        .fill({ color, alpha: 0.04 });

      // Draw frame border
      this.gfx
        .rect(originX - 3, originY - 3, figW + 6, figH + 6)
        .stroke({ color, alpha: 0.12, width: 1 });

      // Draw pixel figure
      for (let r = 0; r < bb.figure.length; r++) {
        const row = bb.figure[r];
        const rg = state.rowGlitches[r];
        const scanlineAlpha = r % 2 === 0 ? 1 : 0.7;
        const rowAlpha = baseAlpha * scanlineAlpha * flickerAlpha;

        for (let c = 0; c < row.length; c++) {
          if (row[c] === 0) continue;
          const px = originX + c * bb.pixelSize + rg.offsetX;
          const py = originY + r * bb.pixelSize;
          this.gfx
            .rect(px, py, bb.pixelSize, bb.pixelSize)
            .fill({ color, alpha: rowAlpha });
        }
      }

      // Update label colors and alpha
      const labelAlpha = 0.2 * flickerAlpha;
      const tagAlpha = 0.15 * flickerAlpha;
      this.labels[i].alpha = labelAlpha;
      this.labels[i].style.fill = color;
      this.taglines[i].alpha = tagAlpha;
      this.taglines[i].style.fill = color;
    }
  }
}
