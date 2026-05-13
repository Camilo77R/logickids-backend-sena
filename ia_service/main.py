from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from datetime import datetime
from analizador import AnalizadorLogicKids

app = FastAPI(title="LogicKids IA Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/ia/recomendaciones")
async def generar_recomendaciones(file: UploadFile = File(...)):
    temp_path = f"temp_{datetime.now().timestamp()}.csv"
    try:
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        analizador = AnalizadorLogicKids(temp_path)
        recomendaciones = analizador.generar_recomendaciones()
        return {"success": True, "recomendaciones": recomendaciones, "total": len(recomendaciones)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.get("/api/ia/health")
async def health():
    return {"status": "ok", "service": "LogicKids IA"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)