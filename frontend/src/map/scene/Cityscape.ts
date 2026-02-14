import { Container, Graphics } from 'pixi.js';
import { isoProject } from '../data/topology';

function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

type BuildingStyle = 'flat' | 'wedge' | 'stepped';

interface PeripheralDef {
  gridX: number;
  gridY: number;
  width: number;
  depth: number;
  height: number;
  color: number;
  hasWarningLight: boolean;
}

interface DecorativeDef {
  gridX: number;
  gridY: number;
  width: number;
  depth: number;
  height: number;
  color: number;
  alpha: number;
  style: BuildingStyle;
  accentColor: number;
}

interface NeonSign {
  bx: number; by: number;          // building screen pos
  face: 'left' | 'right';
  heightFrac: number;              // fraction up the face
  widthFrac: number;               // position along face
  w: number; h: number;
  color: number;
  freq: number;
  building: DecorativeDef;
}

interface NeonPool {
  gridX: number; gridY: number;
  rx: number; ry: number;
  color: number;
  freq: number;
}

const ACCENT_PALETTE = [0x00fff5, 0xff00ff, 0xffd93d, 0x00ff64, 0xff4444, 0xff8800, 0x44aaff, 0xaa66ff];

function pickAccent(i: number): number {
  return ACCENT_PALETTE[i % ACCENT_PALETTE.length];
}

const PERIPHERAL_BUILDINGS: PeripheralDef[] = [
  // Back row (distant)
  { gridX: -1,  gridY: 5,   width: 24, depth: 16, height: 260, color: 0x112233, hasWarningLight: true },
  { gridX: 0,   gridY: 5.5, width: 50, depth: 30, height: 140, color: 0x0a1525, hasWarningLight: false },
  { gridX: 1.5, gridY: 5,   width: 22, depth: 14, height: 300, color: 0x1a2a3f, hasWarningLight: false },
  { gridX: 3,   gridY: 5.5, width: 60, depth: 36, height: 100, color: 0x112233, hasWarningLight: false },
  { gridX: 4.5, gridY: 5,   width: 28, depth: 18, height: 220, color: 0x0a1525, hasWarningLight: true },
  // Right periphery
  { gridX: 5.5, gridY: 3,   width: 30, depth: 20, height: 200, color: 0x1a2a3f, hasWarningLight: false },
  { gridX: 6,   gridY: 1.5, width: 44, depth: 28, height: 150, color: 0x112233, hasWarningLight: false },
  { gridX: 6,   gridY: 3.5, width: 20, depth: 14, height: 280, color: 0x0a1525, hasWarningLight: false },
  // Left periphery
  { gridX: -1,  gridY: 0,   width: 26, depth: 18, height: 240, color: 0x1a2a3f, hasWarningLight: false },
  { gridX: -1,  gridY: 1.5, width: 50, depth: 32, height: 120, color: 0x112233, hasWarningLight: false },
  // Upper-right periphery
  { gridX: 5.5, gridY: -0.5, width: 22, depth: 16, height: 190, color: 0x0a1525, hasWarningLight: false },
  { gridX: 6,   gridY: 0.5,  width: 40, depth: 24, height: 130, color: 0x1a2a3f, hasWarningLight: false },
  // Extra fill
  { gridX: 2.5, gridY: 6,   width: 26, depth: 16, height: 230, color: 0x0a1525, hasWarningLight: false },
];

const DECORATIVE_BUILDINGS: DecorativeDef[] = [
  // Between nodes
  { gridX: 0.5,  gridY: 0.5, width: 18, depth: 12, height: 35, color: 0x0d1520, alpha: 0.40, style: 'flat',    accentColor: pickAccent(0) },
  { gridX: 1.8,  gridY: 1.2, width: 22, depth: 14, height: 42, color: 0x1a1f2e, alpha: 0.38, style: 'wedge',   accentColor: pickAccent(1) },
  { gridX: 1.3,  gridY: 2.7, width: 14, depth: 10, height: 28, color: 0x252a3a, alpha: 0.42, style: 'stepped', accentColor: pickAccent(2) },
  { gridX: 3.6,  gridY: 2.8, width: 20, depth: 14, height: 38, color: 0x15191f, alpha: 0.38, style: 'flat',    accentColor: pickAccent(3) },
  { gridX: 3.5,  gridY: 0.3, width: 16, depth: 12, height: 32, color: 0x0d1520, alpha: 0.40, style: 'wedge',   accentColor: pickAccent(4) },
  { gridX: 1.0,  gridY: 3.5, width: 24, depth: 16, height: 45, color: 0x1a1f2e, alpha: 0.36, style: 'stepped', accentColor: pickAccent(5) },
  { gridX: 2.5,  gridY: 1.5, width: 12, depth: 10, height: 24, color: 0x252a3a, alpha: 0.40, style: 'flat',    accentColor: pickAccent(6) },
  { gridX: 4.2,  gridY: 1.5, width: 18, depth: 14, height: 36, color: 0x15191f, alpha: 0.38, style: 'wedge',   accentColor: pickAccent(7) },
  { gridX: 0.8,  gridY: 1.0, width: 14, depth: 12, height: 30, color: 0x0d1520, alpha: 0.42, style: 'flat',    accentColor: pickAccent(0) },
  { gridX: 3.2,  gridY: 3.5, width: 20, depth: 16, height: 40, color: 0x1a1f2e, alpha: 0.38, style: 'stepped', accentColor: pickAccent(1) },
  // Periphery fill
  { gridX: 0.2,  gridY: 3.5, width: 16, depth: 12, height: 34, color: 0x252a3a, alpha: 0.38, style: 'flat',    accentColor: pickAccent(2) },
  { gridX: 4.5,  gridY: 3.5, width: 22, depth: 14, height: 44, color: 0x15191f, alpha: 0.40, style: 'wedge',   accentColor: pickAccent(3) },
  { gridX: 2.3,  gridY: 4.5, width: 18, depth: 12, height: 30, color: 0x0d1520, alpha: 0.36, style: 'flat',    accentColor: pickAccent(4) },
  { gridX: 5.2,  gridY: 0.5, width: 14, depth: 10, height: 26, color: 0x1a1f2e, alpha: 0.42, style: 'stepped', accentColor: pickAccent(5) },
  { gridX: 5.5,  gridY: 2.3, width: 20, depth: 14, height: 38, color: 0x252a3a, alpha: 0.38, style: 'wedge',   accentColor: pickAccent(6) },
  { gridX: -0.3, gridY: 2.5, width: 16, depth: 12, height: 32, color: 0x15191f, alpha: 0.40, style: 'flat',    accentColor: pickAccent(7) },
  { gridX: 1.5,  gridY: 0.3, width: 18, depth: 14, height: 36, color: 0x0d1520, alpha: 0.38, style: 'stepped', accentColor: pickAccent(0) },
  { gridX: 4.8,  gridY: 4.0, width: 14, depth: 10, height: 22, color: 0x1a1f2e, alpha: 0.42, style: 'flat',    accentColor: pickAccent(1) },
  { gridX: 0.3,  gridY: 4.2, width: 20, depth: 14, height: 40, color: 0x252a3a, alpha: 0.36, style: 'wedge',   accentColor: pickAccent(2) },
  { gridX: 2.8,  gridY: 0.2, width: 16, depth: 12, height: 28, color: 0x15191f, alpha: 0.40, style: 'flat',    accentColor: pickAccent(3) },
  // New density-fill buildings
  { gridX: 0.3,  gridY: 1.5, width: 14, depth: 10, height: 32, color: 0x0d1520, alpha: 0.42, style: 'wedge',   accentColor: pickAccent(4) },
  { gridX: 1.5,  gridY: 1.8, width: 18, depth: 12, height: 38, color: 0x1a1f2e, alpha: 0.38, style: 'flat',    accentColor: pickAccent(5) },
  { gridX: 2.2,  gridY: 0.8, width: 16, depth: 12, height: 34, color: 0x252a3a, alpha: 0.40, style: 'stepped', accentColor: pickAccent(6) },
  { gridX: 3.8,  gridY: 0.8, width: 14, depth: 10, height: 30, color: 0x15191f, alpha: 0.42, style: 'flat',    accentColor: pickAccent(7) },
  { gridX: 4.5,  gridY: 1.0, width: 16, depth: 12, height: 36, color: 0x0d1520, alpha: 0.38, style: 'wedge',   accentColor: pickAccent(0) },
  { gridX: 1.8,  gridY: 3.2, width: 20, depth: 14, height: 42, color: 0x1a1f2e, alpha: 0.40, style: 'stepped', accentColor: pickAccent(1) },
  { gridX: 2.7,  gridY: 2.3, width: 14, depth: 10, height: 28, color: 0x252a3a, alpha: 0.42, style: 'flat',    accentColor: pickAccent(2) },
  { gridX: 4.0,  gridY: 2.5, width: 18, depth: 14, height: 40, color: 0x15191f, alpha: 0.38, style: 'wedge',   accentColor: pickAccent(3) },
  { gridX: 0.5,  gridY: 3.0, width: 16, depth: 12, height: 34, color: 0x0d1520, alpha: 0.40, style: 'flat',    accentColor: pickAccent(4) },
  { gridX: 3.5,  gridY: 4.2, width: 20, depth: 14, height: 38, color: 0x1a1f2e, alpha: 0.36, style: 'stepped', accentColor: pickAccent(5) },
  // Space Needle neighborhood
  { gridX: -0.6, gridY: -0.4, width: 14, depth: 10, height: 30, color: 0x0d1520, alpha: 0.40, style: 'flat',    accentColor: pickAccent(6) },
  { gridX: 0.6,  gridY: -1.2, width: 16, depth: 12, height: 36, color: 0x1a1f2e, alpha: 0.38, style: 'wedge',   accentColor: pickAccent(7) },
  { gridX: -0.8, gridY: -1.0, width: 12, depth: 10, height: 24, color: 0x252a3a, alpha: 0.42, style: 'stepped', accentColor: pickAccent(0) },
  { gridX: 0.5,  gridY: -0.2, width: 14, depth: 10, height: 28, color: 0x15191f, alpha: 0.40, style: 'flat',    accentColor: pickAccent(1) },
  { gridX: -0.4, gridY: -1.4, width: 10, depth: 8,  height: 20, color: 0x0d1520, alpha: 0.38, style: 'wedge',   accentColor: pickAccent(2) },
];

