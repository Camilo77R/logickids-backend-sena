import pg from 'pg';

import { env } from '../src/config/env.js';

const EXPECTED_COLUMNS = [
  'input_snapshot_json',
  'origen_generacion',
  'version_reglas',
];
const EXPECTED_CONSTRAINTS = [
  'ck_recomendaciones_destino',
  'ck_recomendaciones_origen',
];

const client = new pg.Client({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
  statement_timeout: 5000,
});

try {
  await client.connect();

  const columnsResult = await client.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'recomendaciones'
       AND column_name = ANY($1)
     ORDER BY column_name`,
    [EXPECTED_COLUMNS]
  );
  const constraintsResult = await client.query(
    `SELECT c.conname, c.convalidated
     FROM pg_constraint AS c
     JOIN pg_class AS t ON t.oid = c.conrelid
     WHERE t.relname = 'recomendaciones'
       AND c.conname = ANY($1)
     ORDER BY c.conname`,
    [EXPECTED_CONSTRAINTS]
  );

  const foundColumns = columnsResult.rows.map((row) => row.column_name);
  const foundConstraints = constraintsResult.rows.map((row) => row.conname);
  const missingColumns = EXPECTED_COLUMNS.filter((name) => !foundColumns.includes(name));
  const missingConstraints = EXPECTED_CONSTRAINTS.filter(
    (name) => !foundConstraints.includes(name)
  );

  console.log(JSON.stringify({
    ok: missingColumns.length === 0 && missingConstraints.length === 0,
    columns: columnsResult.rows,
    constraints: constraintsResult.rows,
    missingColumns,
    missingConstraints,
  }, null, 2));

  if (missingColumns.length || missingConstraints.length) process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
