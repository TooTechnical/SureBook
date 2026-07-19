import assert from "node:assert/strict";
import test from "node:test";
import { hasInternalPermission } from "../src/lib/internal-authz";

test("read-only analysts cannot perform sensitive admin actions", () => {
  assert.equal(hasInternalPermission("read_only_analyst", "view_platform"), true);
  assert.equal(hasInternalPermission("read_only_analyst", "manage_business_status"), false);
  assert.equal(hasInternalPermission("read_only_analyst", "view_finance"), false);
});

test("finance access does not imply support or moderation access", () => {
  assert.equal(hasInternalPermission("finance", "view_finance"), true);
  assert.equal(hasInternalPermission("finance", "manage_support"), false);
  assert.equal(hasInternalPermission("finance", "moderate_reviews"), false);
});
