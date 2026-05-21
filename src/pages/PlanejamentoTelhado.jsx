import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, Ruler, Zap, RotateCcw, Download, ChevronRight, Loader2, CheckCircle, AlertTriangle, Sun } from "lucide-react";

const MARGEM_BORDA = 0.3; // metros de margem nas bordas
const ESPACO_ENTRE = 0.02; // metros entre módulos

export default function PlanejamentoTelhado() {
  const [modulos, setModulos] = useState([]);
  const [moduloSelecionado, setModuloSelecionado] = useState(null);
  const [modo, setModo] = useState("manual"); // "manual" | "drone"
  const [droneFile, setDroneFile] = useState(null);
  const [droneUrl, setDroneUrl] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [dimensoes, setDimensoes] = useState({ largura: "", comprimento: "", inclinacao: "15" });
  const [orientacaoTelhado, setOrientacaoTelhado] = useState("landscape"); // landscape | portrait (módulo em relação ao telhado)
  const [resultado, setResultado] = useState(null);
  const [analiseIA, setAnaliseIA] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    base44.entities.Produto.filter({ ativo: true, tipo: "modulo_fv" }).then(setModulos).catch(() => {});
  }, []);

  useEffect(() => {
    if (resultado) desenharLayout(resultado);
  }, [resultado]);

  const handleUploadDrone = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDroneFile(file);
    setAnalisando(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setDroneUrl(file_url);

    const analise = await base44.integrations.Core.InvokeLLM({
      prompt: `Analise esta foto de drone de um telhado residencial/comercial e estime:
- largura_m: largura útil do telhado em metros (número)
- comprimento_m: comprimento útil do telhado em metros (número)  
- inclinacao_graus: inclinação estimada do telhado em graus (número, ex: 15, 30)
- tipo_telhado: tipo (ceramica, fibrocimento, metalico, laje, outro)
- observacoes: observações importantes sobre sombreamento ou obstáculos

Retorne apenas JSON com esses campos. Se não conseguir identificar, use null.`,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          largura_m: { type: "number" },
          comprimento_m: { type: "number" },
          inclinacao_graus: { type: "number" },
          tipo_telhado: { type: "string" },
          observacoes: { type: "string" }
        }
      }
    });

    setAnaliseIA(analise);
    if (analise.largura_m) setDimensoes(d => ({ ...d, largura: String(analise.largura_m) }));
    if (analise.comprimento_m) setDimensoes(d => ({ ...d, comprimento: String(analise.comprimento_m) }));
    if (analise.inclinacao_graus) setDimensoes(d => ({ ...d, inclinacao: String(analise.inclinacao_graus) }));
    setAnalisando(false);
  };

  const calcularLayout = () => {
    const mod = moduloSelecionado;
    if (!mod || !dimensoes.largura || !dimensoes.comprimento) return;

    const telhadoL = parseFloat(dimensoes.largura);
    const telhadoC = parseFloat(dimensoes.comprimento);

    // Dimensões do módulo em metros (busca area_m2 ou calcula pelo Wp)
    // Padrão: módulo 60 células ≈ 1.00m x 1.65m, 72 células ≈ 1.00m x 1.96m
    // Usa dimensoes cadastradas se disponível, senão estima
    let modW = 1.0;  // largura do módulo
    let modH = 1.65; // altura do módulo

    if (mod.dimensoes) {
      const match = mod.dimensoes.match(/([\d.]+)\s*[xX×]\s*([\d.]+)/);
      if (match) {
        const d1 = parseFloat(match[1]) / 1000; // converte mm para m se necessário
        const d2 = parseFloat(match[2]) / 1000;
        modW = d1 > 3 ? d1 / 1000 : d1; // se > 3 assume que estava em mm
        modH = d2 > 3 ? d2 / 1000 : d2;
        if (modW > modH) { const tmp = modW; modW = modH; modH = tmp; } // menor = largura
      }
    } else if (mod.area_m2) {
      modW = Math.sqrt(mod.area_m2 / 1.65);
      modH = mod.area_m2 / modW;
    }

    const areaUtil = (telhadoL - 2 * MARGEM_BORDA) * (telhadoC - 2 * MARGEM_BORDA);

    // Testa 2 orientações e escolhe a melhor
    const calcOrientation = (mW, mH) => {
      const cols = Math.floor((telhadoL - 2 * MARGEM_BORDA + ESPACO_ENTRE) / (mW + ESPACO_ENTRE));
      const rows = Math.floor((telhadoC - 2 * MARGEM_BORDA + ESPACO_ENTRE) / (mH + ESPACO_ENTRE));
      return { cols: Math.max(0, cols), rows: Math.max(0, rows), total: Math.max(0, cols * rows), mW, mH };
    };

    const opt1 = calcOrientation(modW, modH);       // portrait
    const opt2 = calcOrientation(modH, modW);       // landscape
    const melhor = opt2.total >= opt1.total ? { ...opt2, orientacao: "landscape" } : { ...opt1, orientacao: "portrait" };

    const potenciaKwp = (melhor.total * (mod.potencia_wp || 0)) / 1000;
    const areaOcupada = melhor.total * (melhor.mW * melhor.mH);
    const aproveitamento = areaUtil > 0 ? (areaOcupada / areaUtil) * 100 : 0;

    setResultado({
      ...melhor,
      telhadoL,
      telhadoC,
      modulo: mod,
      potenciaKwp,
      areaOcupada,
      aproveitamento,
    });
  };

  const desenharLayout = (r) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    const escalaX = (W - 40) / r.telhadoL;
    const escalaY = (H - 40) / r.telhadoC;
    const escala = Math.min(escalaX, escalaY);

    const tw = r.telhadoL * escala;
    const th = r.telhadoC * escala;
    const ox = (W - tw) / 2;
    const oy = (H - th) / 2;

    ctx.clearRect(0, 0, W, H);

    // Telhado
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(ox, oy, tw, th);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, tw, th);

    // Margem de borda
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(ox + MARGEM_BORDA * escala, oy + MARGEM_BORDA * escala,
      tw - 2 * MARGEM_BORDA * escala, th - 2 * MARGEM_BORDA * escala);
    ctx.setLineDash([]);

    // Módulos
    const mwPx = r.mW * escala;
    const mhPx = r.mH * escala;
    const startX = ox + MARGEM_BORDA * escala;
    const startY = oy + MARGEM_BORDA * escala;

    for (let row = 0; row < r.rows; row++) {
      for (let col = 0; col < r.cols; col++) {
        const x = startX + col * (mwPx + ESPACO_ENTRE * escala);
        const y = startY + row * (mhPx + ESPACO_ENTRE * escala);
        ctx.fillStyle = "#1d4ed8";
        ctx.fillRect(x, y, mwPx, mhPx);
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, mwPx, mhPx);
        // Linha diagonal (célula)
        ctx.strokeStyle = "#3b82f620";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + mwPx, y + mhPx);
        ctx.stroke();
      }
    }

    // Legenda
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.fillText(`${r.telhadoL}m × ${r.telhadoC}m`, ox + 4, oy - 6);
  };

  const modSel = modulos.find(m => m.id === moduloSelecionado);

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sun size={22} className="text-amber-400" /> Planejamento de Telhado
        </h1>
        <p className="text-slate-400 text-sm mt-1">Gere o layout ideal de painéis para um telhado via foto de drone ou dimensões manuais</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel esquerdo: inputs */}
        <div className="space-y-5">
          {/* Modo de entrada */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <p className="text-white font-semibold text-sm">1. Dimensões do Telhado</p>
            <div className="flex gap-2">
              <button onClick={() => setModo("manual")} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${modo === "manual" ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                <Ruler size={13} className="inline mr-1.5" />Medidas manuais
              </button>
              <button onClick={() => setModo("drone")} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${modo === "drone" ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                <Upload size={13} className="inline mr-1.5" />Foto de drone (IA)
              </button>
            </div>

            {modo === "drone" && (
              <div className="space-y-3">
                <label className="cursor-pointer block">
                  <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${droneUrl ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-700 hover:border-amber-500/50"}`}>
                    {analisando ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={28} className="text-amber-400 animate-spin" />
                        <p className="text-slate-300 text-sm font-medium">Analisando foto com IA...</p>
                        <p className="text-slate-500 text-xs">Identificando dimensões do telhado</p>
                      </div>
                    ) : droneUrl ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle size={24} className="text-emerald-400" />
                        <p className="text-emerald-300 text-sm font-medium">Foto analisada com sucesso</p>
                        <p className="text-slate-500 text-xs">Clique para substituir</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload size={28} className="text-slate-500" />
                        <p className="text-slate-300 text-sm font-medium">Enviar foto de drone</p>
                        <p className="text-slate-500 text-xs">JPG, PNG ou PDF</p>
                      </div>
                    )}
                  </div>
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleUploadDrone} />
                </label>

                {analiseIA && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-1">
                    <p className="text-blue-300 text-xs font-semibold">IA detectou:</p>
                    {analiseIA.tipo_telhado && <p className="text-slate-300 text-xs">Tipo: <strong>{analiseIA.tipo_telhado}</strong></p>}
                    {analiseIA.observacoes && <p className="text-slate-400 text-xs">{analiseIA.observacoes}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Largura (m)", key: "largura", placeholder: "ex: 8" },
                { label: "Comprimento (m)", key: "comprimento", placeholder: "ex: 12" },
                { label: "Inclinação (°)", key: "inclinacao", placeholder: "ex: 15" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-slate-400 text-xs block mb-1.5">{f.label}</label>
                  <input
                    type="number"
                    value={dimensoes[f.key]}
                    onChange={e => setDimensoes(d => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Seleção de módulo */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <p className="text-white font-semibold text-sm">2. Módulo Fotovoltaico</p>
            <select
              value={moduloSelecionado || ""}
              onChange={e => setModuloSelecionado(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="">Selecionar módulo...</option>
              {modulos.map(m => (
                <option key={m.id} value={m.id}>
                  {m.fabricante} {m.modelo}{m.potencia_wp ? ` — ${m.potencia_wp} Wp` : ""}{m.dimensoes ? ` (${m.dimensoes})` : ""}
                </option>
              ))}
            </select>
            {modSel && (
              <div className="bg-slate-800 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-slate-500">Potência:</span> <span className="text-white font-medium">{modSel.potencia_wp || "—"} Wp</span></div>
                <div><span className="text-slate-500">Dimensões:</span> <span className="text-white font-medium">{modSel.dimensoes || "Padrão 1×1.65m"}</span></div>
                <div><span className="text-slate-500">Eficiência:</span> <span className="text-white font-medium">{modSel.eficiencia_modulo ? `${modSel.eficiencia_modulo}%` : "—"}</span></div>
                <div><span className="text-slate-500">Área:</span> <span className="text-white font-medium">{modSel.area_m2 ? `${modSel.area_m2} m²` : "—"}</span></div>
              </div>
            )}
          </div>

          {/* Botão calcular */}
          <button
            onClick={calcularLayout}
            disabled={!moduloSelecionado || !dimensoes.largura || !dimensoes.comprimento}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Zap size={16} /> Gerar Layout Otimizado
          </button>

          {/* Resultado resumo */}
          {resultado && (
            <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 space-y-4">
              <p className="text-amber-400 font-semibold text-sm flex items-center gap-2"><CheckCircle size={15} /> Resultado</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total de Módulos", value: resultado.total, color: "text-white", bold: true },
                  { label: "Potência Total", value: `${resultado.potenciaKwp.toFixed(2)} kWp`, color: "text-amber-400", bold: true },
                  { label: "Disposição", value: `${resultado.cols} colunas × ${resultado.rows} fileiras`, color: "text-slate-300" },
                  { label: "Orientação módulo", value: resultado.orientacao === "landscape" ? "Horizontal" : "Vertical", color: "text-slate-300" },
                  { label: "Área ocupada", value: `${resultado.areaOcupada.toFixed(1)} m²`, color: "text-slate-300" },
                  { label: "Aproveitamento", value: `${resultado.aproveitamento.toFixed(0)}%`, color: resultado.aproveitamento > 70 ? "text-emerald-400" : "text-amber-400" },
                ].map(item => (
                  <div key={item.label} className="bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-500 text-xs mb-1">{item.label}</p>
                    <p className={`text-sm ${item.bold ? "font-bold text-base" : "font-medium"} ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
              {resultado.aproveitamento < 50 && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-300 text-xs">Aproveitamento baixo. Verifique as dimensões do telhado ou considere um módulo menor.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Painel direito: visualização */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white font-semibold text-sm">Visualização do Layout</p>
            {resultado && (
              <button
                onClick={() => { setResultado(null); setDimensoes({ largura: "", comprimento: "", inclinacao: "15" }); setModuloSelecionado(null); setDroneUrl(""); setAnaliseIA(null); setDroneFile(null); }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg transition-all"
              >
                <RotateCcw size={12} /> Novo cálculo
              </button>
            )}
          </div>

          {!resultado ? (
            <div className="flex-1 flex items-center justify-center min-h-64">
              <div className="text-center">
                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Sun size={32} className="text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm">Preencha as dimensões e selecione um módulo para visualizar o layout</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-3">
              <canvas
                ref={canvasRef}
                width={500}
                height={380}
                className="w-full rounded-xl bg-slate-950 border border-slate-800"
              />
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-500 inline-block"></span> Telhado</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-600 inline-block"></span> Módulos ({resultado.total})</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-dashed border-slate-500 inline-block"></span> Margem</span>
              </div>

              {/* Foto drone se disponível */}
              {droneUrl && (
                <div className="mt-2">
                  <p className="text-slate-400 text-xs mb-2">Foto original:</p>
                  <img src={droneUrl} alt="Drone" className="w-full rounded-xl border border-slate-700 max-h-48 object-cover" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}