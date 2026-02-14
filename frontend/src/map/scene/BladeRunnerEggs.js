import { Container, Graphics, Text } from 'pixi.js';
import { isoProject } from '../data/topology';
const GOLD = 0x8b7355;
const GOLD_TEXT = 0xaa9060;
export class BladeRunnerEggs extends Container {
    gfx = new Graphics();
    pyramid = new Graphics();
    mottoText;
    serialText;
    elapsed = 0;
    vkTimer = 0;
    vkAlpha = 0;
    centerX = 0;
    centerY = 0;
    pyramidBurst = 0; // countdown for click burst glow
    onPyramidClick = null;
    constructor() {
        super();
        this.addChild(this.gfx);
        this.addChild(this.pyramid);
        this.mottoText = new Text({
            text: 'More Human Than Human',
            style: {
                fontFamily: 'Orbitron, sans-serif',
                fontSize: 8,
                fill: GOLD_TEXT,
                letterSpacing: 1,
            },
        });
        this.mottoText.alpha = 0.06;
        this.mottoText.anchor.set(0.5, 0);
        this.addChild(this.mottoText);
        this.serialText = new Text({
            text: 'N7FAA52318',
            style: {
                fontFamily: 'Share Tech Mono, monospace',
                fontSize: 7,
                fill: 0x445566,
                letterSpacing: 2,
            },
        });
        this.serialText.alpha = 0.04;
        this.addChild(this.serialText);
    }
    init(centerX, centerY) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.drawPyramid();
        this.positionElements();
    }
    reposition(centerX, centerY) {
        this.centerX = centerX;
        this.centerY = centerY;
        this.drawPyramid();
        this.positionElements();
    }
    positionElements() {
        // Motto near pyramid
        const pyramidPos = isoProject(1, 0, this.centerX, this.centerY);
        this.mottoText.position.set(pyramidPos.x, pyramidPos.y + 20);
        // Serial watermark lower-left
        this.serialText.position.set(40, this.centerY + 250);
    }
    setPyramidClickHandler(cb) {
        this.onPyramidClick = cb;
    }
    triggerVkFlash() {
        this.vkAlpha = 0.2;
        this.vkTimer = 0;
    }
    getVkAlpha() {
        return this.vkAlpha;
    }
    drawPyramid() {
        const pos = isoProject(1, 0, this.centerX, this.centerY);
        const x = pos.x;
        const y = pos.y;
        // Small isometric pyramid
        const size = 12;
        const height = 16;
        const apexY = y - height;
        this.pyramid.clear();
        // Left face
        this.pyramid
            .poly([x, apexY, x - size, y, x, y + size * 0.5])
            .fill({ color: GOLD, alpha: 0.1 });
        // Right face
        this.pyramid
            .poly([x, apexY, x + size, y, x, y + size * 0.5])
            .fill({ color: GOLD, alpha: 0.08 });
        // Edges
        this.pyramid
            .moveTo(x, apexY).lineTo(x - size, y)
            .stroke({ color: GOLD, alpha: 0.15, width: 1 })
            .moveTo(x, apexY).lineTo(x + size, y)
            .stroke({ color: GOLD, alpha: 0.15, width: 1 })
            .moveTo(x, apexY).lineTo(x, y + size * 0.5)
            .stroke({ color: GOLD, alpha: 0.12, width: 1 })
            .moveTo(x - size, y).lineTo(x, y + size * 0.5).lineTo(x + size, y)
            .stroke({ color: GOLD, alpha: 0.1, width: 1 });
        // Make pyramid clickable
        this.pyramid.eventMode = 'static';
        this.pyramid.cursor = 'pointer';
        this.pyramid.hitArea = {
            contains: (px, py) => {
                // Simple bounding triangle test
                const dx = px - x;
                const dy = py - y;
                return dx >= -size && dx <= size && dy >= apexY - y && dy <= size * 0.5
                    && Math.abs(dx) <= size * (1 - (apexY - y - dy) / (apexY - y - size * 0.5));
            },
        };
        this.pyramid.removeAllListeners();
        this.pyramid.on('pointertap', () => {
            this.pyramidBurst = 1;
            if (this.onPyramidClick)
                this.onPyramidClick();
        });
    }
    update(dt) {
        this.elapsed += dt * 0.02;
        // Pulsing apex glow on pyramid
        const pos = isoProject(1, 0, this.centerX, this.centerY);
        const apexGlow = 0.08 + Math.sin(this.elapsed * 1.5) * 0.04;
        this.gfx.clear();
        this.gfx
            .circle(pos.x, pos.y - 16, 3)
            .fill({ color: 0xffcc44, alpha: apexGlow });
        // Click burst glow — decays over ~1s
        if (this.pyramidBurst > 0) {
            this.pyramidBurst -= dt * 0.03;
            if (this.pyramidBurst < 0)
                this.pyramidBurst = 0;
            const burstAlpha = this.pyramidBurst * 0.5;
            const burstRadius = 6 + (1 - this.pyramidBurst) * 20;
            this.gfx
                .circle(pos.x, pos.y - 16, burstRadius)
                .fill({ color: 0xffcc44, alpha: burstAlpha });
        }
        // VK-TEST flash on DNS node position every ~60s
        this.vkTimer += dt * 0.02;
        if (this.vkAlpha > 0) {
            // Currently showing, fade after 2s
            const showTime = 60 - (this.vkTimer % 60);
            if (showTime > 58) {
                // Just triggered, hold
                this.vkAlpha = 0.2;
            }
            else {
                this.vkAlpha -= dt * 0.02 * 0.1;
                if (this.vkAlpha <= 0)
                    this.vkAlpha = 0;
            }
        }
        if (this.vkTimer >= 60) {
            this.vkTimer = 0;
            this.vkAlpha = 0.2;
        }
    }
}
