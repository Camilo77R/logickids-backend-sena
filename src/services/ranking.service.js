import { db } from '../config/db.js';
import { assertGroupBelongsToUser } from './access.service.js';
import { withActiveGroupHistory } from './access.service.js';

const RANKING_METRIC = Object.freeze({
  key: 'puntaje_total',
  label: 'Puntaje oficial acumulado',
  order: 'desc',
  tieBreakers: ['aciertos_totales', 'errores_totales', 'sesiones_finalizadas', 'nombre'],
});

const normalizeInteger = (value) => Number(value ?? 0);

const buildEmptyRanking = (scope) => ({
  scope,
  metrica: RANKING_METRIC,
  total_participantes: 0,
  ranking: [],
  top3: [],
  resto: [],
  mi_posicion: null,
});

const resolveSessionScope = async (sesionClaseId, executor = db) =>
  executor('sesiones_clase as sc')
    .join('grupos as g', 'g.id_grupo', 'sc.grupo_id')
    .leftJoin('rutas_pedagogicas as ruta', 'ruta.id_ruta_pedagogica', 'sc.ruta_pedagogica_id')
    .leftJoin('sesion_clase_pasos as paso', function joinFirstStep() {
      this.on('paso.sesion_clase_id', 'sc.id_sesion_clase').andOn('paso.orden', db.raw('1'));
    })
    .leftJoin('minijuegos as m', 'm.id_minijuego', 'paso.minijuego_id')
    .where('sc.id_sesion_clase', sesionClaseId)
    .select(
      'sc.id_sesion_clase as sesion_clase_id',
      'sc.grupo_id',
      'g.institucion_id',
      'g.tutor_asignado_id',
      'sc.modo as sesion_modo',
      'sc.estado as sesion_estado',
      'sc.ruta_pedagogica_id as sesion_ruta_id',
      'ruta.slug as sesion_ruta_slug',
      'ruta.nombre as sesion_ruta_nombre',
      'paso.minijuego_id as sesion_minijuego_id',
      'm.slug as sesion_minijuego_slug',
      'm.titulo as sesion_minijuego_titulo'
    )
    .first();

const resolvePreferredClassSessionForGroup = async (grupoId, executor = db) => {
  const activeSession = await executor('sesiones_clase')
    .where({
      grupo_id: grupoId,
      estado: 'activa',
    })
    .orderBy('abierta_en', 'desc')
    .orderBy('id_sesion_clase', 'desc')
    .select('id_sesion_clase')
    .first();

  if (activeSession) {
    return {
      sesionClaseId: activeSession.id_sesion_clase,
      fuente: 'sesion_activa',
    };
  }

  const latestSession = await executor('sesiones_clase')
    .where({ grupo_id: grupoId })
    .orderBy('abierta_en', 'desc')
    .orderBy('id_sesion_clase', 'desc')
    .select('id_sesion_clase')
    .first();

  if (!latestSession) {
    return null;
  }

  return {
    sesionClaseId: latestSession.id_sesion_clase,
    fuente: 'ultima_sesion_clase',
  };
};

const resolvePreferredClassSessionForStudent = async (studentId, executor = db) => {
  const studentContext = await withActiveGroupHistory(executor('estudiantes'), {
    studentTable: 'estudiantes',
    alias: 'egh',
  })
    .leftJoin('sesiones_clase as sc', function joinActiveClassSession() {
      this.on('sc.grupo_id', 'egh.grupo_id').andOn('sc.estado', db.raw('?', ['activa']));
    })
    .where('estudiantes.id_estudiante', studentId)
    .select('estudiantes.institucion_id', 'egh.grupo_id', 'sc.id_sesion_clase as sesion_clase_id')
    .first();

  if (studentContext?.sesion_clase_id != null) {
    return {
      sesionClaseId: studentContext.sesion_clase_id,
      fuente: 'sesion_activa',
    };
  }

  const latestPlayedSession = await executor('sesiones_juego')
    .where({ estudiante_id: studentId })
    .whereNotNull('sesion_clase_id')
    .orderBy('iniciada_en', 'desc')
    .orderBy('id_sesion_juego', 'desc')
    .select('sesion_clase_id')
    .first();

  if (!latestPlayedSession?.sesion_clase_id) {
    return null;
  }

  return {
    sesionClaseId: latestPlayedSession.sesion_clase_id,
    fuente: 'ultima_sesion_jugada',
  };
};

