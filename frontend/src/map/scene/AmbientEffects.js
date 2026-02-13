import { Container, Graphics } from 'pixi.js';
const COLORS = [0x00fff5, 0x00ff64, 0xff00ff, 0xffd93d, 0x4ecdc4, 0xff6b6b];
export class AmbientEffects extends Container {
    gfx = new Graphics();
    particles = [];
    viewWidth = 0;
    viewHeight = 0;
    constructor() {
        super();
        this.addChild(this.gfx);
    }
    init(width, height) {
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
    }
    update(dt) {
        this.gfx.clear();
        for (const p of this.particles) {
            p.phase += 0.01 * dt;
            p.x += Math.sin(p.phase) * 0.3;
            p.y += p.vy * dt;
            if (p.y < -10) {
                p.y = this.viewHeight + 10;
                p.x = Math.random() * this.viewWidth;
            }
            this.gfx
                .circle(p.x, p.y, p.size)
                .fill({ color: p.color, alpha: p.alpha });
        }
    }
    resize(width, height) {
        this.viewWidth = width;
        this.viewHeight = height;
    }
}