const TREE_POSITIONS = [
  { gridX: 0.1, gridY: 0.8 }, { gridX: 1.9, gridY: 0.1 }, { gridX: 0.7, gridY: 2.2 },
  { gridX: 3.1, gridY: 0.7 }, { gridX: 3.9, gridY: 1.8 }, { gridX: 4.2, gridY: 3.2 },
  { gridX: 0.5, gridY: 4.8 }, { gridX: 2.8, gridY: 4.1 }, { gridX: 5.1, gridY: 1.2 },
  { gridX: 5.7, gridY: 3.8 }, { gridX: -0.5, gridY: 2.5 }, { gridX: 1.2, gridY: 3.9 },
  // Space Needle park trees
  { gridX: -0.3, gridY: -0.6 }, { gridX: 0.3, gridY: -0.5 }, { gridX: -0.1, gridY: -1.1 },
  { gridX: 0.4, gridY: -0.9 }, { gridX: -0.5, gridY: -0.1 },
];

const ROAD_SEGMENTS: [number, number, number, number][] = [
  // Streets (iso-horizontal, constant gridY)
  [-0.5, 0, 5.5, 0],   // top edge
  [-0.5, 1, 5, 1],      // upper (OpenSearch row)
  [-0.5, 2, 5, 2],      // main (Frontend-Backend-Valkey row)
  [-0.5, 3, 5, 3],      // lower (PostgreSQL row)
  [-0.5, 4, 5, 4],      // bottom edge
  // Avenues (iso-vertical, constant gridX)
  [0, -0.5, 0, 4.5],    // left edge (by Frontend)
  [2, -0.5, 2, 4.5],    // center (Backend-Postgres column)
  [4, -0.5, 4, 4.5],    // right (DNS-Valkey column)
  [5, -0.5, 5, 4.5],    // far right edge
  // Inner alleys
  [1, 0, 1, 4],          // inner-left alley
  [3, 0, 3, 4],          // center-right alley
];

const NEON_POOL_DEFS: NeonPool[] = [
  { gridX: 1, gridY: 1, rx: 18, ry: 9,  color: 0x00fff5, freq: 1.2 },
  { gridX: 3, gridY: 1, rx: 22, ry: 11, color: 0xff00ff, freq: 1.5 },
  { gridX: 1, gridY: 3, rx: 16, ry: 8,  color: 0xffd93d, freq: 1.0 },
  { gridX: 3, gridY: 3, rx: 24, ry: 12, color: 0x00ff64, freq: 1.8 },
  { gridX: 5, gridY: 2, rx: 18, ry: 9,  color: 0x00fff5, freq: 1.3 },
  { gridX: 0, gridY: 4, rx: 16, ry: 8,  color: 0xff00ff, freq: 2.0 },
  { gridX: 4, gridY: 4, rx: 20, ry: 10, color: 0xffd93d, freq: 1.1 },
  { gridX: 2, gridY: 0, rx: 18, ry: 9,  color: 0x00ff64, freq: 1.6 },
  // Space Needle park pool
  { gridX: 0, gridY: -0.3, rx: 14, ry: 7,  color: 0x44aaff, freq: 1.4 },
];

interface MysteryDataDef {
  gridX: number;
  gridY: number;
  color: number;
  size: number;
  freq: number;
}

const MYSTERY_DATA: MysteryDataDef[] = [
  { gridX: 1, gridY: 1.5, color: 0x00ff64, size: 6, freq: 1.5 },
  { gridX: 3.5, gridY: 1.5, color: 0x4488ff, size: 7, freq: 1.2 },
  { gridX: 0.5, gridY: 3.5, color: 0xaa44ff, size: 6, freq: 1.8 },
  { gridX: 4.5, gridY: 0.5, color: 0x00ff64, size: 5, freq: 1.6 },
  { gridX: 2.5, gridY: 3.8, color: 0x4488ff, size: 6, freq: 1.3 },
];

const NEON_COLORS = [0x00fff5, 0xff00ff, 0xffd93d, 0x00ff64, 0xff4444, 0xff8800, 0x44aaff, 0xaa66ff];

const WINDOW_COLORS = [0xffd93d, 0xffd93d, 0xffd93d, 0xffd93d, 0x00fff5, 0xff8800];

// Seeded pseudo-random for deterministic window patterns
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Grid positions the NetNavi can walk between (road intersections)
const NAVI_WAYPOINTS = [
  { gridX: 0, gridY: 0 }, { gridX: 1, gridY: 0 }, { gridX: 2, gridY: 0 },
  { gridX: 3, gridY: 0 }, { gridX: 4, gridY: 0 },
  { gridX: 0, gridY: 1 }, { gridX: 1, gridY: 1 }, { gridX: 2, gridY: 1 },
  { gridX: 3, gridY: 1 }, { gridX: 4, gridY: 1 },
  { gridX: 0, gridY: 2 }, { gridX: 1, gridY: 2 }, { gridX: 2, gridY: 2 },
  { gridX: 3, gridY: 2 }, { gridX: 4, gridY: 2 }, { gridX: 5, gridY: 2 },
  { gridX: 0, gridY: 3 }, { gridX: 1, gridY: 3 }, { gridX: 2, gridY: 3 },
  { gridX: 3, gridY: 3 }, { gridX: 4, gridY: 3 },
  { gridX: 0, gridY: 4 }, { gridX: 2, gridY: 4 }, { gridX: 4, gridY: 4 },
];

// Peripheral buildings that get billboard panels (by index)
const BILLBOARD_INDICES = [0, 2, 5, 7, 10];

export class Cityscape extends Container {
  private roads = new Graphics();
  private decorativeBuildings = new Graphics();
  private peripheralBuildings = new Graphics();
  private arcade = new Graphics();
  private arcadeGhosts = new Graphics();
  private spaceNeedle = new Graphics();
  private spaceNeedleBeacon = new Graphics();
  private trees = new Graphics();
  private neonPools = new Graphics();
  private neonSigns = new Graphics();
  private mysteryData = new Graphics();
  private arcadeBanner = new Graphics();
  private warningLights = new Graphics();
  private spinner = new Graphics();
  private navi = new Graphics();

  private centerX = 0;
  private centerY = 0;
  private elapsed = 0;
  private spinnerTimer = 0;
  private spinnerInterval = 40 + Math.random() * 30;
  private spinnerProgress = -1; // -1 = not flying
  private screenWidth = 0;
  private screenHeight = 0;
  private neonSignDefs: NeonSign[] = [];

  // NetNavi state
  private naviWaypointIdx = 0;
  private naviFromX = 0;
  private naviFromY = 0;
  private naviToX = 0;
  private naviToY = 0;
  private naviMoveProgress = -1; // -1 = idle at waypoint
  private naviIdleTimer = 0;
  private naviIdleWait = 4 + Math.random() * 6;
  private naviScreenX = 0;
  private naviScreenY = 0;
  private naviFacingRight = true;

  // Power pill ghost effect
  private powerPillTimer = 0; // seconds remaining, 0 = off

  // UFO attack effect
  private ufoAttack = new Graphics();
  private ufoTimer = 0; // seconds remaining, 0 = off
  private ufoPhase = 0; // animation progress

  constructor() {
    super();
    this.addChild(this.roads);
    this.addChild(this.decorativeBuildings);
    this.addChild(this.peripheralBuildings);
    this.addChild(this.arcade);
    this.addChild(this.arcadeGhosts);
    this.addChild(this.spaceNeedle);
    this.addChild(this.spaceNeedleBeacon);
    this.addChild(this.ufoAttack);
    this.addChild(this.trees);
    this.addChild(this.neonPools);
    this.addChild(this.mysteryData);
    this.addChild(this.neonSigns);
    this.addChild(this.arcadeBanner);
    this.addChild(this.warningLights);
    this.addChild(this.navi);
    this.addChild(this.spinner);
    this.generateNeonSigns();
  }

  init(centerX: number, centerY: number, screenWidth: number, screenHeight: number): void {
    this.centerX = centerX;
    this.centerY = centerY;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.drawStatic();
    // Position navi at current waypoint
    const wp = NAVI_WAYPOINTS[this.naviWaypointIdx];
    const naviPos = isoProject(wp.gridX, wp.gridY, this.centerX, this.centerY);
    this.naviScreenX = naviPos.x;
    this.naviScreenY = naviPos.y;
  }

  private generateNeonSigns(): void {
    // Every decorative building gets 1-2 signs
    for (let i = 0; i < DECORATIVE_BUILDINGS.length; i++) {
      const b = DECORATIVE_BUILDINGS[i];
      const signCount = 1 + (i % 3 === 0 ? 1 : 0); // ~1/3 get 2 signs
      for (let s = 0; s < signCount; s++) {
        this.neonSignDefs.push({
          bx: 0, by: 0,
          face: s === 0 ? 'left' : 'right',
          heightFrac: 0.3 + (((i * 7 + s * 13) % 10) / 10) * 0.4,
          widthFrac: 0.3 + (((i * 11 + s * 3) % 10) / 10) * 0.4,
          w: 8 + (i % 5) * 2,    // 8-16px
          h: 3 + (i % 4),        // 3-6px
          color: NEON_COLORS[(i + s) % NEON_COLORS.length],
          freq: 0.8 + ((i * 3 + s) % 7) * 0.1,
          building: b,
        });
      }
    }
  }

