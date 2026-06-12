export const MERCADO_INTELIGENTE_SLUG = 'mercado-inteligente';

export const MERCADO_INTELIGENTE_DIFFICULTY_PRESETS = Object.freeze({
  1: Object.freeze({
    rondas_por_partida: 1,
    presupuesto_monedas: 8,
    cantidad_productos_visibles: 4,
    cantidad_objetivos: 2,
    precio_min: 1,
    precio_max: 4,
    categorias_permitidas: ['frutas', 'verduras', 'panaderia'],
    modo_objetivo: 'presupuesto_maximo',
    ayudas_disponibles: 1,
  }),
  2: Object.freeze({
    rondas_por_partida: 1,
    presupuesto_monedas: 10,
    cantidad_productos_visibles: 5,
    cantidad_objetivos: 2,
    precio_min: 1,
    precio_max: 5,
    categorias_permitidas: ['frutas', 'verduras', 'panaderia', 'lacteos'],
    modo_objetivo: 'presupuesto_maximo',
    ayudas_disponibles: 1,
  }),
  3: Object.freeze({
    rondas_por_partida: 1,
    presupuesto_monedas: 12,
    cantidad_productos_visibles: 6,
    cantidad_objetivos: 3,
    precio_min: 2,
    precio_max: 6,
    categorias_permitidas: ['frutas', 'verduras', 'panaderia', 'lacteos'],
    modo_objetivo: 'categoria_objetivo',
    ayudas_disponibles: 1,
  }),
  4: Object.freeze({
    rondas_por_partida: 1,
    presupuesto_monedas: 14,
    cantidad_productos_visibles: 6,
    cantidad_objetivos: 3,
    precio_min: 2,
    precio_max: 7,
    categorias_permitidas: ['frutas', 'verduras', 'panaderia', 'lacteos'],
    modo_objetivo: 'presupuesto_exacto',
    ayudas_disponibles: 0,
  }),
});

export const buildMercadoInteligenteGameConfig = (dificultad, configuracionBase = {}) => {
  const dificultadNormalizada = MERCADO_INTELIGENTE_DIFFICULTY_PRESETS[dificultad]
    ? Number(dificultad)
    : 4;
  const preset =
    MERCADO_INTELIGENTE_DIFFICULTY_PRESETS[dificultadNormalizada];

  return {
    ...preset,
    ...configuracionBase,
    dificultad: dificultadNormalizada,
  };
};
