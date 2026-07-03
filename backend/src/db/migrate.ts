import 'dotenv/config'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is required')

  const migrationsFolder = resolve(__dirname, 'migrations')
  console.log(`Running migrations from ${migrationsFolder}...`)
  const client = postgres(connectionString, { prepare: false, max: 1 })
  const db = drizzle(client)
  await migrate(db, { migrationsFolder })
  await client.end()
  console.log('Migrations complete')
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
