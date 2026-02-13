export type NodeId = 'frontend' | 'backend' | 'valkey' | 'postgres' | 'opensearch' | 'dns';

export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface HealthResponse {
  app: ServiceStatus;
  valkey: ServiceStatus;
  postgres: ServiceStatus;
  opensearch: ServiceStatus;
  dns_canary: ServiceStatus;
  rate_limiter: ServiceStatus;
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
