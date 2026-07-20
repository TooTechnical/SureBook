import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as coreSchema from "./schema";
import * as calendarSchema from "./calendar-schema";
import * as marketingSchema from "./marketing-schema";
import * as discountSchema from "./discount-schema";
import * as operationsSchema from "./operations-schema";
import { env } from "@/lib/env";

const client = postgres(env.DATABASE_URL, { prepare: false, max: 10 });
const schema = { ...coreSchema, ...calendarSchema, ...marketingSchema, ...discountSchema, ...operationsSchema };
export const db = drizzle(client, { schema });