  private drawStatic(): void {
    this.drawRoads();
    this.drawDecorativeBuildings();
    this.drawPeripheralBuildings();
    this.drawArcade();
    this.drawSpaceNeedle();
    this.drawTrees();
    // Recompute neon sign screen positions
    for (const sign of this.neonSignDefs) {
      const pos = isoProject(sign.building.gridX, sign.building.gridY, this.centerX, this.centerY);
      sign.bx = pos.x;
      sign.by = pos.y;
    }
  }

  private drawRoads(): void {
    this.roads.clear();
    const roadWidth = 8;

    for (const [x1, y1, x2, y2] of ROAD_SEGMENTS) {
      const from = isoProject(x1, y1, this.centerX, this.centerY);
      const to = isoProject(x2, y2, this.centerX, this.centerY);

      // Road direction vector
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;
      const nx = -dy / len * (roadWidth / 2);
      const ny = dx / len * (roadWidth / 2);

      // Road fill quad (darker asphalt)
      this.roads
        .poly([
          from.x + nx, from.y + ny,
          to.x + nx,   to.y + ny,
          to.x - nx,   to.y - ny,
          from.x - nx, from.y - ny,
        ])
        .fill({ color: 0x1a2030, alpha: 0.25 });

      // Neon edge lines (lane markers on each side)
      this.roads
        .moveTo(from.x + nx, from.y + ny)
        .lineTo(to.x + nx, to.y + ny)
        .stroke({ color: 0x00fff5, alpha: 0.08, width: 0.5 });
      this.roads
        .moveTo(from.x - nx, from.y - ny)
        .lineTo(to.x - nx, to.y - ny)
        .stroke({ color: 0x00fff5, alpha: 0.08, width: 0.5 });

      // Center lane dashes
      const dashLen = 8;
      const gapLen = 6;
      const segLen = dashLen + gapLen;
      const steps = Math.floor(len / segLen);
      for (let i = 0; i < steps; i++) {
        const t0 = (i * segLen) / len;
        const t1 = Math.min((i * segLen + dashLen) / len, 1);
        const sx = from.x + dx * t0;
        const sy = from.y + dy * t0;
        const ex = from.x + dx * t1;
        const ey = from.y + dy * t1;
        this.roads
          .moveTo(sx, sy)
          .lineTo(ex, ey)
          .stroke({ color: 0x4a5565, alpha: 0.2, width: 1 });
      }
    }

    // Intersection junction dots at integer grid crossings
    const intersections = new Set<string>();
    for (const [x1, y1, x2, y2] of ROAD_SEGMENTS) {
      const minX = Math.ceil(Math.min(x1, x2));
      const maxX = Math.floor(Math.max(x1, x2));
      const minY = Math.ceil(Math.min(y1, y2));
      const maxY = Math.floor(Math.max(y1, y2));
      if (x1 === x2) {
        // Vertical road — mark integer y positions
        for (let gy = minY; gy <= maxY; gy++) intersections.add(`${x1},${gy}`);
      } else if (y1 === y2) {
        // Horizontal road — mark integer x positions
        for (let gx = minX; gx <= maxX; gx++) intersections.add(`${gx},${y1}`);
      }
    }
    for (const key of intersections) {
      const [gx, gy] = key.split(',').map(Number);
      const pos = isoProject(gx, gy, this.centerX, this.centerY);
      this.roads
        .circle(pos.x, pos.y, 5)
        .fill({ color: 0x1a2030, alpha: 0.3 });
    }
  }

  private drawDecorativeBuildings(): void {
    this.decorativeBuildings.clear();
    for (const b of DECORATIVE_BUILDINGS) {
      const pos = isoProject(b.gridX, b.gridY, this.centerX, this.centerY);
      this.drawDecorativeBuilding(pos.x, pos.y, b);
    }
  }

  private drawDecorativeBuilding(x: number, y: number, b: DecorativeDef): void {
    const hw = b.width / 2;
    const hd = b.depth / 2;
    const h = b.height;
    const alpha = b.alpha;

    if (b.style === 'flat') {
      this.drawFlatTop(this.decorativeBuildings, x, y, hw, hd, h, b.color, alpha, b.accentColor);
    } else if (b.style === 'wedge') {
      this.drawWedge(this.decorativeBuildings, x, y, hw, hd, h, b.color, alpha, b.accentColor);
    } else {
      this.drawStepped(this.decorativeBuildings, x, y, hw, hd, h, b.color, alpha, b.accentColor);
    }

    // Window grids on both faces
    const seed = Math.round(b.gridX * 1000 + b.gridY * 7777);
    this.drawWindowGrid(this.decorativeBuildings, x, y, hw, hd, h, 'left', seed);
    this.drawWindowGrid(this.decorativeBuildings, x, y, hw, hd, h, 'right', seed + 999);

    // Neon stripe bands (1-2 per building)
    const stripeCount = 1 + (seed % 2);
    for (let s = 0; s < stripeCount; s++) {
      const frac = 0.3 + (((seed + s * 37) % 40) / 100);
      const stripeAlpha = 0.20 + ((seed + s) % 10) * 0.01;
      const stripeY = y - h + h * frac;
      // Draw on left face
      const ly1 = stripeY + hd * 1;
      const ly2 = stripeY + hd * 0;
      this.decorativeBuildings
        .poly([
          x - hw, ly2,
          x, ly1,
          x, ly1 + 2,
          x - hw, ly2 + 2,
        ])
        .fill({ color: b.accentColor, alpha: stripeAlpha });
    }

    // Rooftop details (~50% chance)
    if (seed % 2 === 0) {
      const topY = y - h - hd;
      if (seed % 4 < 2) {
        // Antenna
        const ax = x + ((seed % 3) - 1) * 2;
        const aLen = 4 + (seed % 5);
        this.decorativeBuildings
          .moveTo(ax, topY)
          .lineTo(ax, topY - aLen)
          .stroke({ color: 0x445566, alpha: 0.30, width: 1 });
        this.decorativeBuildings
          .circle(ax, topY - aLen, 1)
          .fill({ color: 0xff2200, alpha: 0.25 });
      } else {
        // AC unit
        const ux = x + ((seed % 5) - 2);
        this.decorativeBuildings
          .rect(ux - 1.5, topY - 2, 3, 2)
          .fill({ color: 0x1a2030, alpha: 0.30 });
      }
    }
  }

  private drawWindowGrid(g: Graphics, x: number, y: number, hw: number, hd: number, h: number, face: 'left' | 'right', seed: number): void {
    const rand = seededRand(seed);
    const rowSpacing = 8;
    const colSpacing = 6;
    const rows = Math.floor(h / rowSpacing);
    const cols = Math.max(2, Math.floor((hw + hd) / colSpacing));

    for (let row = 1; row < rows; row++) {
      const frac = row / rows;
      const wy = y - h + h * frac;
      for (let col = 0; col < cols; col++) {
        if (rand() < 0.30) continue; // skip ~30% for organic look
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
        const windowAlpha = 0.15 + rand() * 0.15; // 0.15-0.30
        g.rect(wx - 1, skewY - 1, 2, 2)
          .fill({ color: windowColor, alpha: windowAlpha });
      }
    }
  }

  private drawFlatTop(g: Graphics, x: number, y: number, hw: number, hd: number, h: number, color: number, alpha: number, accent?: number): void {
    // Top
    g.poly([x, y - h - hd, x + hw, y - h, x, y - h + hd, x - hw, y - h])
      .fill({ color: shade(color, 0.9), alpha: alpha * 1.2 });
    // Left face
    g.poly([x - hw, y - h, x, y - h + hd, x, y + hd, x - hw, y])
      .fill({ color: shade(color, 0.4), alpha });
    // Right face
    g.poly([x + hw, y - h, x, y - h + hd, x, y + hd, x + hw, y])
      .fill({ color: shade(color, 0.6), alpha });
    // Top edge
    g.moveTo(x, y - h - hd).lineTo(x + hw, y - h)
      .lineTo(x, y - h + hd).lineTo(x - hw, y - h).closePath()
      .stroke({ color, alpha: alpha * 0.5, width: 1 });

    // Neon edge outlines
    if (accent !== undefined) {
      const ea = 0.25;
      // Top diamond
      g.moveTo(x, y - h - hd).lineTo(x + hw, y - h)
        .lineTo(x, y - h + hd).lineTo(x - hw, y - h).closePath()
        .stroke({ color: accent, alpha: ea, width: 1 });
      // Left face edges
      g.moveTo(x - hw, y - h).lineTo(x - hw, y)
        .stroke({ color: accent, alpha: ea, width: 1 });
      g.moveTo(x, y - h + hd).lineTo(x, y + hd)
        .stroke({ color: accent, alpha: ea, width: 1 });
      // Right face edges
      g.moveTo(x + hw, y - h).lineTo(x + hw, y)
        .stroke({ color: accent, alpha: ea, width: 1 });
      // Bottom edges
      g.moveTo(x - hw, y).lineTo(x, y + hd).lineTo(x + hw, y)
        .stroke({ color: accent, alpha: ea * 0.6, width: 1 });
    }
  }

