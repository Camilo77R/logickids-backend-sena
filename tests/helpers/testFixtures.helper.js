import { db } from '../../src/config/db.js';

export const TEST_INSTITUTION_PREFIX = '__TEST_FIXTURE__ ';

const registeredInstitutionIds = new Set();
const isMarkedTestInstitutionName = (name) => name.startsWith(TEST_INSTITUTION_PREFIX);

export const buildTestInstitutionName = (name) => `${TEST_INSTITUTION_PREFIX}${name}`;

export const registerTestInstitution = (institutionId) => {
  if (!Number.isInteger(institutionId) || institutionId <= 0) {
    throw new Error(`ID de institucion de prueba invalido: ${institutionId}`);
  }

  registeredInstitutionIds.add(institutionId);
};

const deleteSessionsForFixture = async (trx, studentIds, classSessionIds) => {
  if (studentIds.length === 0 && classSessionIds.length === 0) {
    return;
  }

  const query = trx('sesiones_juego');

  if (studentIds.length > 0) {
    query.whereIn('estudiante_id', studentIds);
  }

  if (classSessionIds.length > 0) {
    const addClassFilter = studentIds.length > 0 ? 'orWhereIn' : 'whereIn';
    query[addClassFilter]('sesion_clase_id', classSessionIds);
  }

  await query.del();
};

const findSafeFixtureInstitutionIds = async (trx, institutionIds, isAllowedInstitutionName) => {
  const institutions = await trx('instituciones')
    .whereIn('id_institucion', institutionIds)
    .select('id_institucion', 'nombre');

  const unsafeInstitutions = institutions.filter(
    ({ nombre }) => !isAllowedInstitutionName(nombre),
  );

  if (unsafeInstitutions.length > 0) {
    const names = unsafeInstitutions.map(({ nombre }) => nombre).join(', ');
    throw new Error(`Limpieza de fixtures rechazada para instituciones sin marca: ${names}`);
  }

  return institutions.map(({ id_institucion }) => id_institucion);
};

const findFixtureEntityIds = async (trx, institutionIds) => {
  // Un trx usa una sola conexion; ejecutar varias queries en paralelo sobre el
  // mismo cliente provoca warnings y hace el cleanup menos predecible.
  const studentIds = await trx('estudiantes')
    .whereIn('institucion_id', institutionIds)
    .pluck('id_estudiante');
  const groupIds = await trx('grupos')
    .whereIn('institucion_id', institutionIds)
    .pluck('id_grupo');
  const userIds = await trx('usuarios')
    .whereIn('institucion_id', institutionIds)
    .pluck('id_usuario');

  const classSessionIds =
    groupIds.length > 0
      ? await trx('sesiones_clase').whereIn('grupo_id', groupIds).pluck('id_sesion_clase')
      : [];

  return { studentIds, groupIds, userIds, classSessionIds };
};

const deleteFixtureEntities = async (
  trx,
  { institutionIds, studentIds, groupIds, userIds, classSessionIds },
) => {
  await deleteSessionsForFixture(trx, studentIds, classSessionIds);

  if (classSessionIds.length > 0) {
    await trx('sesiones_clase').whereIn('id_sesion_clase', classSessionIds).del();
  }
  if (studentIds.length > 0) {
    await trx('estudiantes').whereIn('id_estudiante', studentIds).del();
  }
  if (groupIds.length > 0) {
    await trx('grupos').whereIn('id_grupo', groupIds).del();
  }
  if (userIds.length > 0) {
    await trx('usuarios').whereIn('id_usuario', userIds).del();
  }

  await trx('instituciones').whereIn('id_institucion', institutionIds).del();
};

const deleteFixtureInstitutions = async (trx, registeredIds, isAllowedInstitutionName) => {
  const institutionIds = await findSafeFixtureInstitutionIds(
    trx,
    registeredIds,
    isAllowedInstitutionName,
  );
  if (institutionIds.length === 0) {
    return;
  }

  const entityIds = await findFixtureEntityIds(trx, institutionIds);
  await deleteFixtureEntities(trx, { institutionIds, ...entityIds });
};

export const deleteTestInstitutionsByIds = async (
  institutionIds,
  { isAllowedInstitutionName = isMarkedTestInstitutionName } = {},
) => {
  if (institutionIds.length === 0) {
    return;
  }

  await db.transaction((trx) =>
    deleteFixtureInstitutions(trx, institutionIds, isAllowedInstitutionName),
  );
};

export const cleanupRegisteredTestInstitutions = async () => {
  const institutionIds = [...registeredInstitutionIds];
  if (institutionIds.length === 0) {
    return;
  }

  await deleteTestInstitutionsByIds(institutionIds);
  institutionIds.forEach((institutionId) => registeredInstitutionIds.delete(institutionId));
};
