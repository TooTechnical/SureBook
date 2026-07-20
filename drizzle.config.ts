import { defineConfig } from "drizzle-kit";
import { sureBookTables } from "./drizzle.tables";

export default defineConfig({
  schema: [
    "./src/db/schema.ts",
    "./src/db/calendar-schema.ts",
    "./src/db/marketing-schema.ts",
    "./src/db/discount-schema.ts",
    "./src/db/operations-schema.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  tablesFilter: [...sureBookTables],
  extensionsFilters: ["postgis"],
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
