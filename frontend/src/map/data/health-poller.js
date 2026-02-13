export class HealthPoller {
    healthTimer = null;
    webhookTimer = null;
    onHealth;
    onWebhook;
    constructor(onHealth, onWebhook) {
        this.onHealth = onHealth;
        this.onWebhook = onWebhook;
    }
    start() {
        this.pollHealth();
        this.pollWebhooks();
        this.healthTimer = setInterval(() => this.pollHealth(), 30_000);
        this.webhookTimer = setInterval(() => this.pollWebhooks(), 15_000);
    }
    stop() {
        if (this.healthTimer)
            clearInterval(this.healthTimer);
        if (this.webhookTimer)
            clearInterval(this.webhookTimer);
    }
    async pollHealth() {
        try {
            const res = await fetch('/api/health');
            if (res.ok) {
                const data = await res.json();
                this.onHealth(data);
                return;
            }
        }
        catch {
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
        }
        catch {
            // silent fail — map shows stale data
        }
    }
    async pollWebhooks() {
        try {
            const res = await fetch('/api/webhook-results');
            if (res.ok) {
                const data = await res.json();
                this.onWebhook(data);
            }
        }
        catch {
            // silent fail
        }
    }
}
