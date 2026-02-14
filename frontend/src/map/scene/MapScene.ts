import { Application, Graphics, Ticker } from 'pixi.js';
import type { HealthResponse, WebhookResponse, NodeId, ServiceStatus } from '../data/types';
import { NODES, CONNECTIONS, getNodeConfig } from '../data/topology';
import { IsometricGrid } from './IsometricGrid';
import { InfraNode } from './InfraNode';
import { Connection } from './Connection';
import { ParticleFlow } from './ParticleFlow';
import { AmbientEffects } from './AmbientEffects';
import { BladeRunnerEggs } from './BladeRunnerEggs';
import { HoloAd } from './HoloAd';
import { Cityscape } from './Cityscape';

export class MapScene {
  private app: Application;
  private grid: IsometricGrid;
  private nodes = new Map<NodeId, InfraNode>();
  private connections: Connection[] = [];
  private particleFlow: ParticleFlow;
  private ambient: AmbientEffects;
  private bladeRunnerEggs: BladeRunnerEggs;
  private holoAds: HoloAd;
  private cityscape: Cityscape;
  private lastWebhookCount = -1;
  private eggIndex = 0;

  // Batman Beyond rooftop runner
  private batmanGfx = new Graphics();
  private batmanFromX = 0;
  private batmanFromY = 0;
  private batmanToX = 0;
  private batmanToY = 0;
  private batmanProgress = -1; // -1 = perched, 0-1 = jumping
  private batmanIdleTimer = 0;
  private batmanIdleWait = 7;
  private batmanCurrentNode: NodeId = 'frontend';
  private batmanFacingRight = true;
  private batmanElapsed = 0;

  constructor(app: Application) {
    this.app = app;
    this.grid = new IsometricGrid();
    this.particleFlow = new ParticleFlow();
    this.ambient = new AmbientEffects();
    this.bladeRunnerEggs = new BladeRunnerEggs();
    this.holoAds = new HoloAd();
    this.cityscape = new Cityscape();

    // Clicking the pyramid cycles through easter egg effects
    this.bladeRunnerEggs.setPyramidClickHandler(() => {
      const effects = [
        () => this.bladeRunnerEggs.triggerVkFlash(),
        () => this.ambient.triggerDove(),
        () => this.ambient.triggerTears(),
        () => this.cityscape.triggerPowerPill(),
        () => this.cityscape.triggerUfoAttack(),
      ];
      effects[this.eggIndex % effects.length]();
      this.eggIndex++;
    });
  }

  build(): void {
    const { width, height } = this.app.screen;

    // Enable stage pointer events for hover interactivity
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    // Layer order: grid → cityscape → bladeRunnerEggs → holoAds → connections → nodes → particles → ambient
    this.app.stage.addChild(this.grid);
    this.app.stage.addChild(this.cityscape);
    this.app.stage.addChild(this.bladeRunnerEggs);
    this.app.stage.addChild(this.holoAds);

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

    this.app.stage.addChild(this.batmanGfx);
    this.app.stage.addChild(this.particleFlow);
    this.app.stage.addChild(this.ambient);

    this.particleFlow.setConnections(this.connections);
    this.ambient.init(width, height);

    this.reposition();

    // Tick loop
    Ticker.shared.add(this.tick, this);
  }

  reposition(): void {
    const { width, height } = this.app.screen;
    const centerX = width / 2 - 100;
    const centerY = height / 2 - 120;

    this.grid.draw(centerX, centerY);
    this.cityscape.init(centerX, centerY, width, height);
    this.bladeRunnerEggs.init(centerX, centerY);
    this.holoAds.init(centerX, centerY);

    for (const node of this.nodes.values()) {
      node.positionAt(centerX, centerY);
    }

    for (const conn of this.connections) {
      const fromNode = this.nodes.get(conn.config.from)!;
      const toNode = this.nodes.get(conn.config.to)!;
      conn.setEndpoints(fromNode.topCenter, toNode.topCenter);
    }

    this.ambient.resize(width, height);

    // Position Batman on current node rooftop
    const batNode = this.nodes.get(this.batmanCurrentNode);
    if (batNode) {
      const tc = batNode.topCenter;
      this.batmanFromX = tc.x;
      this.batmanFromY = tc.y;
      this.batmanProgress = -1;
    }
  }

