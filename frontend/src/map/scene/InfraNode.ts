import { Container, Graphics, Text, Ticker, Polygon } from 'pixi.js';
import type { InfraNodeConfig, ServiceStatus } from '../data/types';
import { isoProject } from '../data/topology';

const STATUS_COLORS: Record<ServiceStatus, number> = {
  healthy: 0x00ff64,
  degraded: 0xffd93d,
  down: 0xff0044,
  unknown: 0x555577,
};

const STATUS_LABELS: Record<ServiceStatus, string> = {
  healthy: 'HEALTHY',
  degraded: 'DEGRADED',
  down: 'DOWN',
  unknown: 'UNKNOWN',
};

const BUILDING_WIDTH = 60;
const BUILDING_DEPTH = 40;

const WINDOW_COLORS = [0xffd93d, 0xffee88, 0xff8800, 0x00fff5, 0xffffff];

function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export class InfraNode extends Container {
  readonly config: InfraNodeConfig;
  private building = new Graphics();
  private glow = new Graphics();
  private healthDot = new Graphics();
  private serviceDetails = new Graphics();
  private serviceAnim = new Graphics();
  private replicantEye = new Graphics();
  private nameLabel: Text;
  private tooltipContainer = new Container();
  private tooltipBg = new Graphics();
  private tooltipName: Text;
  private tooltipStatus: Text;
  private currentStatus: ServiceStatus = 'unknown';
  private latencyMs: number | null = null;
  private elapsed = 0;
  private hovered = false;
  private eyeTimer = 0;
  private eyeAlpha = 0.05;
  private ledTimer = 0;
  private scanLineOffset = 0;
  private signalPulse = 0;
  screenX = 0;
  screenY = 0;

  constructor(config: InfraNodeConfig) {
    super();
    this.config = config;

    this.addChild(this.glow);
    this.addChild(this.building);
    this.addChild(this.serviceDetails);
    this.addChild(this.serviceAnim);
    this.addChild(this.healthDot);

    // Replicant eye (backend node only)
    if (config.id === 'backend') {
      this.addChild(this.replicantEye);
    }

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
    this.nameLabel.visible = false;
    this.addChild(this.nameLabel);

    // Tooltip
    this.tooltipName = new Text({
      text: config.label,
      style: {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: 10,
        fontWeight: '700',
        fill: config.color,
        letterSpacing: 1,
      },
    });
    this.tooltipName.anchor.set(0.5, 1);

    this.tooltipStatus = new Text({
      text: 'UNKNOWN',
      style: {
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 9,
        fill: STATUS_COLORS.unknown,
        letterSpacing: 1,
      },
    });
    this.tooltipStatus.anchor.set(0.5, 1);

    this.tooltipContainer.addChild(this.tooltipBg);
    this.tooltipContainer.addChild(this.tooltipName);
    this.tooltipContainer.addChild(this.tooltipStatus);
    this.tooltipContainer.visible = false;
    this.addChild(this.tooltipContainer);

    // Hover interactivity
    this.eventMode = 'static';
    this.on('pointerenter', () => { this.hovered = true; this.tooltipContainer.visible = true; });
    this.on('pointerleave', () => { this.hovered = false; this.tooltipContainer.visible = false; });

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

  setHealth(status: ServiceStatus, latencyMs?: number): void {
    this.currentStatus = status;
    this.latencyMs = latencyMs ?? null;
    this.drawHealthDot();
    this.updateTooltip();
  }

  // ─── Base building ───────────────────────────────────────────────────

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
    const ea = 0.4;
    this.building
      .moveTo(x, y - h - hd).lineTo(x + hw, y - h).lineTo(x, y - h + hd).lineTo(x - hw, y - h).closePath()
      .stroke({ color, alpha: ea, width: 1 })
      .moveTo(x - hw, y - h).lineTo(x - hw, y)
      .stroke({ color, alpha: ea, width: 1 })
      .moveTo(x + hw, y - h).lineTo(x + hw, y)
      .stroke({ color, alpha: ea, width: 1 })
      .moveTo(x, y - h + hd).lineTo(x, y + hd)
      .stroke({ color, alpha: ea, width: 1 })
      .moveTo(x - hw, y).lineTo(x, y + hd).lineTo(x + hw, y)
      .stroke({ color, alpha: ea, width: 1 });

    // Glow layer
    this.glow.clear();
    this.glow
      .poly([x, y - h - hd, x + hw, y - h, x, y - h + hd, x - hw, y - h])
      .fill({ color, alpha: 0.15 });

    // Shared + per-service visuals
    this.drawServiceDetails();

    // Replicant eye on backend node
    if (this.config.id === 'backend') {
      this.drawReplicantEye();
    }

    // Hit area
    this.hitArea = new Polygon([
      x, y - h - hd,
      x + hw, y - h,
      x + hw, y,
      x, y + hd,
      x - hw, y,
      x - hw, y - h,
    ]);

    // Label
    const labelOffset = this.config.id === 'dns' ? 32 : 12;
    this.nameLabel.position.set(x, y - h - hd - labelOffset);

    // Tooltip position
    const tooltipTop = y - h - hd - labelOffset;
    this.tooltipName.position.set(x, tooltipTop - 12);
    this.tooltipStatus.position.set(x, tooltipTop);
    this.drawTooltipBg();

    this.drawHealthDot();
    this.updateTooltip();
  }

  // ─── Shared visual upgrades ──────────────────────────────────────────

  private drawWindowGrid(face: 'left' | 'right'): void {
    const { buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;
    const hd = BUILDING_DEPTH / 2;

    const seed = Math.round(this.config.gridX * 1000 + this.config.gridY * 7777 + (face === 'right' ? 999 : 0));
    const rand = seededRand(seed);

    const rowSpacing = 8;
    const colSpacing = 6;
    const rows = Math.floor(h / rowSpacing);
    const cols = Math.max(2, Math.floor((hw + hd) / colSpacing));

    for (let row = 1; row < rows; row++) {
      const frac = row / rows;
      const wy = y - h + h * frac;
      for (let col = 0; col < cols; col++) {
        if (rand() < 0.25) continue;

        const colFrac = (col + 0.5) / cols;
        let wx: number, skewY: number;
        if (face === 'left') {
          wx = x - hw + hw * colFrac;
          skewY = wy + hd * (1 - colFrac);
        } else {
          wx = x + hw * colFrac;
          skewY = wy + hd * colFrac;
        }

        const windowColor = WINDOW_COLORS[Math.floor(rand() * WINDOW_COLORS.length)];
        const windowAlpha = 0.25 + rand() * 0.20;
        this.serviceDetails
          .rect(wx - 1, skewY - 1, 2, 2)
          .fill({ color: windowColor, alpha: windowAlpha });
      }
    }
  }

  private drawNeonStripes(): void {
    const { color, buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;
    const hd = BUILDING_DEPTH / 2;

    const seed = Math.round(this.config.gridX * 1234 + this.config.gridY * 5678);
    const stripeCount = 2 + (seed % 2);

    for (let s = 0; s < stripeCount; s++) {
      const frac = 0.25 + (((seed + s * 37) % 50) / 100);
      const stripeAlpha = 0.20 + ((seed + s) % 10) * 0.01;
      const stripeY = y - h + h * frac;
      const ly = stripeY + hd;

      // Left face
      this.serviceDetails
        .poly([x - hw, stripeY, x, ly, x, ly + 2, x - hw, stripeY + 2])
        .fill({ color, alpha: stripeAlpha });

      // Right face
      this.serviceDetails
        .poly([x + hw, stripeY, x, ly, x, ly + 2, x + hw, stripeY + 2])
        .fill({ color, alpha: stripeAlpha });
    }
  }

  // ─── Per-service thematic details ────────────────────────────────────

  private drawServiceDetails(): void {
    this.serviceDetails.clear();

    // Shared upgrades on all nodes
    this.drawWindowGrid('left');
    this.drawWindowGrid('right');
    this.drawNeonStripes();

    // Per-service dispatch
    const { id } = this.config;
    switch (id) {
      case 'frontend':  this.themeFrontend();   break;
      case 'backend':   this.themeBackend();    break;
      case 'valkey':    this.themeValkey();      break;
      case 'postgres':  this.themePostgres();    break;
      case 'opensearch': this.themeOpenSearch(); break;
      case 'dns':       this.themeDns();         break;
    }
  }

  /** Frontend — monitor screen with code lines, browser tab, WiFi arcs */
  private themeFrontend(): void {
    const { color, buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;

    // Right face — large screen
    const sx = x + hw * 0.12;
    const sy = y - h * 0.82;
    const sw = hw * 0.7;
    const sh = h * 0.55;

    // Screen backlight bleed glow
    this.serviceDetails
      .rect(sx - 3, sy - 3, sw + 6, sh + 6)
      .fill({ color, alpha: 0.06 });

    // Bezel
    this.serviceDetails
      .rect(sx - 1, sy - 1, sw + 2, sh + 2)
      .fill({ color: shade(color, 0.3), alpha: 0.5 });
    // Screen background
    this.serviceDetails
      .rect(sx, sy, sw, sh)
      .fill({ color: 0x020815, alpha: 0.85 });
    // Glow border
    this.serviceDetails
      .rect(sx, sy, sw, sh)
      .stroke({ color, alpha: 0.8, width: 1.5 });

    // Code lines — alternating cyan/green
    const lineLengths = [0.85, 0.6, 0.75, 0.45, 0.9, 0.5, 0.7, 0.55];
    const lineColors = [color, 0x00ff64, color, 0x00fff5, color, 0x00ff64, color, 0x00fff5];
    for (let i = 0; i < lineLengths.length; i++) {
      const ly = sy + 4 + i * (sh / 9);
      if (ly > sy + sh - 3) break;
      this.serviceDetails
        .moveTo(sx + 3, ly)
        .lineTo(sx + 3 + (sw - 6) * lineLengths[i], ly)
        .stroke({ color: lineColors[i], alpha: 0.35, width: 1 });
    }

    // Blinking cursor dot at end of line 2
    const cursorLineY = sy + 4 + 1 * (sh / 9);
    const cursorLineX = sx + 3 + (sw - 6) * lineLengths[1];
    this.serviceDetails
      .rect(cursorLineX + 1, cursorLineY - 1, 2, 2)
      .fill({ color, alpha: 0.5 });

    // Left face — browser tab indicator
    const tabX = x - hw * 0.8;
    const tabY = y - h * 0.85;
    this.serviceDetails
      .rect(tabX, tabY, hw * 0.5, 3)
      .fill({ color, alpha: 0.4 });
    this.serviceDetails
      .rect(tabX, tabY, hw * 0.15, 3)
      .fill({ color, alpha: 0.65 });

    // Rooftop — WiFi arcs + antenna dot
    const topY = y - h - BUILDING_DEPTH / 2;
    this.serviceDetails
      .circle(x, topY - 2, 1.5)
      .fill({ color, alpha: 0.5 });
    for (let i = 1; i <= 3; i++) {
      const r = 2 + i * 2.5;
      const startAngle = -Math.PI * 0.8;
      this.serviceDetails
        .moveTo(x + Math.cos(startAngle) * r, topY - 2 + Math.sin(startAngle) * r)
        .arc(x, topY - 2, r, startAngle, -Math.PI * 0.2)
        .stroke({ color, alpha: 0.45 - i * 0.08, width: 1.5 });
    }
  }

  /** Backend — server rack bays, LEDs, circuit traces, vent */
  private themeBackend(): void {
    const { color, buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;

    // Left face — rack unit bays
    const rackLeft = x - hw * 0.85;
    const rackRight = x - hw * 0.1;
    const rackTop = y - h * 0.9;

    for (let i = 0; i < 8; i++) {
      const ry = rackTop + i * (h * 0.09);
      this.serviceDetails
        .moveTo(rackLeft, ry)
        .lineTo(rackRight, ry)
        .stroke({ color, alpha: 0.35, width: 0.5 });
      if (i < 7) {
        const bayAlpha = i % 2 === 0 ? 0.14 : 0.08;
        this.serviceDetails
          .rect(rackLeft, ry, rackRight - rackLeft, h * 0.09)
          .fill({ color, alpha: bayAlpha });
      }
    }

    // LED column — left side (static base — animated overlay in animBackend)
    const ledColors = [0x00ff64, 0xffd93d, 0xff4444, 0x00ff64, 0x00fff5];
    for (let i = 0; i < ledColors.length; i++) {
      const ly = rackTop + 4 + i * (h * 0.14);
      this.serviceDetails
        .circle(rackRight + 4, ly, 1.5)
        .fill({ color: ledColors[i], alpha: 0.25 });
    }

    // Right face — circuit traces
    const traceX = x + hw * 0.2;
    for (let i = 0; i < 4; i++) {
      const ty = y - h * 0.75 + i * 12;
      const tw = 6 + (i % 3) * 4;
      this.serviceDetails
        .moveTo(traceX, ty)
        .lineTo(traceX + tw, ty)
        .lineTo(traceX + tw, ty + 4)
        .stroke({ color, alpha: 0.25, width: 1 });
    }

    // Second LED column — right face
    const rightLedX = x + hw * 0.7;
    const rightLedColors = [0x00fff5, 0x00ff64, 0xffd93d, 0x00ff64];
    for (let i = 0; i < rightLedColors.length; i++) {
      const ly = y - h * 0.7 + i * (h * 0.14);
      this.serviceDetails
        .circle(rightLedX, ly, 1.2)
        .fill({ color: rightLedColors[i], alpha: 0.2 });
    }

    // Power connector block — left face bottom
    const pcX = rackLeft + 2;
    const pcY = y - h * 0.12;
    this.serviceDetails
      .rect(pcX, pcY, 8, 4)
      .fill({ color: shade(color, 0.25), alpha: 0.35 })
      .stroke({ color, alpha: 0.25, width: 0.5 });
    // Connector pins
    for (let p = 0; p < 3; p++) {
      this.serviceDetails
        .rect(pcX + 1.5 + p * 2.2, pcY + 1, 1, 2)
        .fill({ color: 0xffd93d, alpha: 0.3 });
    }

    // Rooftop — vent box with slits
    const topY = y - h - BUILDING_DEPTH / 2;
    this.serviceDetails
      .rect(x - 7, topY - 5, 14, 5)
      .fill({ color: shade(color, 0.35), alpha: 0.55 })
      .stroke({ color, alpha: 0.3, width: 0.5 });
    for (let i = 0; i < 4; i++) {
      this.serviceDetails
        .moveTo(x - 5, topY - 4 + i * 1.3)
        .lineTo(x + 5, topY - 4 + i * 1.3)
        .stroke({ color: 0x000000, alpha: 0.3, width: 0.5 });
    }
  }

  /** Valkey — RAM chip grid, data bus traces, heat spreader */
  private themeValkey(): void {
    const { color, buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;

    // Right face — 4×3 RAM chip grid with pin lines
    const gridStartX = x + hw * 0.1;
    const gridStartY = y - h * 0.85;
    const chipW = 5;
    const chipH = 3.5;
    const gapX = 7;
    const gapY = 6;

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const cx = gridStartX + col * gapX;
        const cy = gridStartY + row * gapY;

        this.serviceDetails
          .rect(cx, cy, chipW, chipH)
          .fill({ color: shade(color, 0.6), alpha: 0.55 })
          .stroke({ color, alpha: 0.4, width: 0.5 });

        // Pin lines
        for (let p = 0; p < 3; p++) {
          const px = cx + 1 + p * 1.5;
          this.serviceDetails
            .moveTo(px, cy - 1).lineTo(px, cy)
            .stroke({ color, alpha: 0.35, width: 0.5 })
            .moveTo(px, cy + chipH).lineTo(px, cy + chipH + 1)
            .stroke({ color, alpha: 0.35, width: 0.5 });
        }

        // Address mark inside chip
        this.serviceDetails
          .rect(cx + 1.5, cy + 1, 2, 1.5)
          .fill({ color, alpha: 0.2 });
      }
    }

    // Left face — data bus traces with endpoint caps
    const busX = x - hw * 0.8;
    const busW = hw * 0.55;
    for (let i = 0; i < 6; i++) {
      const by = y - h * 0.75 + i * 5;
      const bw = busW * (0.5 + ((i * 7) % 5) / 10);
      this.serviceDetails
        .moveTo(busX, by)
        .lineTo(busX + bw, by)
        .stroke({ color, alpha: 0.4, width: 1.5 });
      this.serviceDetails
        .rect(busX + bw, by - 1, 2, 2)
        .fill({ color, alpha: 0.3 });
    }

    // Rooftop — heat spreader with thermal lines
    const topY = y - h - BUILDING_DEPTH / 2;
    this.serviceDetails
      .rect(x - 8, topY - 4, 16, 4)
      .fill({ color: shade(color, 0.5), alpha: 0.5 })
      .stroke({ color, alpha: 0.35, width: 0.5 });
    for (let i = 0; i < 3; i++) {
      this.serviceDetails
        .moveTo(x - 6 + i * 5, topY - 3.5)
        .lineTo(x - 6 + i * 5, topY - 0.5)
        .stroke({ color, alpha: 0.25, width: 0.5 });
    }
    // Glowing center dot on heat spreader
    this.serviceDetails
      .circle(x, topY - 2, 1.5)
      .fill({ color, alpha: 0.5 });
    this.serviceDetails
      .circle(x, topY - 2, 3.5)
      .fill({ color, alpha: 0.1 });
  }

  /** PostgreSQL — stacked cylinders, table grid, DB icon */
  private themePostgres(): void {
    const { color, buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;

    // Right face — 3 stacked database cylinders
    const cylX = x + hw * 0.32;
    const cylRX = 9;
    const cylRY = 3.5;
    const cylH = 8;
    const startY = y - h * 0.8;

    for (let i = 0; i < 3; i++) {
      const cy = startY + i * (cylH + 4);

      // Cylinder body
      this.serviceDetails
        .rect(cylX - cylRX, cy, cylRX * 2, cylH)
        .fill({ color: shade(color, 0.3), alpha: 0.45 });
      this.serviceDetails
        .moveTo(cylX - cylRX, cy).lineTo(cylX - cylRX, cy + cylH)
        .stroke({ color, alpha: 0.35, width: 0.5 })
        .moveTo(cylX + cylRX, cy).lineTo(cylX + cylRX, cy + cylH)
        .stroke({ color, alpha: 0.35, width: 0.5 });
      // Top ellipse
      this.serviceDetails
        .ellipse(cylX, cy, cylRX, cylRY)
        .fill({ color: shade(color, 0.65), alpha: 0.6 })
        .stroke({ color, alpha: 0.5, width: 0.5 });
      // Bottom ellipse
      this.serviceDetails
        .ellipse(cylX, cy + cylH, cylRX, cylRY)
        .fill({ color: shade(color, 0.4), alpha: 0.45 });
    }

    // Connector lines between cylinder stacks
    for (let i = 0; i < 2; i++) {
      const fromY = startY + i * (cylH + 4) + cylH;
      const toY = startY + (i + 1) * (cylH + 4);
      this.serviceDetails
        .moveTo(cylX - cylRX + 2, fromY + cylRY)
        .lineTo(cylX - cylRX + 2, toY - cylRY)
        .stroke({ color, alpha: 0.2, width: 0.5 })
        .moveTo(cylX + cylRX - 2, fromY + cylRY)
        .lineTo(cylX + cylRX - 2, toY - cylRY)
        .stroke({ color, alpha: 0.2, width: 0.5 });
    }

    // Left face — table grid with bold header row
    const gridX = x - hw * 0.78;
    const gridY = y - h * 0.72;
    const gridW = hw * 0.55;
    const gridH = h * 0.4;
    const rows = 5;
    const cols = 3;

    for (let r = 0; r <= rows; r++) {
      const ly = gridY + (r / rows) * gridH;
      this.serviceDetails
        .moveTo(gridX, ly)
        .lineTo(gridX + gridW, ly)
        .stroke({ color, alpha: r === 0 ? 0.5 : 0.28, width: r === 0 ? 1 : 0.5 });
    }
    for (let c = 0; c <= cols; c++) {
      const lx = gridX + (c / cols) * gridW;
      this.serviceDetails
        .moveTo(lx, gridY)
        .lineTo(lx, gridY + gridH)
        .stroke({ color, alpha: 0.25, width: 0.5 });
    }

    // Data dots in table cells
    const cellW = gridW / cols;
    const cellH = gridH / rows;
    for (let r = 1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dotX = gridX + c * cellW + cellW * 0.5;
        const dotY = gridY + r * cellH + cellH * 0.5;
        this.serviceDetails
          .circle(dotX, dotY, 0.8)
          .fill({ color, alpha: 0.18 });
      }
    }

    // Rooftop — DB cylinder icon
    const topY = y - h - BUILDING_DEPTH / 2;
    this.serviceDetails
      .rect(x - 7, topY - 2, 14, 5)
      .fill({ color: shade(color, 0.35), alpha: 0.3 });
    this.serviceDetails
      .ellipse(x, topY - 2, 7, 3)
      .fill({ color: shade(color, 0.55), alpha: 0.4 })
      .stroke({ color, alpha: 0.3, width: 0.5 });
    this.serviceDetails
      .ellipse(x, topY + 3, 7, 3)
      .fill({ color: shade(color, 0.4), alpha: 0.3 });
  }

  /** OpenSearch — terminal window, magnifying glass, antenna array */
  private themeOpenSearch(): void {
    const { color, buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;

    // Right face — terminal window with colored log lines
    const termX = x + hw * 0.08;
    const termY = y - h * 0.85;
    const termW = hw * 0.75;
    const termH = h * 0.6;

    this.serviceDetails
      .rect(termX, termY, termW, termH)
      .fill({ color: 0x050510, alpha: 0.8 })
      .stroke({ color, alpha: 0.6, width: 1 });

    // Title bar with window dots
    this.serviceDetails
      .rect(termX, termY, termW, 3)
      .fill({ color, alpha: 0.35 });
    // Window dots (red, yellow, green)
    const dotColors = [0xff4444, 0xffd93d, 0x00ff64];
    for (let d = 0; d < 3; d++) {
      this.serviceDetails
        .circle(termX + 3 + d * 3, termY + 1.5, 0.8)
        .fill({ color: dotColors[d], alpha: 0.6 });
    }

    // Colored log lines
    const logColors = [color, 0x00ff64, color, 0xffd93d, color, 0xff4444, color, 0x00fff5];
    const logLengths = [0.9, 0.55, 0.75, 0.4, 0.85, 0.3, 0.65, 0.5];
    for (let i = 0; i < logLengths.length; i++) {
      const ly = termY + 6 + i * 4;
      if (ly > termY + termH - 3) break;
      this.serviceDetails
        .moveTo(termX + 3, ly)
        .lineTo(termX + 3 + (termW - 6) * logLengths[i], ly)
        .stroke({ color: logColors[i], alpha: 0.4, width: 1 });
    }

    // Left face — magnifying glass with crosshair
    const glassX = x - hw * 0.45;
    const glassY = y - h * 0.5;
    const glassR = 7;

    this.serviceDetails
      .circle(glassX, glassY, glassR)
      .fill({ color: shade(color, 0.2), alpha: 0.25 })
      .stroke({ color, alpha: 0.55, width: 2 });

    // Crosshair
    this.serviceDetails
      .moveTo(glassX - 3, glassY).lineTo(glassX + 3, glassY)
      .stroke({ color, alpha: 0.2, width: 0.5 })
      .moveTo(glassX, glassY - 3).lineTo(glassX, glassY + 3)
      .stroke({ color, alpha: 0.2, width: 0.5 });

    // Lens flare highlight arc
    this.serviceDetails
      .moveTo(glassX + Math.cos(-Math.PI * 0.7) * (glassR - 2), glassY + Math.sin(-Math.PI * 0.7) * (glassR - 2))
      .arc(glassX, glassY, glassR - 2, -Math.PI * 0.7, -Math.PI * 0.3)
      .stroke({ color: 0xffffff, alpha: 0.15, width: 1 });

    // Handle
    const ha = Math.PI * 0.75;
    const hx = glassX + Math.cos(ha) * glassR;
    const hy = glassY + Math.sin(ha) * glassR;
    this.serviceDetails
      .moveTo(hx, hy)
      .lineTo(hx + Math.cos(ha) * 7, hy + Math.sin(ha) * 7)
      .stroke({ color, alpha: 0.5, width: 2 });

    // Rooftop — 3-element antenna array
    const topY = y - h - BUILDING_DEPTH / 2;
    for (let i = -1; i <= 1; i++) {
      const ax = x + i * 6;
      const aH = 4 + (1 - Math.abs(i)) * 2;
      this.serviceDetails
        .moveTo(ax, topY).lineTo(ax, topY - aH)
        .stroke({ color, alpha: 0.4, width: 1 });
      this.serviceDetails
        .circle(ax, topY - aH, 1)
        .fill({ color, alpha: 0.6 });
    }
  }

  /** DNS — signal tower with cross-bars, satellite dish, arrows, zone file */
  private themeDns(): void {
    const { color, buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;
    const hd = BUILDING_DEPTH / 2;
    const topY = y - h - hd;

    // Tall antenna mast (18px above rooftop)
    const antTip = topY - 18;
    this.serviceDetails
      .moveTo(x, topY).lineTo(x, antTip)
      .stroke({ color, alpha: 0.6, width: 2 });

    // Cross-bars on mast
    for (let i = 1; i <= 3; i++) {
      const cy = topY - i * 4.5;
      const cw = 3 + (3 - i) * 1.5;
      this.serviceDetails
        .moveTo(x - cw, cy).lineTo(x + cw, cy)
        .stroke({ color, alpha: 0.4, width: 1 });
    }

    // Antenna tip beacon
    this.serviceDetails
      .circle(x, antTip, 2)
      .fill({ color, alpha: 0.75 });

    // Static signal arcs
    for (let i = 1; i <= 3; i++) {
      const r = 3 + i * 3;
      const startAngle = -Math.PI * 0.75;
      this.serviceDetails
        .moveTo(x + Math.cos(startAngle) * r, antTip + Math.sin(startAngle) * r)
        .arc(x, antTip, r, startAngle, -Math.PI * 0.25)
        .stroke({ color, alpha: 0.35 - i * 0.07, width: 1 });
    }

    // Satellite dish
    const dishX = x + 7;
    const dishY = topY - 1;
    const dishStart = -Math.PI * 0.9;
    this.serviceDetails
      .moveTo(dishX + Math.cos(dishStart) * 6, dishY + Math.sin(dishStart) * 6)
      .arc(dishX, dishY, 6, dishStart, -Math.PI * 0.1)
      .stroke({ color, alpha: 0.55, width: 2 });
    // Dish arm
    this.serviceDetails
      .moveTo(dishX, dishY).lineTo(dishX - 3, dishY - 5)
      .stroke({ color, alpha: 0.5, width: 1 });
    // Dish receiver dot
    this.serviceDetails
      .circle(dishX - 3, dishY - 5, 1)
      .fill({ color, alpha: 0.5 });
    // Dish receiver glow halo
    this.serviceDetails
      .circle(dishX - 3, dishY - 5, 3)
      .fill({ color, alpha: 0.1 });

    // Right face — DNS query/response arrows
    const arrowX = x + hw * 0.2;
    for (let i = 0; i < 3; i++) {
      const ay = y - h * 0.7 + i * 10;
      // Query arrow (right)
      this.serviceDetails
        .moveTo(arrowX, ay).lineTo(arrowX + 12, ay)
        .stroke({ color, alpha: 0.35, width: 1 });
      this.serviceDetails
        .poly([arrowX + 12, ay - 2, arrowX + 15, ay, arrowX + 12, ay + 2])
        .fill({ color, alpha: 0.35 });
      // Response arrow (left, green)
      this.serviceDetails
        .moveTo(arrowX + 15, ay + 4).lineTo(arrowX + 3, ay + 4)
        .stroke({ color: 0x00ff64, alpha: 0.28, width: 1 });
      this.serviceDetails
        .poly([arrowX + 3, ay + 2, arrowX, ay + 4, arrowX + 3, ay + 6])
        .fill({ color: 0x00ff64, alpha: 0.28 });
    }

    // Left face — zone file lines with bold header
    const zoneX = x - hw * 0.8;
    const zoneW = hw * 0.5;
    for (let i = 0; i < 5; i++) {
      const zy = y - h * 0.65 + i * 6;
      const zw = zoneW * (0.5 + ((i * 3) % 5) / 10);
      const isHeader = i === 0;
      this.serviceDetails
        .moveTo(zoneX, zy).lineTo(zoneX + (isHeader ? zoneW * 0.9 : zw), zy)
        .stroke({ color, alpha: isHeader ? 0.5 : 0.3, width: isHeader ? 1.5 : 1 });
    }
  }

  // ─── Replicant eye (backend only) ───────────────────────────────────

  private drawReplicantEye(): void {
    const { buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;

    const eyeX = x + hw * 0.35;
    const eyeY = y - h * 0.7;

    this.replicantEye.clear();
    this.replicantEye
      .circle(eyeX, eyeY, 3)
      .fill({ color: 0xffaa00, alpha: this.eyeAlpha });
  }

  // ─── Health dot ──────────────────────────────────────────────────────

  private drawHealthDot(): void {
    const x = this.screenX;
    const y = this.screenY - this.config.buildingHeight;
    this.healthDot.clear();
    this.healthDot
      .circle(x, y, 5)
      .fill({ color: STATUS_COLORS[this.currentStatus], alpha: 0.9 });
    this.healthDot
      .circle(x, y, 8)
      .stroke({ color: STATUS_COLORS[this.currentStatus], alpha: 0.3, width: 2 });
  }

  // ─── Tooltip ─────────────────────────────────────────────────────────

  private updateTooltip(): void {
    const statusColor = STATUS_COLORS[this.currentStatus];
    let statusText = STATUS_LABELS[this.currentStatus];
    if (this.latencyMs != null) {
      statusText += ` | ${this.latencyMs}ms`;
    }
    this.tooltipStatus.text = statusText;
    this.tooltipStatus.style.fill = statusColor;
    this.drawTooltipBg();
  }

  private drawTooltipBg(): void {
    const x = this.screenX;
    const y = this.screenY;
    const h = this.config.buildingHeight;
    const hd = BUILDING_DEPTH / 2;
    const labelOffset = this.config.id === 'dns' ? 32 : 12;
    const tooltipTop = y - h - hd - labelOffset;
    const bgW = 100;
    const bgH = 28;
    const bgX = x - bgW / 2;
    const bgY = tooltipTop - 26;

    this.tooltipBg.clear();
    this.tooltipBg
      .roundRect(bgX, bgY, bgW, bgH, 3)
      .fill({ color: 0x0a0a1a, alpha: 0.85 })
      .stroke({ color: this.config.color, alpha: 0.4, width: 1 });
  }

  // ─── Animation loop ─────────────────────────────────────────────────

  private animate = (ticker: Ticker): void => {
    this.elapsed += ticker.deltaTime * 0.02;

    // Glow pulse — brighter when hovered
    const pulse = this.hovered
      ? 0.35 + Math.sin(this.elapsed * 3) * 0.15
      : 0.1 + Math.sin(this.elapsed * 2) * 0.08;
    this.glow.alpha = pulse;

    // Replicant eye glow cycle (~45s)
    if (this.config.id === 'backend') {
      this.eyeTimer += ticker.deltaTime * 0.02;
      const cyclePeriod = 45;
      const cyclePos = this.eyeTimer % cyclePeriod;

      if (cyclePos < 0.5) {
        this.eyeAlpha = 0.05 + (cyclePos / 0.5) * 0.55;
      } else if (cyclePos < 1.0) {
        this.eyeAlpha = 0.6 - ((cyclePos - 0.5) / 0.5) * 0.55;
      } else {
        this.eyeAlpha = 0.05;
      }

      this.drawReplicantEye();
    }

    // Per-service animations
    this.serviceAnim.clear();

    switch (this.config.id) {
      case 'frontend':  this.animFrontend(ticker);  break;
      case 'backend':   this.animBackend(ticker);   break;
      case 'dns':       this.animDns(ticker);       break;
    }
  };

  /** Frontend — scan line sweeps down screen with trail */
  private animFrontend(ticker: Ticker): void {
    this.scanLineOffset += ticker.deltaTime * 0.025;
    if (this.scanLineOffset > 1) this.scanLineOffset -= 1;

    const { color, buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hw = BUILDING_WIDTH / 2;

    const sx = x + hw * 0.12;
    const sy = y - h * 0.82;
    const sw = hw * 0.7;
    const sh = h * 0.55;

    const lineY = sy + this.scanLineOffset * sh;
    if (lineY >= sy && lineY <= sy + sh) {
      // Bright scan line
      this.serviceAnim
        .moveTo(sx + 2, lineY)
        .lineTo(sx + sw - 2, lineY)
        .stroke({ color, alpha: 0.65, width: 1.5 });
      // Fading trail
      for (let t = 1; t <= 3; t++) {
        const trailY = lineY - t * 2;
        if (trailY >= sy) {
          this.serviceAnim
            .moveTo(sx + 2, trailY)
            .lineTo(sx + sw - 2, trailY)
            .stroke({ color, alpha: 0.3 / t, width: 1 });
        }
      }
    }
  }

  /** Backend — blinking LEDs with glow halos */
  private animBackend(ticker: Ticker): void {
    this.ledTimer += ticker.deltaTime * 0.02;

    const { buildingHeight: h } = this.config;
    const x = this.screenX;
    const hw = BUILDING_WIDTH / 2;

    const ledColors = [0x00ff64, 0xffd93d, 0xff4444, 0x00ff64, 0x00fff5];
    const freqs = [1.5, 2.3, 0.7, 3.1, 1.1];
    const rackRight = x - hw * 0.1;
    const rackTop = this.screenY - h * 0.9;

    for (let i = 0; i < ledColors.length; i++) {
      const ly = rackTop + 4 + i * (h * 0.14);
      const blink = Math.sin(this.ledTimer * freqs[i] * Math.PI * 2);
      const ledAlpha = blink > 0 ? 0.75 : 0.08;
      this.serviceAnim
        .circle(rackRight + 4, ly, 1.5)
        .fill({ color: ledColors[i], alpha: ledAlpha });
      if (blink > 0) {
        this.serviceAnim
          .circle(rackRight + 4, ly, 4)
          .fill({ color: ledColors[i], alpha: 0.08 });
      }
    }
  }

  /** DNS — dual pulsing signal arcs + beacon blink */
  private animDns(ticker: Ticker): void {
    this.signalPulse += ticker.deltaTime * 0.012;
    if (this.signalPulse > 1) this.signalPulse -= 1;

    const { color, buildingHeight: h } = this.config;
    const x = this.screenX;
    const y = this.screenY;
    const hd = BUILDING_DEPTH / 2;
    const antTip = y - h - hd - 18;

    // Two expanding + fading arc pulses, offset by 0.5
    for (let phase = 0; phase < 2; phase++) {
      const t = (this.signalPulse + phase * 0.5) % 1;
      const expandR = 4 + t * 14;
      const fadeAlpha = 0.45 * (1 - t);
      if (fadeAlpha < 0.02) continue;

      const pulseStart = -Math.PI * 0.8;
      this.serviceAnim
        .moveTo(x + Math.cos(pulseStart) * expandR, antTip + Math.sin(pulseStart) * expandR)
        .arc(x, antTip, expandR, pulseStart, -Math.PI * 0.2)
        .stroke({ color, alpha: fadeAlpha, width: 1 });
    }

    // Beacon blink
    const beaconAlpha = 0.3 + Math.sin(this.elapsed * 4) * 0.25;
    this.serviceAnim
      .circle(x, antTip, 2.5)
      .fill({ color, alpha: beaconAlpha });
  }

  setEasterEggAlpha(alpha: number): void {
    if (alpha > 0) {
      this.nameLabel.text = 'VK-TEST';
      this.nameLabel.style.fill = 0xffd93d;
      this.nameLabel.alpha = Math.max(this.nameLabel.alpha, 0.5 + alpha * 2.5);
    } else {
      this.nameLabel.text = this.config.label;
      this.nameLabel.style.fill = this.config.color;
      this.nameLabel.alpha = 1;
    }
  }

  destroy(): void {
    Ticker.shared.remove(this.animate, this);
    super.destroy({ children: true });
  }
}
