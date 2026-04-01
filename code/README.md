# Lab 1 — IoT Digital Twin Dashboard

**Vercel URL:** `https://<o-teu-projeto>.vercel.app`
> ⚠️ Substitui o URL acima pelo URL real do teu projeto no Vercel antes de entregar.

---

## Descrição Geral

Este projeto implementa um sistema IoT completo de monitorização e controlo de um robô simulado, dividido em três camadas:

1. **Edge (Local)** — `coppelia_probe.py` lê os sensores do CoppeliaSim e envia os dados para o backend local.
2. **Backend Local** — `main.py` (FastAPI) recebe os dados, consulta a temperatura em Lisboa via OpenWeather, grava no Supabase e controla o robô via uma thread vigilante.
3. **Cloud** — Dashboard Next.js publicado no Vercel, com gráficos em tempo real via Supabase Realtime e controlo dos sliders diretamente na base de dados.

---

## Arquitetura

```
CoppeliaSim (sinais accelX/Y/Z)
        ↓  porta 19997
coppelia_probe.py
        ↓  POST /data  (localhost:8000)
main.py (FastAPI)
        ↓  REST API
Supabase (robot_data + robot_config)
        ↑  UPDATE direto (sliders)
Dashboard Next.js (Vercel)
        ↑  Realtime subscription
```

---

## Estrutura de Ficheiros

```
Lab1/
├── coppelia_probe.py       # Sonda: lê CoppeliaSim, envia para o backend
├── main.py                 # Backend FastAPI: grava no Supabase, controla robô
├── nextjs-dashboard/       # Aplicação Next.js (sem .next/ e node_modules/)
│   ├── app/
│   │   ├── page.tsx        # Dashboard principal
│   │   └── lib/
│   │       └── supabase.ts # Cliente Supabase
│   ├── package.json
│   └── ...
├── report.pdf              # Relatório automático do laboratório
└── README.md               # Este ficheiro
```

---

## Pré-requisitos

### Backend local (`main.py`)
- Python 3.9+
- Bibliotecas CoppeliaSim: `sim.py`, `simConst.py` e a DLL/`.so`/`.dylib` na mesma pasta
- CoppeliaSim aberto na **porta 19999** (API remota)

```bash
pip install fastapi uvicorn requests
```

### Sonda (`coppelia_probe.py`)
- Python 3.9+
- CoppeliaSim aberto e em modo **Play (▶)**, com os sinais `accelX`, `accelY`, `accelZ` ativos
- CoppeliaSim na **porta 19997**

```bash
pip install requests
```

### Dashboard (Next.js)
- Node.js 18+

```bash
cd nextjs-dashboard
npm install
```

---

## Como Executar

### 1. Iniciar o CoppeliaSim
Abre o CoppeliaSim, carrega a cena do robô e prime **Play (▶)**.

### 2. Iniciar o backend local
Abre um terminal na pasta do projeto:

```bash
uvicorn main:app --reload
```

O servidor fica disponível em `http://localhost:8000`.
A thread vigilante inicia automaticamente e começa a monitorizar o Supabase a cada 1 segundo.

### 3. Iniciar a sonda
Abre um segundo terminal:

```bash
python coppelia_probe.py
```

A sonda liga-se ao CoppeliaSim (porta 19997), lê os acelerómetros e envia os dados para o backend de acordo com o intervalo definido no dashboard.

### 4. Aceder ao dashboard
Abre o browser no URL do Vercel (ver topo deste ficheiro) ou, em desenvolvimento local:

```bash
cd nextjs-dashboard
npm run dev
# Acede em http://localhost:3000
```

---

## Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| Telemetria em tempo real | Gráficos de Accel X/Y/Z e Temperatura atualizados via Supabase Realtime |
| Previsão T+1 | Regressão linear sobre as últimas 5 amostras para prever o próximo valor |
| Estatísticas | Média, Máximo e Mínimo das últimas 40 amostras por eixo |
| Slider de Cadência | Controla o intervalo de leitura da sonda (0.5s a 5s) via `robot_config.intervalo_leitura` |
| Slider de Velocidade | Controla a velocidade do robô no CoppeliaSim via `robot_config.robot_speed` |
| Temperatura ambiente | Temperatura de Lisboa obtida em tempo real da API OpenWeather |
| Histórico | Tabela com os últimos 40 registos do Supabase |

---

## Base de Dados (Supabase)

### Tabela `robot_data`
Armazena a telemetria do robô.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | int8 | Chave primária (auto) |
| created_at | timestamptz | Data/hora de inserção (auto) |
| accel_x | float8 | Aceleração eixo X (m/s²) |
| accel_y | float8 | Aceleração eixo Y (m/s²) |
| accel_z | float8 | Aceleração eixo Z (m/s²) |
| temperature | float8 | Temperatura em Lisboa (°C) |

### Tabela `robot_config`
Armazena a configuração de controlo. Deve ter **exatamente uma linha com id = 1**.

| Coluna | Tipo | Descrição |
|---|---|---|
| id | int8 | Chave primária (fixo: 1) |
| robot_speed | float8 | Fator de velocidade do robô (0.1 – 2.0) |
| intervalo_leitura | float8 | Intervalo de leitura da sonda em segundos |

**SQL de criação (caso necessário):**

```sql
CREATE TABLE robot_config (
  id int8 PRIMARY KEY,
  robot_speed float8 DEFAULT 1.0,
  intervalo_leitura float8 DEFAULT 2.0
);
INSERT INTO robot_config (id, robot_speed, intervalo_leitura) VALUES (1, 1.0, 2.0);
```

> RLS (Row Level Security) deve estar **desativado** nas duas tabelas, ou configurado para permitir operações anónimas de leitura e escrita.

---

## Variáveis e Credenciais

As credenciais estão definidas diretamente em `main.py`:

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_KEY` | Chave pública (publishable) do Supabase |
| `WEATHER_API_KEY` | Chave da API OpenWeatherMap |

---

## Mensagens de Estado (Terminais)

### `coppelia_probe.py`
| Mensagem | Significado |
|---|---|
| `✅ Dados enviados ao Supabase` | Tudo a funcionar normalmente |
| `❌ BACKEND NÃO ESTÁ LIGADO` | O `main.py` não está a correr |
| `⚠️ SIMULAÇÃO SEM DADOS` | CoppeliaSim ligado mas simulação não está em Play |

### `main.py`
| Mensagem | Significado |
|---|---|
| `>>> Conectado ao CoppeliaSim com sucesso!` | Ligação à porta 19999 OK |
| `>>> [Vigilante] Velocidade → Xx` | Slider de velocidade detetado e aplicado |
| `>>> [Vigilante] Intervalo → Xs` | Slider de cadência detetado |

---

## Notas de Entrega

- As pastas `.next/` e `node_modules/` estão **excluídas** do arquivo de entrega conforme indicado.
- Para reinstalar as dependências do Next.js após descompactar: `npm install` dentro da pasta `nextjs-dashboard/`.
