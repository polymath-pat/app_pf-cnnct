import { Graphics, Text, Container } from 'pixi.js';
import { TILE_WIDTH, TILE_HEIGHT, isoProject } from '../data/topology';

const GRID_EXTENT = 6;
const LINE_COLOR = 0x00fff5;
const LINE_ALPHA = 0.06;

export class IsometricGrid extends Container {
  private gfx = new Graphics();
  private silkscreen: Text;
  centerX = 0;
  centerY = 0;

  constructor() {
    super();
    this.addChild(this.gfx);

    this.silkscreen = new Text({
      text: 'PCB-CNNCT-01',
      style: {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 7,
        fill: 0x00fff5,
        letterSpacing: 1,
      },
    });
    this.silkscreen.alpha = 0.06;
    this.addChild(this.silkscreen);
  }

  draw(centerX: number, centerY: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    this.gfx.clear();

    for (let i = -1; i <= GRID_EXTENT; i++) {
      const a = isoProject(i, -1, centerX, centerY);
      const b = isoProject(i, GRID_EXTENT, centerX, centerY);
      this.gfx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: LINE_COLOR, alpha: LINE_ALPHA, width: 1 });
    }

    for (let j = -1; j <= GRID_EXTENT; j++) {
      const a = isoProject(-1, j, centerX, centerY);
      const b = isoProject(GRID_EXTENT, j, centerX, centerY);
      this.gfx.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: LINE_COLOR, alpha: LINE_ALPHA, width: 1 });
    }

    // Diamond outline
    const corners = [
      isoProject(-1, -1, centerX, centerY),
      isoProject(GRID_EXTENT, -1, centerX, centerY),
      isoProject(GRID_EXTENT, GRID_EXTENT, centerX, centerY),
      isoProject(-1, GRID_EXTENT, centerX, centerY),
    ];
    this.gfx
      .moveTo(corners[0].x, corners[0].y)
      .lineTo(corners[1].x, corners[1].y)
      .lineTo(corners[2].x, corners[2].y)
      .lineTo(corners[3].x, corners[3].y)
      .closePath()
      .stroke({ color: LINE_COLOR, alpha: LINE_ALPHA * 2, width: 1 });

    // PCB test points at deterministic grid intersections
    for (let i = 0; i <= GRID_EXTENT; i++) {
      for (let j = 0; j <= GRID_EXTENT; j++) {
        // Only draw at a subset of intersections for subtlety
        if ((i + j) % 3 !== 0) continue;
        const pt = isoProject(i, j, centerX, centerY);
        this.gfx
          .circle(pt.x, pt.y, 2)
          .fill({ color: LINE_COLOR, alpha: 0.08 });
      }
    }

    // Silkscreen reference text in lower-right area
    const silkPos = isoProject(GRID_EXTENT - 1, GRID_EXTENT, centerX, centerY);
    this.silkscreen.position.set(silkPos.x - 30, silkPos.y + 8);
  }
}
