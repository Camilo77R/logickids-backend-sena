import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockQueryBuilder } from '../setup.js';

vi.mock('../../../src/services/email.service.js', () => ({
  enviarCorreoActivacionTutor: vi.fn(() => Promise.resolve()),
}));

const { builders, mockKnexDb } = vi.hoisted(() => {
  const builders = {};
  function mockKnexDb(table) {
    if (!builders[table]) builders[table] = createMockQueryBuilder();
    return builders[table];
  }
  mockKnexDb.raw = vi.fn((v) => ({ toRaw: () => v }));
  mockKnexDb.fn = { now: vi.fn(() => 'NOW()') };
  mockKnexDb.client = { config: { client: 'pg' } };
  mockKnexDb.transaction = vi.fn((cb) => cb(mockKnexDb));
  return { builders, mockKnexDb };
});

vi.mock('../../../src/config/db.js', () => ({ db: mockKnexDb }));
vi.mock('bcrypt', () => ({ default: { hash: vi.fn(() => 'hashed') }, hash: vi.fn(() => 'hashed') }));

vi.mock('../../../src/services/sesionesClase.service.js', () => ({
  cerrarSesionClasePorGrupo: vi.fn(),
  ESTADOS_SESION_CLASE: { cancelada: 'cancelada' },
  obtenerSesionClaseActivaPorGrupo: vi.fn(),
}));
vi.mock('../../../src/services/sesiones.service.js', () => ({ abandonarSesionesActivasDeClase: vi.fn() }));

beforeEach(() => { Object.keys(builders).forEach((k) => delete builders[k]); vi.clearAllMocks(); });

const admin = await import('../../../src/services/admin.service.js');
const superadmin = { rol: 'superadmin', id: 1, institucion_id: null };
const adminUser = { rol: 'admin', id: 2, institucion_id: 1, es_admin_principal: true };

describe('listarUsuarios', () => {
  it('retorna query', () => {
    const result = admin.listarUsuarios(superadmin, { rol: 'todos' });
    expect(result.then).toBeDefined();
  });

  it('lanza error si filtro de rol invalido', async () => {
    await expect(admin.listarUsuarios(superadmin, { rol: 'invalido' }))
      .rejects.toThrow('Filtro');
  });
});

describe('obtenerUsuario', () => {
  it('lanza error si usuario no existe', async () => {
    builders['usuarios'] = createMockQueryBuilder();
    builders['usuarios'].first.mockResolvedValueOnce(null);
    await expect(admin.obtenerUsuario(1, superadmin))
      .rejects.toThrow('no encontrado');
  });
});

describe('cambiarEstadoUsuario', () => {
  it('cambia estado exitosamente', async () => {
    builders['usuarios'] = createMockQueryBuilder();
    builders['usuarios'].first.mockResolvedValueOnce({
      id_usuario: 1, id: 1, nombre: 'Test', email: 't@t.com',
      rol: 'tutor', estado: 'inactivo', institucion_id: 1,
    });
    builders['estados_usuario'] = createMockQueryBuilder();
    builders['estados_usuario'].first.mockResolvedValueOnce({ id_estado_usuario: 1 });
    const result = await admin.cambiarEstadoUsuario(1, 'activo', adminUser);
    expect(result.estado).toBe('activo');
  });

  it('lanza error si usuario no existe', async () => {
    builders['usuarios'] = createMockQueryBuilder();
    builders['usuarios'].first.mockResolvedValueOnce(null);
    await expect(admin.cambiarEstadoUsuario(99, 'activo', adminUser))
      .rejects.toThrow('no encontrado');
  });
});

describe('crearAdminInstitucional', () => {
  it('lanza error si email ya existe', async () => {
    builders['instituciones'] = createMockQueryBuilder();
    // assertInstitutionExists is called twice (normalizeInstitutionScope + direct)
    builders['instituciones'].first.mockResolvedValue({ id_institucion: 1, nombre: 'I', activo: true });
    builders['usuarios'] = createMockQueryBuilder();
    builders['usuarios'].first.mockResolvedValueOnce({ id_usuario: 1 });
    await expect(admin.crearAdminInstitucional(superadmin, {
      nombre: 'Admin', email: 'dup@test.com', institucion_id: 1,
    })).rejects.toThrow('ya está registrado');
  });
});

