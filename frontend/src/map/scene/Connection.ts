import { Container, Graphics, Text } from 'pixi.js';
import type { ConnectionConfig, NodeId } from '../data/types';

export class Connection extends Container {
  readonly config: ConnectionConfig;
  private line = new Graphics();
  private labelText: Text;
  startX = 0;
  startY = 0;
  endX = 0;
  endY = 0;
  private pulseAlpha = 0;

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
    this.addChild(this.line);

    this.labelText = new Text({
      text: config.label,
      style: {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 9,
        fill: 0xffffff,
        letterSpacing: 1,
      },
    });
    this.labelText.anchor.set(0.5, 0.5);
    this.labelText.alpha = 0.3;
    this.addChild(this.labelText);
  }

  setEndpoints(start: { x: number; y: number }, end: { x: number; y: number }): void {
    this.startX = start.x;
    this.startY = start.y;
    this.endX = end.x;
    this.endY = end.y;
    this.draw();
  }

  pulse(): void {
    this.pulseAlpha = 0.6;
  }

  update(dt: number): void {
    if (this.pulseAlpha > 0.15) {
      this.pulseAlpha -= dt * 0.01;
      this.draw();
    }
  }

  private draw(): void {
    this.line.clear();

    const alpha = Math.max(0.12, this.pulseAlpha);
    const color = 0x00fff5;

    // Dashed line
    const dx = this.endX - this.startX;
    const dy = this.endY - this.startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const dashLen = 8;
    const gapLen = 6;
    const steps = Math.floor(len / (dashLen + gapLen));
    const ux = dx / len;
    const uy = dy / len;

    for (let i = 0; i < steps; i++) {
      const sx = this.startX + ux * i * (dashLen + gapLen);
      const sy = this.startY + uy * i * (dashLen + gapLen);
      const ex = sx + ux * dashLen;
      const ey = sy + uy * dashLen;
      this.line.moveTo(sx, sy).lineTo(ex, ey).stroke({ color, alpha, width: 1.5 });
    }

    // Label at midpoint
    this.labelText.position.set(
      (this.startX + this.endX) / 2,
      (this.startY + this.endY) / 2 - 10,
    );
  }
}
