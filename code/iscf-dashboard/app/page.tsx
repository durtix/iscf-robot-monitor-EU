"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase"; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";


export default function Dashboard() {
  const [robotSpeed, setRobotSpeed] = useState<number>(1.0);
  const [data, setData] = useState<any[]>([]);
  const [intervalo, setIntervalo] = useState<number>(2);
  const linkNgrok = "https://bulah-unmossed-omnisciently.ngrok-free.dev";
  const localhost = "http://localhost:8000/robot-speed";

  // --- FUNÇÃO: Cálculo de Previsão (Regressão Linear) ---
  const getPrediction = (axis: string) => {
    if (!data || data.length < 5) return null;
    const points = data.slice(-5);
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    points.forEach((p, i) => {
      const val = (p as any)[`accel_${axis}`] || 0;
      sumX += i; sumY += val; sumXY += i * val; sumXX += i * i;
    });

    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    return (slope * n + intercept).toFixed(4);
  };
  const alterarVelocidadeRobo = async (valor: number) => {
  setRobotSpeed(valor);
  try {
    await fetch(`${linkNgrok}/robot-speed`, {//${localhost}-------------------------------------------------------------------
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: valor }),
    });
  } catch (e) {
    console.log("Erro ao comunicar com o Backend Local");
  }
};

  // --- FUNÇÃO: Estatísticas ---
  const calcStats = (axis: string) => {
    if (data.length === 0) return { avg: "0.0000", max: "0.0000", min: "0.0000" };
    const vals = data.map(d => (d as any)[`accel_${axis}`]).filter(v => v != null);
    if (vals.length === 0) return { avg: "0.0000", max: "0.0000", min: "0.0000" };
    return {
      avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4),
      max: Math.max(...vals).toFixed(4),
      min: Math.min(...vals).toFixed(4)
    };
  };

  const atualizarIntervalo = async (novoValor: number) => {
    setIntervalo(novoValor);
    try {
      await fetch(`${linkNgrok}/interval`, { //${localhost} ---------------------------------------------------------------------------------
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: novoValor }),
      });
    } catch (e) { console.log("API Local Offline"); }
  };

  const fetchInitialData = async () => {
    const { data: robotData } = await supabase
      .from("robot_data").select("*").order("created_at", { ascending: false }).limit(40);
    if (robotData) setData(robotData.reverse());
  };

  useEffect(() => {
    fetchInitialData();
    const channel = supabase.channel("realtime-robot")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "robot_data" }, 
      (payload) => { setData((prev) => [...prev.slice(-39), payload.new]); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const statsX = calcStats("x");
  const statsY = calcStats("y");
  const statsZ = calcStats("z");
  const lastData = data.length > 0 ? data[data.length - 1] : null;

  return (
    <main className="p-6 font-mono bg-[#0a0c10] text-[#e0e6f0] min-h-screen text-sm">
      <header className="flex justify-between items-end border-b border-[#1e2230] pb-4 mb-6">
        <div className="text-2xl font-bold font-sans tracking-tight">
          ISCF <span className="text-[#00e5ff]">//</span> Robot Monitor
        </div>
        <div className="flex items-center gap-3 text-[#4a5268] text-xs">
          <div className="w-2 h-2 rounded-full bg-[#69ff47] shadow-[0_0_8px_#69ff47] animate-pulse"></div>
          <span>Cloud Connected · Forecasting Active</span>
        </div>
      </header>

      {/* Cartões de Métricas */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[ 
          { label: "Accel X", key: "x", val: lastData?.accel_x, color: "text-[#00e5ff]", border: "border-l-[#00e5ff]" },
          { label: "Accel Y", key: "y", val: lastData?.accel_y, color: "text-[#ff4081]", border: "border-l-[#ff4081]" },
          { label: "Accel Z", key: "z", val: lastData?.accel_z, color: "text-[#69ff47]", border: "border-l-[#69ff47]" },
          { label: "Temp (Lisboa)", key: "t", val: lastData?.temperature, color: "text-[#ffab40]", border: "border-l-[#ffab40]", unit: "°C" }
        ].map((m, i) => {
          const pred = m.key !== "t" ? getPrediction(m.key) : null;
          return (
            <div key={i} className={`bg-[#111318] border border-[#1e2230] p-4 rounded-md border-l-4 ${m.border}`}>
              <div className="flex justify-between items-center mb-2">
                <div className="text-[10px] text-[#4a5268] uppercase tracking-widest">{m.label}</div>
                {pred && <span className="text-[#00e5ff] text-[8px] font-bold">PREVISÃO T+1</span>}
              </div>
              <div className={`text-3xl font-bold font-sans ${m.color}`}>
                {m.val != null ? Number(m.val).toFixed(4) : "—"}
              </div>
              <div className="flex justify-between items-end mt-2">
                <div className="text-[10px] text-[#4a5268]">{m.unit || "m/s²"}</div>
                {pred && <div className="text-[10px] text-[#00e5ff] italic">Seguinte: {pred}</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#111318] border border-[#1e2230] p-4 rounded-md mb-6 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#4a5268] uppercase tracking-widest">Cadência</span>
          <input type="range" min="0.5" max="5" step="0.5" value={intervalo} onChange={(e) => atualizarIntervalo(Number(e.target.value))} className="accent-[#00e5ff] w-48" />
          <span className="text-[#00e5ff] font-mono">{intervalo.toFixed(1)}s</span>
        </div>
      </div>

      {/* Segundo Slider: Controlo de Velocidade do Robô (EXTRA 20) */}
      <div className="bg-[#111318] border border-[#ff4081]/30 p-4 rounded-md flex flex-col gap-3">
        <div className="text-[10px] text-[#ff4081] uppercase font-bold tracking-widest">
          Velocidade do Robô (Digital Twin)
        </div>
        <div className="flex items-center gap-4">
          <input 
            type="range" 
            min="0.1" 
            max="2" 
            step="0.1" 
            value={robotSpeed} 
            onChange={(e) => alterarVelocidadeRobo(Number(e.target.value))} 
            className="accent-[#ff4081] flex-1 cursor-pointer" 
          />
          <span className="text-[#ff4081] font-mono min-w-[45px] text-right">
            {Math.round(robotSpeed * 100)}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {[ { id: "accel_x", label: "Acelerómetro X", color: "#00e5ff" }, { id: "accel_y", label: "Acelerómetro Y", color: "#ff4081" }, { id: "accel_z", label: "Acelerómetro Z", color: "#69ff47" }, { id: "temperature", label: "Temperatura", color: "#ffab40" } ].map((g) => (
          <div key={g.id} className="bg-[#111318] border border-[#1e2230] p-4 rounded-md">
            <div className="text-[10px] text-[#4a5268] uppercase tracking-widest mb-4">{g.label}</div>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
                  <XAxis dataKey="created_at" hide />
                  <YAxis stroke="#4a5268" fontSize={10} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: "#0a0c10", borderColor: "#1e2230" }} />
                  <Line type="linear" dataKey={g.id} stroke={g.color} dot={true} isAnimationActive={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* --- SECÇÃO REPOSTA: Estatísticas e Tabela de Histórico --- */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 bg-[#111318] border border-[#1e2230] p-4 rounded-md">
           <div className="text-[10px] text-[#4a5268] uppercase tracking-widest mb-4">Estatísticas (40 Amostras)</div>
           <div className="space-y-3">
             {[ { l: "X", s: statsX, c: "text-[#00e5ff]" }, { l: "Y", s: statsY, c: "text-[#ff4081]" }, { l: "Z", s: statsZ, c: "text-[#69ff47]" } ].map((ax) => (
               <div key={ax.l} className="bg-[#0a0c10] border border-[#1e2230] p-3 rounded">
                 <div className="text-[10px] text-[#4a5268] mb-1">EIXO {ax.l}</div>
                 <div className="flex justify-between text-[10px]"><span className="text-[#4a5268]">Média</span><span className={ax.c}>{ax.s.avg}</span></div>
                 <div className="flex justify-between text-[10px]"><span className="text-[#4a5268]">Máximo</span><span className={ax.c}>{ax.s.max}</span></div>
                 <div className="flex justify-between text-[10px]"><span className="text-[#4a5268]">Mínimo</span><span className={ax.c}>{ax.s.min}</span></div>
               </div>
             ))}
           </div>
        </div>
        <div className="col-span-2 bg-[#111318] border border-[#1e2230] p-4 rounded-md overflow-y-auto max-h-[400px]">
          <div className="text-[10px] text-[#4a5268] uppercase tracking-widest mb-4">Últimos Registos (Supabase)</div>
          <table className="w-full text-left text-[10px]">
            <thead className="text-[#4a5268] border-b border-[#1e2230]">
              <tr><th className="pb-2">Tempo</th><th>X</th><th>Y</th><th>Z</th><th>Temp</th></tr>
            </thead>
            <tbody>
              {[...data].reverse().map((row, i) => (
                <tr key={i} className="border-b border-[#1e2230]/50 hover:bg-white/5">
                  <td className="py-2 text-[#4a5268]">{new Date(row.created_at).toLocaleTimeString()}</td>
                  <td className="text-[#00e5ff]">{Number(row.accel_x).toFixed(4)}</td>
                  <td className="text-[#ff4081]">{Number(row.accel_y).toFixed(4)}</td>
                  <td className="text-[#69ff47]">{Number(row.accel_z).toFixed(4)}</td>
                  <td className="text-[#ffab40]">{Number(row.temperature).toFixed(1)}°C</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}