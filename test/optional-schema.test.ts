import assert from "node:assert/strict";
import test from "node:test";
import { isMissingDatabaseRelation, optionalSchemaQuery } from "../src/lib/optional-schema";

test("recognises a missing Postgres relation through a wrapped Drizzle error", () => {
  const databaseError = Object.assign(new Error('relation "weekly_report_preferences" does not exist'), { code: "42P01" });
  const drizzleError = Object.assign(new Error("Failed query"), { cause: databaseError });
  assert.equal(isMissingDatabaseRelation(drizzleError), true);
});

test("optional schema queries fall back only for missing relations", async () => {
  const databaseError = Object.assign(new Error("missing"), { code: "42P01" });
  assert.deepEqual(await optionalSchemaQuery(Promise.reject(databaseError), []), { data: [], schemaAvailable: false });
  await assert.rejects(optionalSchemaQuery(Promise.reject(new Error("connection refused")), []), /connection refused/);
});
