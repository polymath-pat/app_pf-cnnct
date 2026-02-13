import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";

// --- Configuration ---
const config = new pulumi.Config();
const imageSha = process.env.GITHUB_SHA || "latest";
const region = digitalocean.Region.SFO3;
const registryName = "kadet-cantu";

// --- Database: Managed Valkey (Redis) for rate limiting ---
const valkey = new digitalocean.DatabaseCluster("cnnct-valkey", {
    engine: "valkey",
    version: "8",
    size: "db-s-1vcpu-1gb",
    region: region,
    nodeCount: 1,
});

// --- Database: Managed PostgreSQL for webhook storage ---
const postgres = new digitalocean.DatabaseCluster("cnnct-postgres", {
    engine: "pg",
    version: "16",
    size: "db-s-1vcpu-1gb",
    region: region,
    nodeCount: 1,
});

// --- VPC: use existing default SFO3 VPC for private networking ---
const vpcId = config.get("vpcId") || "7a01284b-392e-4846-88ad-cb2ee89a8c0b";

// --- App Platform ---
const app = new digitalocean.App("cnnct-app", {
    spec: {
        name: "cnnct",
        region: region,

        // Connect to VPC for private networking with droplets
        vpcs: [{ id: vpcId }],

        // Backend API service (from DOCR image)
        services: [{
            name: "backend-api",
            image: {
                registryType: "DOCR",
                repository: "backend-api",
                tag: imageSha,
                registryCredentials: "",
            },
            httpPort: 8080,
            instanceCount: 1,
            instanceSizeSlug: "apps-s-1vcpu-0.5gb",
            healthCheck: {
                httpPath: "/healthz",
                initialDelaySeconds: 10,
                periodSeconds: 30,
            },
            envs: [
                {
                    key: "REDIS_URL",
                    value: valkey.uri,
                    type: "SECRET",
                },
                {
                    key: "DATABASE_URL",
                    value: postgres.uri,
                    type: "SECRET",
                },
                { key: "HOST", value: "0.0.0.0" },
                { key: "PORT", value: "8080" },
                {
                    key: "WEBHOOK_SECRET",
                    value: config.requireSecret("webhookSecret"),
                    type: "SECRET",
                },
                { key: "WEBHOOK_DNS_TARGET", value: config.get("webhookDnsTarget") || "example.com" },
                ...(config.get("webhookTimerInterval") ? [{
                    key: "WEBHOOK_TIMER_INTERVAL",
                    value: config.get("webhookTimerInterval")!,
                }] : []),
                ...(config.get("opensearchUrl") ? [{
                    key: "OPENSEARCH_URL",
                    value: config.requireSecret("opensearchUrl"),
                    type: "SECRET" as const,
                }] : []),
            ],
        }],

        // Frontend static site (built from source)
        staticSites: [{
            name: "frontend",
            github: {
                repo: "polymath-pat/doap-cnnct",
                branch: "main",
                deployOnPush: true,
            },
            sourceDir: "/frontend",
            buildCommand: "npm install && npm run build",
            outputDir: "/dist",
        }],

        // Custom domain
        domainNames: [{
            name: "cnnct.metaciety.net",
            type: "ALIAS",
        }],

        // Ingress routing
        ingress: {
            rules: [
                {
                    match: { path: { prefix: "/api" } },
                    component: { name: "backend-api", preservePathPrefix: false },
                },
                {
                    match: { path: { prefix: "/" } },
                    component: { name: "frontend" },
                },
            ],
        },
    },
});

// --- DNS: CNAME record for custom domain ---
const cname = new digitalocean.DnsRecord("cnnct-dns", {
    domain: "metaciety.net",
    type: "CNAME",
    name: "cnnct",
    value: app.defaultIngress.apply(url => {
        // Strip https:// to get the hostname, add trailing dot for CNAME
        return url.replace("https://", "") + ".";
    }),
    ttl: 1800,
});

// --- Tags ---
const opensearchTag = new digitalocean.Tag("opensearch", { name: "opensearch" });

// --- Database Trusted Sources ---
new digitalocean.DatabaseFirewall("valkey-fw", {
    clusterId: valkey.id,
    rules: [
        { type: "app", value: app.id },
        { type: "tag", value: opensearchTag.name },
    ],
});

new digitalocean.DatabaseFirewall("postgres-fw", {
    clusterId: postgres.id,
    rules: [
        { type: "app", value: app.id },
        { type: "tag", value: opensearchTag.name },
    ],
});

// --- OpenSearch Droplet Firewall ---
new digitalocean.Firewall("opensearch-fw", {
    name: "opensearch-fw",
    tags: [opensearchTag.name],
    inboundRules: [
        { protocol: "tcp", portRange: "22", sourceAddresses: ["0.0.0.0/0", "::/0"] },
        { protocol: "tcp", portRange: "9200", sourceAddresses: ["0.0.0.0/0", "::/0"] },
        { protocol: "tcp", portRange: "5601", sourceAddresses: ["0.0.0.0/0", "::/0"] },
    ],
    outboundRules: [
        { protocol: "tcp", portRange: "all", destinationAddresses: ["0.0.0.0/0", "::/0"] },
        { protocol: "udp", portRange: "all", destinationAddresses: ["0.0.0.0/0", "::/0"] },
    ],
});

// --- Log Forwarding: Database → OpenSearch ---
// The opensearchUrl contains embedded credentials with special characters that
// break Go's url.Parse (used by the provider's validator). We must URL-encode
// the password portion so the provider accepts it without leaking credentials
// in validation errors.
if (config.get("opensearchUrl")) {
    const safeEndpoint = config.requireSecret("opensearchUrl").apply(raw => {
        const match = raw.match(/^(https?:\/\/)([^:]+):(.+)@(.+)$/);
        if (!match) return raw;
        const [, scheme, user, pass, hostPort] = match;
        return `${scheme}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hostPort}`;
    });
    const caCert = config.getSecret("opensearchCaCert");

    new digitalocean.DatabaseLogsinkOpensearch("pg-logsink-opensearch", {
        clusterId: postgres.id,
        endpoint: safeEndpoint,
        indexPrefix: "pg-logs",
        indexDaysMax: 30,
        caCert,
    });

    new digitalocean.DatabaseLogsinkOpensearch("valkey-logsink-opensearch", {
        clusterId: valkey.id,
        endpoint: safeEndpoint,
        indexPrefix: "valkey-logs",
        indexDaysMax: 30,
        caCert,
    });
}

// --- Outputs ---
export const appUrl = app.liveUrl;
export const customDomain = "cnnct.metaciety.net";
export const valkeyHost = valkey.host;
export const postgresHost = postgres.host;
export const appVpcId = vpcId;
