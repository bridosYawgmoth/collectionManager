import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createSql } from "./db.js";

const config = loadConfig();
const sql = createSql(config.databaseUrl);
const app = buildApp({ sql, logger: true });

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error({ err: error }, "server failed to start");
  await sql.end({ timeout: 2 });
  throw error;
}
