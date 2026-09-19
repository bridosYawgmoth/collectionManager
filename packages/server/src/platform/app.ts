import Fastify, { type FastifyInstance } from "fastify";
import type { SqlClient } from "./db.js";

export type HealthStatus = "ok" | "degraded";
export type PostgresStatus = "up" | "down";

export interface HealthResponse {
  status: HealthStatus;
  postgres: PostgresStatus;
}

export interface BuildAppOptions {
  sql: SqlClient;
  logger?: boolean;
}

// buildApp: HTTP composition root. Health is injected with a SqlClient so
// tests can prove both the live-Postgres path and the unreachable path
// without binding a port. Without the factory, boot and tests would each
// construct Fastify and drift.
export function buildApp(options: BuildAppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.get("/health", async (_request, reply): Promise<HealthResponse> => {
    try {
      await options.sql`SELECT 1`;
      return { status: "ok", postgres: "up" };
    } catch (error) {
      app.log.error({ err: error }, "health check could not query Postgres");
      void reply.code(503);
      return { status: "degraded", postgres: "down" };
    }
  });

  return app;
}