  private drawWedge(g: Graphics, x: number, y: number, hw: number, hd: number, h: number, color: number, alpha: number, accent?: number): void {
    const apex = h * 0.3; // rear raised by this amount
    // Top face (slanted) — rear-left corner raised
    g.poly([
      x, y - h - apex - hd,  // back (raised)
      x + hw, y - h,          // right
      x, y - h + hd,          // front
      x - hw, y - h,          // left
    ]).fill({ color: shade(color, 0.9), alpha: alpha * 1.2 });
    // Left face (taller at back)
    g.poly([
      x - hw, y - h,
      x, y - h - apex - hd,
      x, y + hd,
      x - hw, y,
    ]).fill({ color: shade(color, 0.4), alpha });
    // Right face
    g.poly([x + hw, y - h, x, y - h + hd, x, y + hd, x + hw, y])
      .fill({ color: shade(color, 0.6), alpha });

    // Neon edge outlines
    if (accent !== undefined) {
      const ea = 0.25;
      // Top quad
      g.moveTo(x, y - h - apex - hd).lineTo(x + hw, y - h)
        .lineTo(x, y - h + hd).lineTo(x - hw, y - h).closePath()
        .stroke({ color: accent, alpha: ea, width: 1 });
      // Left face vertical edges
      g.moveTo(x - hw, y - h).lineTo(x - hw, y)
        .stroke({ color: accent, alpha: ea, width: 1 });
      g.moveTo(x, y - h - apex - hd).lineTo(x, y + hd)
        .stroke({ color: accent, alpha: ea, width: 1 });
      // Right face vertical edges
      g.moveTo(x + hw, y - h).lineTo(x + hw, y)
        .stroke({ color: accent, alpha: ea, width: 1 });
      // Bottom
      g.moveTo(x - hw, y).lineTo(x, y + hd).lineTo(x + hw, y)
        .stroke({ color: accent, alpha: ea * 0.6, width: 1 });
    }
  }

  private drawStepped(g: Graphics, x: number, y: number, hw: number, hd: number, h: number, color: number, alpha: number, accent?: number): void {
    const lowerH = h * 0.6;
    const upperH = h * 0.4;
    const uhw = hw * 0.7;
    const uhd = hd * 0.7;

    // Lower tier (full footprint)
    this.drawFlatTop(g, x, y, hw, hd, lowerH, color, alpha, accent);
    // Upper tier (smaller footprint, on top of lower)
    this.drawFlatTop(g, x, y - lowerH, uhw, uhd, upperH, shade(color, 1.1), alpha * 0.9, accent);
  }

  private drawPeripheralBuildings(): void {
    this.peripheralBuildings.clear();
    for (let i = 0; i < PERIPHERAL_BUILDINGS.length; i++) {
      const b = PERIPHERAL_BUILDINGS[i];
      const pos = isoProject(b.gridX, b.gridY, this.centerX, this.centerY);
      this.drawPeripheralBuilding(pos.x, pos.y, b, i);
    }
  }

  private drawPeripheralBuilding(x: number, y: number, b: PeripheralDef, index: number): void {
    const hw = b.width / 2;
    const hd = b.depth / 2;
    const h = b.height;
    const alpha = 0.25;

    // Top
    this.peripheralBuildings
      .poly([x, y - h - hd, x + hw, y - h, x, y - h + hd, x - hw, y - h])
      .fill({ color: shade(b.color, 0.9), alpha: alpha * 1.2 });
    // Left face
    this.peripheralBuildings
      .poly([x - hw, y - h, x, y - h + hd, x, y + hd, x - hw, y])
      .fill({ color: shade(b.color, 0.4), alpha });
    // Right face
    this.peripheralBuildings
      .poly([x + hw, y - h, x, y - h + hd, x, y + hd, x + hw, y])
      .fill({ color: shade(b.color, 0.6), alpha });
    // Top edge
    this.peripheralBuildings
      .moveTo(x, y - h - hd).lineTo(x + hw, y - h)
      .lineTo(x, y - h + hd).lineTo(x - hw, y - h).closePath()
      .stroke({ color: b.color, alpha: alpha * 0.8, width: 1 });

    // Window grids on both faces
    const seed = Math.round(b.gridX * 1000 + b.gridY * 7777 + 5000);
    this.drawPeripheralWindowGrid(x, y, hw, hd, h, 'left', seed);
    this.drawPeripheralWindowGrid(x, y, hw, hd, h, 'right', seed + 999);

    // Billboard panels on selected buildings
    if (BILLBOARD_INDICES.includes(index)) {
      this.drawBillboard(x, y, hw, hd, h, index);
    }
  }

  private drawPeripheralWindowGrid(x: number, y: number, hw: number, hd: number, h: number, face: 'left' | 'right', seed: number): void {
    const rand = seededRand(seed);
    const windowRows = Math.floor(h / 12);
    const windowCols = Math.floor((hw + hd) / 8);
    for (let row = 1; row < windowRows; row++) {
      const frac = row / windowRows;
      const wy = y - h + h * frac;
      for (let col = 0; col < windowCols; col++) {
        if (rand() < 0.30) continue;
        const colFrac = (col + 0.5) / windowCols;

        let wx: number, skewY: number;
        if (face === 'left') {
          wx = x - hw + hw * colFrac;
          skewY = wy + hd * (1 - colFrac);
        } else {
          wx = x + hw * colFrac;
          skewY = wy + hd * colFrac;
        }

        const windowColor = WINDOW_COLORS[Math.floor(rand() * WINDOW_COLORS.length)];
        const windowAlpha = 0.12 + rand() * 0.08; // 0.12-0.20
        this.peripheralBuildings
          .rect(wx - 1, skewY - 1, 2, 2)
          .fill({ color: windowColor, alpha: windowAlpha });
      }
    }
  }

  private drawBillboard(x: number, y: number, hw: number, hd: number, h: number, index: number): void {
    // Large colored rectangle on left face
    const billColor = ACCENT_PALETTE[index % ACCENT_PALETTE.length];
    const billAlpha = 0.20 + (index % 3) * 0.05; // 0.20-0.30
    const topFrac = 0.2 + (index % 3) * 0.1;
    const bottomFrac = topFrac + 0.4;

    const ty = y - h + h * topFrac;
    const by = y - h + h * bottomFrac;
    const leftInset = 0.15;
    const rightInset = 0.85;

    // Billboard quad on left face (isometric-projected)
    const tl_x = x - hw + hw * leftInset;
    const tl_y = ty + hd * (1 - leftInset);
    const tr_x = x - hw + hw * rightInset;
    const tr_y = ty + hd * (1 - rightInset);
    const br_x = x - hw + hw * rightInset;
    const br_y = by + hd * (1 - rightInset);
    const bl_x = x - hw + hw * leftInset;
    const bl_y = by + hd * (1 - leftInset);

    this.peripheralBuildings
      .poly([tl_x, tl_y, tr_x, tr_y, br_x, br_y, bl_x, bl_y])
      .fill({ color: billColor, alpha: billAlpha });

    // "Text" detail lines — 1-2 horizontal stripes inside the billboard
    const stripeCount = 1 + (index % 2);
    for (let s = 0; s < stripeCount; s++) {
      const sf = topFrac + (bottomFrac - topFrac) * (0.3 + s * 0.3);
      const sy = y - h + h * sf;
      const sl_x = x - hw + hw * (leftInset + 0.05);
      const sl_y = sy + hd * (1 - leftInset - 0.05);
      const sr_x = x - hw + hw * (rightInset - 0.05);
      const sr_y = sy + hd * (1 - rightInset + 0.05);
      this.peripheralBuildings
        .moveTo(sl_x, sl_y)
        .lineTo(sr_x, sr_y)
        .stroke({ color: 0xffffff, alpha: billAlpha * 0.5, width: 1 });
    }
  }

  private drawTrees(): void {
    this.trees.clear();
    for (const t of TREE_POSITIONS) {
      const pos = isoProject(t.gridX, t.gridY, this.centerX, this.centerY);
      // Trunk
      this.trees
        .rect(pos.x - 1, pos.y - 8, 2, 8)
        .fill({ color: 0x3a2f1a, alpha: 0.20 });
      // Diamond canopy
      this.trees
        .poly([pos.x, pos.y - 14, pos.x + 4, pos.y - 10, pos.x, pos.y - 6, pos.x - 4, pos.y - 10])
        .fill({ color: 0x1a4a2a, alpha: 0.25 });
    }
  }

