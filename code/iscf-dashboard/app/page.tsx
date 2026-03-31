"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase"; 
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const [robotSpeed, setRobotSpeed] = useState<number>(1.0);
  const [data, setData] = useState<any[]>([]);
  const [intervalo, setIntervalo] = useState<number>(2);

  const alterarVelocidadeRobo = async (valor: number) => {
    setRobotSpeed(valor);
    try {
      await supabase.from("robot_config").update({ robot_speed: valor }).eq("id", 1);
    } catch (e) { console.error("Erro no Supabase", e); }
  };

  const atualizarIntervalo = async (novoValor: number) => {
    setIntervalo(novoValor);
    try {
      await supabase.from("robot_config").update({ intervalo_leitura: novoValor }).eq("id", 1);
    } catch (e) { console.error("Erro no Supabase", e); }
  };

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

  return (
    <main className="p-6 font-mono bg-[#0a0c10] text-[#e0e6f0] min-h-screen text-sm">
      <header className="flex justify-between items-end border-b border-[#1e2230] pb-4 mb-6">
        <div className="text-2xl font-bold font-sans tracking-tight">ISCF <span className="text-[#00e5ff]">//</span> Robot Monitor</div>
        <div className="flex items-center gap-3 text-[#4a5268] text-xs">
          <div className="w-2 h-2 rounded-full bg-[#69ff47] shadow-[0_0_8px_#69ff47] animate-pulse"></div>
          <span>Cloud Control Active</span>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[ 
          { label: "Accel X", key: "x", val: lastData?.accel_x, color: "text-[#00e5ff]", border: "border-l-[#00e5ff]" },
          { label: "Accel Y", key: "y", val: lastData?.accel_y, color: "text-[#ff4081]", border: "border-l-[#ff4081]" },
          { label: "Accel Z", key: "z", val: lastData?.accel_z, color: "text-[#69ff47]", border: "border-l-[#69ff47]" },
          { label: "Temp", key: "t", val: lastData?.temperature, color: "text-[#ffab40]", border: "border-l-[#ffab40]", unit: "°C" }
        ].map((m, i) => (
          <div key={i} className={`bg-[#111318] border border-[#1e2230] p-4 rounded-md border-l-4 ${m.border}`}>
            <div className="text-[10px] text-[#4a5268] uppercase tracking-widest">{m.label}</div>
            <div className={`text-3xl font-bold font-sans ${m.color}`}>{m.val != null ? Number(m.val).toFixed(4) : "—"}</div>
            <div className="flex justify-between items-end mt-2">
              <div className="text-[10px] text-[#4a5268]">{m.unit || "m/s²"}</div>
              {m.key !== "t" && <div className="text-[10px] text-[#00e5ff] italic">Pred: {getPrediction(m.key)}</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 mb-6">
        <div className="bg-[#111318] border border-[#1e2230] p-4 rounded-md flex items-center gap-6">
          <span className="text-[10px] text-[#4a5268] uppercase tracking-widest">Cadência (s)</span>
          <input type="range" min="0.5" max="5" step="0.5" value={intervalo} onChange={(e) => atualizarIntervalo(Number(e.target.value))} className="accent-[#00e5ff] w-48" />
          <span className="text-[#00e5ff] font-mono">{intervalo.toFixed(1)}s</span>
        </div>
        <div className="bg-[#111318] border border-[#ff4081]/30 p-4 rounded-md flex flex-col gap-3">
          <div className="text-[10px] text-[#ff4081] uppercase font-bold tracking-widest">Velocidade do Robô</div>
          <div className="flex items-center gap-4">
            <input type="range" min="0.1" max="2" step="0.1" value={robotSpeed} onChange={(e) => alterarVelocidadeRobo(Number(e.target.value))} className="accent-[#ff4081] flex-1 cursor-pointer" />
            <span className="text-[#ff4081] font-mono">{Math.round(robotSpeed * 100)}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 h-[200px]">
        {[{ id: "accel_x", color: "#00e5ff" }, { id: "accel_y", color: "#ff4081" }].map((g) => (
          <div key={g.id} className="bg-[#111318] border border-[#1e2230] p-4 rounded-md">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
                  <XAxis dataKey="created_at" hide />
                  <YAxis stroke="#4a5268" fontSize={10} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ backgroundColor: "#0a0c10", borderColor: "#1e2230" }} />
                  <Line type="linear" dataKey={g.id} stroke={g.color} dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
          </div>
        ))}
      </div>
    </main>
  );
}