const resolveRankingRows = async (sesionClaseId, executor = db) =>
  executor('sesion_clase_participantes as participante')
    .join('estudiantes as estudiante', 'estudiante.id_estudiante', 'participante.estudiante_id')
    .leftJoin('sesiones_juego as sesion', function joinSessions() {
      this.on('sesion.sesion_clase_id', 'participante.sesion_clase_id').andOn(
        'sesion.estudiante_id',
        'participante.estudiante_id'
      );
    })
    .where('participante.sesion_clase_id', sesionClaseId)
    .groupBy(
      'participante.sesion_clase_id',
      'participante.estudiante_id',
      'participante.estado',
      'estudiante.nombre',
      'estudiante.color_avatar'
    )
    .select(
      'participante.sesion_clase_id',
      'participante.estudiante_id as estudiante_id',
      'participante.estado as participante_estado',
      'estudiante.nombre',
      'estudiante.color_avatar',
      db.raw('COALESCE(SUM(sesion.puntaje), 0) as puntaje_total'),
      db.raw('COALESCE(SUM(sesion.aciertos), 0) as aciertos_totales'),
      db.raw('COALESCE(SUM(sesion.errores), 0) as errores_totales'),
      db.raw('COALESCE(MAX(sesion.combo_maximo), 0) as combo_maximo'),
      db.raw('COALESCE(SUM(sesion.estrellas_obtenidas), 0) as estrellas_totales'),
      db.raw(
        'COUNT(sesion.id_sesion_juego) FILTER (WHERE sesion.finalizada_en IS NOT NULL) as sesiones_finalizadas'
      ),
      db.raw('MAX(sesion.finalizada_en) as ultima_finalizacion')
    );

const compareRankingEntries = (left, right) => {
  if (right.puntaje_total !== left.puntaje_total) {
    return right.puntaje_total - left.puntaje_total;
  }

  if (right.aciertos_totales !== left.aciertos_totales) {
    return right.aciertos_totales - left.aciertos_totales;
  }

  if (left.errores_totales !== right.errores_totales) {
    return left.errores_totales - right.errores_totales;
  }

  if (right.sesiones_finalizadas !== left.sesiones_finalizadas) {
    return right.sesiones_finalizadas - left.sesiones_finalizadas;
  }

  return left.nombre.localeCompare(right.nombre, 'es');
};

const hasSameRankingMetrics = (left, right) =>
  left.puntaje_total === right.puntaje_total &&
  left.aciertos_totales === right.aciertos_totales &&
  left.errores_totales === right.errores_totales &&
  left.sesiones_finalizadas === right.sesiones_finalizadas;

