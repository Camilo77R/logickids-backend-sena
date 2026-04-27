import app from './app.js';
import { env } from './config/env.js';
import { checkDbConnection } from './config/db.js';

const start = async () => {
  await checkDbConnection();
  app.listen(env.PORT, () => {
    console.log(`\n LogicKids API v2 → http://localhost:${env.PORT}`);
    console.log(`    Entorno : ${env.NODE_ENV}`);
    console.log(`    CORS    : ${env.CORS_ORIGIN}\n`);
  });
};

start();
