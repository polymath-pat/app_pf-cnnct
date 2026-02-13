import type { HealthResponse, WebhookResponse } from './types';

export type HealthCallback = (data: HealthResponse) => void;
export type WebhookCallback = (data: WebhookResponse) => void;

export class HealthPoller {
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private webhookTimer: ReturnType<typeof setInterval> | null = null;
  private onHealth: HealthCallback;
  private onWebhook: WebhookCallback;

  constructor(onHealth: HealthCallback, onWebhook: WebhookCallback) {
    this.onHealth = onHealth;
    this.onWebhook = onWebhook;
  }

  start(): void {
    this.pollHealth();
    this.pollWebhooks();
    this.healthTimer = setInterval(() => this.pollHealth(), 30_000);
    this.webhookTimer = setInterval(() => this.pollWebhooks(), 15_000);
  }

  stop(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.webhookTimer) clearInterval(this.webhookTimer);
  }

  private async pollHealth(): Promise<void> {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data: HealthResponse = await res.json();
        this.onHealth(data);
        return;
      }
    } catch {
      // silent fail
    }
    // Fallback: try /api/healthz (simpler endpoint)
    try {
      const res = await fetch('/api/healthz');
      if (res.ok) {
        this.onHealth({
          app: { git_sha: 'unknown', uptime_seconds: 0 },
          valkey: { connected: false },
          postgres: { connected: false },
          opensearch: { configured: false, connected: false },
          dns_canary: { ok: false },
          rate_limiter: { backend: 'unknown', in_memory_fallback: false },
        });
      }
    } catch {
      // silent fail — map shows stale data
    }
  }

  private async pollWebhooks(): Promise<void> {
    try {
      const res = await fetch('/api/webhook-results');
      if (res.ok) {
        const data: WebhookResponse = await res.json();
        this.onWebhook(data);
      }
    } catch {
      // silent fail
    }
  }
}
