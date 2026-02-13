import { Container, Graphics, Text, Ticker } from 'pixi.js';
import type { InfraNodeConfig, ServiceStatus } from '../data/types';
import { isoProject } from '../data/topology';

const STATUS_COLORS: Record<ServiceStatus, number> = {
  healthy: 0x00ff64,
  degraded: 0xffd93d,
  down: 0xff0044,
  unknown: 0x555577,
};

const BUILDING_WIDTH = 60;
const BUILDING_DEPTH = 40;

function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

export class InfraNode extends Container {
  readonly config: InfraNodeConfig;
  private building = new Graphics();
  private glow = new Graphics();
  private healthDot = new Graphics();
  private nameLabel: Text;
  private currentStatus: ServiceStatus = 'unknown';
  private elapsed = 0;
  screenX = 0;
  screenY = 0;

  constructor(config: InfraNodeConfig) {
    super();
    this.config = config;

    this.addChild(this.glow);
    this.addChild(this.building);
    this.addChild(this.healthDot);

    this.nameLabel = new Text({
      text: config.label,
      style: {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 11,
        fontWeight: '700',
        fill: config.color,
        letterSpacing: 2,
      },
    });
    this.nameLabel.anchor.set(0.5, 1);
    this.addChild(this.nameLabel);

    Ticker.shared.add(this.animate, this);
  }

  positionAt(centerX: number, centerY: number): void {
    const pos = isoProject(this.config.gridX, this.config.gridY, centerX, centerY);
    this.screenX = pos.x;
    this.screenY = pos.y;
    this.position.set(0, 0);
    this.drawBuilding();
  }

  get topCenter(): { x: number; y: number } {
    return { x: this.screenX, y: this.screenY - this.config.buildingHeight };
  }

  setHealth(status: ServiceStatus): void {
    this.currentStatus = status;
    this.drawHealthDot();
  }

  private drawBuilding(): void {
    const { color, buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;
    const hd = BUILDING_DEPTH / 2;

    this.building.clear();

    // Top face
    this.building
      .poly([x, y - h - hd, x + hw, y - h, x, y - h + hd, x - hw, y - h])
      .fill({ color: shade(color, 0.9), alpha: 0.85 });

    // Left face
    this.building
      .poly([x - hw, y - h, x, y - h + hd, x, y + hd, x - hw, y])
      .fill({ color: shade(color, 0.5), alpha: 0.85 });

    // Right face
    this.building
      .poly([x + hw, y - h, x, y - h + hd, x, y + hd, x + hw, y])
      .fill({ color: shade(color, 0.35), alpha: 0.85 });

    // Edges
    const edgeColor = color;
    const edgeAlpha = 0.4;
    this.building
      .moveTo(x, y - h - hd).lineTo(x + hw, y - h).lineTo(x, y - h + hd).lineTo(x - hw, y - h).closePath()
      .stroke({ color: edgeColor, alpha: edgeAlpha, width: 1 })
      .moveTo(x - hw, y - h).lineTo(x - hw, y)
      .stroke({ color: edgeColor, alpha: edgeAlpha, width: 1 })
      .moveTo(x + hw, y - h).lineTo(x + hw, y)
      .stroke({ color: edgeColor, alpha: edgeAlpha, width: 1 })
      .moveTo(x, y - h + hd).lineTo(x, y + hd)
      .stroke({ color: edgeColor, alpha: edgeAlpha, width: 1 })
      .moveTo(x - hw, y).lineTo(x, y + hd).lineTo(x + hw, y)
      .stroke({ color: edgeColor, alpha: edgeAlpha, width: 1 });

    // Glow layer
    this.glow.clear();
    this.glow
      .poly([x, y - h - hd, x + hw, y - h, x, y - h + hd, x - hw, y - h])
      .fill({ color, alpha: 0.15 });

    // Label
    this.nameLabel.position.set(x, y - h - hd - 12);

    this.drawHealthDot();
  }

  private drawHealthDot(): void {
    const x = this.screenX;
    const y = this.screenY - this.config.buildingHeight;
    this.healthDot.clear();
    this.healthDot
      .circle(x, y, 5)
      .fill({ color: STATUS_COLORS[this.currentStatus], alpha: 0.9 });
    // Outer glow ring
    this.healthDot
      .circle(x, y, 8)
      .stroke({ color: STATUS_COLORS[this.currentStatus], alpha: 0.3, width: 2 });
  }

  private animate = (ticker: Ticker): void => {
    this.elapsed += ticker.deltaTime * 0.02;
    const pulse = 0.1 + Math.sin(this.elapsed * 2) * 0.08;
    this.glow.alpha = pulse;
  };

  destroy(): void {
    Ticker.shared.remove(this.animate, this);
    super.destroy({ children: true });
  }
}
