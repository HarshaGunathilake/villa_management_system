import mysql from "mysql2/promise";
import { config } from "./config";
import { createSchema } from "./schema";
import { seedDatabase } from "./seed";

type Pool = mysql.Pool;
type Params = (string | number | null)[];

// One pool for the whole server, kept across hot reloads in development.
const globalForDb = globalThis as unknown as { __villaPool?: Pool; __villaReady?: Promise<void> };

// Keep this low on serverless hosting (Vercel) with a shared-hosting database: each running copy opens its own pool.
const POOL_LIMIT = Math.max(1, Number(process.env.DB_CONNECTION_LIMIT ?? 10) || 10);
/** After a long quiet spell every pooled connection may be dead, so try past all of them to a fresh one. */
const ATTEMPTS = POOL_LIMIT + 1;

function pool() {
  if (!globalForDb.__villaPool) {
    const limit = POOL_LIMIT;
    globalForDb.__villaPool = mysql.createPool({
      ...config.db,
      waitForConnections: true,
      connectionLimit: limit,
      charset: "utf8mb4",
      // Dates come back as plain strings ("2026-10-04"), never shifted by a time zone.
      dateStrings: true,
      // Remote and shared-hosting databases (Hostinger) close idle connections on their side.
      // Close ours first, and keep the ones in use alive, so a dead connection is never reused.
      maxIdle: limit,
      idleTimeout: 30_000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10_000,
      connectTimeout: 15_000,
    });
  }
  return globalForDb.__villaPool;
}

/** The connection was dropped under us (closed by the database server or the network). */
function isDroppedConnection(error: unknown) {
  const e = error as { code?: string; fatal?: boolean };
  return ["ECONNRESET", "PROTOCOL_CONNECTION_LOST", "EPIPE", "ETIMEDOUT", "ECONNREFUSED"].includes(e?.code ?? "") || (e?.fatal === true && e?.code !== "ER_ACCESS_DENIED_ERROR");
}

/**
 * A read that hits a dropped connection is tried again; the pool throws the
 * dead connection away, so each try gets another one, in the end a fresh one.
 * Writes are never repeated: if the connection dropped after the server ran
 * the statement, running it again could save a change twice.
 */
async function withRetry<T>(sql: string, run: () => Promise<T>): Promise<T> {
  const isRead = /^\s*(SELECT|SHOW)\b/i.test(sql);
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isRead || !isDroppedConnection(error) || attempt >= ATTEMPTS) throw error;
    }
  }
}

/**
 * A pooled connection that is known to be alive: checked with a ping first,
 * and swapped for a fresh one if the server had closed it. Used before writes,
 * which must not be retried once sent.
 */
async function liveConnection(): Promise<mysql.PoolConnection> {
  for (let attempt = 1; ; attempt++) {
    const connection = await pool().getConnection();
    try {
      await connection.ping();
      return connection;
    } catch (error) {
      connection.destroy();
      if (attempt >= ATTEMPTS || !isDroppedConnection(error)) throw error;
    }
  }
}

/** Gives the connection back, or throws it away if it broke while in use. */
function done(connection: mysql.PoolConnection, error?: unknown) {
  if (error && isDroppedConnection(error)) connection.destroy();
  else connection.release();
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
  query: (sql, params) => withRetry(sql, () => wrap(pool()).query(sql, params)),
  one: (sql, params) => withRetry(sql, () => wrap(pool()).one(sql, params)),
  async run(sql, params) {
    const connection = await liveConnection();
    try {
      const result = await wrap(connection as unknown as { query: Pool["query"] }).run(sql, params);
      done(connection);
      return result;
    } catch (error) {
      done(connection, error);
      throw error;
    }
  },
};

/** Run several statements as one unit: all succeed or none do. */
export async function transaction<T>(work: (tx: Db) => Promise<T>): Promise<T> {
  const connection = await liveConnection();
  try {
    await connection.beginTransaction();
    const result = await work(wrap(connection as unknown as { query: Pool["query"] }));
    await connection.commit();
    done(connection);
    return result;
  } catch (error) {
    // On a dropped connection the rollback fails too (the server has already rolled back); keep the first error.
    await connection.rollback().catch(() => {});
    done(connection, error);
    throw error;
  }
}

export async function closePool() {
  await globalForDb.__villaPool?.end();
  globalForDb.__villaPool = undefined;
  globalForDb.__villaReady = undefined;
}
