import { Container, Graphics } from 'pixi.js';
import { isoProject } from '../data/topology';
function shade(color, factor) {
    const r = Math.round(((color >> 16) & 0xff) * factor);
    const g = Math.round(((color >> 8) & 0xff) * factor);
    const b = Math.round((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
}
const ACCENT_PALETTE = [0x00fff5, 0xff00ff, 0xffd93d, 0x00ff64, 0xff4444, 0xff8800, 0x44aaff, 0xaa66ff];
function pickAccent(i) {
    return ACCENT_PALETTE[i % ACCENT_PALETTE.length];
}
const PERIPHERAL_BUILDINGS = [
    // Back row (distant)
    { gridX: -1, gridY: 5, width: 24, depth: 16, height: 260, color: 0x112233, hasWarningLight: true },
    { gridX: 0, gridY: 5.5, width: 50, depth: 30, height: 140, color: 0x0a1525, hasWarningLight: false },
    { gridX: 1.5, gridY: 5, width: 22, depth: 14, height: 300, color: 0x1a2a3f, hasWarningLight: false },
    { gridX: 3, gridY: 5.5, width: 60, depth: 36, height: 100, color: 0x112233, hasWarningLight: false },
    { gridX: 4.5, gridY: 5, width: 28, depth: 18, height: 220, color: 0x0a1525, hasWarningLight: true },
    // Right periphery
    { gridX: 5.5, gridY: 3, width: 30, depth: 20, height: 200, color: 0x1a2a3f, hasWarningLight: false },
    { gridX: 6, gridY: 1.5, width: 44, depth: 28, height: 150, color: 0x112233, hasWarningLight: false },
    { gridX: 6, gridY: 3.5, width: 20, depth: 14, height: 280, color: 0x0a1525, hasWarningLight: false },
    // Left periphery
    { gridX: -1, gridY: 0, width: 26, depth: 18, height: 240, color: 0x1a2a3f, hasWarningLight: false },
    { gridX: -1, gridY: 1.5, width: 50, depth: 32, height: 120, color: 0x112233, hasWarningLight: false },
    // Upper-right periphery
    { gridX: 5.5, gridY: -0.5, width: 22, depth: 16, height: 190, color: 0x0a1525, hasWarningLight: false },
    { gridX: 6, gridY: 0.5, width: 40, depth: 24, height: 130, color: 0x1a2a3f, hasWarningLight: false },
    // Extra fill
    { gridX: 2.5, gridY: 6, width: 26, depth: 16, height: 230, color: 0x0a1525, hasWarningLight: false },
];
const DECORATIVE_BUILDINGS = [
    // Between nodes
    { gridX: 0.5, gridY: 0.5, width: 18, depth: 12, height: 35, color: 0x0d1520, alpha: 0.40, style: 'flat', accentColor: pickAccent(0) },
    { gridX: 1.8, gridY: 1.2, width: 22, depth: 14, height: 42, color: 0x1a1f2e, alpha: 0.38, style: 'wedge', accentColor: pickAccent(1) },
    { gridX: 1.3, gridY: 2.7, width: 14, depth: 10, height: 28, color: 0x252a3a, alpha: 0.42, style: 'stepped', accentColor: pickAccent(2) },
    { gridX: 3.6, gridY: 2.8, width: 20, depth: 14, height: 38, color: 0x15191f, alpha: 0.38, style: 'flat', accentColor: pickAccent(3) },
    { gridX: 3.5, gridY: 0.3, width: 16, depth: 12, height: 32, color: 0x0d1520, alpha: 0.40, style: 'wedge', accentColor: pickAccent(4) },
    { gridX: 1.0, gridY: 3.5, width: 24, depth: 16, height: 45, color: 0x1a1f2e, alpha: 0.36, style: 'stepped', accentColor: pickAccent(5) },
    { gridX: 2.5, gridY: 1.5, width: 12, depth: 10, height: 24, color: 0x252a3a, alpha: 0.40, style: 'flat', accentColor: pickAccent(6) },
    { gridX: 4.2, gridY: 1.5, width: 18, depth: 14, height: 36, color: 0x15191f, alpha: 0.38, style: 'wedge', accentColor: pickAccent(7) },
    { gridX: 0.8, gridY: 1.0, width: 14, depth: 12, height: 30, color: 0x0d1520, alpha: 0.42, style: 'flat', accentColor: pickAccent(0) },
    { gridX: 3.2, gridY: 3.5, width: 20, depth: 16, height: 40, color: 0x1a1f2e, alpha: 0.38, style: 'stepped', accentColor: pickAccent(1) },
    // Periphery fill
    { gridX: 0.2, gridY: 3.5, width: 16, depth: 12, height: 34, color: 0x252a3a, alpha: 0.38, style: 'flat', accentColor: pickAccent(2) },
    { gridX: 4.5, gridY: 3.5, width: 22, depth: 14, height: 44, color: 0x15191f, alpha: 0.40, style: 'wedge', accentColor: pickAccent(3) },
    { gridX: 2.3, gridY: 4.5, width: 18, depth: 12, height: 30, color: 0x0d1520, alpha: 0.36, style: 'flat', accentColor: pickAccent(4) },
    { gridX: 5.2, gridY: 0.5, width: 14, depth: 10, height: 26, color: 0x1a1f2e, alpha: 0.42, style: 'stepped', accentColor: pickAccent(5) },
    { gridX: 5.5, gridY: 2.3, width: 20, depth: 14, height: 38, color: 0x252a3a, alpha: 0.38, style: 'wedge', accentColor: pickAccent(6) },
    { gridX: -0.3, gridY: 2.5, width: 16, depth: 12, height: 32, color: 0x15191f, alpha: 0.40, style: 'flat', accentColor: pickAccent(7) },
    { gridX: 1.5, gridY: 0.3, width: 18, depth: 14, height: 36, color: 0x0d1520, alpha: 0.38, style: 'stepped', accentColor: pickAccent(0) },
    { gridX: 4.8, gridY: 4.0, width: 14, depth: 10, height: 22, color: 0x1a1f2e, alpha: 0.42, style: 'flat', accentColor: pickAccent(1) },
    { gridX: 0.3, gridY: 4.2, width: 20, depth: 14, height: 40, color: 0x252a3a, alpha: 0.36, style: 'wedge', accentColor: pickAccent(2) },
    { gridX: 2.8, gridY: 0.2, width: 16, depth: 12, height: 28, color: 0x15191f, alpha: 0.40, style: 'flat', accentColor: pickAccent(3) },
    // New density-fill buildings
    { gridX: 0.3, gridY: 1.5, width: 14, depth: 10, height: 32, color: 0x0d1520, alpha: 0.42, style: 'wedge', accentColor: pickAccent(4) },
    { gridX: 1.5, gridY: 1.8, width: 18, depth: 12, height: 38, color: 0x1a1f2e, alpha: 0.38, style: 'flat', accentColor: pickAccent(5) },
    { gridX: 2.2, gridY: 0.8, width: 16, depth: 12, height: 34, color: 0x252a3a, alpha: 0.40, style: 'stepped', accentColor: pickAccent(6) },
    { gridX: 3.8, gridY: 0.8, width: 14, depth: 10, height: 30, color: 0x15191f, alpha: 0.42, style: 'flat', accentColor: pickAccent(7) },
    { gridX: 4.5, gridY: 1.0, width: 16, depth: 12, height: 36, color: 0x0d1520, alpha: 0.38, style: 'wedge', accentColor: pickAccent(0) },
    { gridX: 1.8, gridY: 3.2, width: 20, depth: 14, height: 42, color: 0x1a1f2e, alpha: 0.40, style: 'stepped', accentColor: pickAccent(1) },
    { gridX: 2.7, gridY: 2.3, width: 14, depth: 10, height: 28, color: 0x252a3a, alpha: 0.42, style: 'flat', accentColor: pickAccent(2) },
    { gridX: 4.0, gridY: 2.5, width: 18, depth: 14, height: 40, color: 0x15191f, alpha: 0.38, style: 'wedge', accentColor: pickAccent(3) },
    { gridX: 0.5, gridY: 3.0, width: 16, depth: 12, height: 34, color: 0x0d1520, alpha: 0.40, style: 'flat', accentColor: pickAccent(4) },
    { gridX: 3.5, gridY: 4.2, width: 20, depth: 14, height: 38, color: 0x1a1f2e, alpha: 0.36, style: 'stepped', accentColor: pickAccent(5) },
];
const TREE_POSITIONS = [
    { gridX: 0.1, gridY: 0.8 }, { gridX: 1.9, gridY: 0.1 }, { gridX: 0.7, gridY: 2.2 },
    { gridX: 3.1, gridY: 0.7 }, { gridX: 3.9, gridY: 1.8 }, { gridX: 4.2, gridY: 3.2 },
    { gridX: 0.5, gridY: 4.8 }, { gridX: 2.8, gridY: 4.1 }, { gridX: 5.1, gridY: 1.2 },
    { gridX: 5.7, gridY: 3.8 }, { gridX: -0.5, gridY: 2.5 }, { gridX: 1.2, gridY: 3.9 },
];
const ROAD_SEGMENTS = [
    // Streets (iso-horizontal, constant gridY)
    [-0.5, 0, 5.5, 0], // top edge
    [-0.5, 1, 5, 1], // upper (OpenSearch row)
    [-0.5, 2, 5, 2], // main (Frontend-Backend-Valkey row)
    [-0.5, 3, 5, 3], // lower (PostgreSQL row)
    [-0.5, 4, 5, 4], // bottom edge
    // Avenues (iso-vertical, constant gridX)
    [0, -0.5, 0, 4.5], // left edge (by Frontend)
    [2, -0.5, 2, 4.5], // center (Backend-Postgres column)
    [4, -0.5, 4, 4.5], // right (DNS-Valkey column)
    [5, -0.5, 5, 4.5], // far right edge
    // Inner alleys
    [1, 0, 1, 4], // inner-left alley
    [3, 0, 3, 4], // center-right alley
];
const NEON_POOL_DEFS = [
    { gridX: 1, gridY: 1, rx: 18, ry: 9, color: 0x00fff5, freq: 1.2 },
    { gridX: 3, gridY: 1, rx: 22, ry: 11, color: 0xff00ff, freq: 1.5 },
    { gridX: 1, gridY: 3, rx: 16, ry: 8, color: 0xffd93d, freq: 1.0 },
    { gridX: 3, gridY: 3, rx: 24, ry: 12, color: 0x00ff64, freq: 1.8 },
    { gridX: 5, gridY: 2, rx: 18, ry: 9, color: 0x00fff5, freq: 1.3 },
    { gridX: 0, gridY: 4, rx: 16, ry: 8, color: 0xff00ff, freq: 2.0 },
    { gridX: 4, gridY: 4, rx: 20, ry: 10, color: 0xffd93d, freq: 1.1 },
    { gridX: 2, gridY: 0, rx: 18, ry: 9, color: 0x00ff64, freq: 1.6 },
];
const NEON_COLORS = [0x00fff5, 0xff00ff, 0xffd93d, 0x00ff64, 0xff4444, 0xff8800, 0x44aaff, 0xaa66ff];
const WINDOW_COLORS = [0xffd93d, 0xffd93d, 0xffd93d, 0xffd93d, 0x00fff5, 0xff8800];
// Seeded pseudo-random for deterministic window patterns
function seededRand(seed) {
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
    roads = new Graphics();
    decorativeBuildings = new Graphics();
    peripheralBuildings = new Graphics();
    trees = new Graphics();
    neonPools = new Graphics();
    neonSigns = new Graphics();
    warningLights = new Graphics();
    spinner = new Graphics();
    navi = new Graphics();
    centerX = 0;
    centerY = 0;
    elapsed = 0;
    spinnerTimer = 0;
    spinnerInterval = 40 + Math.random() * 30;
    spinnerProgress = -1; // -1 = not flying
    screenWidth = 0;
    screenHeight = 0;
    neonSignDefs = [];
    // NetNavi state
    naviWaypointIdx = 0;
    naviFromX = 0;
    naviFromY = 0;
    naviToX = 0;
    naviToY = 0;
    naviMoveProgress = -1; // -1 = idle at waypoint
    naviIdleTimer = 0;
    naviIdleWait = 4 + Math.random() * 6;
    naviScreenX = 0;
    naviScreenY = 0;
    naviFacingRight = true;
    constructor() {
        super();
        this.addChild(this.roads);
        this.addChild(this.decorativeBuildings);
        this.addChild(this.peripheralBuildings);
        this.addChild(this.trees);
        this.addChild(this.neonPools);
        this.addChild(this.neonSigns);
        this.addChild(this.warningLights);
        this.addChild(this.navi);
        this.addChild(this.spinner);
        this.generateNeonSigns();
    }
    init(centerX, centerY, screenWidth, screenHeight) {
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
    generateNeonSigns() {
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
                    w: 8 + (i % 5) * 2, // 8-16px
                    h: 3 + (i % 4), // 3-6px
                    color: NEON_COLORS[(i + s) % NEON_COLORS.length],
                    freq: 0.8 + ((i * 3 + s) % 7) * 0.1,
                    building: b,
                });
            }
        }
    }
    drawStatic() {
        this.drawRoads();
        this.drawDecorativeBuildings();
        this.drawPeripheralBuildings();
        this.drawTrees();
        // Recompute neon sign screen positions
        for (const sign of this.neonSignDefs) {
            const pos = isoProject(sign.building.gridX, sign.building.gridY, this.centerX, this.centerY);
            sign.bx = pos.x;
            sign.by = pos.y;
        }
    }
    drawRoads() {
        this.roads.clear();
        const roadWidth = 8;
        for (const [x1, y1, x2, y2] of ROAD_SEGMENTS) {
            const from = isoProject(x1, y1, this.centerX, this.centerY);
            const to = isoProject(x2, y2, this.centerX, this.centerY);
            // Road direction vector
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0)
                continue;
            const nx = -dy / len * (roadWidth / 2);
            const ny = dx / len * (roadWidth / 2);
            // Road fill quad (darker asphalt)
            this.roads
                .poly([
                from.x + nx, from.y + ny,
                to.x + nx, to.y + ny,
                to.x - nx, to.y - ny,
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
        const intersections = new Set();
        for (const [x1, y1, x2, y2] of ROAD_SEGMENTS) {
            const minX = Math.ceil(Math.min(x1, x2));
            const maxX = Math.floor(Math.max(x1, x2));
            const minY = Math.ceil(Math.min(y1, y2));
            const maxY = Math.floor(Math.max(y1, y2));
            if (x1 === x2) {
                // Vertical road — mark integer y positions
                for (let gy = minY; gy <= maxY; gy++)
                    intersections.add(`${x1},${gy}`);
            }
            else if (y1 === y2) {
                // Horizontal road — mark integer x positions
                for (let gx = minX; gx <= maxX; gx++)
                    intersections.add(`${gx},${y1}`);
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
    drawDecorativeBuildings() {
        this.decorativeBuildings.clear();
        for (const b of DECORATIVE_BUILDINGS) {
            const pos = isoProject(b.gridX, b.gridY, this.centerX, this.centerY);
            this.drawDecorativeBuilding(pos.x, pos.y, b);
        }
    }
    drawDecorativeBuilding(x, y, b) {
        const hw = b.width / 2;
        const hd = b.depth / 2;
        const h = b.height;
        const alpha = b.alpha;
        if (b.style === 'flat') {
            this.drawFlatTop(this.decorativeBuildings, x, y, hw, hd, h, b.color, alpha, b.accentColor);
        }
        else if (b.style === 'wedge') {
            this.drawWedge(this.decorativeBuildings, x, y, hw, hd, h, b.color, alpha, b.accentColor);
        }
        else {
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
            }
            else {
                // AC unit
                const ux = x + ((seed % 5) - 2);
                this.decorativeBuildings
                    .rect(ux - 1.5, topY - 2, 3, 2)
                    .fill({ color: 0x1a2030, alpha: 0.30 });
            }
        }
    }
    drawWindowGrid(g, x, y, hw, hd, h, face, seed) {
        const rand = seededRand(seed);
        const rowSpacing = 8;
        const colSpacing = 6;
        const rows = Math.floor(h / rowSpacing);
        const cols = Math.max(2, Math.floor((hw + hd) / colSpacing));
        for (let row = 1; row < rows; row++) {
            const frac = row / rows;
            const wy = y - h + h * frac;
            for (let col = 0; col < cols; col++) {
                if (rand() < 0.30)
                    continue; // skip ~30% for organic look
                const colFrac = (col + 0.5) / cols;
                let wx, skewY;
                if (face === 'left') {
                    wx = x - hw + hw * colFrac;
                    skewY = wy + hd * (1 - colFrac);
                }
                else {
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
    drawFlatTop(g, x, y, hw, hd, h, color, alpha, accent) {
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
    drawWedge(g, x, y, hw, hd, h, color, alpha, accent) {
        const apex = h * 0.3; // rear raised by this amount
        // Top face (slanted) — rear-left corner raised
        g.poly([
            x, y - h - apex - hd, // back (raised)
            x + hw, y - h, // right
            x, y - h + hd, // front
            x - hw, y - h, // left
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
    drawStepped(g, x, y, hw, hd, h, color, alpha, accent) {
        const lowerH = h * 0.6;
        const upperH = h * 0.4;
        const uhw = hw * 0.7;
        const uhd = hd * 0.7;
        // Lower tier (full footprint)
        this.drawFlatTop(g, x, y, hw, hd, lowerH, color, alpha, accent);
        // Upper tier (smaller footprint, on top of lower)
        this.drawFlatTop(g, x, y - lowerH, uhw, uhd, upperH, shade(color, 1.1), alpha * 0.9, accent);
    }
    drawPeripheralBuildings() {
        this.peripheralBuildings.clear();
        for (let i = 0; i < PERIPHERAL_BUILDINGS.length; i++) {
            const b = PERIPHERAL_BUILDINGS[i];
            const pos = isoProject(b.gridX, b.gridY, this.centerX, this.centerY);
            this.drawPeripheralBuilding(pos.x, pos.y, b, i);
        }
    }
    drawPeripheralBuilding(x, y, b, index) {
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
    drawPeripheralWindowGrid(x, y, hw, hd, h, face, seed) {
        const rand = seededRand(seed);
        const windowRows = Math.floor(h / 12);
        const windowCols = Math.floor((hw + hd) / 8);
        for (let row = 1; row < windowRows; row++) {
            const frac = row / windowRows;
            const wy = y - h + h * frac;
            for (let col = 0; col < windowCols; col++) {
                if (rand() < 0.30)
                    continue;
                const colFrac = (col + 0.5) / windowCols;
                let wx, skewY;
                if (face === 'left') {
                    wx = x - hw + hw * colFrac;
                    skewY = wy + hd * (1 - colFrac);
                }
                else {
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
    drawBillboard(x, y, hw, hd, h, index) {
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
    drawTrees() {
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
    update(dt) {
        this.elapsed += dt * 0.02;
        // Warning lights — slow pulse
        this.warningLights.clear();
        const lightAlpha = 0.03 + Math.sin(this.elapsed * 1.2) * 0.02;
        for (const b of PERIPHERAL_BUILDINGS) {
            if (!b.hasWarningLight)
                continue;
            const pos = isoProject(b.gridX, b.gridY, this.centerX, this.centerY);
            this.warningLights
                .circle(pos.x, pos.y - b.height - b.depth / 2 - 2, 1.5)
                .fill({ color: 0xff2200, alpha: lightAlpha });
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
            let sx, sy;
            if (sign.face === 'left') {
                const faceY = y - h + h * sign.heightFrac;
                sx = x - hw + hw * sign.widthFrac;
                sy = faceY + hd * (1 - sign.widthFrac);
            }
            else {
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
        }
        else if (this.spinnerTimer >= this.spinnerInterval) {
            this.spinnerProgress = 0;
            this.spinnerTimer = 0;
        }
    }
    updateNavi(dt) {
        if (this.naviMoveProgress >= 0) {
            // Walking to next waypoint
            this.naviMoveProgress += dt * 0.008;
            if (this.naviMoveProgress >= 1) {
                this.naviMoveProgress = -1;
                this.naviScreenX = this.naviToX;
                this.naviScreenY = this.naviToY;
                this.naviIdleTimer = 0;
                this.naviIdleWait = 4 + Math.random() * 6;
            }
            else {
                // Lerp position
                const t = this.naviMoveProgress;
                // Ease in-out
                const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                this.naviScreenX = this.naviFromX + (this.naviToX - this.naviFromX) * ease;
                this.naviScreenY = this.naviFromY + (this.naviToY - this.naviFromY) * ease;
            }
        }
        else {
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
    drawNavi() {
        this.navi.clear();
        const x = this.naviScreenX;
        // Idle bob
        const bob = this.naviMoveProgress >= 0
            ? Math.sin(this.naviMoveProgress * Math.PI * 8) * 1 // walk bounce
            : Math.sin(this.elapsed * 2) * 0.8; // idle breathing
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
    drawSpinner() {
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
        if (alpha <= 0)
            return;
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
            if (trailAlpha <= 0)
                continue;
            this.spinner
                .rect(x - 8 - i * 6, y - 1, 4, 2)
                .fill({ color: bodyColor, alpha: trailAlpha });
        }
    }
}
