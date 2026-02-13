import { Application, Ticker } from 'pixi.js';
import type { HealthResponse, WebhookResponse, NodeId, ServiceStatus } from '../data/types';
import { NODES, CONNECTIONS, getNodeConfig } from '../data/topology';
import { IsometricGrid } from './IsometricGrid';
import { InfraNode } from './InfraNode';
import { Connection } from './Connection';
import { ParticleFlow } from './ParticleFlow';
import { AmbientEffects } from './AmbientEffects';

export class MapScene {
  private app: Application;
  private grid: IsometricGrid;
  private nodes = new Map<NodeId, InfraNode>();
  private connections: Connection[] = [];
  private particleFlow: ParticleFlow;
  private ambient: AmbientEffects;
  private lastWebhookCount = -1;

  constructor(app: Application) {
    this.app = app;
    this.grid = new IsometricGrid();
    this.particleFlow = new ParticleFlow();
    this.ambient = new AmbientEffects();
  }

  build(): void {
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

  reposition(): void {
    const { width, height } = this.app.screen;
    const centerX = width / 2 - 100;
    const centerY = height / 2 - 120;

    this.grid.draw(centerX, centerY);

    for (const node of this.nodes.values()) {
      node.positionAt(centerX, centerY);
    }

    for (const conn of this.connections) {
      const fromNode = this.nodes.get(conn.config.from)!;
      const toNode = this.nodes.get(conn.config.to)!;
      conn.setEndpoints(fromNode.topCenter, toNode.topCenter);
    }

    this.ambient.resize(width, height);
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

    for (const [nodeId, status] of Object.entries(statuses)) {
      this.nodes.get(nodeId as NodeId)?.setHealth(status);
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
    for (const conn of this.connections) {
      conn.update(dt);
    }
  };

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
