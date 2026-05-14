-- ======================================================
-- MIGRACIÓN: 20260509_create_solicitudes_reactivacion_table
-- DESCRIPCIÓN: Crea la tabla de solicitudes de reactivación
-- AUTOR: LogicKids Team
-- FECHA: 2026-05-09
-- ======================================================

-- 1. Crear tabla
CREATE TABLE IF NOT EXISTS solicitudes_reactivacion (
    id_solicitud SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    correo_contacto VARCHAR(255) NOT NULL,
    motivo TEXT NOT NULL,
    descripcion TEXT,
    estado_solicitud VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    respuesta_admin TEXT,
    leida_admin BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_solicitud TIMESTAMP NOT NULL DEFAULT NOW(),
    fecha_respuesta TIMESTAMP,
    
    CONSTRAINT chk_estado_solicitud CHECK (
        estado_solicitud IN ('pendiente', 'aprobado', 'rechazado')
    ),
    
    CONSTRAINT chk_respuesta_admin CHECK (
        (estado_solicitud = 'rechazado' AND respuesta_admin IS NOT NULL AND respuesta_admin != '') OR
        (estado_solicitud != 'rechazado')
    ),
    
    CONSTRAINT chk_fecha_respuesta CHECK (
        (estado_solicitud IN ('aprobado', 'rechazado') AND fecha_respuesta IS NOT NULL) OR
        (estado_solicitud = 'pendiente')
    ),
    
    CONSTRAINT fk_solicitudes_usuario 
        FOREIGN KEY (usuario_id) 
        REFERENCES usuarios(id_usuario) 
        ON DELETE CASCADE
);

-- 2. Crear índices
CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario ON solicitudes_reactivacion(usuario_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_reactivacion(estado_solicitud);
CREATE INDEX IF NOT EXISTS idx_solicitudes_leida ON solicitudes_reactivacion(leida_admin);
CREATE INDEX IF NOT EXISTS idx_solicitudes_fecha ON solicitudes_reactivacion(fecha_solicitud DESC);

-- 3. Comentarios de documentación
COMMENT ON TABLE solicitudes_reactivacion IS 'Solicitudes de reactivación de tutores suspendidos';
COMMENT ON COLUMN solicitudes_reactivacion.id_solicitud IS 'Identificador único de la solicitud';
COMMENT ON COLUMN solicitudes_reactivacion.usuario_id IS 'ID del tutor suspendido que solicita reactivación';
COMMENT ON COLUMN solicitudes_reactivacion.correo_contacto IS 'Correo donde el tutor recibirá la respuesta';
COMMENT ON COLUMN solicitudes_reactivacion.motivo IS 'Motivo de la solicitud (obligatorio)';
COMMENT ON COLUMN solicitudes_reactivacion.descripcion IS 'Descripción adicional (opcional)';
COMMENT ON COLUMN solicitudes_reactivacion.estado_solicitud IS 'Estado: pendiente, aprobado, rechazado';
COMMENT ON COLUMN solicitudes_reactivacion.respuesta_admin IS 'Motivo del rechazo (si aplica)';
COMMENT ON COLUMN solicitudes_reactivacion.leida_admin IS 'Indica si el admin ya vio la solicitud';
COMMENT ON COLUMN solicitudes_reactivacion.fecha_solicitud IS 'Fecha y hora en que se creó la solicitud';
COMMENT ON COLUMN solicitudes_reactivacion.fecha_respuesta IS 'Fecha y hora en que el admin respondió';

-- 4. Verificar migración
SELECT ' Migración completada: solicitudes_reactivacion' as status;