import { z } from 'zod';

const joinPayloadSchema = z.object({
  sesionId: z.coerce
    .number({ invalid_type_error: 'La sesion debe ser numerica' })
    .int('La sesion debe ser un entero')
    .positive('La sesion debe ser positiva'),
});

const submitPayloadSchema = z.object({
  sesionId: z.coerce
    .number({ invalid_type_error: 'La sesion debe ser numerica' })
    .int('La sesion debe ser un entero')
    .positive('La sesion debe ser positiva'),
  numeroMeteorito: z.coerce
    .number({ invalid_type_error: 'El numero del meteorito debe ser numerico' })
    .finite('El numero del meteorito debe ser valido'),
  clasificacionElegida: z.enum(['menor', 'igual', 'mayor'], {
    errorMap: () => ({ message: 'La clasificacion debe ser menor, igual o mayor' }),
  }),
  tiempoReaccionMs: z.coerce
    .number({ invalid_type_error: 'El tiempo de reaccion debe ser numerico' })
    .int('El tiempo de reaccion debe ser un entero')
    .min(0, 'El tiempo de reaccion no puede ser negativo')
    .max(60_000, 'El tiempo de reaccion no puede superar 60 segundos'),
});

export const parseCodigoEstelarJoinPayload = (payload) => joinPayloadSchema.parse(payload);

export const parseCodigoEstelarSubmitPayload = (payload) => submitPayloadSchema.parse(payload);
