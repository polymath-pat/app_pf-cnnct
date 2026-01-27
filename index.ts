import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";

// 1. Create a DigitalOcean Container Registry (if you don't have one already)
const registry = new digitalocean.ContainerRegistry("kadet-cantu", {
    name: "kadet-cantu",
    subscriptionTierSlug: "basic",
});

// 2. Provision the Valkey (Redis) Database
const redisDb = new digitalocean.DatabaseCluster("redis-ratelimit", {
    engine: "valkey",
    version: "7",
    size: "db-s-1vcpu-1gb",
    region: "nyc1",
    nodeCount: 1,
});

// 3. Define the DigitalOcean App
const app = new digitalocean.App("network-cnnct", {
    spec: {
        name: "network-cnnct",
        region: "nyc",
        domains: [{
            name: "cnnct.metaciety.net",
            type: "PRIMARY",
        }],
        
        // Backend Service using your DOCR image
        services: [{
            name: "backend-api",
            image: {
                registryType: "DOCR",
                repository: "backend-api",
                tag: process.env.GITHUB_SHA || "latest", // Use CI SHA if available
            },
            httpPort: 8080,
            instanceCount: 1,
            instanceSizeSlug: "basic-xxs",
            healthCheck: {
                httpPath: "/healthz",
                initialDelaySeconds: 10,
                periodSeconds: 30,
            },
            envs: [{
                key: "REDIS_URL",
                scope: "RUN_TIME",
                // Dynamically link the Redis connection string
                value: redisDb.privateUri,
            }],
            routes: [{ path: "/api" }],
        }],

        // Static Site for the Frontend
        staticSites: [{
            name: "frontend-ui",
            github: {
                repo: "polymath-pat/doap-cnnct",
                branch: "main",
                deployOnPush: false,
            },
            sourceDir: "/frontend",
            buildCommand: "npm run build",
            outputDir: "dist",
            routes: [{ path: "/" }],
        }],
    },
});

// Export the resulting App URL
export const endpoint = app.liveUrl;