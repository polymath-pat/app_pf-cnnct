export type NodeId = 'frontend' | 'backend' | 'valkey' | 'postgres' | 'opensearch' | 'dns';

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

// Matches the actual /api/health JSON shape
export interface HealthResponse {
  app: { git_sha: string; uptime_seconds: number };
  valkey: { connected: boolean; latency_ms?: number };
  postgres: { connected: boolean; latency_ms?: number };
  opensearch: { configured: boolean; connected: boolean; status?: string; latency_ms?: number };
  dns_canary: { ok: boolean; latency_ms?: number; error?: string | null };
  rate_limiter: { backend: string; in_memory_fallback: boolean };
}

export interface InfraNodeConfig {
  id: NodeId;
  label: string;
  healthKey: keyof HealthResponse | null;
  gridX: number;
  gridY: number;
  color: number;
  buildingHeight: number;
}

export interface ConnectionConfig {
  from: NodeId;
  to: NodeId;
  label: string;
  bidirectional?: boolean;
}

export interface WebhookResult {
  id: number;
  source: string;
  received_at: string;
}

export interface WebhookResponse {
  count: number;
  results: WebhookResult[];
}
