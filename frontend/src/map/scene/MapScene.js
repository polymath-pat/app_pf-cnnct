import { Ticker } from 'pixi.js';
import { NODES, CONNECTIONS } from '../data/topology';
import { IsometricGrid } from './IsometricGrid';
import { InfraNode } from './InfraNode';
import { Connection } from './Connection';
import { ParticleFlow } from './ParticleFlow';
import { AmbientEffects } from './AmbientEffects';
export class MapScene {
    app;
    grid;
    nodes = new Map();
    connections = [];
    particleFlow;
    ambient;
    lastWebhookCount = -1;
    constructor(app) {
        this.app = app;
        this.grid = new IsometricGrid();
        this.particleFlow = new ParticleFlow();
        this.ambient = new AmbientEffects();
    }
    build() {
        const { width, height } = this.app.screen;
        // Layer order: grid → connections → nodes → particles → ambient
        this.app.stage.addChild(this.grid);
        // Create connections
        for (const cfg of CONNECTIONS) {
            const conn = new Connection(cfg);
            this.connections.push(conn);
            this.app.stage.addChild(conn);
        }
        // Create nodes
        for (const cfg of NODES) {
            const node = new InfraNode(cfg);
            this.nodes.set(cfg.id, node);
            this.app.stage.addChild(node);
        }
        this.app.stage.addChild(this.particleFlow);
        this.app.stage.addChild(this.ambient);
        this.particleFlow.setConnections(this.connections);
        this.ambient.init(width, height);
        this.reposition();
        // Tick loop
        Ticker.shared.add(this.tick, this);
    }
    reposition() {
        const { width, height } = this.app.screen;
        const centerX = width / 2 - 100;
        const centerY = height / 2 - 120;
        this.grid.draw(centerX, centerY);
        for (const node of this.nodes.values()) {
            node.positionAt(centerX, centerY);
        }
        for (const conn of this.connections) {
            const fromNode = this.nodes.get(conn.config.from);
            const toNode = this.nodes.get(conn.config.to);
            conn.setEndpoints(fromNode.topCenter, toNode.topCenter);
        }
        this.ambient.resize(width, height);
    }
    updateHealth(data) {
        const mapping = {
            app: 'backend',
            valkey: 'valkey',
            postgres: 'postgres',
            opensearch: 'opensearch',
            dns_canary: 'dns',
            rate_limiter: 'valkey',
        };
        for (const [key, nodeId] of Object.entries(mapping)) {
            const node = this.nodes.get(nodeId);
            if (node) {
                const status = data[key];
                if (status)
                    node.setHealth(status);
            }
        }
        // Frontend is always "healthy" if the page loaded
        this.nodes.get('frontend')?.setHealth('healthy');
        this.updateLegendHTML(data);
    }
    updateWebhooks(data) {
        if (this.lastWebhookCount === -1) {
            this.lastWebhookCount = data.count;
            return;
        }
        if (data.count > this.lastWebhookCount) {
            // New events — burst particles along frontend→backend→postgres path
            const feToBackend = this.connections.find(c => c.config.from === 'frontend' && c.config.to === 'backend');
            const backendToPg = this.connections.find(c => c.config.from === 'backend' && c.config.to === 'postgres');
            if (feToBackend)
                this.particleFlow.burst(feToBackend, 8);
            if (backendToPg)
                this.particleFlow.burst(backendToPg, 6);
        }
        this.lastWebhookCount = data.count;
    }
    tick = (ticker) => {
        const dt = ticker.deltaTime;
        this.particleFlow.update(dt);
        this.ambient.update(dt);
        for (const conn of this.connections) {
            conn.update(dt);
        }
    };
    updateLegendHTML(data) {
        const legendItems = document.getElementById('legend-items');
        if (!legendItems)
            return;
        const entries = [
            { label: 'Frontend', status: 'healthy', color: '#00ff64' },
        ];
        const keyMap = [
            ['Backend', 'app'],
            ['Valkey', 'valkey'],
            ['PostgreSQL', 'postgres'],
            ['OpenSearch', 'opensearch'],
            ['DNS Canary', 'dns_canary'],
        ];
        for (const [label, key] of keyMap) {
            const s = data[key] || 'unknown';
            const color = s === 'healthy' ? '#00ff64' : s === 'degraded' ? '#ffd93d' : s === 'down' ? '#ff0044' : '#555577';
            entries.push({ label, status: s, color });
        }
        legendItems.innerHTML = entries.map(e => `<div style="display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${e.color};box-shadow:0 0 6px ${e.color};"></span>
        <span>${e.label}</span>
        <span style="margin-left:auto;color:${e.color};text-transform:uppercase;font-size:9px;">${e.status}</span>
      </div>`).join('');
    }
}
