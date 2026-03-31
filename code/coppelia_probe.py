import sim
import time
import requests

clientID = -1

def get_data_from_simulation(signal_id):
    if clientID != -1:
        res, data = sim.simxGetFloatSignal(clientID, signal_id, sim.simx_opmode_blocking)
        if res == sim.simx_return_ok:
            return data
    return None


class DataCollection():
    def __init__(self):
        self._main_online = True      # controla mensagem de aviso do backend
        self._sim_online  = True      # controla mensagem de aviso da simulação

    def run(self):
        print(">>> Sonda iniciada. A ler CoppeliaSim e a enviar para http://localhost:8000 ...")
        print("=" * 60)

        while True:
            # --- Leitura dos sensores ---
            x = get_data_from_simulation("accelX")
            y = get_data_from_simulation("accelY")
            z = get_data_from_simulation("accelZ")

            sim_sem_dados = (x is None and y is None and z is None)

            if sim_sem_dados:
                # Avisa uma vez; depois só uma linha simples
                if self._sim_online:
                    print()
                    print("=" * 60)
                    print("⚠️   SIMULAÇÃO SEM DADOS!")
                    print("    O CoppeliaSim está ligado mas não há sinais de acelerómetro.")
                    print("    Verifica se a simulação está em modo Play (▶).")
                    print("    A enviar null para o Supabase até a simulação arrancar...")
                    print("=" * 60)
                    self._sim_online = False
                else:
                    print("⚠️  [Simulação] Ainda sem dados — a enviar null...")
            else:
                # Recuperou após estar sem dados — avisa uma vez
                if not self._sim_online:
                    print("✅ [Simulação] Dados recebidos! Simulação ativa.")
                    self._sim_online = True
                print(f"[Sensor] X={x:.4f}  Y={y:.4f}  Z={z:.4f}")

            payload = {"accel_x": x, "accel_y": y, "accel_z": z}
            wait_time = 2.0  # fallback

            # --- Envio para o backend local (main.py) ---
            try:
                response = requests.post("http://localhost:8000/data", json=payload, timeout=3)

                if response.status_code == 200:
                    resp_json  = response.json()
                    wait_time  = float(resp_json.get("interval", 2.0))

                    # Recuperou após estar offline — avisa uma vez
                    if not self._main_online:
                        print("✅ [Backend] main.py voltou a estar online!")
                        self._main_online = True

                    print(f"✅ Dados enviados ao Supabase. Próxima leitura em {wait_time}s")
                else:
                    print(f"⚠️  [Backend] Resposta inesperada: HTTP {response.status_code}")

            except requests.exceptions.ConnectionError:
                # main.py não está a correr
                if self._main_online:
                    print()
                    print("=" * 60)
                    print("❌  BACKEND NÃO ESTÁ LIGADO!")
                    print("    Abre um terminal e executa:  uvicorn main:app --reload")
                    print("    Os dados NÃO estão a ser gravados no Supabase.")
                    print("=" * 60)
                    self._main_online = False
                else:
                    print("❌  [Backend] main.py ainda offline... (a tentar de novo em 2s)")

            except Exception as e:
                print(f"❌  [Backend] Erro inesperado: {e}")

            time.sleep(wait_time)


if __name__ == '__main__':
    sim.simxFinish(-1)
    clientID = sim.simxStart('127.0.0.1', 19997, True, True, 5000, 5)

    if clientID != -1:
        print('>>> Conectado ao CoppeliaSim (porta 19997).')
        DataCollection().run()
    else:
        print('>>> ERRO: Não foi possível ligar ao CoppeliaSim.')
        print('    Verifica se o simulador está aberto e em modo Play.')
        exit()
