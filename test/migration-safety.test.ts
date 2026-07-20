import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import config from "../drizzle.config";
import { protectedPostgisRelations, sureBookTables } from "../drizzle.tables";

test("Drizzle push is restricted to SureBook tables and excludes PostGIS relations", () => {
  assert.deepEqual(config.schemaFilter, ["public"]);
  assert.deepEqual(config.extensionsFilters, ["postgis"]);
  assert.deepEqual(config.tablesFilter, [...sureBookTables]);
  for (const relation of protectedPostgisRelations) assert.equal(sureBookTables.includes(relation as never), false);
});

test("SureBook table allowlist matches every pgTable declaration", async () => {
  const schemaDirectory = new URL("../src/db/", import.meta.url);
  const files = (await readdir(schemaDirectory)).filter((file) => file.endsWith("-schema.ts") || file === "schema.ts");
  const declared = new Set<string>();
  for (const file of files) {
    const source = await readFile(new URL(file, schemaDirectory), "utf8");
    for (const match of source.matchAll(/pgTable\("([^"]+)"/g)) declared.add(match[1]);
  }
  assert.deepEqual([...sureBookTables].sort(), [...declared].sort());
});

test("checked-in SQL never drops PostGIS extension objects", async () => {
  const migrationDirectory = new URL("../drizzle/", import.meta.url);
  const files = (await readdir(migrationDirectory)).filter((file) => file.endsWith(".sql"));
  for (const file of files) {
    const sql = await readFile(new URL(file, migrationDirectory), "utf8");
    assert.doesNotMatch(sql, /DROP\s+(?:TABLE|VIEW)\s+(?:IF\s+EXISTS\s+)?["']?(?:geography_columns|geometry_columns|spatial_ref_sys)["']?/i, file);
    assert.doesNotMatch(sql, /DROP\s+EXTENSION\s+(?:IF\s+EXISTS\s+)?["']?postgis["']?/i, file);
  }
});

test("operations migration creates only allowlisted SureBook tables", async () => {
  const sql = await readFile(new URL("../drizzle/0003_operations_growth_admin.sql", import.meta.url), "utf8");
  const createdTables = [...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/gi)].map((match) => match[1]);
  assert.ok(createdTables.length > 0);
  for (const table of createdTables) assert.ok(sureBookTables.includes(table as never), `${table} is not allowlisted`);
});
