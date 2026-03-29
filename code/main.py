from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI()

# --- CONFIGURAÇÃO DE CORS (Obrigatório para o Slider funcionar) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Credenciais Supabase
SUPABASE_URL = "https://eglasirhoxnnfdsgcwog.supabase.co"
SUPABASE_KEY = "sb_publishable_9ay0iLkAoTEnCYRdsVm9tQ_Uv5YHvl1" # Mantém a tua chave completa

# Credencial OpenWeather
WEATHER_API_KEY = "1f4ca3e21ece9617fb1383bc72428cc7"

# --- VARIÁVEL DO INTERVALO (Lab 1.3) ---
_interval = 2.0 

@app.get("/interval")
def get_interval():
    return {"interval": _interval}

@app.put("/interval")
async def set_interval(request: Request):
    global _interval
    body = await request.json()
    _interval = float(body.get("value", 2.0))
    print(f"DEBUG: Novo intervalo definido para {_interval}s")
    return {"status": "ok", "interval": _interval}

# --- ROTA DE DADOS ---
@app.post("/data")
async def receive_data(sensor_data: dict):
    # 1. Obter temperatura de Lisboa
    weather_url = f"https://api.openweathermap.org/data/2.5/weather?q=Lisbon&appid={WEATHER_API_KEY}&units=metric"
    try:
        temp_resp = requests.get(weather_url, timeout=5).json()
        current_temp = temp_resp.get("main", {}).get("temp", 0.0)
    except:
        current_temp = 0.0

    # 2. Preparar dados
    db_payload = {
        "accel_x": sensor_data.get("accel_x"),
        "accel_y": sensor_data.get("accel_y"),
        "accel_z": sensor_data.get("accel_z"),
        "temperature": current_temp
    }

    # 3. Inserir no Supabase
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/robot_data", 
        json=db_payload, 
        headers=headers
    )
    
    return {"status": "sucesso", "db_status": response.status_code, "interval": _interval}