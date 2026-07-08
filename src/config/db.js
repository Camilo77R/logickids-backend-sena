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
  },
  pool: { min: 2, max: 10 },
  acquireConnectionTimeout: 10_000,
});

export async function checkDbConnection() {
  try {
    await db.raw('SELECT 1');
    console.log(' PostgreSQL conectado —', env.DB_NAME);
  } catch (err) {
    console.error(' Error de conexión a PostgreSQL:', err.message);
    process.exit(1);
  }
}
