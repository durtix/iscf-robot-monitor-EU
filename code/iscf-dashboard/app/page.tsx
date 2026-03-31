"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase"; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const [robotSpeed, setRobotSpeed] = useState<number>(1.0);
  const [data, setData] = useState<any[]>([]);
  const [intervalo, setIntervalo] = useState<number>(2);

  // --- FUNÇÕES DE CONTROLO ---
  const alterarVelocidadeRobo = async (valor: number) => {
    setRobotSpeed(valor);
    await supabase.from("robot_config").update({ robot_speed: valor }).eq("id", 1);
  };

  const atualizarIntervalo = async (novoValor: number) => {
    setIntervalo(novoValor);
    await supabase.from("robot_config").update({ intervalo_leitura: novoValor }).eq("id", 1);
  };

  // --- LÓGICA DE ESTATÍSTICAS E PREVISÃO ---
  const getPrediction = (axis: string) => {
    if (!data || data.length < 5) return null;
    const points = data.slice(-5);
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    points.forEach((p, i) => {
      const val = (p as any)[`accel_${axis}`] || 0;
      sumX += i; sumY += val; sumXY += i * val; sumXX += i * i;
    });
    const denom = (n * sumXX - sumX * sumX);
    if (denom === 0) return null;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return (slope * n + intercept).toFixed(4);
  };

  const calcStats = (axis: string) => {
    const vals = data.map(d => (d as any)[`accel_${axis}`]).filter(v => v != null);
    if (vals.length === 0) return { avg: "0.0000", max: "0.0000", min: "0.0000" };
    return {
      avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(4),
      max: Math.max(...vals).toFixed(4),
      min: Math.min(...vals).toFixed(4)
    };
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: res } = await supabase.from("robot_data").select("*").order("created_at", { ascending: false }).limit(40);
      if (res) setData(res.reverse());
    };
    fetchInitialData();

    const channel = supabase.channel("realtime-robot")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "robot_data" }, 
      (payload) => { setData((prev) => [...prev.slice(-39), payload.new]); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const lastData = data.length > 0 ? data[data.length - 1] : null;
  const statsX = calcStats("x");
  const statsY = calcStats("y");

  return (
    <main className="p-6 font-mono bg-[#0a0c10] text-[#e0e6f0] min-h-screen text-sm">
      {/* Header */}
      <header className="flex justify-between items-end border-b border-[#1e2230] pb-4 mb-6">
        <div className="text-2xl font-bold font-sans tracking-tight">
          ISCF <span className="text-[#00e5ff]">//</span> Robot Monitor
        </div>
        <div className="flex items-center gap-3 text-[#4a5268] text-xs">
          <div className="w-2 h-2 rounded-full bg-[#69ff47] shadow-[0_0_8px_#69ff47] animate-pulse"></div>
          <span>Cloud Control Active</span>
        </div>
      </header>

      {/* Cartões Principais */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[ 
          { label: "Accel X", key: "x", val: lastData?.accel_x, color: "text-[#00e5ff]", border: "border-l-[#00e5ff]", stats: statsX },
          { label: "Accel Y", key: "y", val: lastData?.accel_y, color: "text-[#ff4081]", border: "border-l-[#ff4081]", stats: statsY },
          { label: "Accel Z", key: "z", val: lastData?.accel_z, color: "text-[#69ff47]", border: "border-l-[#69ff47]" },
          { label: "Temp", key: "t", val: lastData?.temperature, color: "text-[#ffab40]", border: "border-l-[#ffab40]", unit: "°C" }
        ].map((m, i) => (
          <div key={i} className={`bg-[#111318] border border-[#1e2230] p-4 rounded-md border-l-4 ${m.border}`}>
            <div className="text-[10px] text-[#4a5268] uppercase mb-1">{m.label}</div>
            <div className={`text-3xl font-bold font-sans ${m.color}`}>
              {m.val != null ? Number(m.val).toFixed(4) : "—"}
            </div>
            {m.stats && (
              <div className="mt-2 grid grid-cols-3 gap-1 text-[8px] text-[#4a5268] border-t border-[#1e2230] pt-2">
                <div>AVG: {m.stats.avg}</div>
                <div>MAX: {m.stats.max}</div>
                <div>MIN: {m.stats.min}</div>
              </div>
            )}
            <div className="flex justify-between items-end mt-2">
              <div className="text-[10px] text-[#4a5268]">{m.unit || "m/s²"}</div>
              {m.key !== "t" && <div className="text-[10px] text-[#00e5ff] italic">Pred: {getPrediction(m.key)}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111318] border border-[#1e2230] p-4 rounded-md">
          <div className="text-[10px] text-[#4a5268] uppercase mb-4 text-center">Cadência de Leitura: {intervalo}s</div>
          <input type="range" min="0.5" max="5" step="0.5" value={intervalo} onChange={(e) => atualizarIntervalo(Number(e.target.value))} className="accent-[#00e5ff] w-full" />
        </div>
        <div className="bg-[#111318] border border-[#ff4081]/30 p-4 rounded-md">
          <div className="text-[10px] text-[#ff4081] uppercase font-bold mb-4 text-center">Velocidade Digital Twin: {Math.round(robotSpeed * 100)}%</div>
          <input type="range" min="0.1" max="2" step="0.1" value={robotSpeed} onChange={(e) => alterarVelocidadeRobo(Number(e.target.value))} className="accent-[#ff4081] w-full" />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-4 h-[300px]">
        {["accel_x", "accel_y"].map(id => (
          <div key={id} className="bg-[#111318] border border-[#1e2230] p-4 rounded-md">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
                <XAxis dataKey="created_at" hide />
                <YAxis stroke="#4a5268" fontSize={10} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: "#0a0c10", border: "none" }} />
                <Line type="monotone" dataKey={id} stroke={id === "accel_x" ? "#00e5ff" : "#ff4081"} dot={false} strokeWidth={2} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </main>
  );
}