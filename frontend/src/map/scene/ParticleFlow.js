import { Container, Graphics } from 'pixi.js';
export class ParticleFlow extends Container {
    gfx = new Graphics();
    particles = [];
    ambientTimer = 0;
    connections = [];
    constructor() {
        super();
        this.addChild(this.gfx);
    }
    setConnections(connections) {
        this.connections = connections;
    }
    burst(connection, count = 6) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                progress: -i * 0.08,
                speed: 0.003 + Math.random() * 0.002,
                connection,
                color: 0x00fff5,
            });
        }
        connection.pulse();
    }
    update(dt) {
        // Ambient particles
        this.ambientTimer += dt;
        if (this.ambientTimer > 120 && this.connections.length > 0) {
            this.ambientTimer = 0;
            const conn = this.connections[Math.floor(Math.random() * this.connections.length)];
            this.particles.push({
                progress: 0,
                speed: 0.002 + Math.random() * 0.001,
                connection: conn,
                color: 0x00fff5,
            });
        }
        this.gfx.clear();
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.progress += p.speed * dt;
            if (p.progress > 1) {
                this.particles.splice(i, 1);
                continue;
            }
            if (p.progress < 0)
                continue;
            const t = p.progress;
            const x = p.connection.startX + (p.connection.endX - p.connection.startX) * t;
            const y = p.connection.startY + (p.connection.endY - p.connection.startY) * t;
            const alpha = Math.sin(t * Math.PI);
            this.gfx
                .circle(x, y, 2.5)
                .fill({ color: p.color, alpha: alpha * 0.8 });
            // Glow
            this.gfx
                .circle(x, y, 5)
                .fill({ color: p.color, alpha: alpha * 0.2 });
        }
    }
}
