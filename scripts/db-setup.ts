// npm run db:setup   creates the database, tables and first accounts (safe to run again)
// npm run db:reset   deletes ALL data and starts again from the sample data
import "./load-env";

async function main() {
  const reset = process.argv.includes("--reset");
  const { config } = await import("../lib/server/config");
  const { db, ensureReady, closePool } = await import("../lib/server/db");
  const { TABLE_NAMES } = await import("../lib/server/schema");

  if (reset) {
    await ensureReady();
    await db.run("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of TABLE_NAMES) await db.run(`DROP TABLE IF EXISTS \`${table}\``);
    await db.run("SET FOREIGN_KEY_CHECKS = 1");
    await closePool();
    console.log("All tables dropped.");
  }

  await ensureReady();
  const villas = await db.query<{ name: string; account_status: string }>("SELECT name, account_status FROM villas ORDER BY name");
  const users = await db.query<{ email: string; role: string }>("SELECT email, role FROM users ORDER BY role, email");
  console.log(`Database "${config.db.database}" on ${config.db.host}:${config.db.port} is ready.`);
  console.log(`Villas: ${villas.map((v) => `${v.name} (${v.account_status})`).join(", ") || "none"}`);
  console.log(`Accounts: ${users.map((u) => `${u.email} [${u.role}]`).join(", ")}`);
  await closePool();
}

main().catch((error) => {
  console.error("Database setup failed:", error.message ?? error);
  console.error("Check that MySQL is running and the DB_ values in .env.local are right.");
  process.exit(1);
});