  private drawArcade(): void {
    this.arcade.clear();
    const g = this.arcade;
    const pos = isoProject(1.5, -0.8, this.centerX, this.centerY);
    const x = pos.x;
    const y = pos.y;
    const hw = 16;
    const hd = 11;
    const h = 44;
    const alpha = 0.42;
    const bodyColor = 0x0d1520;
    const accentColor = 0xffff00;

    // Use the same flat-top building as other decorative buildings
    this.drawFlatTop(g, x, y, hw, hd, h, bodyColor, alpha, accentColor);

    // Window grid on both faces (same as other decorative buildings)
    const seed = 8888;
    this.drawWindowGrid(g, x, y, hw, hd, h, 'left', seed);
    this.drawWindowGrid(g, x, y, hw, hd, h, 'right', seed + 999);

    // Neon stripe bands (yellow, matching accent)
    for (const frac of [0.18, 0.82]) {
      const stripeY = y - h + h * frac;
      const ly1 = stripeY + hd * 1;
      const ly2 = stripeY + hd * 0;
      g.poly([x - hw, ly2, x, ly1, x, ly1 + 2, x - hw, ly2 + 2])
        .fill({ color: accentColor, alpha: 0.22 });
    }

    // Rooftop antenna
    const topY = y - h - hd;
    g.moveTo(x, topY).lineTo(x, topY - 6)
      .stroke({ color: 0x445566, alpha: 0.30, width: 1 });
    g.circle(x, topY - 6, 1)
      .fill({ color: 0xffff00, alpha: 0.30 });

    // === LEFT FACE: Pac-Man mural ===
    // Helper to get a point on the left face: u=0..1 (left edge to center), v=0..1 (top to bottom)
    const leftFacePoint = (u: number, v: number) => {
      const faceTop = y - h;
      const faceBot = y;
      const py = faceTop + (faceBot - faceTop) * v;
      // Left edge is at (x-hw, py), right edge at (x, py+hd)
      const px = (x - hw) + (hw) * u;
      const skew = hd * (1 - u) + hd * u * 0; // iso skew: left edge has +hd offset, right edge has 0
      return { x: px, y: py + hd * (1 - u) };
    };

    // Pac-Man — centered on left face at ~40% from top
    const pac = leftFacePoint(0.5, 0.40);
    const pacR = 5;
    const pacAlpha = 0.50;
    g.circle(pac.x, pac.y, pacR)
      .fill({ color: 0xffff00, alpha: pacAlpha });
    // Mouth cut-out (wedge pointing right along face)
    const mouthDx = hw * 0.04; // slight iso direction
    g.poly([
      pac.x, pac.y,
      pac.x + pacR * 0.9 + mouthDx, pac.y - pacR * 0.5,
      pac.x + pacR * 0.9 + mouthDx, pac.y + pacR * 0.5,
    ]).fill({ color: shade(bodyColor, 0.4), alpha });
    // Eye
    g.circle(pac.x + 1, pac.y - pacR * 0.35, 0.8)
      .fill({ color: 0x0a0a1e, alpha: 0.6 });

    // Pac-dots trail (going left/down along face)
    for (let d = 1; d <= 3; d++) {
      const dot = leftFacePoint(0.5 - d * 0.12, 0.40 + d * 0.03);
      g.circle(dot.x, dot.y, 1)
        .fill({ color: 0xffff00, alpha: 0.40 });
    }
    // Power pellet
    const pellet = leftFacePoint(0.12, 0.48);
    g.circle(pellet.x, pellet.y, 1.8)
      .fill({ color: 0xffff00, alpha: 0.50 });

    // Draw ghosts on separate layer (so they can be redrawn for power pill)
    this.drawArcadeGhosts(false);
  }

  private drawArcadeGhosts(frightened: boolean): void {
    this.arcadeGhosts.clear();
    const g = this.arcadeGhosts;
    const pos = isoProject(1.5, -0.8, this.centerX, this.centerY);
    const x = pos.x;
    const y = pos.y;
    const hw = 16;
    const hd = 11;
    const h = 44;

    const rightFacePoint = (u: number, v: number) => {
      const faceTop = y - h;
      const faceBot = y;
      const py = faceTop + (faceBot - faceTop) * v;
      const px = x + hw * u;
      return { x: px, y: py + hd * u };
    };

    const normalColors = [0xff0000, 0xffb8ff, 0x00ffff, 0xffb852]; // Blinky, Pinky, Inky, Clyde
    const frightenedColor = 0x2222dd;
    const frightenedFlash = this.powerPillTimer < 2 && this.powerPillTimer > 0;

    for (let gi = 0; gi < 4; gi++) {
      const u = 0.15 + gi * 0.20;
      // When frightened and flashing (last 2s), alternate white/blue
      let gc: number;
      if (frightened) {
        gc = (frightenedFlash && Math.floor(this.elapsed * 8) % 2 === 0) ? 0xffffff : frightenedColor;
      } else {
        gc = normalColors[gi];
      }
      const ga = 0.45;
      const gp = rightFacePoint(u, 0.38 + gi * 0.02);
      const gw = 4;
      const gh = 5.5;

      // Head (rounded rect)
      g.roundRect(gp.x - gw / 2, gp.y - gh, gw, gh * 0.7, 2)
        .fill({ color: gc, alpha: ga });
      // Body skirt
      g.rect(gp.x - gw / 2, gp.y - gh * 0.4, gw, gh * 0.4)
        .fill({ color: gc, alpha: ga });
      // Wavy bottom — 3 bumps
      const bw = gw / 3;
      for (let b = 0; b < 3; b++) {
        g.circle(gp.x - gw / 2 + bw * b + bw / 2, gp.y, bw / 2)
          .fill({ color: gc, alpha: ga });
      }
      // Eyes — frightened ghosts get wavy mouth + small dot eyes
      const eo = gw * 0.17;
      if (frightened) {
        // Dot eyes
        g.circle(gp.x - eo, gp.y - gh * 0.55, 0.7)
          .fill({ color: 0xffcccc, alpha: ga });
        g.circle(gp.x + eo, gp.y - gh * 0.55, 0.7)
          .fill({ color: 0xffcccc, alpha: ga });
        // Wavy frown mouth
        g.moveTo(gp.x - gw * 0.3, gp.y - gh * 0.3)
          .lineTo(gp.x - gw * 0.15, gp.y - gh * 0.35)
          .lineTo(gp.x, gp.y - gh * 0.3)
          .lineTo(gp.x + gw * 0.15, gp.y - gh * 0.35)
          .lineTo(gp.x + gw * 0.3, gp.y - gh * 0.3)
          .stroke({ color: 0xffcccc, alpha: ga, width: 0.5 });
      } else {
        // Normal white eyes with blue pupils
        g.circle(gp.x - eo, gp.y - gh * 0.55, 1.1)
          .fill({ color: 0xffffff, alpha: ga });
        g.circle(gp.x + eo, gp.y - gh * 0.55, 1.1)
          .fill({ color: 0xffffff, alpha: ga });
        g.circle(gp.x - eo + 0.3, gp.y - gh * 0.55, 0.6)
          .fill({ color: 0x2222ff, alpha: ga });
        g.circle(gp.x + eo + 0.3, gp.y - gh * 0.55, 0.6)
          .fill({ color: 0x2222ff, alpha: ga });
      }
    }
  }

