from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import requests
import time
import threading

# --- 1. IMPORTAR BIBLIOTECAS COPPELIA ---
try:
    import sim
    SIM_AVAILABLE = True
except:
    SIM_AVAILABLE = False
    print('--------------------------------------------------------------')
    print('"sim.py" não encontrado. Copia "sim.py", "simConst.py" e a DLL para esta pasta.')
    print('--------------------------------------------------------------')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. LIGAÇÃO AO COPPELIASIM ---
clientID = -1
if SIM_AVAILABLE:
    sim.simxFinish(-1)
    clientID = sim.simxStart('127.0.0.1', 19999, True, True, 5000, 5)
    if clientID != -1:
        print('>>> Conectado ao CoppeliaSim com sucesso! (porta 19999)')
    else:
        print('>>> AVISO: CoppeliaSim não respondeu. Velocidade do robô não será controlada.')

# --- CREDENCIAIS ---
SUPABASE_URL = "https://eglasirhoxnnfdsgcwog.supabase.co"
SUPABASE_KEY = "sb_publishable_9ay0iLkAoTEnCYRdsVm9tQ_Uv5YHvl1"
WEATHER_API_KEY = "1f4ca3e21ece9617fb1383bc72428cc7"

SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# Cache local — atualizada pela thread vigilante
_last_speed    = None
_last_interval = None  # coluna: intervalo_leitura

# ============================================================
# THREAD VIGILANTE
# Lê robot_config (id=1) a cada 1s.
# ATENÇÃO: coluna é "intervalo_leitura", não "interval"
# ============================================================
def watcher_thread():
    global _last_speed, _last_interval
    print(">>> [Vigilante] Thread iniciada — a monitorizar Supabase robot_config...")
    while True:
        try:
            resp = requests.get(
                f"{SUPABASE_URL}/rest/v1/robot_config?id=eq.1&select=robot_speed,intervalo_leitura",
                headers=SUPABASE_HEADERS,
                timeout=3
            )
            if resp.status_code == 200:
                rows = resp.json()
                if rows:
                    config       = rows[0]
                    new_speed    = config.get("robot_speed")
                    new_interval = config.get("intervalo_leitura")   # <-- nome correto

                    # Velocidade mudou → injeta no CoppeliaSim
                    if new_speed is not None and new_speed != _last_speed:
                        _last_speed = new_speed
                        if SIM_AVAILABLE and clientID != -1:
                            sim.simxSetFloatSignal(clientID, 'robot_speed', float(new_speed), sim.simx_opmode_oneshot)
                            print(f">>> [Vigilante] Velocidade → {new_speed}x  ✅ CoppeliaSim atualizado")
                        else:
                            print(f">>> [Vigilante] Velocidade={new_speed} mas CoppeliaSim não ligado.")

                    # Intervalo mudou → atualiza cache
                    if new_interval is not None and new_interval != _last_interval:
                        _last_interval = new_interval
                        print(f">>> [Vigilante] Intervalo → {new_interval}s")
            else:
                print(f">>> [Vigilante] Supabase erro {resp.status_code}: {resp.text[:120]}")

        except Exception as e:
            print(f">>> [Vigilante] Exceção: {e}")

        time.sleep(1)

# Arranca thread ao iniciar o servidor
threading.Thread(target=watcher_thread, daemon=True).start()

# ============================================================
# GET /interval — sonda consulta para saber quanto tempo dormir
# ============================================================
@app.get("/interval")
def get_interval():
    return {"interval": _last_interval if _last_interval is not None else 2.0}

# ============================================================
# POST /data — recebe dados do coppelia_probe, grava no Supabase
# ============================================================
@app.post("/data")
async def receive_data(sensor_data: dict):
    # Temperatura de Lisboa
    weather_url = f"https://api.openweathermap.org/data/2.5/weather?q=Lisbon&appid={WEATHER_API_KEY}&units=metric"
    try:
        current_temp = requests.get(weather_url, timeout=2).json().get("main", {}).get("temp", 0.0)
    except:
        current_temp = 0.0

    # Gravar em robot_data
    db_payload = {
        "accel_x":     sensor_data.get("accel_x"),
        "accel_y":     sensor_data.get("accel_y"),
        "accel_z":     sensor_data.get("accel_z"),
        "temperature": current_temp,
    }
    response = requests.post(
        f"{SUPABASE_URL}/rest/v1/robot_data",
        json=db_payload,
        headers={**SUPABASE_HEADERS, "Prefer": "return=minimal"},
    )

    return {
        "status":    "sucesso",
        "db_status": response.status_code,
        "interval":  _last_interval if _last_interval is not None else 2.0,
    }
