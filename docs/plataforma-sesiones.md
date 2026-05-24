# Plataforma de Sesiones de Clase

## Qué teníamos

Antes la plataforma representaba la clase activa con dos flags dispersos:

- `estudiantes.sesion_activa`
- `grupos.sesion_minijuego_id`

Y la partida individual del niño vivía en:

- `sesiones_juego`

Ese modelo sirve para un solo minijuego activo por grupo, pero se queda corto cuando la actividad completa debe soportar:

- rutas con varios minijuegos
- progreso por paso
- cierre automático de la clase
- configuración adaptada por IA o reglas

## Qué cambió

La fuente de verdad ahora es una sesión padre explícita:

- `sesiones_clase`

Y se divide en dos piezas hijas:

- `sesion_clase_pasos`
- `sesion_clase_participantes`

Además se enriquecieron las partidas reales:

- `sesiones_juego.sesion_clase_id`
- `sesiones_juego.orden_en_ruta`
- `sesiones_juego.configuracion_aplicada`
- `sesiones_juego.fuente_adaptacion`
- `sesiones_juego.modelo_ia_id`

Y los eventos ahora permiten detalles específicos del juego:

- `eventos_sesion.metadata`

## Imagen mental

Piense en una clase como una carpeta principal:

- la carpeta es `sesiones_clase`
- cada actividad del recorrido es un archivo en `sesion_clase_pasos`
- cada niño inscrito en la clase queda en `sesion_clase_participantes`
- cada vez que un niño juega un minijuego concreto, se crea una fila en `sesiones_juego`

## Por qué no hay una tabla por juego

La plataforma base ya cubre lo común:

- qué clase está activa
- qué pasos tiene
- quién participa
- qué jugó cada estudiante
- con qué configuración exacta jugó
- qué eventos ocurrieron

Solo necesitaríamos una tabla específica por juego si ese juego tuviera estado persistente propio y complejo, por ejemplo:

- inventarios
- mapas editables
- objetos coleccionables permanentes
- reanudación exacta de mundos complejos

Mientras un juego pueda expresarse con:

- `configuracion_aplicada`
- `eventos_sesion.metadata`

no hace falta crear otra tabla.

## Qué gana el sistema

- una sesión `single` es un caso de una ruta con un solo paso
- una sesión `path` es una ruta con varios pasos
- el front puede seguir consumiendo `sesion_activa` y `sesion_minijuego_*` como contrato derivado
- la DB deja de depender de flags legacy como fuente de verdad
- la plataforma queda lista para 5 juegos consistentes y adaptación futura

## Qué afecta

### Backend

Impacto alto:

- apertura y cierre de clase
- inicio de partida
- finalización de partida
- perfil infantil
- reglas de seguridad por institución, grupo y tutor

### Frontend

Impacto bajo si el contrato HTTP visible se conserva:

- `sesion_activa`
- `sesion_minijuego_id`
- `sesion_minijuego_slug`
- `sesion_minijuego_titulo`

## Regla de diseño

El backend decide:

- cuál es la clase activa
- cuál es el paso actual del estudiante
- qué configuración exacta se aplicó

El cliente no debería reinventar ese estado.
