import app from './app.js';
import { env } from './config/env.js';
import { checkDbConnection } from './config/db.js';
import { createServer } from 'http';
import { setupSockets } from './sockets/socket.manager.js';

const start = async () => {
  await checkDbConnection();
  
  // Crear servidor HTTP explícito para acoplar Socket.io
  const httpServer = createServer(app);
  
  // Inicializar Sockets
  setupSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    console.log(`\n LogicKids API v2 → http://localhost:${env.PORT}`);
    console.log(`    Entorno : ${env.NODE_ENV}`);
    console.log(`    CORS    : ${env.CORS_ORIGIN}`);
    console.log(`    Sockets : Inicializados y escuchando\n`);
  });
};

start();
