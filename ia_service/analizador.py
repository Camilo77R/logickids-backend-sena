import pandas as pd
from datetime import datetime

class AnalizadorLogicKids:
    def __init__(self, csv_path):
        self.df = pd.read_csv(csv_path)
    
    def generar_recomendaciones(self):
        recomendaciones = []
        
        for estudiante in self.df['estudiante_id'].unique():
            datos_est = self.df[self.df['estudiante_id'] == estudiante]
            idx_min = datos_est['precision_porcentaje'].idxmin()
            peor = datos_est.loc[idx_min]
            
            precision = float(peor['precision_porcentaje'])
            
            if precision < 50:
                severidad = "alta"
                prioridad = 3
            elif precision < 70:
                severidad = "media"
                prioridad = 2
            else:
                severidad = "baja"
                prioridad = 1
            
            recomendaciones.append({
                'estudiante_id': int(peor['estudiante_id']),
                'nombre': peor['nombre_estudiante'],
                'habilidad_critica': peor['habilidad'],
                'precision_actual': precision,
                'severidad': severidad,
                'prioridad': prioridad,
                'recomendacion': peor.get('recomendacion_manual', 'Practicar más'),
                'fecha_generacion': datetime.now().isoformat()
            })
        
        return recomendaciones