describe('crearTutorInstitucional', () => {
  it('lanza error si no se indica institucion', async () => {
    await expect(admin.crearTutorInstitucional(superadmin, {
      nombre: 'Tutor', email: 't@t.com',
    })).rejects.toThrow('Debe indicar');
  });
});

describe('listarInstituciones', () => {
  it('retorna query sin filtro', () => {
    const result = admin.listarInstituciones();
    expect(result.then).toBeDefined();
  });

  it('lanza error si filtro estado invalido', () => {
    expect(() => admin.listarInstituciones({ estado: 'invalido' }))
      .toThrow('Filtro');
  });
});

describe('crearInstitucion', () => {
  it('lanza error si ya existe', async () => {
    builders['instituciones'] = createMockQueryBuilder();
    builders['instituciones'].first.mockResolvedValueOnce({ id_institucion: 1 });
    await expect(admin.crearInstitucion({ nombre: 'Duplicada' }))
      .rejects.toThrow('Ya existe');
  });

  it('crea institucion exitosamente', async () => {
    builders['instituciones'] = createMockQueryBuilder();
    builders['instituciones'].first.mockResolvedValueOnce(null);
    builders['instituciones'].returning.mockReturnThis();
    builders['instituciones'].then = vi.fn((resolve) => Promise.resolve(resolve ? resolve([{ id_institucion: 1, nombre: 'Nueva' }]) : [{ id_institucion: 1, nombre: 'Nueva' }]));
    builders['roles'] = createMockQueryBuilder();
    builders['roles'].first.mockResolvedValueOnce({ id_rol: 2 });
    builders['usuarios'] = createMockQueryBuilder();
    builders['usuarios'].returning.mockReturnThis();
    builders['usuarios'].then = vi.fn((resolve) => Promise.resolve(resolve ? resolve([{ id_usuario: 1, email: 'a@b.com' }]) : [{ id_usuario: 1, email: 'a@b.com' }]));
    const result = await admin.crearInstitucion({ nombre: 'Nueva', ciudad: 'Cali' });
    expect(result.institucion.nombre).toBe('Nueva');
  });
});

describe('desactivarInstitucion', () => {
  it('lanza error si no existe', async () => {
    builders['instituciones'] = createMockQueryBuilder();
    builders['instituciones'].first.mockResolvedValueOnce(null);
    await expect(admin.desactivarInstitucion(99))
      .rejects.toThrow('no encontrada');
  });
});

describe('reactivarInstitucion', () => {
  it('lanza error si ya esta activa', async () => {
    builders['instituciones'] = createMockQueryBuilder();
    builders['instituciones'].first.mockResolvedValueOnce({ id_institucion: 1, activo: true });
    await expect(admin.reactivarInstitucion(1))
      .rejects.toThrow('ya está activa');
  });
});

describe('actualizarInstitucion', () => {
  it('lanza error si no hay campos validos', async () => {
    await expect(admin.actualizarInstitucion(1, {}))
      .rejects.toThrow('No se proporcionaron');
  });

  it('actualiza institucion', async () => {
    builders['instituciones'] = createMockQueryBuilder();
    builders['instituciones'].first.mockResolvedValueOnce({ id_institucion: 1, nombre: 'Viejo' });
    builders['instituciones'].returning.mockReturnThis();
    builders['instituciones'].then = vi.fn((resolve) => Promise.resolve(resolve ? resolve([{ id: 1, nombre: 'Nuevo' }]) : [{ id: 1, nombre: 'Nuevo' }]));
    const result = await admin.actualizarInstitucion(1, { nombre: 'Nuevo' });
    expect(result.nombre).toBe('Nuevo');
  });
});

describe('listarDashboard', () => {
  it('retorna dashboard superadmin', () => {
    const result = admin.listarDashboard(superadmin);
    expect(result.then).toBeDefined();
  });
});

describe('listarMinijuegosAdmin', () => {
  it('retorna query', () => {
    const result = admin.listarMinijuegosAdmin();
    expect(result.then).toBeDefined();
  });
});

describe('toggleMinijuego', () => {
  it('lanza error si minijuego no existe', async () => {
    builders['minijuegos'] = createMockQueryBuilder();
    builders['minijuegos'].returning.mockReturnThis();
    builders['minijuegos'].then = vi.fn((resolve) => Promise.resolve(resolve ? resolve([]) : []));
    await expect(admin.toggleMinijuego(1, false))
      .rejects.toThrow('no encontrado');
  });
});