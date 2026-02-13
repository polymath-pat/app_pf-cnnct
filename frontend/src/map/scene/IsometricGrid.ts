import { Graphics, Container } from 'pixi.js';
import { TILE_WIDTH, TILE_HEIGHT, isoProject } from '../data/topology';

const GRID_EXTENT = 6;
const LINE_COLOR = 0x00fff5;
const LINE_ALPHA = 0.06;

export class IsometricGrid extends Container {
  private gfx = new Graphics();
  centerX = 0;
  centerY = 0;

  constructor() {
    super();
    this.addChild(this.gfx);
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
  }
}