  private drawSpaceNeedle(): void {
    this.spaceNeedle.clear();
    const g = this.spaceNeedle;
    const pos = isoProject(0, -0.8, this.centerX, this.centerY);
    const x = pos.x;
    const y = pos.y;
    const alpha = 0.50;
    const steelGray = 0x8899aa;
    const darkShaft = 0x556677;
    const accent = 0x00fff5;
    const magenta = 0xff00ff;

    // Total height ~120px — taller and more prominent
    const totalH = 120;
    const baseY = y;
    const legTopY = baseY - totalH * 0.28;
    const deckY = baseY - totalH * 0.62;
    const spireTopY = baseY - totalH;

    // === Ground shadow (drawn first, behind everything) ===
    g.ellipse(x, baseY + 2, 16, 6)
      .fill({ color: 0x000000, alpha: 0.10 });

    // === Base platform — isometric diamond pad ===
    const padHW = 16;
    const padHD = 7;
    g.poly([x, baseY - padHD, x + padHW, baseY, x, baseY + padHD, x - padHW, baseY])
      .fill({ color: 0x1a2a3f, alpha: 0.30 });
    g.moveTo(x, baseY - padHD).lineTo(x + padHW, baseY)
      .lineTo(x, baseY + padHD).lineTo(x - padHW, baseY).closePath()
      .stroke({ color: accent, alpha: 0.18, width: 1 });

    // === Tripod legs with structural cross-bracing ===
    const legSpread = 16;
    // Outer legs — thicker, gradient feel via double stroke
    for (const [lx, ly] of [[x - legSpread, baseY], [x + legSpread, baseY], [x, baseY + 5]] as [number, number][]) {
      // Glow stroke behind
      g.moveTo(lx, ly).lineTo(x + (lx === x ? 0 : (lx < x ? 1 : -1)), legTopY)
        .stroke({ color: accent, alpha: 0.08, width: 4 });
      // Main steel stroke
      g.moveTo(lx, ly).lineTo(x + (lx === x ? 0 : (lx < x ? 1 : -1)), legTopY)
        .stroke({ color: steelGray, alpha, width: 2 });
      // Foot accent
      g.circle(lx, ly, 2)
        .fill({ color: accent, alpha: 0.20 });
    }

    // Cross-bracing between legs (structural diamond pattern)
    const braceCount = 3;
    for (let i = 1; i <= braceCount; i++) {
      const t = i / (braceCount + 1);
      const brY = baseY + (legTopY - baseY) * t;
      const spread = legSpread * (1 - t);
      g.moveTo(x - spread, brY).lineTo(x + spread, brY)
        .stroke({ color: darkShaft, alpha: alpha * 0.5, width: 0.8 });
      // X cross
      if (i < braceCount) {
        const t2 = (i + 1) / (braceCount + 1);
        const brY2 = baseY + (legTopY - baseY) * t2;
        const spread2 = legSpread * (1 - t2);
        g.moveTo(x - spread, brY).lineTo(x + spread2, brY2)
          .stroke({ color: darkShaft, alpha: alpha * 0.3, width: 0.5 });
        g.moveTo(x + spread, brY).lineTo(x - spread2, brY2)
          .stroke({ color: darkShaft, alpha: alpha * 0.3, width: 0.5 });
      }
    }

    // === Central shaft — tapered with neon accent strips ===
    const shaftTop = deckY + 8;
    const shaftBot = legTopY;
    const shaftW = 2;
    g.poly([
      x - shaftW - 1, shaftBot,
      x + shaftW + 1, shaftBot,
      x + shaftW, shaftTop,
      x - shaftW, shaftTop,
    ]).fill({ color: darkShaft, alpha });
    // Neon accent strips running up shaft
    g.moveTo(x - shaftW, shaftBot).lineTo(x - shaftW, shaftTop)
      .stroke({ color: accent, alpha: 0.20, width: 0.8 });
    g.moveTo(x + shaftW, shaftBot).lineTo(x + shaftW, shaftTop)
      .stroke({ color: magenta, alpha: 0.15, width: 0.8 });

    // === Observation deck — wider, multi-layered saucer ===
    const deckHW = 22;
    const deckHD = 10;
    const deckThick = 6;

    // Deck underside glow (drawn before deck so it's behind)
    g.poly([
      x - deckHW * 0.8, deckY + deckThick + 1,
      x, deckY + deckHD + deckThick + 2,
      x + deckHW * 0.8, deckY + deckThick + 1,
    ]).fill({ color: accent, alpha: 0.06 });

    // Main deck top surface
    g.poly([
      x, deckY - deckHD,
      x + deckHW, deckY,
      x, deckY + deckHD,
      x - deckHW, deckY,
    ]).fill({ color: shade(steelGray, 0.95), alpha: alpha * 1.1 });

    // Inner ring on top face (restaurant level)
    const innerHW = deckHW * 0.55;
    const innerHD = deckHD * 0.55;
    g.poly([
      x, deckY - innerHD,
      x + innerHW, deckY,
      x, deckY + innerHD,
      x - innerHW, deckY,
    ]).fill({ color: shade(steelGray, 1.1), alpha: alpha * 0.6 });
    g.moveTo(x, deckY - innerHD).lineTo(x + innerHW, deckY)
      .lineTo(x, deckY + innerHD).lineTo(x - innerHW, deckY).closePath()
      .stroke({ color: accent, alpha: 0.18, width: 0.5 });

    // Deck left underside
    g.poly([
      x - deckHW, deckY,
      x, deckY + deckHD,
      x, deckY + deckHD + deckThick,
      x - deckHW, deckY + deckThick,
    ]).fill({ color: shade(steelGray, 0.35), alpha });

    // Deck right underside
    g.poly([
      x + deckHW, deckY,
      x, deckY + deckHD,
      x, deckY + deckHD + deckThick,
      x + deckHW, deckY + deckThick,
    ]).fill({ color: shade(steelGray, 0.55), alpha });

    // Deck rim — dual accent edges (cyan outer, magenta inner)
    g.moveTo(x, deckY - deckHD).lineTo(x + deckHW, deckY)
      .lineTo(x, deckY + deckHD).lineTo(x - deckHW, deckY).closePath()
      .stroke({ color: accent, alpha: 0.30, width: 1.5 });
    g.moveTo(x, deckY - deckHD + 1).lineTo(x + deckHW - 1, deckY)
      .lineTo(x, deckY + deckHD - 1).lineTo(x - deckHW + 1, deckY).closePath()
      .stroke({ color: magenta, alpha: 0.12, width: 0.5 });

    // Bottom lip
    g.moveTo(x - deckHW, deckY + deckThick)
      .lineTo(x, deckY + deckHD + deckThick)
      .lineTo(x + deckHW, deckY + deckThick)
      .stroke({ color: accent, alpha: 0.18, width: 1 });

    // Window dots around the deck rim — two rows
    for (let row = 0; row < 2; row++) {
      const windowCount = row === 0 ? 14 : 8;
      const yOff = row * 3;
      const scale = row === 0 ? 1 : 0.7;
      const hw = deckHW * scale;
      const hd = deckHD * scale;
      for (let i = 0; i < windowCount; i++) {
        const t = (i + 0.5) / windowCount;
        let wx: number, wy: number;
        if (t < 0.25) {
          const f = t / 0.25;
          wx = x + hw * f;
          wy = deckY - hd + hd * f;
        } else if (t < 0.5) {
          const f = (t - 0.25) / 0.25;
          wx = x + hw * (1 - f);
          wy = deckY + hd * f;
        } else if (t < 0.75) {
          const f = (t - 0.5) / 0.25;
          wx = x - hw * f;
          wy = deckY + hd * (1 - f);
        } else {
          const f = (t - 0.75) / 0.25;
          wx = x - hw * (1 - f);
          wy = deckY - hd * f;
        }
        const wColor = row === 0 ? 0xffd93d : 0x00fff5;
        g.circle(wx, wy + 2 + yOff, row === 0 ? 1.2 : 0.8)
          .fill({ color: wColor, alpha: 0.30 });
      }
    }

    // === Top spire / antenna — multi-segment with accent rings ===
    const spireBase = deckY - deckHD;
    // Main spire shaft
    g.moveTo(x, spireBase).lineTo(x, spireTopY)
      .stroke({ color: steelGray, alpha: alpha * 0.9, width: 2 });
    // Accent glow along spire
    g.moveTo(x, spireBase).lineTo(x, spireTopY)
      .stroke({ color: accent, alpha: 0.10, width: 4 });

    // Accent rings along spire
    const ringCount = 4;
    for (let i = 0; i < ringCount; i++) {
      const t = (i + 1) / (ringCount + 1);
      const ry = spireBase + (spireTopY - spireBase) * t;
      const rw = 3 - i * 0.5;
      g.moveTo(x - rw, ry).lineTo(x + rw, ry)
        .stroke({ color: i % 2 === 0 ? accent : magenta, alpha: 0.25, width: 1 });
    }

    // Antenna tip finial
    g.circle(x, spireTopY, 1.5)
      .fill({ color: steelGray, alpha: alpha * 0.8 });
  }

  triggerPowerPill(): void {
    this.powerPillTimer = 8; // 8 seconds of frightened ghosts
  }

  triggerUfoAttack(): void {
    this.ufoTimer = 8;
    this.ufoPhase = 0;
  }

