import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { buildPoolConfig } from "./config";

type Db = ReturnType<typeof drizzle>;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDrizzle?: Db;
};

/**
 * Bağlantı ilk gerçek kullanımda (lazy) kurulur.
 *
 * Modül seviyesinde DATABASE_URL kontrolü yapmak `next build` sırasında
 * "Collecting page data" aşamasında patlıyordu: Next.js route modüllerini
 * build anında import eder ve bu noktada veritabanına ihtiyaç yoktur.
 * Hata artık yalnızca gerçekten sorgu atıldığında (runtime) fırlatılır.
 */
function getPool(): Pool {
  if (globalForDb.__arenaNextJsPostgresqlPool) {
    return globalForDb.__arenaNextJsPostgresqlPool;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  // Pool'u production'da da global'e yazıyoruz: serverless örneği sıcak
  // kaldığı sürece bağlantılar yeniden kullanılır.
  const pool = new Pool(buildPoolConfig(databaseUrl));
  globalForDb.__arenaNextJsPostgresqlPool = pool;
  return pool;
}

function getDb(): Db {
  if (!globalForDb.__arenaNextJsDrizzle) {
    globalForDb.__arenaNextJsDrizzle = drizzle(getPool());
  }
  return globalForDb.__arenaNextJsDrizzle;
}

function lazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const instance = resolve();
      const value = Reflect.get(instance, prop, instance);
      return typeof value === "function" ? value.bind(instance) : value;
    },
    has(_target, prop) {
      return prop in resolve();
    },
  });
}

export const pool: Pool = lazy(getPool);
export const db: Db = lazy(getDb);