const buildRankingEntries = (rows) => {
  const normalizedRows = rows.map((row) => ({
    estudiante_id: row.estudiante_id,
    nombre: row.nombre,
    color_avatar: row.color_avatar,
    participante_estado: row.participante_estado,
    puntaje_total: normalizeInteger(row.puntaje_total),
    aciertos_totales: normalizeInteger(row.aciertos_totales),
    errores_totales: normalizeInteger(row.errores_totales),
    combo_maximo: normalizeInteger(row.combo_maximo),
    estrellas_totales: normalizeInteger(row.estrellas_totales),
    sesiones_finalizadas: normalizeInteger(row.sesiones_finalizadas),
    ultima_finalizacion: row.ultima_finalizacion ?? null,
  }));

  const participantes = normalizedRows.filter(
    (r) => r.puntaje_total > 0 || r.sesiones_finalizadas > 0
  );
  const sinParticipacion = normalizedRows.filter(
    (r) => r.puntaje_total === 0 && r.sesiones_finalizadas === 0
  );

  participantes.sort(compareRankingEntries);

  const ranked = participantes.map((row, index) => {
    const previousEntry = index > 0 ? participantes[index - 1] : null;
    const previousPosition = index > 0 ? participantes[index - 1]._rankingPosition : null;
    const rankingPosition =
      previousEntry && hasSameRankingMetrics(previousEntry, row) ? previousPosition : index + 1;

    row._rankingPosition = rankingPosition;

    return {
      posicion: rankingPosition,
      estudiante_id: row.estudiante_id,
      nombre: row.nombre,
      color_avatar: row.color_avatar,
      participante_estado: row.participante_estado,
      valor: row.puntaje_total,
      puntaje: row.puntaje_total,
      aciertos: row.aciertos_totales,
      errores: row.errores_totales,
      combo_maximo: row.combo_maximo,
      estrellas_totales: row.estrellas_totales,
      sesiones_finalizadas: row.sesiones_finalizadas,
      ultima_finalizacion: row.ultima_finalizacion,
      esta_en_top3: index < 3,
      participacion: true,
    };
  });

  const sinRanking = sinParticipacion.map((row) => ({
    posicion: null,
    estudiante_id: row.estudiante_id,
    nombre: row.nombre,
    color_avatar: row.color_avatar,
    participante_estado: row.participante_estado,
    valor: 0,
    puntaje: 0,
    aciertos: 0,
    errores: 0,
    combo_maximo: 0,
    estrellas_totales: 0,
    sesiones_finalizadas: 0,
    ultima_finalizacion: null,
    esta_en_top3: false,
    participacion: false,
  }));

  return [...ranked, ...sinRanking];
};

const buildRankingPayload = ({ scope, rows, ownerStudentId = null }) => {
  const ranking = buildRankingEntries(rows);
  const miPosicion =
    ownerStudentId == null
      ? null
      : ranking.find((entry) => entry.estudiante_id === ownerStudentId) ?? null;

  return {
    scope,
    metrica: RANKING_METRIC,
    total_participantes: ranking.length,
    ranking,
    top3: ranking.slice(0, 3),
    resto: ranking.slice(3),
    mi_posicion: miPosicion,
  };
};

export const obtenerRankingGrupo = async (grupoId, user, executor = db) => {
  await assertGroupBelongsToUser(grupoId, user, executor);

  const target = await resolvePreferredClassSessionForGroup(grupoId, executor);
  if (!target) {
    return buildEmptyRanking({
      grupo_id: grupoId,
      sesion_clase_id: null,
      fuente: 'sin_sesion',
    });
  }

  const scope = await resolveSessionScope(target.sesionClaseId, executor);
  if (!scope) {
    return buildEmptyRanking({
      grupo_id: grupoId,
      sesion_clase_id: target.sesionClaseId,
      fuente: target.fuente,
    });
  }

  const rows = await resolveRankingRows(target.sesionClaseId, executor);
  return buildRankingPayload({
    scope: {
      ...scope,
      fuente: target.fuente,
    },
    rows,
  });
};

export const obtenerMiRanking = async (studentId, executor = db) => {
  const target = await resolvePreferredClassSessionForStudent(studentId, executor);
  if (!target) {
    return buildEmptyRanking({
      grupo_id: null,
      sesion_clase_id: null,
      fuente: 'sin_sesion',
    });
  }

  const scope = await resolveSessionScope(target.sesionClaseId, executor);
  if (!scope) {
    return buildEmptyRanking({
      grupo_id: null,
      sesion_clase_id: target.sesionClaseId,
      fuente: target.fuente,
    });
  }

  const rows = await resolveRankingRows(target.sesionClaseId, executor);
  return buildRankingPayload({
    scope: {
      ...scope,
      fuente: target.fuente,
    },
    rows,
    ownerStudentId: studentId,
  });
};
