import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

const protectedObjects = ["geography_columns", "geometry_columns", "spatial_ref_sys"];

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const migrationPath = resolve(process.cwd(), "drizzle/0003_operations_growth_admin.sql");
  const migration = await readFile(migrationPath, "utf8");
  const destructivePostgisPattern = new RegExp(`DROP\\s+(?:TABLE|VIEW)\\s+(?:IF\\s+EXISTS\\s+)?["']?(?:${protectedObjects.join("|")})["']?|DROP\\s+EXTENSION\\s+(?:IF\\s+EXISTS\\s+)?["']?postgis["']?`, "i");
  if (destructivePostgisPattern.test(migration)) throw new Error("Refusing to run a migration that modifies protected PostGIS objects");

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    await client.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(78263491820341)`;
      await transaction.unsafe(migration);
    });
    console.log("SureBook operations migration applied without modifying PostGIS system objects.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
