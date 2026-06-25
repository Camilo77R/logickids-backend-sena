import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_STUDENT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_STUDENT_EXPIRES_IN: z.string().default('4h'),
  JWT_STUDENT_ISSUER: z.string().default('logickids-backend'),
  JWT_STUDENT_AUDIENCE: z.string().default('logickids-student-mobile'),
  STUDENT_DEVICE_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(240),
  STUDENT_DEVICE_INACTIVITY_MINUTES: z.coerce.number().int().positive().default(30),
  STUDENT_LOGIN_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  STUDENT_LOGIN_BLOCK_MINUTES: z.coerce.number().int().positive().default(15),
  STUDENT_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  STUDENT_LOGIN_MAX_ATTEMPTS_PER_IP: z.coerce.number().int().positive().default(300),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  EMAIL_HOST: z.string().optional(),
  EMAIL_PORT: z.coerce.number().optional(),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_PUBLIC_BASE_URL: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().url().optional(),
  ),
  GEMINI_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('  Variables de entorno inválidas:');
  parsed.error.issues.forEach((i) => console.error(`   ${i.path.join('.')}: ${i.message}`));
  process.exit(1);
}

export const env = parsed.data;
