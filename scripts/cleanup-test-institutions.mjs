import { db } from '../src/config/db.js';
import { deleteTestInstitutionsByIds } from '../tests/helpers/testFixtures.helper.js';

const LEGACY_TEST_INSTITUTION_PATTERNS = [
  /^Inst (codigo-estelar|mercado-config|group-flow|move-student|single-active-group|solicitudes)-\d+(?:-[a-z0-9]+)?$/i,
  /^Institucion (admins|tutors|super-tutor|dashboard)-\d+(?:-[a-z0-9]+)?$/i,
  /^Tenant Lifecycle (?:admin-)?\d+$/i,
  /^Test Tenant \d+$/i,
];

const isLegacyTestInstitutionName = (name) =>
  LEGACY_TEST_INSTITUTION_PATTERNS.some((pattern) => pattern.test(name));

const printPreview = (institutions) => {
  console.log(`Instituciones historicas de test detectadas: ${institutions.length}`);
  institutions.slice(0, 20).forEach(({ id_institucion, nombre }) => {
    console.log(`- ${id_institucion}: ${nombre}`);
  });

  if (institutions.length > 20) {
    console.log(`... y ${institutions.length - 20} adicionales.`);
  }
};

const main = async () => {
  const execute = process.argv.includes('--execute');
  const institutions = (await db('instituciones').select('id_institucion', 'nombre'))
    .filter(({ nombre }) => isLegacyTestInstitutionName(nombre));

  printPreview(institutions);

  if (!execute || institutions.length === 0) {
    console.log(
      execute
        ? 'No hay residuos historicos para eliminar.'
        : 'Simulacion terminada. Use --execute solo despues de revisar esta lista.',
    );
    return;
  }

  await deleteTestInstitutionsByIds(
    institutions.map(({ id_institucion }) => id_institucion),
    { isAllowedInstitutionName: isLegacyTestInstitutionName },
  );

  console.log(`Limpieza completada: ${institutions.length} instituciones de test eliminadas.`);
};

try {
  await main();
} finally {
  await db.destroy();
}
