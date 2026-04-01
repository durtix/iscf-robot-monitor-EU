"use client";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

// =====================================================================
// PDF gerado no browser com jsPDF (sem backend).
// Instala: npm install jspdf
// =====================================================================

type Row = {
  id?: number;
  created_at: string;
  accel_x: number | null;
  accel_y: number | null;
  accel_z: number | null;
  temperature: number | null;
};

// ---------- helpers de estatísticas ----------
function stats(vals: number[]) {
  if (vals.length === 0) return { avg: 0, max: 0, min: 0, std: 0, count: 0 };
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const std = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length);
  return { avg, max, min, std, count: vals.length };
}

function fmt(n: number) { return n.toFixed(4); }

// ---------- gerador de PDF ----------
async function generateReport(rows: Row[], minutes: number) {
  // importação dinâmica para não quebrar SSR
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });////////////

  const W = 210;
  const MARGIN = 18;
  const COL = W - MARGIN * 2;
  let y = 0;

  const accent  = [0, 229, 255] as [number, number, number];   // #00e5ff
  const dark    = [10, 12, 16]  as [number, number, number];   // #0a0c10
  const mid     = [17, 19, 24]  as [number, number, number];   // #111318
  const light   = [224, 230, 240] as [number, number, number]; // #e0e6f0
  const muted   = [74, 82, 104]  as [number, number, number];  // #4a5268
  const green   = [105, 255, 71] as [number, number, number];
  const pink    = [255, 64, 129] as [number, number, number];
  const orange  = [255, 171, 64] as [number, number, number];

  // ── fundo da página ──
  doc.setFillColor(...dark);
  doc.rect(0, 0, W, 297, "F");

  // ── cabeçalho ──
  doc.setFillColor(...mid);
  doc.rect(0, 0, W, 32, "F");
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.6);
  doc.line(0, 32, W, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...light);
  doc.text("ISCF // Robot Monitor", MARGIN, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("Automatic Telemetry Report", MARGIN, 20);
  doc.text(`Generated: ${new Date().toLocaleString("pt-PT")}`, MARGIN, 26);

  // badge do intervalo
  doc.setFillColor(...accent);
  doc.roundedRect(W - MARGIN - 40, 8, 40, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...dark);
  doc.text(`Last ${minutes} min`, W - MARGIN - 20, 16, { align: "center" });

  y = 42;

  // ── resumo de amostras ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...muted);

  const fromDate = new Date(Date.now() - minutes * 60 * 1000);
  doc.text(
    `Period: ${fromDate.toLocaleString("pt-PT")} → ${new Date().toLocaleString("pt-PT")}   |   Samples: ${rows.length}`,
    MARGIN, y
  );
  y += 10;

  // ── função para bloco de eixo ──
  const axisBlock = (
    label: string,
    key: keyof Row,
    color: [number, number, number],
    unit: string
  ) => {
    const vals = rows.map(r => r[key] as number).filter(v => v != null);
    const s = stats(vals);

    // fundo do bloco
    doc.setFillColor(...mid);
    doc.roundedRect(MARGIN, y, COL, 28, 2, 2, "F");

    // barra lateral colorida
    doc.setFillColor(...color);
    doc.rect(MARGIN, y, 2.5, 28, "F");

    // título
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...color);
    doc.text(label, MARGIN + 7, y + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...muted);
    doc.text(`unit: ${unit}   |   n = ${s.count}`, MARGIN + 7, y + 13);

    // métricas
    const metrics = [
      { lbl: "Average", val: fmt(s.avg) },
      { lbl: "Maximum", val: fmt(s.max) },
      { lbl: "Minimum", val: fmt(s.min) },
      { lbl: "Std Dev",  val: fmt(s.std) },
    ];
    const cellW = COL / 4;
    metrics.forEach((m, i) => {
      const cx = MARGIN + 3 + i * cellW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...muted);
      doc.text(m.lbl.toUpperCase(), cx + cellW / 2, y + 19, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...light);
      doc.text(m.val, cx + cellW / 2, y + 25, { align: "center" });
    });

    y += 33;
  };

  // ── secção: Acelerómetro ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("ACCELEROMETER STATISTICS", MARGIN, y);
  doc.setDrawColor(...muted);
  doc.setLineWidth(0.2);
  doc.line(MARGIN + 60, y - 1, MARGIN + COL, y - 1);
  y += 5;

  axisBlock("Accel X",     "accel_x",    accent, "m/s²");
  axisBlock("Accel Y",     "accel_y",    pink,   "m/s²");
  axisBlock("Accel Z",     "accel_z",    green,  "m/s²");

  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("AMBIENT CONDITIONS", MARGIN, y);
  doc.line(MARGIN + 56, y - 1, MARGIN + COL, y - 1);
  y += 5;

  axisBlock("Temperature (Lisboa)", "temperature", orange, "°C");

  // ── tabela de amostras (últimas 15) ──
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text("SAMPLE LOG  (last 15 records)", MARGIN, y);
  doc.line(MARGIN + 72, y - 1, MARGIN + COL, y - 1);
  y += 5;

  // cabeçalho da tabela
  const cols = ["Timestamp", "Accel X", "Accel Y", "Accel Z", "Temp (°C)"];
  const colW = [52, 28, 28, 28, 28];
  const rowH = 7;

  doc.setFillColor(...mid);
  doc.rect(MARGIN, y, COL, rowH, "F");
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y + rowH, MARGIN + COL, y + rowH);

  let cx = MARGIN + 2;
  cols.forEach((c, i) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(...accent);
    doc.text(c, cx, y + 4.5);
    cx += colW[i];
  });
  y += rowH;

  // linhas
  const sample = [...rows].reverse().slice(0, 15);
  sample.forEach((row, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(17, 19, 28);
      doc.rect(MARGIN, y, COL, rowH, "F");
    }
    const cells = [
      new Date(row.created_at).toLocaleTimeString("pt-PT"),
      row.accel_x != null ? fmt(row.accel_x) : "—",
      row.accel_y != null ? fmt(row.accel_y) : "—",
      row.accel_z != null ? fmt(row.accel_z) : "—",
      row.temperature != null ? Number(row.temperature).toFixed(1) : "—",
    ];
    cx = MARGIN + 2;
    cells.forEach((cell, i) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...light);
      doc.text(cell, cx, y + 4.5);
      cx += colW[i];
    });
    y += rowH;
  });

  // ── rodapé ──
  const footerY = 287;
  doc.setDrawColor(...muted);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, footerY - 3, W - MARGIN, footerY - 3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...muted);
  doc.text("ISCF // Robot Monitor — Automatic Report", MARGIN, footerY);
  doc.text("Page 1", W - MARGIN, footerY, { align: "right" });

  // ── download ──
  const filename = `robot_report_${minutes}min_${new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "h")}.pdf`;
  doc.save(filename);
}

