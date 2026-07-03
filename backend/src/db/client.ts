import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

// Supabase pooler (port 6543) runs in transaction mode → prepared statements
// must be disabled. Session mode (port 5432) can keep prepare: true. Default
// here is safe for both.
const client = postgres(connectionString, { prepare: false, max: 10 })
export const db = drizzle(client, { schema })
export { schema }
