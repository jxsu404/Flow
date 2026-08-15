import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

export type Database = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL no está configurada. Crea un proyecto Neon Free y copia la cadena del pooler.",
    );
  }
  const pool = new Pool({ connectionString: url });
  return drizzle(pool, { schema });
}

let _db: Database | null = null;

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}
