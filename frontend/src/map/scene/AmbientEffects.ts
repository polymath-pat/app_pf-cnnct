import { Container, Graphics, Text } from 'pixi.js';

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: number;
  phase: number;
  isDove?: boolean;
}

const COLORS = [0x00fff5, 0x00ff64, 0xff00ff, 0xffd93d, 0x4ecdc4, 0xff6b6b];

export class AmbientEffects extends Container {
  private gfx = new Graphics();
  private particles: AmbientParticle[] = [];
  private viewWidth = 0;
  private viewHeight = 0;
  private elapsed = 0;
  private doveTimer = 0;
  private tearsTimer = 0;
  private tearsText: Text;
  private tearsPhase: 'idle' | 'fadein' | 'hold' | 'fadeout' = 'idle';
  private tearsPhaseTime = 0;

  constructor() {
    super();
    this.addChild(this.gfx);

    this.tearsText = new Text({
      text: 'Like tears in rain...',
      style: {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 14,
        fill: 0x8899bb,
        fontStyle: 'italic',
        letterSpacing: 2,
      },
    });
    this.tearsText.anchor.set(0.5, 0.5);
    this.tearsText.alpha = 0;
    this.addChild(this.tearsText);
  }

  init(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.particles = [];

    for (let i = 0; i < 70; i++) {
      this.particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: -(0.1 + Math.random() * 0.3),
        alpha: 0.05 + Math.random() * 0.15,
        size: 1 + Math.random() * 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Position tears text
    this.tearsText.position.set(width * 0.7, height * 0.85);
  }

  update(dt: number): void {
    this.elapsed += dt * 0.02;
    this.gfx.clear();

    for (const p of this.particles) {
      p.phase += 0.01 * dt;
      p.x += Math.sin(p.phase) * 0.3;
      p.y += p.vy * dt;

      if (p.isDove) {
        // Dove rises faster with wider wobble, fades via sine
        p.x += Math.sin(p.phase * 2) * 0.8;
        const peakAlpha = p.size >= 6 ? 0.5 : 0.3; // boosted doves are brighter
        p.alpha = peakAlpha * Math.max(0, Math.sin((p.y / this.viewHeight) * Math.PI));
        if (p.y < -20) {
          // Remove dove particle by resetting to normal
          p.isDove = false;
          p.y = this.viewHeight + 10;
          p.x = Math.random() * this.viewWidth;
          p.size = 1 + Math.random() * 2;
          p.vy = -(0.1 + Math.random() * 0.3);
          p.alpha = 0.05 + Math.random() * 0.15;
          p.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        }
      } else {
        if (p.y < -10) {
          p.y = this.viewHeight + 10;
          p.x = Math.random() * this.viewWidth;
        }
      }

      this.gfx
        .circle(p.x, p.y, p.size)
        .fill({ color: p.color, alpha: p.alpha });
    }

    // Dove particle every ~90s
    this.doveTimer += dt * 0.02;
    if (this.doveTimer >= 90) {
      this.doveTimer = 0;
      this.spawnDove();
    }

    // "Like tears in rain..." text every ~120s
    this.tearsTimer += dt * 0.02;
    if (this.tearsPhase === 'idle' && this.tearsTimer >= 120) {
      this.tearsTimer = 0;
      this.tearsPhase = 'fadein';
      this.tearsPhaseTime = 0;
    }

    this.updateTearsText(dt);
  }

  triggerDove(): void {
    // Spawn multiple brighter doves for a noticeable effect
    for (let i = 0; i < 3; i++) {
      this.spawnDove(true);
    }
  }

  triggerTears(): void {
    // Force trigger even if already showing — restart the cycle
    this.tearsPhase = 'fadein';
    this.tearsPhaseTime = 0;
  }

  private spawnDove(boosted = false): void {
    // Convert one particle into a dove
    const p = this.particles[Math.floor(Math.random() * this.particles.length)];
    p.isDove = true;
    p.x = this.viewWidth * (0.3 + Math.random() * 0.4);
    p.y = this.viewHeight * 0.8;
    p.vy = -(0.8 + Math.random() * 0.4);
    p.size = boosted ? 6 : 4;
    p.color = 0xffffff;
    p.alpha = boosted ? 0.5 : 0.3;
    p.phase = Math.random() * Math.PI * 2;
  }

  private updateTearsText(dt: number): void {
    if (this.tearsPhase === 'idle') return;

    this.tearsPhaseTime += dt * 0.02;

    if (this.tearsPhase === 'fadein') {
      const progress = Math.min(this.tearsPhaseTime / 2, 1);
      this.tearsText.alpha = progress * 0.40;
      if (progress >= 1) {
        this.tearsPhase = 'hold';
        this.tearsPhaseTime = 0;
      }
    } else if (this.tearsPhase === 'hold') {
      this.tearsText.alpha = 0.40;
      if (this.tearsPhaseTime >= 5) {
        this.tearsPhase = 'fadeout';
        this.tearsPhaseTime = 0;
      }
    } else if (this.tearsPhase === 'fadeout') {
      const progress = Math.min(this.tearsPhaseTime / 2, 1);
      this.tearsText.alpha = 0.40 * (1 - progress);
      if (progress >= 1) {
        this.tearsPhase = 'idle';
        this.tearsText.alpha = 0;
      }
    }
  }

  resize(width: number, height: number): void {
    this.viewWidth = width;
    this.viewHeight = height;
    this.tearsText.position.set(width * 0.7, height * 0.85);
  }
}
