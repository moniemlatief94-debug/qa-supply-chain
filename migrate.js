import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, pool } from "../server/db.js";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationDirectory = join(projectRoot, "migrations");

async function runMigrations() {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        migration_id VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [rows] = await connection.query("SELECT migration_id FROM schema_migrations");
    const applied = new Set(rows.map((row) => row.migration_id));
    const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(migrationDirectory, file), "utf8");
      const statements = sql.split(";").map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) await connection.query(statement);
      await connection.execute("INSERT INTO schema_migrations (migration_id) VALUES (?)", [file]);
      console.log(`Applied database migration: ${file}`);
    }
    console.log("Database schema is up to date.");
  } finally {
    connection.release();
    await closeDatabase();
  }
}

runMigrations().catch((error) => {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
});
