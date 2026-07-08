import os
from datetime import datetime
from pathlib import Path

import pandas as pd

try:
    from google import genai
except ImportError:
    genai = None


DEFAULT_MODEL_NAME = "gemini-3-flash-preview"
DEFAULT_PROMPT_VERSION = "v2"
FALLBACK_MODEL_NAME = "heuristico-local"
DEFAULT_HISTORY_PATH = Path(__file__).resolve().parents[1] / "datasets" / "recomendaciones_ia" / "exports" / "recommendation_history.csv"


def _load_env_value(key):
    value = os.getenv(key)
    if value:
        return value

    project_env = Path(__file__).resolve().parents[1] / ".env"
    if not project_env.exists():
        return None

    for line in project_env.read_text(encoding="utf-8").splitlines():
        cleaned = line.strip()
        if not cleaned or cleaned.startswith("#") or "=" not in cleaned:
            continue

        env_key, env_value = cleaned.split("=", 1)
        if env_key.strip() == key:
            candidate = env_value.strip().strip('"').strip("'")
            return candidate or None

    return None


class AnalizadorLogicKids:
    def __init__(self, csv_path):
        self.df = pd.read_csv(csv_path)
        self.history_df = self._load_history_df()
        self.gemini_api_key = _load_env_value("GEMINI_API_KEY")
        self.model_name = _load_env_value("GEMINI_MODEL_NAME") or DEFAULT_MODEL_NAME
        self.prompt_version = _load_env_value("RECOMENDACIONES_PROMPT_VERSION") or DEFAULT_PROMPT_VERSION
        self.genai_client = self._build_genai_client()
        print(f"DEBUG MAIN: GEMINI_API_KEY loaded: {bool(self.gemini_api_key)}")

    def _load_history_df(self):
        history_path_value = _load_env_value("RECOMENDACIONES_HISTORY_CSV")
        history_path = Path(history_path_value) if history_path_value else DEFAULT_HISTORY_PATH

        try:
            if history_path.exists():
                return pd.read_csv(history_path)
        except Exception as exc:
            print(f"DEBUG: no fue posible cargar historial CSV: {exc}")

        return pd.DataFrame()

    def generar_recomendaciones(self):
        recomendaciones = []

        for estudiante in self.df["estudiante_id"].unique():
            datos_est = self.df[self.df["estudiante_id"] == estudiante].copy()
            idx_min = datos_est["precision_porcentaje"].idxmin()
            peor = datos_est.loc[idx_min]

            precision = float(peor["precision_porcentaje"])
            severidad, prioridad = self._resolver_severidad(precision)
            recomendacion, modelo_usado, es_simulada, ia_error = self._generar_texto_recomendacion(
                datos_est, peor, severidad
            )

            recomendaciones.append(
                {
                    "estudiante_id": int(peor["estudiante_id"]),
                    "nombre": peor["nombre_estudiante"],
                    "habilidad_critica": peor["habilidad"],
                    "precision_actual": precision,
                    "severidad": severidad,
                    "prioridad": prioridad,
                    "modelo_usado": modelo_usado,
                    "es_simulada": es_simulada,
                    "prompt_version": self.prompt_version,
                    "origen": "csv",
                    "ia_error": ia_error,
                    "recomendacion": recomendacion,
                    "fecha_generacion": datetime.now().isoformat(),
                }
            )

        return recomendaciones

    def _build_genai_client(self):
        if not self.gemini_api_key:
            return None

        if genai is None:
            return "missing_sdk"

        return genai.Client(api_key=self.gemini_api_key)

    def _resolver_severidad(self, precision):
        if precision < 50:
            return "alta", 3
        if precision < 70:
            return "media", 2
        return "baja", 1

    def _generar_texto_recomendacion(self, datos_est, peor, severidad):
        fallback = self._build_fallback_recommendation(peor, severidad)

        if not self.gemini_api_key:
            return fallback, FALLBACK_MODEL_NAME, True, "GEMINI_API_KEY no configurada"

        if self.genai_client == "missing_sdk":
            return fallback, FALLBACK_MODEL_NAME, True, "Falta instalar el SDK oficial google-genai"

        prompt = self._build_student_prompt(datos_est, peor, severidad)

        try:
            respuesta = self._call_gemini(prompt)
            if respuesta:
                return respuesta, self.model_name, False, None
        except Exception as exc:
            print(f"DEBUG: Gemini fallo para {peor.get('nombre_estudiante', 'N/D')}: {exc}")
            return fallback, FALLBACK_MODEL_NAME, True, str(exc)

        return fallback, FALLBACK_MODEL_NAME, True, "Gemini no devolvio contenido util"

    def _build_student_prompt(self, datos_est, peor, severidad):
        primera_fila = datos_est.iloc[0]
        edad = primera_fila.get("edad", "N/D")
        grupo = primera_fila.get("nombre_grupo", "N/D")
        nombre_estudiante = peor.get("nombre_estudiante", "N/D")
        habilidad_critica = peor.get("habilidad", "N/D")
        precision_critica = peor.get("precision_porcentaje", "N/D")
        tiempo_critico = peor.get("tiempo_reaccion_ms", "N/D")

        lineas = []
        for _, fila in datos_est.iterrows():
            lineas.append(
                (
                    f"- Habilidad: {fila.get('habilidad', 'N/D')}; "
                    f"precision: {fila.get('precision_porcentaje', 'N/D')}%; "
                    f"intentos: {fila.get('total_intentos', 'N/D')}; "
                    f"aciertos: {fila.get('aciertos', 'N/D')}; "
                    f"errores: {fila.get('errores', 'N/D')}; "
                    f"tiempo de reaccion: {fila.get('tiempo_reaccion_ms', 'N/D')} ms; "
                    f"nivel de logro: {fila.get('nivel_logro', 'N/D')}"
                )
            )

        fortalezas = []
        debilidades = []

        for _, fila in datos_est.iterrows():
            precision_fila = float(fila.get("precision_porcentaje", 0))
            habilidad = fila.get("habilidad", "N/D")

            if precision_fila >= 80:
                fortalezas.append(f"{habilidad} ({precision_fila:.2f}%)")
            elif precision_fila < 70:
                debilidades.append(f"{habilidad} ({precision_fila:.2f}%)")

        resumen_fortalezas = ", ".join(fortalezas[:3]) if fortalezas else "No se observan fortalezas claras en este corte."
        resumen_debilidades = ", ".join(debilidades[:3]) if debilidades else "No se observan debilidades adicionales relevantes."
        historial_contexto = self._build_history_context(peor.get("estudiante_id"))

        return (
            "Eres un pedagogo experto en educacion infantil para ninos de 7 a 12 anos. "
            "Analiza exclusivamente los datos del estudiante y redacta una recomendacion pedagogica util para un tutor. "
            "No inventes informacion, no hagas diagnosticos clinicos y no afirmes causas que no se puedan inferir de las metricas.\n\n"
            f"Estudiante: {nombre_estudiante}\n"
            f"Edad: {edad}\n"
            f"Grupo: {grupo}\n"
            f"Habilidad con mayor dificultad: {habilidad_critica}\n"
            f"Precision mas baja detectada: {precision_critica}%\n"
            f"Tiempo de reaccion en la habilidad critica: {tiempo_critico} ms\n"
            f"Severidad estimada: {severidad}\n"
            f"Fortalezas observadas: {resumen_fortalezas}\n"
            f"Debilidades adicionales: {resumen_debilidades}\n"
            f"Historial relevante: {historial_contexto}\n\n"
            "Metricas por habilidad:\n"
            f"{chr(10).join(lineas)}\n\n"
            "Instrucciones:\n"
            "1. Responde en espanol claro y profesional.\n"
            "2. Redacta 4 bloques cortos con estos encabezados exactos: Hallazgo principal:, Interpretacion:, Acciones sugeridas:, Seguimiento:.\n"
            "3. En Hallazgo principal explica que habilidad requiere mas apoyo y menciona la precision observada.\n"
            "4. En Interpretacion menciona si la velocidad de respuesta aporta contexto util, por ejemplo lentitud o impulsividad, sin inventar diagnosticos.\n"
            "5. En Acciones sugeridas propone exactamente 3 acciones concretas, breves y aplicables en aula.\n"
            "6. En Seguimiento indica una forma simple de revisar progreso en las proximas sesiones.\n"
            "7. Si el historial muestra recomendaciones previas, evita repetirlas literalmente y propone continuidad o ajuste.\n"
            "8. No repitas todas las metricas una por una; interpretalas pedagogicamente.\n"
            "9. No uses listas demasiado largas ni texto excesivo. Maximo 180 palabras en total."
        )

    def _build_history_context(self, estudiante_id):
        if self.history_df.empty or "estudiante_id" not in self.history_df.columns:
            return "Sin historial previo disponible."

        student_history = self.history_df[
            self.history_df["estudiante_id"].astype(str) == str(estudiante_id)
        ].copy()

        if student_history.empty:
            return "Sin historial previo disponible."

        if "generado_en" in student_history.columns:
            student_history["generado_en"] = pd.to_datetime(student_history["generado_en"], errors="coerce")
            student_history = student_history.sort_values("generado_en", ascending=False)

        top_rows = student_history.head(2)
        summaries = []

        for _, row in top_rows.iterrows():
            habilidad = row.get("habilidad", "N/D")
            severidad = row.get("severidad", "N/D")
            fecha = row.get("generado_en", "N/D")
            mensaje = str(row.get("mensaje_objetivo", "")).replace("\n", " ").strip()
            mensaje_breve = f"{mensaje[:140]}..." if len(mensaje) > 140 else mensaje
            summaries.append(
                f"[{fecha}] habilidad: {habilidad}; severidad: {severidad}; recomendacion previa: {mensaje_breve or 'Sin mensaje previo.'}"
            )

        return " ".join(summaries)

    def _call_gemini(self, prompt):
        response = self.genai_client.models.generate_content(
            model=self.model_name,
            contents=prompt,
        )
        return getattr(response, "text", None)

    def _build_fallback_recommendation(self, peor, severidad):
        habilidad = peor.get("habilidad", "la habilidad evaluada")
        precision = peor.get("precision_porcentaje", "N/D")

        return (
            f"Hallazgo principal: El estudiante presenta mayor dificultad en {habilidad} con una precision de {precision}%. "
            f"La severidad estimada es {severidad}. "
            f"Interpretacion: conviene reforzar esta habilidad observando tambien el ritmo de respuesta durante la actividad. "
            f"Acciones sugeridas: 1) aplicar ejercicios guiados y progresivos; 2) reforzar con apoyos visuales o ejemplos; 3) repetir practicas breves con acompanamiento del tutor. "
            "Seguimiento: revisar si mejora la precision en las proximas sesiones y contrastar con recomendaciones previas si existen."
        )
