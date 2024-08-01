import * as schema from "./schemas";
import dotenv from "dotenv";
dotenv.config();

// import { drizzle } from "drizzle-orm/node-postgres";
// import { Pool } from "pg";

// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL!,
// });

// export const db = drizzle(pool, { schema });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