  updateHealth(data: HealthResponse): void {
    // Derive simple status from the rich health response objects
    const statuses: Record<NodeId, ServiceStatus> = {
      frontend: 'healthy', // If the page loaded, frontend is up
      backend: data.app?.uptime_seconds != null ? 'healthy' : 'down',
      valkey: data.valkey?.connected ? 'healthy' : 'down',
      postgres: data.postgres?.connected ? 'healthy' : 'down',
      opensearch: data.opensearch?.connected
        ? (data.opensearch.status === 'red' ? 'degraded' : 'healthy')
        : (data.opensearch?.configured === false ? 'unknown' : 'down'),
      dns: data.dns_canary?.ok ? 'healthy' : 'down',
    };

    // Extract latency values from health response
    const latencies: Partial<Record<NodeId, number | undefined>> = {
      valkey: data.valkey?.latency_ms,
      postgres: data.postgres?.latency_ms,
      opensearch: data.opensearch?.latency_ms,
      dns: data.dns_canary?.latency_ms,
    };

    for (const [nodeId, status] of Object.entries(statuses)) {
      const id = nodeId as NodeId;
      this.nodes.get(id)?.setHealth(status, latencies[id] ?? undefined);
    }

    this.updateLegendHTML(statuses);
  }

  updateWebhooks(data: WebhookResponse): void {
    if (this.lastWebhookCount === -1) {
      this.lastWebhookCount = data.count;
      return;
    }

    if (data.count > this.lastWebhookCount) {
      // New events — burst particles along frontend→backend→postgres path
      const feToBackend = this.connections.find(c => c.config.from === 'frontend' && c.config.to === 'backend');
      const backendToPg = this.connections.find(c => c.config.from === 'backend' && c.config.to === 'postgres');
      if (feToBackend) this.particleFlow.burst(feToBackend, 8);
      if (backendToPg) this.particleFlow.burst(backendToPg, 6);
    }

    this.lastWebhookCount = data.count;
  }

  private tick = (ticker: Ticker): void => {
    const dt = ticker.deltaTime;
    this.particleFlow.update(dt);
    this.ambient.update(dt);
    this.cityscape.update(dt);
    this.bladeRunnerEggs.update(dt);
    this.nodes.get('dns')?.setEasterEggAlpha(this.bladeRunnerEggs.getVkAlpha());
    this.holoAds.update(dt);
    this.updateBatman(dt);
    for (const conn of this.connections) {
      conn.update(dt);
    }
  };

  private updateBatman(dt: number): void {
    this.batmanElapsed += dt * 0.02;
    const nodeIds: NodeId[] = ['frontend', 'backend', 'valkey', 'postgres', 'opensearch', 'dns'];

    if (this.batmanProgress < 0) {
      // Perched — idle timer
      this.batmanIdleTimer += dt * 0.02;
      if (this.batmanIdleTimer >= this.batmanIdleWait) {
        // Pick a random different node
        let target: NodeId;
        do {
          target = nodeIds[Math.floor(Math.random() * nodeIds.length)];
        } while (target === this.batmanCurrentNode);

        const fromNode = this.nodes.get(this.batmanCurrentNode);
        const toNode = this.nodes.get(target);
        if (fromNode && toNode) {
          const from = fromNode.topCenter;
          const to = toNode.topCenter;
          this.batmanFromX = from.x;
          this.batmanFromY = from.y;
          this.batmanToX = to.x;
          this.batmanToY = to.y;
          this.batmanFacingRight = to.x >= from.x;
          this.batmanCurrentNode = target;
          this.batmanProgress = 0;
        }
      }
    } else {
      // Jumping
      this.batmanProgress += dt * 0.015;
      if (this.batmanProgress >= 1) {
        // Arrived
        this.batmanProgress = -1;
        this.batmanIdleTimer = 0;
        this.batmanIdleWait = 5 + Math.random() * 8;
        const node = this.nodes.get(this.batmanCurrentNode);
        if (node) {
          const tc = node.topCenter;
          this.batmanFromX = tc.x;
          this.batmanFromY = tc.y;
        }
      }
    }

    this.drawBatman();
  }

