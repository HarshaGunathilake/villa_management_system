import mysql from "mysql2/promise";
import { config } from "./config";
import { createSchema } from "./schema";
import { seedDatabase } from "./seed";

type Pool = mysql.Pool;
type Params = (string | number | null)[];

// One pool for the whole server, kept across hot reloads in development.
const globalForDb = globalThis as unknown as { __villaPool?: Pool; __villaReady?: Promise<void> };

function pool() {
  if (!globalForDb.__villaPool) {
    globalForDb.__villaPool = mysql.createPool({
      ...config.db,
      waitForConnections: true,
      connectionLimit: 10,
      charset: "utf8mb4",
      // Dates come back as plain strings ("2026-10-04"), never shifted by a time zone.
      dateStrings: true,
    });
  }
  return globalForDb.__villaPool;
}

/** Creates the database, tables and first accounts the first time the server is used. */
export function ensureReady() {
  if (!globalForDb.__villaReady) {
    globalForDb.__villaReady = (async () => {
      const { database, ...server } = config.db;
      const bootstrap = await mysql.createConnection(server);
      try {
        await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, "")}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      } finally {
        await bootstrap.end();
      }
      await createSchema(db);
      await seedDatabase(db);
    })().catch((error) => {
      globalForDb.__villaReady = undefined; // try again on the next request
      throw error;
    });
  }
  return globalForDb.__villaReady;
}

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: Params): Promise<T[]>;
  one<T = Record<string, unknown>>(sql: string, params?: Params): Promise<T | undefined>;
  run(sql: string, params?: Params): Promise<{ affectedRows: number; insertId: number }>;
}

function wrap(executor: { query: Pool["query"] }): Db {
  return {
    async query<T>(sql: string, params: Params = []) {
      const [rows] = await executor.query(sql, params);
      return rows as T[];
    },
    async one<T>(sql: string, params: Params = []) {
      const [rows] = await executor.query(sql, params);
      return (rows as T[])[0];
    },
    async run(sql: string, params: Params = []) {
      const [result] = await executor.query(sql, params);
      const r = result as mysql.ResultSetHeader;
      return { affectedRows: r.affectedRows, insertId: r.insertId };
    },
  };
}

export const db: Db = {
  query: (sql, params) => wrap(pool()).query(sql, params),
  one: (sql, params) => wrap(pool()).one(sql, params),
  run: (sql, params) => wrap(pool()).run(sql, params),
};

/** Run several statements as one unit: all succeed or none do. */
export async function transaction<T>(work: (tx: Db) => Promise<T>): Promise<T> {
  const connection = await pool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(wrap(connection as unknown as { query: Pool["query"] }));
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function closePool() {
  await globalForDb.__villaPool?.end();
  globalForDb.__villaPool = undefined;
  globalForDb.__villaReady = undefined;
}
