import { closeDatabase, pool } from "../server/db.js";

try {
  const [rows] = await pool.execute("SELECT migration_id FROM schema_migrations ORDER BY migration_id");
  const applied = new Set(rows.map((row) => row.migration_id));
  const required = ["001_initial.sql", "002_bootstrap_state.sql"];
  const missing = required.filter((migration) => !applied.has(migration));
  if (missing.length) {
    console.error(`Required DDF Tracking database migrations are missing: ${missing.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("DDF Tracking database schema is ready.");
  }
} catch (error) {
  console.error("Database schema readiness check failed:", error.message);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
