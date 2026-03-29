import sim
import time 
import requests

# global configuration variables
clientID=-1

# Helper function provided by the teaching staff
def get_data_from_simulation(id):
    """Connects to the simulation and gets a float signal value

    Parameters
    ----------
    id : str
        The signal id in CoppeliaSim

    Returns
    -------
    data : float
        The float value retrieved from the simulation. None if retrieval fails.
    """
    if clientID!=-1:
        res, data = sim.simxGetFloatSignal(clientID, id, sim.simx_opmode_blocking)
        if res==sim.simx_return_ok:
            return data
    return None

class DataCollection():
    def __init__(self):
        pass        

    def run(self):
        
        while True:
            data = {
                "x": None,
                "y": None,
                "z": None,
                "timestamp": time.time()
            }
            
            x = get_data_from_simulation("accelX")            
            if x is not None:
                data["x"] = x
            
            y = get_data_from_simulation("accelY")
            if y is not None:
                data["y"] = y

            z = get_data_from_simulation("accelZ")
            if z is not None:
                data["z"] = z
            
            print(data)

            # TODO Lab 1: Add the necessary code to send data to your API
            # Enviar dados para o servidor FastAPI (main.py)
            payload = {
                "accel_x": data["x"],
                "accel_y": data["y"],
                "accel_z": data["z"]
            }

            try:
                # Faz o envio para a tua API a correr localmente na porta 8000
                response = requests.post("http://localhost:8000/data", json=payload)
                
                if response.status_code == 200:
                    print("✅ Dados enviados para o Supabase com sucesso!")
                else:
                    print(f"⚠️ Erro no servidor: {response.status_code}")
            except Exception as e:
                print(f"❌ Erro de ligação: Certifica-te que o 'main.py' está a correr! ({e})")
            

            # --- ALTERAÇÃO NECESSÁRIA PARA O INTERVALO DINÂMICO ---
            try:
                # Pergunta ao main.py qual o intervalo atual do slider
                res = requests.get("http://localhost:8000/interval", timeout=1)
                wait_time = res.json().get("interval", 1.0)
                time.sleep(wait_time)
            except:
                # Fallback para 1 segundo se a API não responder
                time.sleep(1)

if __name__ == '__main__':
    sim.simxFinish(-1) # just in case, close all opened connections
    clientID=sim.simxStart('127.0.0.1',19997,True,True,5000,5) # Connect to CoppeliaSim
    if clientID!=-1:
        data_collection = DataCollection()
        data_collection.run()      
    else:
        exit()