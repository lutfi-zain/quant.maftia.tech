import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import BetterSqlite3 from 'better-sqlite3'

const require = createRequire(import.meta.url)

export const DB_PATH = path.resolve('/home/ubuntu/projects/quant.maftia.tech/data/maftia_quant.db')

export interface QueryResult<T = any> {
  all(...params: any[]): T[]
  get(...params: any[]): T | undefined
}

export interface DatabaseConnection {
  prepare<T = any>(sql: string): QueryResult<T>
  exec(sql: string): void
  close(): void
}

let dbInstance: DatabaseConnection | null = null

export function getDb(): DatabaseConnection {
  if (dbInstance) return dbInstance

  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`Database not found at ${DB_PATH}. Ensure Phase 1/2 ingestion pipeline has executed.`)
  }

  if (typeof (globalThis as any).Bun !== 'undefined') {
    // Running under Bun runtime (native bun:sqlite)
    const { Database } = require('bun:sqlite')
    const bunDb = new Database(DB_PATH, { readonly: true })
    bunDb.exec('PRAGMA journal_mode=WAL;')
    bunDb.exec('PRAGMA query_only=true;')
    dbInstance = {
      prepare: <T = any>(sql: string) => {
        const stmt = bunDb.prepare(sql)
        return {
          all: (...params: any[]) => stmt.all(...params) as T[],
          get: (...params: any[]) => stmt.get(...params) as T | undefined,
        }
      },
      exec: (sql: string) => bunDb.exec(sql),
      close: () => bunDb.close(),
    }
  } else {
    // Running under Node/tsx runtime (better-sqlite3)
    const nodeDb = new BetterSqlite3(DB_PATH, { readonly: true })
    nodeDb.exec('PRAGMA journal_mode=WAL;')
    nodeDb.exec('PRAGMA query_only=true;')
    dbInstance = {
      prepare: <T = any>(sql: string) => {
        const stmt = nodeDb.prepare(sql)
        return {
          all: (...params: any[]) => stmt.all(...params) as T[],
          get: (...params: any[]) => stmt.get(...params) as T | undefined,
        }
      },
      exec: (sql: string) => nodeDb.exec(sql),
      close: () => nodeDb.close(),
    }
  }

  return dbInstance
}

export function executeQuery<T = any>(sql: string, params: any[] = []): T[] {
  const db = getDb()
  const stmt = db.prepare<T>(sql)
  return stmt.all(...params)
}

export function executeQuerySingle<T = any>(sql: string, params: any[] = []): T | undefined {
  const db = getDb()
  const stmt = db.prepare<T>(sql)
  return stmt.get(...params)
}
