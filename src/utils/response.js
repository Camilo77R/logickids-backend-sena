/**
 * Contrato de respuesta unificado:
 * { success: boolean, data: any, message: string }
 */

export const ok = (res, data, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, data, message });

export const created = (res, data, message = 'Recurso creado correctamente') =>
  ok(res, data, message, 201);

export const noContent = (res) => res.status(204).send();
