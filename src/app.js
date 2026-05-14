import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { corsOriginHandler } from "./config/cors.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";

import authRoutes from "./routes/auth.routes.js";
import gruposRoutes from "./routes/grupos.routes.js";
import estudiantesRoutes from "./routes/estudiantes.routes.js";
import sesionesRoutes from "./routes/sesiones.routes.js";
import logrosRoutes from "./routes/logros.routes.js";
import estadisticasRoutes from "./routes/estadisticas.routes.js";
import recomendacionesRoutes from "./routes/recomendaciones.routes.js";
import minijuegosRoutes from "./routes/minijuegos.routes.js";
import { buildCodigoEstelarMobileDebugPage } from "./debug/codigoEstelarMobilePage.js";
import adminRoutes from "./routes/admin.routes.js";
import solicitudesRoutes from "./routes/solicitudes.routes.js";

const app = express();

app.use(
    cors({
        origin: corsOriginHandler,
        credentials: true,
    }),
);

app.use(express.json());

if (env.NODE_ENV !== "production") {
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
    app.get("/docs.json", (_req, res) => res.json(swaggerSpec));
    app.get("/debug/codigo-estelar-mobile", (_req, res) =>
        res
            .type("html")
            .send(
                buildCodigoEstelarMobileDebugPage({
                    suggestedApiBaseUrl: "http://192.168.31.80:3000/api",
                    suggestedDifficulty: 2,
                }),
            ),
    );
}

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
app.use("/api/logros", logrosRoutes);
app.use("/api/estadisticas", estadisticasRoutes);
app.use("/api/recomendaciones", recomendacionesRoutes);
app.use("/api/minijuegos", minijuegosRoutes);
app.use("/api/solicitudes", solicitudesRoutes);

app.use((_req, res) =>
    res.status(404).json({ success: false, message: "Ruta no encontrada" }),
);
app.use(errorHandler);

export default app;