  update(dt: number): void {
    this.elapsed += dt * 0.02;

    // Power pill ghost effect
    if (this.powerPillTimer > 0) {
      this.powerPillTimer -= dt * (1 / 60);
      this.drawArcadeGhosts(true);
      if (this.powerPillTimer <= 0) {
        this.powerPillTimer = 0;
        this.drawArcadeGhosts(false);
      }
    }

    // UFO attack effect
    this.ufoAttack.clear();
    if (this.ufoTimer > 0) {
      this.ufoTimer -= dt * (1 / 60);
      this.ufoPhase += dt * (1 / 60);
      if (this.ufoTimer <= 0) {
        this.ufoTimer = 0;
        this.ufoPhase = 0;
      } else {
        this.drawUfoAttack();
      }
    }

    // Warning lights — slow pulse
    this.warningLights.clear();
    const lightAlpha = 0.03 + Math.sin(this.elapsed * 1.2) * 0.02;
    for (const b of PERIPHERAL_BUILDINGS) {
      if (!b.hasWarningLight) continue;
      const pos = isoProject(b.gridX, b.gridY, this.centerX, this.centerY);
      this.warningLights
        .circle(pos.x, pos.y - b.height - b.depth / 2 - 2, 1.5)
        .fill({ color: 0xff2200, alpha: lightAlpha });
    }

    // Space Needle beacon
    this.spaceNeedleBeacon.clear();
    {
      const snPos = isoProject(0, -0.8, this.centerX, this.centerY);
      const snX = snPos.x;
      const snY = snPos.y;
      const totalH = 120;
      const spireTopY = snY - totalH;
      const deckY = snY - totalH * 0.62;
      const deckHW = 22;
      const deckHD = 10;

      // Pulsing red beacon at antenna tip
      const beaconPulse = 0.15 + Math.sin(this.elapsed * 1.8) * 0.12;
      this.spaceNeedleBeacon
        .circle(snX, spireTopY, 2.5)
        .fill({ color: 0xff2200, alpha: beaconPulse });
      // Beacon glow halo
      this.spaceNeedleBeacon
        .circle(snX, spireTopY, 7)
        .fill({ color: 0xff2200, alpha: beaconPulse * 0.25 });

      // Secondary beacon rings along spire
      const spireBase = deckY - deckHD;
      for (let i = 0; i < 4; i++) {
        const t = (i + 1) / 5;
        const ry = spireBase + (spireTopY - spireBase) * t;
        const ringPulse = 0.06 + Math.sin(this.elapsed * 1.2 + i * 1.5) * 0.04;
        this.spaceNeedleBeacon
          .circle(snX, ry, 2)
          .fill({ color: i % 2 === 0 ? 0x00fff5 : 0xff00ff, alpha: ringPulse });
      }

      // Observation deck glow pulse
      const deckGlow = 0.05 + Math.sin(this.elapsed * 0.8) * 0.03;
      this.spaceNeedleBeacon
        .poly([
          snX, deckY - deckHD,
          snX + deckHW, deckY,
          snX, deckY + deckHD,
          snX - deckHW, deckY,
        ])
        .fill({ color: 0x00fff5, alpha: deckGlow });

      // Underside glow pulse (magenta)
      const underGlow = 0.03 + Math.sin(this.elapsed * 1.0 + 1) * 0.02;
      this.spaceNeedleBeacon
        .poly([
          snX - deckHW * 0.6, deckY + 7,
          snX, deckY + deckHD + 8,
          snX + deckHW * 0.6, deckY + 7,
        ])
        .fill({ color: 0xff00ff, alpha: underGlow });
    }

    // Neon signs — pulse
    this.neonSigns.clear();
    for (const sign of this.neonSignDefs) {
      const pulse = 0.40 + Math.sin(this.elapsed * sign.freq * Math.PI * 2) * 0.10;
      const b = sign.building;
      const hw = b.width / 2;
      const hd = b.depth / 2;
      const h = b.height;
      const x = sign.bx;
      const y = sign.by;

      let sx: number, sy: number;
      if (sign.face === 'left') {
        const faceY = y - h + h * sign.heightFrac;
        sx = x - hw + hw * sign.widthFrac;
        sy = faceY + hd * (1 - sign.widthFrac);
      } else {
        const faceY = y - h + h * sign.heightFrac;
        sx = x + hw * sign.widthFrac;
        sy = faceY + hd * sign.widthFrac;
      }

      // Glow behind (3× size)
      this.neonSigns
        .rect(sx - sign.w * 1.5, sy - sign.h * 1.5, sign.w * 3, sign.h * 3)
        .fill({ color: sign.color, alpha: pulse * 0.4 });
      // Sign
      this.neonSigns
        .rect(sx - sign.w / 2, sy - sign.h / 2, sign.w, sign.h)
        .fill({ color: sign.color, alpha: pulse });
    }

    // Neon pools — pulse
    this.neonPools.clear();
    for (const pool of NEON_POOL_DEFS) {
      const pos = isoProject(pool.gridX, pool.gridY, this.centerX, this.centerY);
      const pulse = 0.20 + Math.sin(this.elapsed * pool.freq * Math.PI * 2) * 0.06;
      this.neonPools
        .ellipse(pos.x, pos.y, pool.rx, pool.ry)
        .fill({ color: pool.color, alpha: pulse });
    }

    // Mystery data crystals
    this.mysteryData.clear();
    for (const md of MYSTERY_DATA) {
      const pos = isoProject(md.gridX, md.gridY, this.centerX, this.centerY);
      const spin = Math.sin(this.elapsed * md.freq);
      const halfW = md.size * 0.5 * Math.abs(spin); // simulate Y-axis rotation
      const bob = Math.sin(this.elapsed * 1.5 + md.gridX * 2 + md.gridY) * 3;
      const cx = pos.x;
      const cy = pos.y - md.size - 2 + bob;

      // Ground shadow
      this.mysteryData
        .ellipse(pos.x, pos.y, 4 + halfW * 0.5, 2)
        .fill({ color: 0x000000, alpha: 0.10 });

      // Pulsing glow behind crystal
      const glowPulse = 0.08 + Math.sin(this.elapsed * md.freq * 2) * 0.04;
      this.mysteryData
        .circle(cx, cy, md.size * 1.2)
        .fill({ color: md.color, alpha: glowPulse });

      // Top half — brighter
      this.mysteryData
        .poly([cx, cy - md.size, cx + halfW, cy, cx, cy + 1, cx - halfW, cy])
        .fill({ color: md.color, alpha: 0.55 });

      // Bottom half — darker
      this.mysteryData
        .poly([cx, cy, cx + halfW, cy, cx, cy + md.size, cx - halfW, cy])
        .fill({ color: shade(md.color, 0.5), alpha: 0.45 });

      // Edge highlights
      if (halfW > 1) {
        this.mysteryData
          .moveTo(cx, cy - md.size).lineTo(cx + halfW, cy)
          .stroke({ color: 0xffffff, alpha: 0.15, width: 0.5 })
          .moveTo(cx, cy - md.size).lineTo(cx - halfW, cy)
          .stroke({ color: 0xffffff, alpha: 0.10, width: 0.5 })
          .moveTo(cx + halfW, cy).lineTo(cx, cy + md.size)
          .stroke({ color: 0xffffff, alpha: 0.08, width: 0.5 })
          .moveTo(cx - halfW, cy).lineTo(cx, cy + md.size)
          .stroke({ color: 0xffffff, alpha: 0.06, width: 0.5 });
      }
    }

    // Arcade digital banner
    this.arcadeBanner.clear();
    {
      const aPos = isoProject(1.5, -0.8, this.centerX, this.centerY);
      const ax = aPos.x;
      const ay = aPos.y;
      const ahw = 16;
      const ahd = 11;
      const ah = 44;
      // Top face diamond corners
      const topN = { x: ax, y: ay - ah - ahd };        // north
      const topE = { x: ax + ahw, y: ay - ah };         // east
      const topS = { x: ax, y: ay - ah + ahd };         // south
      const topW = { x: ax - ahw, y: ay - ah };         // west

      // Scroll colored segments across the top face
      const segCount = 6;
      const scrollSpeed = 0.4;
      const bannerColors = [0xff0000, 0xffff00, 0x00ff64, 0x00fff5, 0xff00ff, 0xff8800];
      for (let s = 0; s < segCount; s++) {
        const t0 = ((s / segCount) + this.elapsed * scrollSpeed) % 1;
        const t1 = (((s + 1) / segCount) + this.elapsed * scrollSpeed) % 1;
        if (t1 < t0) continue; // skip wrap-around segment

        // Interpolate along the top diamond: go N→E→S→W→N parametrically
        // Use simple left-right interpolation: t=0 is west edge, t=1 is east edge
        const lerp = (a: {x:number;y:number}, b: {x:number;y:number}, f: number) => ({
          x: a.x + (b.x - a.x) * f,
          y: a.y + (b.y - a.y) * f,
        });

        // Top edge: W → N → E (t 0→0.5→1)
        const topAt = (t: number) => {
          if (t < 0.5) return lerp(topW, topN, t * 2);
          return lerp(topN, topE, (t - 0.5) * 2);
        };
        // Bottom edge: W → S → E (t 0→0.5→1)
        const botAt = (t: number) => {
          if (t < 0.5) return lerp(topW, topS, t * 2);
          return lerp(topS, topE, (t - 0.5) * 2);
        };

        const p0t = topAt(t0);
        const p1t = topAt(t1);
        const p0b = botAt(t0);
        const p1b = botAt(t1);

        this.arcadeBanner
          .poly([p0t.x, p0t.y, p1t.x, p1t.y, p1b.x, p1b.y, p0b.x, p0b.y])
          .fill({ color: bannerColors[s % bannerColors.length], alpha: 0.18 });
      }
    }

    // NetNavi — idle + walk
    this.updateNavi(dt);
    this.drawNavi();

    // Spinner lifecycle
    this.spinnerTimer += dt * (1 / 60);
    this.spinner.clear();

    if (this.spinnerProgress >= 0) {
      this.spinnerProgress += dt * 0.002;
      if (this.spinnerProgress >= 1) {
        this.spinnerProgress = -1;
        this.spinnerTimer = 0;
        this.spinnerInterval = 40 + Math.random() * 30;
        return;
      }
      this.drawSpinner();
    } else if (this.spinnerTimer >= this.spinnerInterval) {
      this.spinnerProgress = 0;
      this.spinnerTimer = 0;
    }
  }

  private updateNavi(dt: number): void {
    if (this.naviMoveProgress >= 0) {
      // Walking to next waypoint
      this.naviMoveProgress += dt * 0.008;
      if (this.naviMoveProgress >= 1) {
        this.naviMoveProgress = -1;
        this.naviScreenX = this.naviToX;
        this.naviScreenY = this.naviToY;
        this.naviIdleTimer = 0;
        this.naviIdleWait = 4 + Math.random() * 6;
      } else {
        // Lerp position
        const t = this.naviMoveProgress;
        // Ease in-out
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.naviScreenX = this.naviFromX + (this.naviToX - this.naviFromX) * ease;
        this.naviScreenY = this.naviFromY + (this.naviToY - this.naviFromY) * ease;
      }
    } else {
      // Idle — wait then pick next waypoint
      this.naviIdleTimer += dt * (1 / 60);
      if (this.naviIdleTimer >= this.naviIdleWait) {
        // Pick a different random waypoint
        let next = this.naviWaypointIdx;
        while (next === this.naviWaypointIdx) {
          next = Math.floor(Math.random() * NAVI_WAYPOINTS.length);
        }
        this.naviWaypointIdx = next;
        const wp = NAVI_WAYPOINTS[next];
        const pos = isoProject(wp.gridX, wp.gridY, this.centerX, this.centerY);
        this.naviFromX = this.naviScreenX;
        this.naviFromY = this.naviScreenY;
        this.naviToX = pos.x;
        this.naviToY = pos.y;
        this.naviFacingRight = this.naviToX > this.naviFromX;
        this.naviMoveProgress = 0;
      }
    }
  }

