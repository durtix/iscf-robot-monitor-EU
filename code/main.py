from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import requests
import time

# --- 1. IMPORTAR BIBLIOTECAS COPPELIA (Certifica-te que os ficheiros estão na pasta) ---
try:
    import sim
except:
    print('--------------------------------------------------------------')
    print('"sim.py" não encontrado. Copia "sim.py", "simConst.py" e a DLL/so/dylib para esta pasta.')
    print('--------------------------------------------------------------')

app = FastAPI()

# --- CONFIGURAÇÃO DE CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. LIGAÇÃO AO COPPELIASIM (Executado ao iniciar o Python) ---
sim.simxFinish(-1) # Fechar conexões anteriores
clientID = sim.simxStart('127.0.0.1', 19999, True, True, 5000, 5)

if clientID != -1:
    print('>>> Conectado ao CoppeliaSim com sucesso!')
else:
    print('>>> Erro: Não foi possível conectar ao CoppeliaSim. Verifica se o simulador está aberto.')

# Credenciais Supabase e OpenWeather
SUPABASE_URL = "https://eglasirhoxnnfdsgcwog.supabase.co"
SUPABASE_KEY = "sb_publishable_9ay0iLkAoTEnCYRdsVm9tQ_Uv5YHvl1"
WEATHER_API_KEY = "1f4ca3e21ece9617fb1383bc72428cc7"

_interval = 2.0 

@app.get("/interval")
def get_interval():
    return {"interval": _interval}

@app.put("/interval")
async def set_interval(request: Request):
    global _interval
    body = await request.json()
    new_val = body.get("value") or body.get("interval")
    if new_val is not None:
        _interval = float(new_val)
        print(f"NOVO INTERVALO: {_interval}s")
    return {"status": "ok", "interval": _interval}

# --- 3. ROTA DE VELOCIDADE (Digital Twin Control) ---
@app.put("/robot-speed")
async def change_robot_speed(request: dict):
    speed_factor = request.get("value", 1.0)
    try:
        # Envia o sinal para o CoppeliaSim
        if clientID != -1:
            sim.simxSetFloatSignal(clientID, 'robot_speed', float(speed_factor), sim.simx_opmode_oneshot)
            print(f">>> Comando Digital Twin: Velocidade ajustada para {speed_factor}x")
            return {"status": "success", "speed": speed_factor}
        else:
            return {"status": "error", "message": "CoppeliaSim não conectado"}
    except Exception as e:
        print(f"Erro ao comunicar com o CoppeliaSim: {e}")
        return {"status": "error", "message": str(e)}

# --- ROTA DE RECEÇÃO DE DADOS ---
@app.post("/data")
async def receive_data(sensor_data: dict):
    # 1. Obter temperatura de Lisboa
    weather_url = f"https://api.openweathermap.org/data/2.5/weather?q=Lisbon&appid={WEATHER_API_KEY}&units=metric"
    try:
        temp_resp = requests.get(weather_url, timeout=2).json()
        current_temp = temp_resp.get("main", {}).get("temp", 0.0)
    except:
        current_temp = 0.0

    # 2. Preparar dados para o Supabase
    db_payload = {
        "accel_x": sensor_data.get("accel_x"),
        "accel_y": sensor_data.get("accel_y"),
        "accel_z": sensor_data.get("accel_z"),
        "temperature": current_temp
    }

    # 3. Enviar para Supabase
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    response = requests.post(f"{SUPABASE_URL}/rest/v1/robot_data", json=db_payload, headers=headers)
    
    # Retorna o intervalo atual para o script de recolha saber quando deve ler o próximo dado
    return {"status": "sucesso", "db_status": response.status_code, "interval": _interval}