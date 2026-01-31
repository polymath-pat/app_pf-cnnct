import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";

// --- Configuration ---
const config = new pulumi.Config();
const imageSha = process.env.GITHUB_SHA || "latest";
const region = digitalocean.Region.SFO3;
const registryName = "kadet-cantu";

// --- Database: Managed Valkey (Redis) ---
const db = new digitalocean.DatabaseCluster("cnnct-valkey", {
    engine: "valkey",
    version: "8",
    size: "db-s-1vcpu-1gb",
    region: region,
    nodeCount: 1,
});

// --- App Platform ---
const app = new digitalocean.App("cnnct-app", {
    spec: {
        name: "cnnct",
        region: region,

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
                    value: db.uri,
                    type: "SECRET",
                },
                { key: "HOST", value: "0.0.0.0" },
                { key: "PORT", value: "8080" },
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

        // Ingress routing
        ingress: {
            rules: [
                {
                    match: { path: { prefix: "/api" } },
                    component: { name: "backend-api", preservePathPrefix: true },
                },
                {
                    match: { path: { prefix: "/" } },
                    component: { name: "frontend" },
                },
            ],
        },
    },
});

// --- Outputs ---
export const appUrl = app.liveUrl;
export const dbHost = db.host;
