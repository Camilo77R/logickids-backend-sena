import { db } from '../src/config/db.js';
import {
  finalizar,
  iniciar,
  registrarEvento,
} from '../src/services/sesiones.service.js';

const ESTUDIANTE_ID = Number(process.env.TREN_FIGURAS_ESTUDIANTE_ID);

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const obtenerMinijuegoTren = async () => {
  const minijuego = await db('minijuegos')
    .where({ slug: 'tren-figuras', activo: true })
    .select('id_minijuego', 'titulo')
    .first();

  if (!minijuego) {
    throw new Error('No existe el minijuego tren-figuras. Ejecuta primero la migracion.');
  }

  return minijuego;
};

const generarJugadas = () =>
  Array.from({ length: 10 }, (_, indice) => {
    const acierto = indice % 4 !== 3;

    return {
      tipo_evento: acierto ? 'acierto' : 'error',
      habilidad: 'Lógica',
      tiempo_reaccion_ms: 700 + indice * 35,
      puntos: acierto ? 10 : 0,
      combo_en_evento: acierto ? (indice % 3) + 1 : 0,
      metadata: {
        origen: 'test-tren-figuras-bridge',
        vagonIndex: indice,
        figuraSolicitada: indice % 2 === 0 ? 'circulo' : 'cuadrado',
      },
    };
  });

const verificarRegistros = async (sesionId) => {
  const sesion = await db('sesiones_juego')
    .where({ id_sesion_juego: sesionId })
    .select('puntaje', 'aciertos', 'errores', 'combo_maximo', 'estado_id')
    .first();
  const eventos = await db('eventos_sesion')
    .where({ sesion_id: sesionId })
    .count({ total: '*' })
    .first();

  console.log('Sesion guardada:', sesion);
  console.log('Eventos guardados:', Number(eventos?.total ?? 0));
};

const simularPartidaTrenFiguras = async () => {
  if (!Number.isInteger(ESTUDIANTE_ID) || ESTUDIANTE_ID <= 0) {
    throw new Error('Define TREN_FIGURAS_ESTUDIANTE_ID con un id_estudiante valido.');
  }

  const minijuego = await obtenerMinijuegoTren();
  console.log('Minijuego:', minijuego.titulo, `#${minijuego.id_minijuego}`);

  const inicio = await iniciar(ESTUDIANTE_ID, {
    minijuego_id: minijuego.id_minijuego,
    dificultad: 1,
  });
  const sesionId = inicio.sesion.id;
  console.log('Sesion iniciada:', sesionId);

  const jugadas = generarJugadas();
  for (const jugada of jugadas) {
    await registrarEvento(sesionId, ESTUDIANTE_ID, jugada);
    await esperar(120);
  }
  console.log('Eventos enviados:', jugadas.length);

  await finalizar(sesionId, ESTUDIANTE_ID, { estado: 'completado' });
  console.log('Sesion finalizada');

  await verificarRegistros(sesionId);
};

simularPartidaTrenFiguras()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.destroy();
  });
