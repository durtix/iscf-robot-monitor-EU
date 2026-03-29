"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase"; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const [data, setData] = useState<any[]>([]);
  const [intervalo, setIntervalo] = useState(2);

  // --- CONFIGURAÇÕES ---
  const LIMITE_ALERTA = 1.5; // Valor em m/s² para ativar o alarme visual

  // --- FUNÇÃO: Atualizar intervalo no Backend (Lab 1.2/1.3) ---
  const atualizarIntervalo = async (novoValor: number) => {
    setIntervalo(novoValor);
    try {
      // Faz o PUT para o FastAPI para alterar a cadência de extração [cite: 61, 161]
      await fetch("http://localhost:8000/interval", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: novoValor }),
      });
      console.log("Intervalo atualizado no Python:", novoValor);
    } catch (error) {
      console.error("Erro ao comunicar com o servidor Python:", error);
    }
  };

  // --- FUNÇÃO: Carregar dados iniciais ---
  const fetchInitialData = async () => {
    const { data: robotData } = await supabase
      .from("robot_data")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(40);
    if (robotData) setData(robotData.reverse());
  };

  // --- REALTIME: Subscrever a mudanças no Supabase ---
  useEffect(() => {
    fetchInitialData();
    const channel = supabase
      .channel("realtime-robot")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "robot_data" }, 
      (payload) => {
        setData((prev) => [...prev.slice(-39), payload.new]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // --- ESTATÍSTICAS: Cálculos para o Relatório ---
  const calcStats = (axis: string) => {
    if (data.length === 0) return { avg: 0, max: 0, min: 0 };
    const vals = data.map(d => d[`accel_${axis}`]).filter(v => v != null);
    if (vals.length === 0) return { avg: 0, max: 0, min: 0 };
    return {
      avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4),
      max: Math.max(...vals).toFixed(4),
      min: Math.min(...vals).toFixed(4)
    };
  };

  const statsX = calcStats("x");
  const statsY = calcStats("y");
  const statsZ = calcStats("z");
  const lastData = data.length > 0 ? data[data.length - 1] : null;

  // Lógica de Alarme
  const temAlerta = (valor: number | undefined) => Math.abs(valor || 0) > LIMITE_ALERTA;

  // --- REPORT: Download CSV (Lab 1.3) ---
  const downloadReport = () => {
    if (data.length === 0) return alert("Sem dados para exportar.");
    const lines = ["timestamp,accel_x,accel_y,accel_z,temperature"];
    data.forEach(r => lines.push(`${r.created_at},${r.accel_x},${r.accel_y},${r.accel_z},${r.temperature}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_iscf_${new Date().getTime()}.csv`;
    a.click();
  };

  return (
    <main className="p-6 font-mono bg-[#0a0c10] text-[#e0e6f0] min-h-screen text-sm">
      <header className="flex justify-between items-end border-b border-[#1e2230] pb-4 mb-6">
        <div className="text-2xl font-bold font-sans tracking-tight">
          ISCF <span className="text-[#00e5ff]">//</span> Robot Monitor
        </div>
        <div className="flex items-center gap-3 text-[#4a5268] text-xs">
          <div className="w-2 h-2 rounded-full bg-[#69ff47] shadow-[0_0_8px_#69ff47] animate-pulse"></div>
          <span>Cloud Connected · Supabase</span>
        </div>
      </header>

      {/* Métricas com Alarme Visual (Extra) */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[ 
          { label: "Accel X", val: lastData?.accel_x, color: "text-[#00e5ff]", border: "border-l-[#00e5ff]" },
          { label: "Accel Y", val: lastData?.accel_y, color: "text-[#ff4081]", border: "border-l-[#ff4081]" },
          { label: "Accel Z", val: lastData?.accel_z, color: "text-[#69ff47]", border: "border-l-[#69ff47]" },
          { label: "Temp (OpenWeather)", val: lastData?.temperature, color: "text-[#ffab40]", border: "border-l-[#ffab40]", unit: "°C" }
        ].map((m, i) => {
          const alertaAtivo = m.label.includes("Accel") && temAlerta(m.val);
          return (
            <div key={i} className={`bg-[#111318] border border-[#1e2230] p-4 rounded-md border-l-4 transition-all duration-300 
              ${alertaAtivo ? 'border-l-red-500 bg-red-900/20 animate-pulse' : m.border}`}>
              <div className="flex justify-between items-center mb-2">
                <div className="text-[10px] text-[#4a5268] uppercase tracking-widest">{m.label}</div>
                {alertaAtivo && <span className="text-red-500 text-[8px] font-bold">⚠️ CRÍTICO</span>}
              </div>
              <div className={`text-3xl font-bold font-sans ${alertaAtivo ? 'text-red-500' : m.color}`}>
                {m.val != null ? Number(m.val).toFixed(4) : "—"}
              </div>
              <div className="text-[10px] text-[#4a5268] mt-1">{m.unit || "m/s²"}</div>
            </div>
          );
        })}
      </div>

      {/* Controlos (Lab 1.3) */}
      <div className="bg-[#111318] border border-[#1e2230] p-4 rounded-md mb-6 flex items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#4a5268] uppercase tracking-widest">Cadência (API)</span>
          <input 
            type="range" min="0.5" max="5" step="0.5" 
            value={intervalo} 
            onChange={(e) => atualizarIntervalo(Number(e.target.value))} 
            className="accent-[#00e5ff] w-48" 
          />
          <span className="text-[#00e5ff] font-mono">{intervalo.toFixed(1)}s</span>
        </div>
        <button onClick={downloadReport} className="border border-[#00e5ff] text-[#00e5ff] px-4 py-2 rounded text-xs uppercase hover:bg-[#00e5ff] hover:text-black transition">
          ⬇ Exportar CSV
        </button>
      </div>

      {/* Gráficos Individuais (Tipo Linear) */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[ 
          { id: "accel_x", label: "Acelerómetro X", color: "#00e5ff" },
          { id: "accel_y", label: "Acelerómetro Y", color: "#ff4081" },
          { id: "accel_z", label: "Acelerómetro Z", color: "#69ff47" },
          { id: "temperature", label: "Temperatura (Lisboa)", color: "#ffab40" }
        ].map((g) => (
          <div key={g.id} className="bg-[#111318] border border-[#1e2230] p-4 rounded-md">
            <div className="text-[10px] text-[#4a5268] uppercase tracking-widest mb-4">{g.label}</div>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
                  <XAxis dataKey="created_at" hide />
                  <YAxis stroke="#4a5268" fontSize={10} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: "#0a0c10", borderColor: "#1e2230" }} />
                  <Line type="linear" dataKey={g.id} stroke={g.color} dot={false} isAnimationActive={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Estatísticas e Tabela */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 bg-[#111318] border border-[#1e2230] p-4 rounded-md">
           <div className="text-[10px] text-[#4a5268] uppercase tracking-widest mb-4">Estatísticas (Realtime)</div>
           <div className="space-y-3">
             {[ { l: "X", s: statsX, c: "text-[#00e5ff]" }, { l: "Y", s: statsY, c: "text-[#ff4081]" }, { l: "Z", s: statsZ, c: "text-[#69ff47]" } ].map((ax) => (
               <div key={ax.l} className="bg-[#0a0c10] border border-[#1e2230] p-3 rounded">
                 <div className="text-[10px] text-[#4a5268] mb-1">EIXO {ax.l}</div>
                 <div className="flex justify-between text-[10px]"><span className="text-[#4a5268]">Média</span><span className={ax.c}>{ax.s.avg}</span></div>
                 <div className="flex justify-between text-[10px]"><span className="text-[#4a5268]">Máximo</span><span className={ax.c}>{ax.s.max}</span></div>
               </div>
             ))}
           </div>
        </div>
        <div className="col-span-2 bg-[#111318] border border-[#1e2230] p-4 rounded-md overflow-y-auto max-h-[350px]">
          <div className="text-[10px] text-[#4a5268] uppercase tracking-widest mb-4">Histórico Supabase</div>
          <table className="w-full text-left text-[10px]">
            <thead className="text-[#4a5268] border-b border-[#1e2230]">
              <tr><th className="pb-2">Tempo</th><th>X</th><th>Y</th><th>Z</th><th>Temp</th></tr>
            </thead>
            <tbody>
              {[...data].reverse().slice(0, 10).map((row, i) => (
                <tr key={i} className="border-b border-[#1e2230]/50 hover:bg-white/5">
                  <td className="py-2 text-[#4a5268]">{new Date(row.created_at).toLocaleTimeString()}</td>
                  <td className="text-[#00e5ff]">{Number(row.accel_x).toFixed(4)}</td>
                  <td className="text-[#ff4081]">{Number(row.accel_y).toFixed(4)}</td>
                  <td className="text-[#69ff47]">{Number(row.accel_z).toFixed(4)}</td>
                  <td className="text-[#ffab40]">{Number(row.temperature).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}