  private drawNavi(): void {
    this.navi.clear();
    const x = this.naviScreenX;
    // Idle bob
    const bob = this.naviMoveProgress >= 0
      ? Math.sin(this.naviMoveProgress * Math.PI * 8) * 1  // walk bounce
      : Math.sin(this.elapsed * 2) * 0.8;                   // idle breathing
    const y = this.naviScreenY + bob;
    const alpha = 0.35;
    const dir = this.naviFacingRight ? 1 : -1;

    // Shadow on ground
    this.navi
      .ellipse(x, this.naviScreenY + 1, 5, 2)
      .fill({ color: 0x000000, alpha: 0.12 });

    // -- MegaMan.EXE pixel sprite (approx 12px tall) --
    // Boots — dark blue
    this.navi
      .rect(x - 3 * dir, y - 2, 2, 2)
      .fill({ color: 0x1144aa, alpha })
      .rect(x + 1 * dir, y - 2, 2, 2)
      .fill({ color: 0x1144aa, alpha });

    // Legs — blue
    this.navi
      .rect(x - 2.5 * dir, y - 5, 2, 3)
      .fill({ color: 0x2266cc, alpha })
      .rect(x + 0.5 * dir, y - 5, 2, 3)
      .fill({ color: 0x2266cc, alpha });

    // Body / torso — bright blue with cyan chest plate
    this.navi
      .rect(x - 3, y - 9, 6, 4)
      .fill({ color: 0x2266cc, alpha });
    // Chest emblem — cyan diamond
    this.navi
      .poly([x, y - 9, x + 1.5, y - 7.5, x, y - 6, x - 1.5, y - 7.5])
      .fill({ color: 0x00fff5, alpha: alpha + 0.1 });

    // Arm — buster arm on front side, normal arm on back
    const busterX = x + 4 * dir;
    const armX = x - 4 * dir;
    // Normal arm
    this.navi
      .rect(armX - 1, y - 8, 2, 3)
      .fill({ color: 0x2266cc, alpha });
    // Buster arm — slightly larger, cyan accent
    this.navi
      .rect(busterX - 1.5, y - 8.5, 3, 3.5)
      .fill({ color: 0x1155bb, alpha });
    this.navi
      .rect(busterX - 1, y - 8, 2, 1)
      .fill({ color: 0x00fff5, alpha: alpha * 0.8 });

    // Head / helmet — rounded blue with ridge
    this.navi
      .roundRect(x - 3.5, y - 14, 7, 5, 2)
      .fill({ color: 0x2266cc, alpha });
    // Visor / face area — dark
    this.navi
      .rect(x - 2, y - 12, 4, 2.5)
      .fill({ color: 0x0a1020, alpha });
    // Eyes — green (MMBN style)
    this.navi
      .rect(x - 1.5, y - 11.5, 1.2, 1.2)
      .fill({ color: 0x00ff64, alpha: alpha + 0.15 })
      .rect(x + 0.3, y - 11.5, 1.2, 1.2)
      .fill({ color: 0x00ff64, alpha: alpha + 0.15 });
    // Helmet ridge — cyan stripe on top
    this.navi
      .rect(x - 0.5, y - 14.5, 1, 3)
      .fill({ color: 0x00fff5, alpha: alpha + 0.05 });
    // Ear guards
    this.navi
      .circle(x - 3.5, y - 11.5, 1.5)
      .fill({ color: 0x1155bb, alpha });
    this.navi
      .circle(x + 3.5, y - 11.5, 1.5)
      .fill({ color: 0x1155bb, alpha });

    // Subtle glow under feet when idle (MMBN panel glow)
    if (this.naviMoveProgress < 0) {
      const glowPulse = 0.06 + Math.sin(this.elapsed * 1.5) * 0.03;
      this.navi
        .poly([x, this.naviScreenY - 4, x + 8, this.naviScreenY, x, this.naviScreenY + 4, x - 8, this.naviScreenY])
        .fill({ color: 0x00fff5, alpha: glowPulse });
    }
  }

  private drawUfoAttack(): void {
    const g = this.ufoAttack;
    const snPos = isoProject(0, -0.8, this.centerX, this.centerY);
    const snX = snPos.x;
    const snY = snPos.y;
    const totalH = 120;
    const spireTopY = snY - totalH;
    const deckY = snY - totalH * 0.62;

    const duration = 8;
    const t = this.ufoPhase / duration; // 0 to 1

    // UFO hover position (above spire)
    const hoverX = snX;
    const hoverY = spireTopY - 30;

    // UFO position based on phase
    let ufoX: number, ufoY: number;
    let laserAlpha = 0;

    if (t < 0.25) {
      // Approach from upper-right
      const approach = t / 0.25;
      const ease = approach < 0.5 ? 2 * approach * approach : 1 - Math.pow(-2 * approach + 2, 2) / 2;
      const startX = snX + Math.min(250, this.screenWidth * 0.35);
      const startY = spireTopY - Math.min(150, this.screenHeight * 0.25);
      ufoX = startX + (hoverX - startX) * ease;
      ufoY = startY + (hoverY - startY) * ease;
    } else if (t < 0.75) {
      // Hovering and attacking
      const hover = (t - 0.25) / 0.5;
      ufoX = hoverX + Math.sin(this.ufoPhase * 2) * 3;
      ufoY = hoverY + Math.sin(this.ufoPhase * 1.5) * 2;
      // Lasers ramp up then hold
      laserAlpha = Math.min(1, hover * 3);
    } else {
      // Retreat to upper-left
      const retreat = (t - 0.75) / 0.25;
      const ease = retreat < 0.5 ? 2 * retreat * retreat : 1 - Math.pow(-2 * retreat + 2, 2) / 2;
      const endX = snX - Math.min(280, this.screenWidth * 0.4);
      const endY = spireTopY - Math.min(180, this.screenHeight * 0.3);
      ufoX = hoverX + (endX - hoverX) * ease;
      ufoY = hoverY + (endY - hoverY) * ease;
      laserAlpha = Math.max(0, 1 - retreat * 4);
    }

    // Overall fade for approach/retreat
    const fadeAlpha = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;

    // === Draw UFO saucer ===
    const saucerW = 20;
    const saucerH = 6;

    // Underside glow
    g.ellipse(ufoX, ufoY + saucerH * 0.3, saucerW * 0.7, saucerH * 1.5)
      .fill({ color: 0x44ffaa, alpha: 0.06 * fadeAlpha });

    // Main body — dark metallic ellipse
    g.ellipse(ufoX, ufoY, saucerW, saucerH)
      .fill({ color: 0x334455, alpha: 0.7 * fadeAlpha });
    g.ellipse(ufoX, ufoY, saucerW, saucerH)
      .stroke({ color: 0x556677, alpha: 0.4 * fadeAlpha, width: 1 });

    // Dome on top
    g.ellipse(ufoX, ufoY - saucerH * 0.6, saucerW * 0.4, saucerH * 0.7)
      .fill({ color: 0x667788, alpha: 0.6 * fadeAlpha });
    g.ellipse(ufoX, ufoY - saucerH * 0.6, saucerW * 0.4, saucerH * 0.7)
      .stroke({ color: 0x88aacc, alpha: 0.3 * fadeAlpha, width: 0.5 });

    // Cycling colored lights underneath
    const lightCount = 7;
    for (let i = 0; i < lightCount; i++) {
      const angle = (i / lightCount) * Math.PI * 2 + this.ufoPhase * 3;
      const lx = ufoX + Math.cos(angle) * saucerW * 0.7;
      const ly = ufoY + Math.sin(angle) * saucerH * 0.5 + saucerH * 0.3;
      const lightColors = [0xff0000, 0x00ff00, 0x0088ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff8800];
      const ci = (i + Math.floor(this.ufoPhase * 5)) % lightColors.length;
      g.circle(lx, ly, 1.2)
        .fill({ color: lightColors[ci], alpha: 0.5 * fadeAlpha });
    }

    // === Laser beams (only during attack phase) ===
    if (laserAlpha > 0) {
      const beamTargets = [
        { x: snX - 8, y: deckY },
        { x: snX, y: deckY - 3 },
        { x: snX + 8, y: deckY },
      ];

      for (let i = 0; i < beamTargets.length; i++) {
        const target = beamTargets[i];
        const wobble = Math.sin(this.ufoPhase * 6 + i * 2.1) * 2;
        const tx = target.x + wobble;
        const ty = target.y;

        // Wide glow beam
        g.moveTo(ufoX, ufoY + saucerH)
          .lineTo(tx, ty)
          .stroke({ color: 0xff00ff, alpha: 0.12 * laserAlpha * fadeAlpha, width: 6 });

        // Bright core beam
        g.moveTo(ufoX, ufoY + saucerH)
          .lineTo(tx, ty)
          .stroke({ color: 0xff2244, alpha: 0.5 * laserAlpha * fadeAlpha, width: 2 });

        // Impact glow on deck
        const impactPulse = 0.3 + Math.sin(this.ufoPhase * 8 + i * 1.5) * 0.15;
        g.circle(tx, ty, 5)
          .fill({ color: 0xff4400, alpha: impactPulse * laserAlpha * fadeAlpha });
        g.circle(tx, ty, 10)
          .fill({ color: 0xff2200, alpha: impactPulse * 0.3 * laserAlpha * fadeAlpha });

        // Sparks at impact
        const sparkCount = 3;
        for (let s = 0; s < sparkCount; s++) {
          const sparkAngle = this.ufoPhase * 10 + i * 3 + s * 2.1;
          const sparkDist = 4 + Math.sin(sparkAngle * 1.7) * 3;
          const sx = tx + Math.cos(sparkAngle) * sparkDist;
          const sy = ty + Math.sin(sparkAngle) * sparkDist * 0.5 - Math.abs(Math.sin(sparkAngle * 2)) * 4;
          g.circle(sx, sy, 0.8)
            .fill({ color: 0xffaa00, alpha: 0.4 * laserAlpha * fadeAlpha });
        }
      }
    }
  }

  private drawSpinner(): void {
    const p = this.spinnerProgress;
    const w = this.screenWidth;
    const cy = this.centerY;

    const startX = -100;
    const startY = cy - 200;
    const endX = w + 100;
    const endY = cy + 300;

    const x = startX + (endX - startX) * p;
    const baseY = startY + (endY - startY) * p;
    const wobble = Math.sin(p * Math.PI * 6) * 3;
    const y = baseY + wobble;

    const alpha = Math.sin(p * Math.PI) * 0.5;
    if (alpha <= 0) return;

    const engineAlpha = (0.3 + Math.sin(this.elapsed * 8) * 0.15) * (alpha / 0.5);
    const bodyColor = 0x00ccff;

    // Body
    this.spinner
      .poly([x - 8, y, x, y - 3, x + 8, y, x, y + 3])
      .fill({ color: bodyColor, alpha });

    // Engine glows
    this.spinner
      .circle(x - 6, y + 1, 1.5)
      .fill({ color: 0xff6600, alpha: engineAlpha });
    this.spinner
      .circle(x - 6, y - 1, 1.5)
      .fill({ color: 0xff6600, alpha: engineAlpha });

    // Trail
    for (let i = 1; i <= 4; i++) {
      const trailAlpha = alpha * (0.3 - i * 0.06);
      if (trailAlpha <= 0) continue;
      this.spinner
        .rect(x - 8 - i * 6, y - 1, 4, 2)
        .fill({ color: bodyColor, alpha: trailAlpha });
    }
  }
}
