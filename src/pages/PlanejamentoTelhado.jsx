import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, Ruler, Zap, RotateCcw, Loader2, CheckCircle, AlertTriangle, Sun, MapPin, Satellite } from "lucide-react";

const MARGEM_BORDA = 0.3; // metros de margem nas bordas
const ESPACO_ENTRE = 0.02; // metros entre módulos

export default function PlanejamentoTelhado() {
  const [modulos, setModulos] = useState([]);
  const [moduloSelecionado, setModuloSelecionado] = useState(null);
  const [modo, setModo] = useState("manual"); // "manual" | "drone" | "solar_api"
  const [droneFile, setDroneFile] = useState(null);
  const [droneUrl, setDroneUrl] = useState("");
  const [analisando, setAnalisando] = useState(false);
  const [dimensoes, setDimensoes] = useState({ largura: "", comprimento: "", inclinacao: "15" });
  const [orientacaoTelhado, setOrientacaoTelhado] = useState("landscape"); // landscape | portrait (módulo em relação ao telhado)
  const [resultado, setResultado] = useState(null);
  const [analiseIA, setAnaliseIA] = useState(null);
  const [enderecoSolar, setEnderecoSolar] = useState("");
  const [dadosSolar, setDadosSolar] = useState(null);
  const [buscandoSolar, setBuscandoSolar] = useState(false);
  const [configSolar, setConfigSolar] = useState("best");
  const [inversores, setInversores] = useState([]);
  const [inversoresSelecionados, setInversoresSelecionados] = useState([]);
  const [stringCalc, setStringCalc] = useState(null);
  const [modoQuantidade, setModoQuantidade] = useState("auto"); // "auto" | "manual"
  const [quantidadeManual, setQuantidadeManual] = useState("");
  const canvasRef = useRef(null);

  const handleBuscarSolarAPI = async () => {
    if (!enderecoSolar) return;
    setBuscandoSolar(true);
    setDadosSolar(null);
    const res = await base44.functions.invoke('solarApi', { address: enderecoSolar });
    const data = res.data;
    if (data.error) {
      setDadosSolar({ erro: data.error, details: data.details });
    } else {
      setDadosSolar(data);
      if (data.buildingArea) {
        const lado = Math.sqrt(data.buildingArea);
        setDimensoes(d => ({ ...d, largura: lado.toFixed(1), comprimento: lado.toFixed(1) }));
      }
    }
    setBuscandoSolar(false);
  };

  useEffect(() => {
    base44.entities.Produto.filter({ ativo: true, tipo: "modulo_fv" }).then(setModulos).catch(() => {});
    base44.entities.Produto.filter({ ativo: true }).then(prods => {
      setInversores(prods.filter(p => ["inversor_string", "microinversor", "hibrido"].includes(p.tipo)));
    }).catch(() => {});
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

  const calcularStrings = (mod, invProdutos) => {
    // Temperaturas de projeto (Brasil): frio=-5°C, quente=70°C (temp. célula)
    const T_MIN = -5;
    const T_MAX = 70;
    const T_STC = 25;

    // Coeficientes de temperatura do módulo
    const coefVoc = parseFloat((mod.coef_temp_voc || "-0.30").replace("%/°C", "").replace(",", ".")) / 100;
    const coefVmp = parseFloat((mod.coef_temp_ppeak || "-0.30").replace("%/°C", "").replace(",", ".")) / 100;

    const Voc = mod.voc || 0;
    const Vmp = mod.vmp || 0;
    const Isc = mod.isc || 0;
    const Imp = mod.imp || 0;

    if (!Voc || !Vmp) return null;

    // Tensão em condição extrema de frio (máxima) e calor (mínima)
    const Voc_frio = Voc * (1 + coefVoc * (T_MIN - T_STC));
    const Vmp_quente = Vmp * (1 + coefVmp * (T_MAX - T_STC));

    const resultados = invProdutos.map(({ produto, quantidade }) => {
      const inv = produto;
      const V_max = inv.tensao_max_dc_v || 600;
      const V_min = inv.tensao_min_dc_v || 80;
      const I_max = inv.corrente_max_dc_a || 20;
      const n_mppt = inv.num_mppt || 1;
      const entradas = inv.entradas_por_mppt || 1;

      // Limites de módulos por string
      const maxModString = V_max > 0 ? Math.floor(V_max / Voc_frio) : 99;
      const minModString = V_min > 0 && Vmp_quente > 0 ? Math.ceil(V_min / Vmp_quente) : 1;

      // Strings por MPPT limitado por corrente
      const maxStringsMppt = I_max > 0 && Isc > 0 ? Math.floor(I_max / Isc) : entradas;
      const stringsParaleloPorMppt = Math.min(maxStringsMppt, entradas);

      // Configuração recomendada: usar string com mais módulos possível dentro dos limites
      const modPorString = maxModString; // usar o máximo seguro
      const totalEntradas = n_mppt * stringsParaleloPorMppt * quantidade;

      // Tensões e correntes resultantes
      const V_string_stc = modPorString * Vmp;
      const V_string_frio = modPorString * Voc_frio;
      const I_mppt = stringsParaleloPorMppt * Isc;

      const alertas = [];
      if (modPorString < minModString) alertas.push(`⚠️ String abaixo da tensão mínima de entrada (${V_min}V). Aumente para ${minModString} módulos/string.`);
      if (V_string_frio > V_max) alertas.push(`🔴 Tensão em frio excede ${V_max}V! Reduza para ${Math.floor(V_max / Voc_frio)} módulos/string.`);
      if (I_mppt > I_max) alertas.push(`🔴 Corrente por MPPT excede ${I_max}A.`);

      return {
        inversor: inv,
        quantidade,
        modPorString,
        minModString,
        maxModString,
        stringsParaleloPorMppt,
        n_mppt,
        entradas,
        totalEntradas,
        V_string_stc: V_string_stc.toFixed(1),
        V_string_frio: V_string_frio.toFixed(1),
        V_max,
        I_mppt: I_mppt.toFixed(1),
        I_max,
        alertas,
      };
    });

    return resultados;
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

    // Limitar pela quantidade manual se definida
    let totalFinal = melhor.total;
    let colsFinal = melhor.cols;
    let rowsFinal = melhor.rows;
    if (modoQuantidade === "manual" && quantidadeManual) {
      const qtdDesejada = parseInt(quantidadeManual);
      if (qtdDesejada < melhor.total) {
        totalFinal = qtdDesejada;
        // Recalcula linhas/colunas mantendo proporção
        colsFinal = Math.ceil(Math.sqrt(qtdDesejada * (melhor.cols / melhor.rows)));
        rowsFinal = Math.ceil(qtdDesejada / colsFinal);
        // Garante que não ultrapasse o telhado
        colsFinal = Math.min(colsFinal, melhor.cols);
        rowsFinal = Math.min(rowsFinal, melhor.rows);
        totalFinal = colsFinal * rowsFinal;
      }
    }

    const potenciaKwp = (totalFinal * (mod.potencia_wp || 0)) / 1000;
    const areaOcupada = totalFinal * (melhor.mW * melhor.mH);
    const aproveitamento = areaUtil > 0 ? (areaOcupada / areaUtil) * 100 : 0;

    setResultado({
      ...melhor,
      total: totalFinal,
      cols: colsFinal,
      rows: rowsFinal,
      telhadoL,
      telhadoC,
      modulo: mod,
      potenciaKwp,
      areaOcupada,
      aproveitamento,
    });

    // Calcular strings se houver inversores selecionados
    if (inversoresSelecionados.length > 0 && mod.voc) {
      const invProdutos = inversoresSelecionados
        .map(s => ({ produto: inversores.find(i => i.id === s.produto_id), quantidade: s.quantidade }))
        .filter(s => s.produto);
      setStringCalc(calcularStrings(mod, invProdutos));
    } else {
      setStringCalc(null);
    }
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
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setModo("manual")} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${modo === "manual" ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                <Ruler size={13} className="inline mr-1.5" />Manual
              </button>
              <button onClick={() => setModo("drone")} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${modo === "drone" ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                <Upload size={13} className="inline mr-1.5" />Drone (IA)
              </button>
              <button onClick={() => setModo("solar_api")} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${modo === "solar_api" ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                <Satellite size={13} className="inline mr-1.5" />Google Solar
              </button>
            </div>

            {modo === "solar_api" && (
              <div className="space-y-3">
                <p className="text-slate-400 text-xs">Busca dados reais do telhado via <strong className="text-blue-400">Google Solar API</strong> — satélite + IA do Google.</p>
                <div className="flex gap-2">
                  <input
                    value={enderecoSolar}
                    onChange={e => setEnderecoSolar(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleBuscarSolarAPI()}
                    placeholder="Ex: Rua das Flores 123, Vitória ES"
                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button onClick={handleBuscarSolarAPI} disabled={buscandoSolar || !enderecoSolar}
                    className="bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5 shrink-0">
                    {buscandoSolar ? <Loader2 size={14} className="animate-spin" /> : <MapPin size={14} />}
                    {buscandoSolar ? "Buscando..." : "Buscar"}
                  </button>
                </div>
                {dadosSolar?.erro && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <div><p className="text-red-300 text-xs font-semibold">{dadosSolar.erro}</p>
                    {dadosSolar.details && <p className="text-slate-400 text-xs mt-0.5">{dadosSolar.details}</p>}</div>
                  </div>
                )}
                {dadosSolar && !dadosSolar.erro && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-2">
                    <p className="text-blue-300 text-xs font-semibold flex items-center gap-1.5"><CheckCircle size={12} /> Google Solar — dados encontrados</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-500">Área telhado:</span> <span className="text-white font-medium">{dadosSolar.buildingArea?.toFixed(0)} m²</span></div>
                      <div><span className="text-slate-500">Máx. painéis:</span> <span className="text-white font-medium">{dadosSolar.maxPanelCount}</span></div>
                      <div><span className="text-slate-500">Horas sol/ano:</span> <span className="text-amber-400 font-medium">{dadosSolar.maxSunshineHours?.toFixed(0)} h</span></div>
                      <div><span className="text-slate-500">Segmentos:</span> <span className="text-white font-medium">{dadosSolar.roofSegments?.length}</span></div>
                    </div>
                    {dadosSolar.roofSegments?.map((seg, i) => (
                      <div key={i} className="flex gap-3 text-xs bg-slate-800 rounded-lg px-3 py-1.5">
                        <span className="text-slate-500">Seg. {i+1}</span>
                        <span className="text-white">{seg.pitchDegrees?.toFixed(0)}° inclinação</span>
                        <span className="text-slate-300">{seg.azimuthDegrees?.toFixed(0)}° azimute</span>
                        <span className="text-amber-400">{seg.stats?.areaMeters2?.toFixed(0)} m²</span>
                      </div>
                    ))}
                    {(dadosSolar.bestConfig || dadosSolar.midConfig) && (
                      <div className="flex gap-2 pt-1">
                        {dadosSolar.midConfig && (() => { const c = dadosSolar.midConfig; const kwp = (c.panelsCount * dadosSolar.panelCapacityWatts) / 1000; return (
                          <button onClick={() => { setConfigSolar("mid"); setResultado({ total: c.panelsCount, potenciaKwp: kwp, cols: Math.ceil(Math.sqrt(c.panelsCount)), rows: Math.ceil(c.panelsCount / Math.ceil(Math.sqrt(c.panelsCount))), mW: dadosSolar.panelWidthMeters, mH: dadosSolar.panelHeightMeters, telhadoL: Math.sqrt(dadosSolar.buildingArea || 100), telhadoC: Math.sqrt(dadosSolar.buildingArea || 100), areaOcupada: c.panelsCount * dadosSolar.panelWidthMeters * dadosSolar.panelHeightMeters, aproveitamento: (c.panelsCount * dadosSolar.panelWidthMeters * dadosSolar.panelHeightMeters / (dadosSolar.buildingArea || 100)) * 100, orientacao: "Google Solar", modulo: modSel, yearlyEnergyDcKwh: c.yearlyEnergyDcKwh }); }}
                            className={`flex-1 rounded-xl p-2.5 text-xs border text-left transition-all ${configSolar === "mid" ? "bg-blue-500/20 border-blue-500/50 text-blue-300" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"}`}>
                            <p className="font-bold">{c.panelsCount} painéis</p><p>{kwp.toFixed(1)} kWp</p>
                          </button>); })()}
                        {dadosSolar.bestConfig && (() => { const c = dadosSolar.bestConfig; const kwp = (c.panelsCount * dadosSolar.panelCapacityWatts) / 1000; return (
                          <button onClick={() => { setConfigSolar("best"); setResultado({ total: c.panelsCount, potenciaKwp: kwp, cols: Math.ceil(Math.sqrt(c.panelsCount)), rows: Math.ceil(c.panelsCount / Math.ceil(Math.sqrt(c.panelsCount))), mW: dadosSolar.panelWidthMeters, mH: dadosSolar.panelHeightMeters, telhadoL: Math.sqrt(dadosSolar.buildingArea || 100), telhadoC: Math.sqrt(dadosSolar.buildingArea || 100), areaOcupada: c.panelsCount * dadosSolar.panelWidthMeters * dadosSolar.panelHeightMeters, aproveitamento: (c.panelsCount * dadosSolar.panelWidthMeters * dadosSolar.panelHeightMeters / (dadosSolar.buildingArea || 100)) * 100, orientacao: "Google Solar (máx)", modulo: modSel, yearlyEnergyDcKwh: c.yearlyEnergyDcKwh }); }}
                            className={`flex-1 rounded-xl p-2.5 text-xs border text-left transition-all ${configSolar === "best" ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"}`}>
                            <p className="font-bold">{c.panelsCount} painéis (máx)</p><p>{kwp.toFixed(1)} kWp</p>
                          </button>); })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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

          {/* Seleção de inversores */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold text-sm">3. Inversores <span className="text-slate-500 font-normal text-xs">(opcional — para dimensionamento de strings)</span></p>
              <button
                onClick={() => setInversoresSelecionados(prev => [...prev, { produto_id: "", quantidade: 1 }])}
                className="text-amber-400 hover:text-amber-300 text-xs font-medium"
              >+ Adicionar</button>
            </div>
            {inversoresSelecionados.length === 0 && (
              <p className="text-slate-500 text-xs">Selecione ao menos um inversor para calcular o dimensionamento de strings (módulos/string, strings por MPPT, limites de tensão e corrente).</p>
            )}
            {inversoresSelecionados.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={item.produto_id}
                  onChange={e => {
                    const arr = [...inversoresSelecionados];
                    arr[i] = { ...arr[i], produto_id: e.target.value };
                    setInversoresSelecionados(arr);
                  }}
                  className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
                >
                  <option value="">Selecionar inversor...</option>
                  {inversores.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.fabricante} {inv.modelo}{inv.potencia_kva ? ` — ${inv.potencia_kva} kVA` : ""}{inv.num_mppt ? ` | ${inv.num_mppt} MPPT` : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="number" min="1"
                  value={item.quantidade}
                  onChange={e => {
                    const arr = [...inversoresSelecionados];
                    arr[i] = { ...arr[i], quantidade: parseInt(e.target.value) || 1 };
                    setInversoresSelecionados(arr);
                  }}
                  className="w-16 bg-slate-800 border border-slate-700 text-white rounded-xl px-2 py-2 text-sm focus:outline-none focus:border-amber-500 text-center"
                />
                <button onClick={() => setInversoresSelecionados(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
              </div>
            ))}
            {/* Ficha técnica do inversor selecionado */}
            {inversoresSelecionados.map((item, i) => {
              const inv = inversores.find(p => p.id === item.produto_id);
              if (!inv || !inv.num_mppt) return null;
              return (
                <div key={`info-${i}`} className="bg-slate-800 rounded-xl p-3 grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-slate-500">MPPTs:</span> <span className="text-white font-medium">{inv.num_mppt}</span></div>
                  <div><span className="text-slate-500">Ent/MPPT:</span> <span className="text-white font-medium">{inv.entradas_por_mppt || 1}</span></div>
                  <div><span className="text-slate-500">I máx DC:</span> <span className="text-white font-medium">{inv.corrente_max_dc_a || "—"} A</span></div>
                  <div><span className="text-slate-500">V máx DC:</span> <span className="text-amber-400 font-medium">{inv.tensao_max_dc_v || "—"} V</span></div>
                  <div><span className="text-slate-500">V mín DC:</span> <span className="text-white font-medium">{inv.tensao_min_dc_v || "—"} V</span></div>
                  <div><span className="text-slate-500">Potência:</span> <span className="text-white font-medium">{inv.potencia_kva || "—"} kVA</span></div>
                </div>
              );
            })}
          </div>

          {/* Modo de quantidade */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <p className="text-white font-semibold text-sm">4. Quantidade de Módulos</p>
            <div className="flex gap-2">
              <button onClick={() => setModoQuantidade("auto")} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${modoQuantidade === "auto" ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                Máximo possível
              </button>
              <button onClick={() => setModoQuantidade("manual")} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${modoQuantidade === "manual" ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                Definir quantidade
              </button>
            </div>
            {modoQuantidade === "manual" && (
              <div>
                <label className="text-slate-400 text-xs block mb-1.5">Quantidade de módulos desejada</label>
                <input
                  type="number" min="1"
                  value={quantidadeManual}
                  onChange={e => setQuantidadeManual(e.target.value)}
                  placeholder="ex: 12"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                />
                <p className="text-slate-500 text-xs mt-1.5">O sistema calculará a melhor disposição para essa quantidade no telhado.</p>
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

              {/* Dimensionamento de strings */}
              {stringCalc && stringCalc.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <p className="text-white font-semibold text-xs uppercase tracking-wide">Dimensionamento Elétrico de Strings</p>
                  {stringCalc.map((r, i) => (
                    <div key={i} className="bg-slate-800 rounded-xl p-4 space-y-2">
                      <p className="text-amber-400 text-xs font-semibold">{r.quantidade}× {r.inversor.fabricante} {r.inversor.modelo}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-900 rounded-lg p-2">
                          <p className="text-slate-500">Módulos/string</p>
                          <p className="text-white font-bold text-base">{r.modPorString}</p>
                          <p className="text-slate-500">({r.minModString}–{r.maxModString} permitido)</p>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-2">
                          <p className="text-slate-500">Strings paralelas/MPPT</p>
                          <p className="text-white font-bold text-base">{r.stringsParaleloPorMppt}</p>
                          <p className="text-slate-500">{r.n_mppt} MPPT × {r.entradas} entradas</p>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-2">
                          <p className="text-slate-500">Tensão string (STC)</p>
                          <p className="text-emerald-400 font-semibold">{r.V_string_stc} V</p>
                          <p className="text-slate-500">frio: {r.V_string_frio} V / máx: {r.V_max} V</p>
                        </div>
                        <div className="bg-slate-900 rounded-lg p-2">
                          <p className="text-slate-500">Corrente por MPPT</p>
                          <p className="text-white font-semibold">{r.I_mppt} A</p>
                          <p className="text-slate-500">máx: {r.I_max} A</p>
                        </div>
                      </div>
                      {r.alertas.length > 0 && (
                        <div className="space-y-1">
                          {r.alertas.map((a, j) => (
                            <p key={j} className="text-xs text-red-300 bg-red-500/10 rounded-lg px-3 py-1.5">{a}</p>
                          ))}
                        </div>
                      )}
                      {r.alertas.length === 0 && (
                        <p className="text-emerald-400 text-xs flex items-center gap-1.5"><CheckCircle size={12} /> Configuração dentro dos limites técnicos</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {inversoresSelecionados.some(s => s.produto_id) && !stringCalc && resultado && (
                <p className="text-slate-500 text-xs">⚠️ Adicione Voc, Vmp, Isc e Imp ao cadastro do módulo para calcular o dimensionamento elétrico.</p>
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