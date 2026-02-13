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
                const status = 'healthy';
                this.onHealth({
                    app: status,
                    valkey: 'unknown',
                    postgres: 'unknown',
                    opensearch: 'unknown',
                    dns_canary: 'unknown',
                    rate_limiter: 'unknown',
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
