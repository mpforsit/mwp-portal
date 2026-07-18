// Gekapselter DB-Zugriff des Ingest-Service (CLAUDE.md: rohes SQL nur
// in packages/db und in klar gekapselten Repository-Modulen wie diesem).
import pg from 'pg'

let pool: pg.Pool | undefined

export const getPool = (): pg.Pool => {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL ist nicht gesetzt.')
    pool = new pg.Pool({ connectionString: url })
  }
  return pool
}

export const closePool = async (): Promise<void> => {
  await pool?.end()
  pool = undefined
}
