import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = ReturnType<typeof create>;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Run `vercel env pull .env.local` after provisioning Neon.",
    );
  }
  return drizzle(neon(url), { schema });
}

// Lazy so `next build` does not need a live database connection.
let cached: Db | null = null;

export function getDb(): Db {
  if (!cached) cached = create();
  return cached;
}

export { schema };
