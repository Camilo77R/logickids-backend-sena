import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  registroSchema,
  loginSchema,
  actualizarPerfilSchema,
  cambiarContrasenaSchema,
} from '../schemas/auth.schema.js';

const router = Router();

router.post('/registro', validate(registroSchema), ctrl.registro);
router.post('/login',    validate(loginSchema),    ctrl.login);

router.get('/perfil',  requireAuth,                                         ctrl.perfil);
router.put('/perfil',  requireAuth, validate(actualizarPerfilSchema),       ctrl.actualizarPerfil);
router.put('/cambiar-contrasena', requireAuth, validate(cambiarContrasenaSchema), ctrl.cambiarContrasena);

export default router;