  private drawBatman(): void {
    const g = this.batmanGfx;
    g.clear();

    let bx: number, by: number;
    const jumping = this.batmanProgress >= 0;

    if (jumping) {
      // Ease-in-out horizontal + parabolic vertical arc
      const t = this.batmanProgress;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      bx = this.batmanFromX + (this.batmanToX - this.batmanFromX) * ease;
      const linearY = this.batmanFromY + (this.batmanToY - this.batmanFromY) * ease;
      const arcHeight = 25 + Math.abs(this.batmanToX - this.batmanFromX) * 0.08;
      by = linearY - 4 * arcHeight * t * (1 - t);
    } else {
      bx = this.batmanFromX;
      by = this.batmanFromY + Math.sin(this.batmanElapsed * 2) * 0.5; // idle bob
    }

    const dir = this.batmanFacingRight ? 1 : -1;

    // Boots/legs (black)
    g.rect(bx - 2 * dir, by - 1, 1.5, 2).fill({ color: 0x111111, alpha: 0.9 });
    g.rect(bx + 0.5 * dir, by - 1, 1.5, 2).fill({ color: 0x111111, alpha: 0.9 });

    // Body (dark suit)
    g.rect(bx - 2, by - 6, 4, 5).fill({ color: 0x0a0a0a, alpha: 0.9 });

    // Red bat emblem
    g.poly([bx, by - 5, bx - 1.5, by - 3.5, bx + 1.5, by - 3.5])
      .fill({ color: 0xff0022, alpha: 0.7 });

    // Head/cowl
    g.rect(bx - 1.5, by - 8.5, 3, 2.5).fill({ color: 0x0a0a0a, alpha: 0.9 });
    // Pointed ears
    g.poly([bx - 1.5, by - 8.5, bx - 1, by - 10.5, bx - 0.5, by - 8.5])
      .fill({ color: 0x0a0a0a, alpha: 0.9 });
    g.poly([bx + 0.5, by - 8.5, bx + 1, by - 10.5, bx + 1.5, by - 8.5])
      .fill({ color: 0x0a0a0a, alpha: 0.9 });

    // Eyes (white slits)
    g.rect(bx - 1, by - 7.8, 0.8, 0.5).fill({ color: 0xffffff, alpha: 0.7 });
    g.rect(bx + 0.2, by - 7.8, 0.8, 0.5).fill({ color: 0xffffff, alpha: 0.7 });

    // Arms
    if (jumping) {
      // Forward arm extended
      g.moveTo(bx + 1.5 * dir, by - 5)
        .lineTo(bx + 4 * dir, by - 6.5)
        .stroke({ color: 0x0a0a0a, alpha: 0.9, width: 1.5 });
      // Back arm tucked
      g.moveTo(bx - 1.5 * dir, by - 5)
        .lineTo(bx - 2.5 * dir, by - 3.5)
        .stroke({ color: 0x0a0a0a, alpha: 0.9, width: 1.5 });
    } else {
      // Both arms down
      g.moveTo(bx - 2, by - 5).lineTo(bx - 3, by - 2)
        .stroke({ color: 0x0a0a0a, alpha: 0.9, width: 1.5 });
      g.moveTo(bx + 2, by - 5).lineTo(bx + 3, by - 2)
        .stroke({ color: 0x0a0a0a, alpha: 0.9, width: 1.5 });
    }

    // Cape
    if (jumping) {
      // Trailing cape segments with fading alpha
      for (let i = 0; i < 4; i++) {
        const ct = Math.max(0, this.batmanProgress - i * 0.06);
        const ease = ct < 0.5 ? 2 * ct * ct : 1 - Math.pow(-2 * ct + 2, 2) / 2;
        const cx = this.batmanFromX + (this.batmanToX - this.batmanFromX) * ease;
        const arcH = 25 + Math.abs(this.batmanToX - this.batmanFromX) * 0.08;
        const cy = (this.batmanFromY + (this.batmanToY - this.batmanFromY) * ease) - 4 * arcH * ct * (1 - ct);
        const cAlpha = 0.5 - i * 0.12;
        if (cAlpha > 0) {
          g.poly([cx, cy - 5, cx - 3 * dir * (1 + i * 0.3), cy + i, cx - 1 * dir, cy + 2 + i])
            .fill({ color: 0x0a0a0a, alpha: cAlpha });
        }
      }
    } else {
      // Perched cape — small triangle hanging behind
      g.poly([bx, by - 6, bx - 3 * dir, by - 1, bx - 1 * dir, by - 1])
        .fill({ color: 0x0a0a0a, alpha: 0.5 });
    }
  }

  private updateLegendHTML(statuses: Record<NodeId, ServiceStatus>): void {
    const legendItems = document.getElementById('legend-items');
    if (!legendItems) return;

    const entries: { label: string; status: string; color: string }[] = [];

    const nodeLabels: [string, NodeId][] = [
      ['Frontend', 'frontend'],
      ['Backend', 'backend'],
      ['Valkey', 'valkey'],
      ['PostgreSQL', 'postgres'],
      ['OpenSearch', 'opensearch'],
      ['DNS Canary', 'dns'],
    ];

    for (const [label, nodeId] of nodeLabels) {
      const s = statuses[nodeId] || 'unknown';
      const color = s === 'healthy' ? '#00ff64' : s === 'degraded' ? '#ffd93d' : s === 'down' ? '#ff0044' : '#555577';
      entries.push({ label, status: s, color });
    }

    legendItems.innerHTML = entries.map(e =>
      `<div style="display:flex;align-items:center;gap:8px;">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${e.color};box-shadow:0 0 6px ${e.color};"></span>
        <span>${e.label}</span>
        <span style="margin-left:auto;color:${e.color};text-transform:uppercase;font-size:9px;">${e.status}</span>
      </div>`
    ).join('');
  }
}
