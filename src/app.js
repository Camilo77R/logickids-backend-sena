import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";

import authRoutes from "./routes/auth.routes.js";
import gruposRoutes from "./routes/grupos.routes.js";
import estudiantesRoutes from "./routes/estudiantes.routes.js";
import sesionesRoutes from "./routes/sesiones.routes.js";

import adminRoutes from "./routes/admin.routes.js";
const app = express();

const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim());
app.use(
    cors({
        origin: (origin, cb) =>
            !origin || allowedOrigins.includes(origin)
                ? cb(null, true)
                : cb(new Error("CORS bloqueado")),
        credentials: true,
    }),
);

app.use(express.json());

app.get("/api/health", (_req, res) =>
    res.json({
        success: true,
        data: {
            status: "ok",
            version: "2.0.0",
            timestamp: new Date().toISOString(),
        },
    }),
);

app.use("/api/auth", authRoutes);
app.use("/api/grupos", gruposRoutes);
app.use("/api/estudiantes", estudiantesRoutes);
app.use("/api/sesiones", sesionesRoutes);

app.use("/api/admin", adminRoutes);
app.use((_req, res) =>
    res.status(404).json({ success: false, message: "Ruta no encontrada" }),
);
app.use(errorHandler);

export default app;
