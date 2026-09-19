import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createSql, type SqlClient } from "./db.js";

function testDatabaseUrl(): string {
  if (process.env.DATABASE_URL !== undefined && process.env.DATABASE_URL !== "") {
    return process.env.DATABASE_URL;
  }
  const user = process.env.USER;
  if (user === undefined || user === "") {
    throw new Error(
      "DATABASE_URL is unset and USER is unset; cannot derive a local connection string",
    );
  }
  return `postgres://${user}@localhost:5432/collection_manager_test`;
}

describe("GET /health", () => {
  const clients: SqlClient[] = [];

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((sql) => sql.end({ timeout: 2 })));
  });

  it("reports ok and postgres up when the database accepts a query", async () => {
    const sql = createSql(testDatabaseUrl());
    clients.push(sql);
    const app = buildApp({ sql });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", postgres: "up" });
    await app.close();
  });

  it("reports degraded when the database is unreachable", async () => {
    const sql = createSql("postgres://unused@127.0.0.1:1/none", {
      connectTimeoutSeconds: 1,
    });
    clients.push(sql);
    const app = buildApp({ sql });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: "degraded", postgres: "down" });
    await app.close();
  });
});
