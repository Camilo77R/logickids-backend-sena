import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

const options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "LogicKids API",
      version: "2.0.0",
      description: "API del backend LogicKids (v2)",
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: "Local",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/routes/*.js", "./src/schemas/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);
