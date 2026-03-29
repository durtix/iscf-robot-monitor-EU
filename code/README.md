# 🤖 ISCF Robot Monitor - UR5 Control Panel

Projeto de monitorização de um braço robótico UR5 via CoppeliaSim e Cloud Stack.

## Funcionalidades Extra 
- **Alarme Visual de Segurança**: O dashboard deteta acelerações perigosas (>1.5 m/s²) e emite um alerta visual (pisca a vermelho).
- **Controlo de Cadência Dinâmico**: Slider no site que altera o `time.sleep` do robô em tempo real via API.
- **Relatórios CSV**: Exportação automática de dados históricos para análise.
- **Contexto Ambiental**: Integração com a API OpenWeather para monitorizar a temperatura da fábrica (Lisboa).

## 🛠️ Tecnologias
- **Backend**: FastAPI (Python)
- **Frontend**: Next.js + Tailwind CSS + Recharts
- **Database**: Supabase (PostgreSQL + Realtime)
- **Simulador**: CoppeliaSim (Remote API)