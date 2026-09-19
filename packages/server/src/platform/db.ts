import postgres from "postgres";

export type SqlClient = postgres.Sql;

export interface CreateSqlOptions {
  connectTimeoutSeconds?: number;
}

// createSql: wraps postgres.js so the rest of the server never constructs a
// client. Without it, connection options scatter and tests cannot inject a
// dead endpoint for the degraded health path.
export function createSql(
  databaseUrl: string,
  options: CreateSqlOptions = {},
): SqlClient {
  return postgres(databaseUrl, {
    max: 4,
    connect_timeout: options.connectTimeoutSeconds ?? 5,
  });
}
