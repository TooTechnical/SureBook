import { defineConfig } from "drizzle-kit";

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
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
