import os
from datetime import datetime
from pathlib import Path

import pandas as pd

try:
    from google import genai
except ImportError:
    genai = None


DEFAULT_MODEL_NAME = "gemini-3-flash-preview"
DEFAULT_PROMPT_VERSION = "v1"
FALLBACK_MODEL_NAME = "heuristico-local"


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
        self.gemini_api_key = _load_env_value("GEMINI_API_KEY")
        self.model_name = _load_env_value("GEMINI_MODEL_NAME") or DEFAULT_MODEL_NAME
        self.prompt_version = _load_env_value("RECOMENDACIONES_PROMPT_VERSION") or DEFAULT_PROMPT_VERSION
        self.genai_client = self._build_genai_client()
        print(f"DEBUG MAIN: GEMINI_API_KEY loaded: {bool(self.gemini_api_key)}")

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

        base_manual = peor.get("recomendacion_manual", "Sin sugerencia manual")

        return (
            "Eres un pedagogo experto en educacion infantil para ninos de 7 a 12 anos. "
            "Analiza las metricas del estudiante y redacta una recomendacion breve, clara y accionable para el tutor.\n\n"
            f"Estudiante: {peor.get('nombre_estudiante', 'N/D')}\n"
            f"Edad: {edad}\n"
            f"Grupo: {grupo}\n"
            f"Habilidad con mayor dificultad: {peor.get('habilidad', 'N/D')}\n"
            f"Precision mas baja detectada: {peor.get('precision_porcentaje', 'N/D')}%\n"
            f"Severidad estimada: {severidad}\n"
            f"Referencia manual existente: {base_manual}\n\n"
            "Metricas por habilidad:\n"
            f"{chr(10).join(lineas)}\n\n"
            "Instrucciones:\n"
            "1. Explica que habilidad requiere mas apoyo.\n"
            "2. Propone 2 o 3 acciones concretas para el tutor.\n"
            "3. Menciona como interpretar la velocidad de respuesta si aporta contexto.\n"
            "4. Usa maximo 3 parrafos cortos en espanol.\n"
            "5. No inventes datos fuera de la tabla."
        )

    def _call_gemini(self, prompt):
        response = self.genai_client.models.generate_content(
            model=self.model_name,
            contents=prompt,
        )
        return getattr(response, "text", None)

    def _build_fallback_recommendation(self, peor, severidad):
        habilidad = peor.get("habilidad", "la habilidad evaluada")
        precision = peor.get("precision_porcentaje", "N/D")
        sugerencia_manual = peor.get("recomendacion_manual", "Practicar mas")

        return (
            f"[Recomendacion simulada] El estudiante presenta mayor dificultad en {habilidad} "
            f"con una precision de {precision}%. La severidad estimada es {severidad}. "
            f"Se recomienda aplicar actividades guiadas y progresivas sobre esta habilidad, "
            f"observar el tiempo de respuesta y reforzar con seguimiento del tutor. "
            f"Sugerencia base: {sugerencia_manual}."
        )
