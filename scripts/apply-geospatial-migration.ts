import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const migrationPath = resolve(process.cwd(), "drizzle/0002_geospatial_marketplace.sql");
  const migration = await readFile(migrationPath, "utf8");
  const client = postgres(databaseUrl, { max: 1, prepare: false });

  try {
    await client.unsafe(migration);
    console.log("Epic 6.1 geospatial migration applied successfully.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