// =====================================================================
// DASHBOARD
// =====================================================================
export default function Dashboard() {
  const [robotSpeed, setRobotSpeed]       = useState<number>(1.0);
  const [intervalo, setIntervalo]         = useState<number>(2.0);
  const [data, setData]                   = useState<Row[]>([]);
  const [configLoaded, setConfigLoaded]   = useState(false);
  const [reportMinutes, setReportMinutes] = useState<number>(30);
  const [generating, setGenerating]       = useState(false);

  // --- Previsão T+1 ---
  const getPrediction = (axis: string) => {
    if (data.length < 5) return null;
    const points = data.slice(-5);
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    points.forEach((p, i) => {
      const val = (p as any)[`accel_${axis}`] || 0;
      sumX += i; sumY += val; sumXY += i * val; sumXX += i * i;
    });
    const denom = n * sumXX - sumX * sumX;
    if (denom === 0) return null;
    const slope     = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;
    return (slope * n + intercept).toFixed(4);
  };

  const calcStats = (axis: string) => {
    const vals = data.map(d => (d as any)[`accel_${axis}`]).filter((v: any) => v != null);
    if (vals.length === 0) return { avg: "0.0000", max: "0.0000", min: "0.0000" };
    return {
      avg: (vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(4),
      max: Math.max(...vals).toFixed(4),
      min: Math.min(...vals).toFixed(4),
    };
  };

  // --- Supabase: config ---
  const updateConfig = async (patch: { robot_speed?: number; intervalo_leitura?: number }) => {
    const { error } = await supabase.from("robot_config").update(patch).eq("id", 1);
    if (error) console.error("Erro ao atualizar robot_config:", error.message);
  };

  const alterarVelocidade = async (valor: number) => {
    setRobotSpeed(valor);
    await updateConfig({ robot_speed: valor });
  };

  const atualizarIntervalo = async (valor: number) => {
    setIntervalo(valor);
    await updateConfig({ intervalo_leitura: valor });
  };

  // --- Gerar relatório: vai buscar dados do intervalo ao Supabase ---
  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const from = new Date(Date.now() - reportMinutes * 60 * 1000).toISOString();
      const { data: reportData, error } = await supabase
        .from("robot_data")
        .select("*")
        .gte("created_at", from)
        .order("created_at", { ascending: true });

      if (error) { console.error(error); return; }
      await generateReport(reportData as Row[], reportMinutes);
    } finally {
      setGenerating(false);
    }
  };

  // --- Config inicial ---
  useEffect(() => {
    (async () => {
      const { data: cfg } = await supabase
        .from("robot_config")
        .select("robot_speed, intervalo_leitura")
        .eq("id", 1)
        .single();
      if (cfg) {
        setRobotSpeed(cfg.robot_speed ?? 1.0);
        setIntervalo(cfg.intervalo_leitura ?? 2.0);
      }
      setConfigLoaded(true);
    })();
  }, []);

  // --- Telemetria + Realtime ---
  useEffect(() => {
    (async () => {
      const { data: robotData } = await supabase
        .from("robot_data")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (robotData) setData((robotData as Row[]).reverse());
    })();

    const channel = supabase
      .channel("realtime-robot")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "robot_data" },
        (payload) => setData((prev) => [...prev.slice(-39), payload.new as Row]))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const statsX   = calcStats("x");
  const statsY   = calcStats("y");
  const statsZ   = calcStats("z");
  const lastData = data.length > 0 ? data[data.length - 1] : null;

  return (
    <main className="p-6 font-mono bg-[#0a0c10] text-[#e0e6f0] min-h-screen text-sm">

      {/* Header */}
      <header className="flex justify-between items-end border-b border-[#1e2230] pb-4 mb-6">
        <div className="text-2xl font-bold font-sans tracking-tight">
          ISCF <span className="text-[#00e5ff]">//</span> Robot Monitor
        </div>
        <div className="flex items-center gap-3 text-[#4a5268] text-xs">
          <div className="w-2 h-2 rounded-full bg-[#69ff47] shadow-[0_0_8px_#69ff47] animate-pulse" />
          <span>Cloud Connected · Forecasting Active</span>
        </div>
      </header>

      {/* Métrica Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Accel X",       key: "x", val: lastData?.accel_x,    color: "text-[#00e5ff]", border: "border-l-[#00e5ff]" },
          { label: "Accel Y",       key: "y", val: lastData?.accel_y,    color: "text-[#ff4081]", border: "border-l-[#ff4081]" },
          { label: "Accel Z",       key: "z", val: lastData?.accel_z,    color: "text-[#69ff47]", border: "border-l-[#69ff47]" },
          { label: "Temp (Lisboa)", key: "t", val: lastData?.temperature, color: "text-[#ffab40]", border: "border-l-[#ffab40]", unit: "°C" },
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

      {/* Slider: Cadência */}
      <div className="bg-[#111318] border border-[#1e2230] p-4 rounded-md mb-4 flex items-center gap-6">
        <span className="text-[10px] text-[#4a5268] uppercase tracking-widest whitespace-nowrap">Cadência</span>
        <input type="range" min="0.5" max="5" step="0.5" value={intervalo}
          disabled={!configLoaded}
          onChange={(e) => atualizarIntervalo(Number(e.target.value))}
          className="accent-[#00e5ff] w-48" />
        <span className="text-[#00e5ff] font-mono">{intervalo.toFixed(1)}s</span>
        <span className="text-[9px] text-[#4a5268] italic ml-auto">
          → Supabase robot_config.intervalo_leitura
        </span>
      </div>

      {/* Slider: Velocidade */}
      <div className="bg-[#111318] border border-[#ff4081]/30 p-4 rounded-md mb-6 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <div className="text-[10px] text-[#ff4081] uppercase font-bold tracking-widest">
            Velocidade do Robô (Digital Twin)
          </div>
          <span className="text-[9px] text-[#4a5268] italic">
            → Supabase robot_config.robot_speed · injetado pelo backend
          </span>
        </div>
        <div className="flex items-center gap-4">
          <input type="range" min="0.1" max="2" step="0.1" value={robotSpeed}
            disabled={!configLoaded}
            onChange={(e) => alterarVelocidade(Number(e.target.value))}
            className="accent-[#ff4081] flex-1 cursor-pointer" />
          <span className="text-[#ff4081] font-mono min-w-[45px] text-right">
            {Math.round(robotSpeed * 100)}%
          </span>
        </div>
      </div>

      {/* ── GERADOR DE RELATÓRIO ── */}
      <div className="bg-[#111318] border border-[#69ff47]/30 p-4 rounded-md mb-6">
        <div className="text-[10px] text-[#69ff47] uppercase font-bold tracking-widest mb-3">
          Automatic Report Download
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[10px] text-[#4a5268] uppercase tracking-widest whitespace-nowrap">
            Time Interval
          </span>
          {[10, 30, 60].map((m) => (
            <button
              key={m}
              onClick={() => setReportMinutes(m)}
              className={`px-3 py-1 rounded text-[10px] font-bold border transition-all ${
                reportMinutes === m
                  ? "bg-[#69ff47] text-[#0a0c10] border-[#69ff47]"
                  : "bg-transparent text-[#69ff47] border-[#69ff47]/40 hover:border-[#69ff47]"
              }`}
            >
              Last {m} min
            </button>
          ))}
          {/* input manual */}
          <div className="flex items-center gap-2">
            <input
              type="number" min="1" max="1440"
              value={reportMinutes}
              onChange={(e) => setReportMinutes(Math.max(1, Number(e.target.value)))}
              className="w-16 bg-[#0a0c10] border border-[#1e2230] text-[#e0e6f0] text-[10px] px-2 py-1 rounded focus:outline-none focus:border-[#69ff47]"
            />
            <span className="text-[10px] text-[#4a5268]">min</span>
          </div>

          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded bg-[#69ff47] text-[#0a0c10] font-bold text-[11px] hover:bg-[#52d438] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z"/>
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {[
          { id: "accel_x",     label: "Acelerómetro X", color: "#00e5ff" },
          { id: "accel_y",     label: "Acelerómetro Y", color: "#ff4081" },
          { id: "accel_z",     label: "Acelerómetro Z", color: "#69ff47" },
          { id: "temperature", label: "Temperatura",    color: "#ffab40" },
        ].map((g) => (
          <div key={g.id} className="bg-[#111318] border border-[#1e2230] p-4 rounded-md">
            <div className="text-[10px] text-[#4a5268] uppercase tracking-widest mb-4">{g.label}</div>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2230" />
                  <XAxis dataKey="created_at" hide />
                  <YAxis stroke="#4a5268" fontSize={10} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ backgroundColor: "#0a0c10", borderColor: "#1e2230" }} />
                  <Line type="linear" dataKey={g.id} stroke={g.color} dot={true}
                        isAnimationActive={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Estatísticas + Tabela */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1 bg-[#111318] border border-[#1e2230] p-4 rounded-md">
          <div className="text-[10px] text-[#4a5268] uppercase tracking-widest mb-4">
            Estatísticas (40 Amostras)
          </div>
          <div className="space-y-3">
            {[
              { l: "X", s: statsX, c: "text-[#00e5ff]" },
              { l: "Y", s: statsY, c: "text-[#ff4081]" },
              { l: "Z", s: statsZ, c: "text-[#69ff47]" },
            ].map((ax) => (
              <div key={ax.l} className="bg-[#0a0c10] border border-[#1e2230] p-3 rounded">
                <div className="text-[10px] text-[#4a5268] mb-1">EIXO {ax.l}</div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#4a5268]">Média</span>
                  <span className={ax.c}>{ax.s.avg}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#4a5268]">Máximo</span>
                  <span className={ax.c}>{ax.s.max}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[#4a5268]">Mínimo</span>
                  <span className={ax.c}>{ax.s.min}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 bg-[#111318] border border-[#1e2230] p-4 rounded-md overflow-y-auto max-h-[400px]">
          <div className="text-[10px] text-[#4a5268] uppercase tracking-widest mb-4">
            Últimos Registos (Supabase)
          </div>
          <table className="w-full text-left text-[10px]">
            <thead className="text-[#4a5268] border-b border-[#1e2230]">
              <tr>
                <th className="pb-2">Tempo</th>
                <th>X</th><th>Y</th><th>Z</th><th>Temp</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((row, i) => (
                <tr key={i} className="border-b border-[#1e2230]/50 hover:bg-white/5">
                  <td className="py-2 text-[#4a5268]">
                    {new Date(row.created_at).toLocaleTimeString()}
                  </td>
                  <td className="text-[#00e5ff]">{row.accel_x != null ? Number(row.accel_x).toFixed(4) : "—"}</td>
                  <td className="text-[#ff4081]">{row.accel_y != null ? Number(row.accel_y).toFixed(4) : "—"}</td>
                  <td className="text-[#69ff47]">{row.accel_z != null ? Number(row.accel_z).toFixed(4) : "—"}</td>
                  <td className="text-[#ffab40]">{row.temperature != null ? Number(row.temperature).toFixed(1) : "—"}°C</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
