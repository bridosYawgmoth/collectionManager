import { existsSync } from "node:fs";
import { resolve } from "node:path";

export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
}

function loadDotEnv(): void {
  const envPath = resolve(import.meta.dirname, "../../../.env");
  if (!existsSync(envPath)) {
    return;
  }
  process.loadEnvFile(envPath);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return undefined;
  }
  return value;
}

// loadConfig: reads env at the process boundary so the rest of the server
// never touches process.env. Without it, a missing DATABASE_URL fails at
// the first query instead of at boot.
export function loadConfig(): Config {
  loadDotEnv();
  const portRaw = optionalEnv("PORT") ?? "3000";
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got ${portRaw}`);
  }
  return {
    databaseUrl: requiredEnv("DATABASE_URL"),
    port,
    host: optionalEnv("HOST") ?? "127.0.0.1",
  };
}
