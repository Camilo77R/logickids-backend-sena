import knex from 'knex';
import { env } from './env.js';

export const db = knex({
  client: 'pg',
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8_000,
    query_timeout: 15_000,
    keepAlive: true,
    keepAliveInitialDelay: 10_000,
  },
  pool: {
    min: 1,
    max: 10,
    idleTimeoutMillis: 8_000,
    createTimeoutMillis: 8_000,
    createRetryIntervalMillis: 500,
    afterCreate: (conn, done) => {
      conn.query('SELECT 1', (err) => {
        if (err) {
          conn.end();
          done(err);
        } else {
          done(null, conn);
        }
      });
    },
  },
  acquireConnectionTimeout: 10_000,
});

export async function checkDbConnection() {
  const MAX_RETRIES = 3;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await db.raw('SELECT 1');
      console.log(' PostgreSQL conectado —', env.DB_NAME);
      return;
    } catch (err) {
      console.error(` Intento ${i + 1}/${MAX_RETRIES} —`, err.message);
      if (i + 1 < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 2_000));
      }
    }
  }
  console.error(' No se pudo conectar a PostgreSQL tras', MAX_RETRIES, 'intentos');
  process.exit(1);
}
