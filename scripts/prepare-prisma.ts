import 'dotenv/config'
import { spawnSync } from 'child_process'
import { Client } from 'pg'

async function main() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  const client = new Client({ connectionString: databaseUrl })

  try {
    await client.connect()

    const migrationsTableResult = await client.query<{ migrations_table: string | null }>(
      "select to_regclass('public._prisma_migrations') as migrations_table"
    )

    const migrationsTableExists = Boolean(migrationsTableResult.rows[0]?.migrations_table)
    let useMigrateDeploy = false

    if (migrationsTableExists) {
      const migrationCountResult = await client.query<{ count: string }>(
        'select count(*)::int as count from "_prisma_migrations"'
      )
      useMigrateDeploy = Number(migrationCountResult.rows[0]?.count ?? 0) > 0
    }

    const prismaArgs = useMigrateDeploy
      ? ['prisma', 'migrate', 'deploy']
      : ['prisma', 'db', 'push', '--accept-data-loss']

    console.log(
      useMigrateDeploy
        ? 'Prisma migration history detected. Applying migrations.'
        : 'No Prisma migration history detected. Bootstrapping schema with db push.'
    )

    const result = spawnSync('npx', prismaArgs, { stdio: 'inherit' })

    if (result.error) {
      throw result.error
    }

    if (result.status !== 0) {
      process.exit(result.status ?? 1)
    }
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})