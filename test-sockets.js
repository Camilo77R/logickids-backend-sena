import { io } from 'socket.io-client';

const SERVER_URL = process.env.SOCKET_BASE_URL ?? 'http://localhost:3000';
const STUDENT_TOKEN = process.env.STUDENT_TOKEN;
const SESSION_ID = Number(process.env.SESSION_ID);
const NUMERO_METEORITO = Number(process.env.NUMERO_METEORITO ?? 16);
const CLASIFICACION = process.env.CLASIFICACION ?? 'mayor';
const TIEMPO_REACCION_MS = Number(process.env.TIEMPO_REACCION_MS ?? 1200);

if (!STUDENT_TOKEN || !SESSION_ID) {
  console.error('Faltan variables requeridas: STUDENT_TOKEN y SESSION_ID');
  console.error('Ejemplo:');
  console.error(
    '  $env:STUDENT_TOKEN="jwt"; $env:SESSION_ID="145"; node test-sockets.js'
  );
  process.exit(1);
}

const socket = io(SERVER_URL, {
  auth: { token: STUDENT_TOKEN },
  transports: ['websocket'],
  reconnection: false,
});

console.log('Probando Codigo Estelar contra', SERVER_URL);

socket.on('connect', () => {
  console.log('Socket conectado:', socket.id);
  socket.emit('codigo_estelar:join', { sesionId: SESSION_ID });
});

socket.on('connect_error', (error) => {
  console.error('Error de conexion:', error.message, error.data ?? '');
  process.exit(1);
});

socket.on('codigo_estelar:joined', (payload) => {
  console.log('\nJOIN OK');
  console.dir(payload, { depth: null });

  socket.emit('codigo_estelar:submit_answer', {
    sesionId: SESSION_ID,
    numeroMeteorito: NUMERO_METEORITO,
    clasificacionElegida: CLASIFICACION,
    tiempoReaccionMs: TIEMPO_REACCION_MS,
  });
});

socket.on('codigo_estelar:leaderboard_update', (payload) => {
  console.log('\nLEADERBOARD UPDATE');
  console.dir(payload, { depth: null });
});

socket.on('codigo_estelar:game_over', (payload) => {
  console.log('\nGAME OVER');
  console.dir(payload, { depth: null });
  socket.close();
});

socket.on('codigo_estelar:error', (payload) => {
  console.error('\nSOCKET ERROR');
  console.dir(payload, { depth: null });
  socket.close();
});
