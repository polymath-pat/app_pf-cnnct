export const TILE_WIDTH = 200;
export const TILE_HEIGHT = 100;
export const NODES = [
    { id: 'dns', label: 'DNS', healthKey: 'dns_canary', gridX: 4, gridY: 0, color: 0xffd93d, buildingHeight: 50 },
    { id: 'opensearch', label: 'OpenSearch', healthKey: 'opensearch', gridX: 3, gridY: 1, color: 0xff00ff, buildingHeight: 65 },
    { id: 'frontend', label: 'Frontend', healthKey: null, gridX: 0, gridY: 2, color: 0x00fff5, buildingHeight: 70 },
    { id: 'backend', label: 'Backend', healthKey: 'app', gridX: 2, gridY: 2, color: 0x00ff64, buildingHeight: 80 },
    { id: 'valkey', label: 'Valkey', healthKey: 'valkey', gridX: 4, gridY: 2, color: 0xff6b6b, buildingHeight: 55 },
    { id: 'postgres', label: 'PostgreSQL', healthKey: 'postgres', gridX: 2, gridY: 3, color: 0x4ecdc4, buildingHeight: 60 },
];
export const CONNECTIONS = [
    { from: 'frontend', to: 'backend', label: 'HTTP', bidirectional: true },
    { from: 'backend', to: 'valkey', label: 'Rate Limit' },
    { from: 'backend', to: 'postgres', label: 'SQL' },
    { from: 'backend', to: 'opensearch', label: 'Logs' },
    { from: 'backend', to: 'dns', label: 'DNS Canary' },
];
export function isoProject(gridX, gridY, centerX, centerY) {
    return {
        x: centerX + (gridX - gridY) * (TILE_WIDTH / 2),
        y: centerY + (gridX + gridY) * (TILE_HEIGHT / 2),
    };
}
export function getNodeConfig(id) {
    return NODES.find(n => n.id === id);
}
