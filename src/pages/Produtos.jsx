import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, Plus, Search, Upload, FileText, CheckCircle, Loader2, X, Filter, Sparkles } from "lucide-react";

const TIPOS = {
  modulo_fv: "Módulo FV",
  inversor_string: "Inversor String",
  microinversor: "Microinversor",
  hibrido: "Híbrido"
};

const TIPO_COLORS = {
  modulo_fv: "bg-amber-400/10 text-amber-400",
  inversor_string: "bg-blue-400/10 text-blue-400",
  microinversor: "bg-violet-400/10 text-violet-400",
  hibrido: "bg-emerald-400/10 text-emerald-400"
};

const PRODUTO_VAZIO = {
  tipo: "modulo_fv", fabricante: "", modelo: "", ativo: true,
  garantia_anos: "", eficiencia: "", dimensoes: "", peso: "",
  inmetro_numero: "", inmetro_validade: "", observacoes: "",
  potencia_wp: "", vmp: "", imp: "", voc: "", isc: "",
  eficiencia_modulo: "", corrente_max_fusivel_a: "", coef_temperatura: "", area_m2: "",
  potencia_kva: "", potencia_ac_w: "", tensao_nominal_ac_v: "", corrente_max_ac_a: "",
  frequencia_operacao_hz: "", range_frequencia_hz: "", fator_potencia: "",
  corrente_max_dc_a: "", tensao_min_dc_v: "", tensao_max_dc_v: "",
  num_mppt: "", entradas_por_mppt: "", range_temperatura: ""
};

export default function Produtos() {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(PRODUTO_VAZIO);
  const [saving, setSaving] = useState(false);
  const [uploadingInmetro, setUploadingInmetro] = useState(false);
  const [preenchendoIA, setPreenchendoIA] = useState(false);

  useEffect(() => {
    base44.entities.Produto.list("-created_date", 200).then(p => {
      setProdutos(p);
      setLoading(false);
    });
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAbrir = (produto = null) => {
    setEditando(produto);
    setForm(produto ? { ...produto } : PRODUTO_VAZIO);
    setModal(true);
  };

  const handleSalvar = async () => {
    setSaving(true);
    if (editando?.id) {
      const updated = await base44.entities.Produto.update(editando.id, form);
      setProdutos(prev => prev.map(p => p.id === editando.id ? updated : p));
    } else {
      const novo = await base44.entities.Produto.create(form);
      setProdutos(prev => [novo, ...prev]);
    }
    setSaving(false);
    setModal(false);
  };

  const handlePreencherIA = async () => {
    if (!form.fabricante || !form.modelo) return;
    setPreenchendoIA(true);
    const isModulo = form.tipo === "modulo_fv";
    const prompt = isModulo
      ? `Busque as especificações técnicas completas do módulo fotovoltaico: Fabricante: ${form.fabricante}, Modelo: ${form.modelo}.
Retorne os dados em JSON com os campos: potencia_wp (Ppeak), vmp (Tensão Vmp), imp (Corrente Imp), voc (Tensão Voc), isc (Corrente Isc), eficiencia_modulo (% eficiência), corrente_max_fusivel_a (corrente máx fusível série), coef_temperatura (ex: "-0.35%/°C"), area_m2, dimensoes, peso, garantia_anos.
Preencha apenas os campos que encontrar com certeza. Deixe null para os demais.`
      : `Busque as especificações técnicas completas do inversor/microinversor solar: Fabricante: ${form.fabricante}, Modelo: ${form.modelo}.
Retorne os dados em JSON com os campos: potencia_kva, potencia_ac_w, tensao_nominal_ac_v (string com range, ex: "220 V (176/224V)"), corrente_max_ac_a, frequencia_operacao_hz, range_frequencia_hz, fator_potencia, corrente_max_dc_a, tensao_min_dc_v, tensao_max_dc_v, num_mppt, entradas_por_mppt, range_temperatura, eficiencia, peso, dimensoes, garantia_anos.
Preencha apenas os campos que encontrar com certeza. Deixe null para os demais.`;

    const response_json_schema = isModulo ? {
      type: "object",
      properties: {
        potencia_wp: { type: "number" },
        vmp: { type: "number" },
        imp: { type: "number" },
        voc: { type: "number" },
        isc: { type: "number" },
        eficiencia_modulo: { type: "number" },
        corrente_max_fusivel_a: { type: "number" },
        coef_temperatura: { type: "string" },
        area_m2: { type: "number" },
        dimensoes: { type: "string" },
        peso: { type: "number" },
        garantia_anos: { type: "number" }
      }
    } : {
      type: "object",
      properties: {
        potencia_kva: { type: "number" },
        potencia_ac_w: { type: "number" },
        tensao_nominal_ac_v: { type: "string" },
        corrente_max_ac_a: { type: "number" },
        frequencia_operacao_hz: { type: "number" },
        range_frequencia_hz: { type: "string" },
        fator_potencia: { type: "number" },
        corrente_max_dc_a: { type: "number" },
        tensao_min_dc_v: { type: "number" },
        tensao_max_dc_v: { type: "number" },
        num_mppt: { type: "number" },
        entradas_por_mppt: { type: "number" },
        range_temperatura: { type: "string" },
        eficiencia: { type: "number" },
        peso: { type: "number" },
        dimensoes: { type: "string" },
        garantia_anos: { type: "number" }
      }
    };

    const resultado = await base44.integrations.Core.InvokeLLM({ prompt, add_context_from_internet: true, response_json_schema });
    if (resultado) {
      setForm(f => {
        const updated = { ...f };
        Object.entries(resultado).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== "" && !f[k]) {
            updated[k] = v;
          }
        });
        return updated;
      });
    }
    setPreenchendoIA(false);
  };

  const handleUploadInmetro = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingInmetro(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, inmetro_url: file_url }));
    setUploadingInmetro(false);
  };

  const handleImportarPlanilha = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tipo: { type: "string" },
                fabricante: { type: "string" },
                modelo: { type: "string" },
                potencia_wp: { type: "number" },
                potencia_kva: { type: "number" },
                eficiencia: { type: "number" },
                garantia_anos: { type: "number" }
              }
            }
          }
        }
      }
    });
    if (result.status === "success" && result.output?.items) {
      const criados = await base44.entities.Produto.bulkCreate(
        result.output.items.map(item => ({ ...item, ativo: true }))
      );
      setProdutos(prev => [...criados, ...prev]);
    }
    setLoading(false);
  };

  const filtered = produtos.filter(p => {
    const matchSearch = !search || p.fabricante?.toLowerCase().includes(search.toLowerCase()) || p.modelo?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filtroTipo === "todos" || p.tipo === filtroTipo;
    return matchSearch && matchTipo;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Biblioteca de Produtos</h1>
          <p className="text-slate-400 text-sm mt-1">{produtos.length} produtos cadastrados</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer">
            <span className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium transition-all">
              <Upload size={15} /> Importar Planilha
            </span>
            <input type="file" className="hidden" accept=".xlsx,.csv" onChange={handleImportarPlanilha} />
          </label>
          <button
            onClick={() => handleAbrir()}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/20"
          >
            <Plus size={15} /> Novo Produto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por fabricante ou modelo..."
            className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[["todos", "Todos"], ...Object.entries(TIPOS)].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFiltroTipo(key)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filtroTipo === key ? "bg-amber-500 text-white" : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-slate-900 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
          <Package size={32} className="text-amber-400/30 mx-auto mb-4" />
          <p className="text-slate-400">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => handleAbrir(p)}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-2xl p-5 text-left transition-all group"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className={`px-2.5 py-1 rounded-lg text-xs font-medium ${TIPO_COLORS[p.tipo] || "bg-slate-700 text-slate-400"}`}>
                  {TIPOS[p.tipo] || p.tipo}
                </div>
                {p.inmetro_url && (
                  <span className="text-xs bg-emerald-400/10 text-emerald-400 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <CheckCircle size={10} /> INMETRO
                  </span>
                )}
              </div>
              <p className="text-white font-semibold text-sm">{p.fabricante}</p>
              <p className="text-slate-400 text-sm">{p.modelo}</p>
              <div className="mt-3 flex gap-3 text-xs text-slate-500">
                {p.potencia_wp && <span>{p.potencia_wp} Wp</span>}
                {p.potencia_kva && <span>{p.potencia_kva} kVA</span>}
                {p.eficiencia && <span>{p.eficiencia}%</span>}
                {p.garantia_anos && <span>{p.garantia_anos} anos</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(false)} />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-white font-bold text-lg">{editando ? "Editar Produto" : "Novo Produto"}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreencherIA}
                  disabled={preenchendoIA || !form.fabricante || !form.modelo}
                  className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                >
                  {preenchendoIA ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {preenchendoIA ? "Buscando..." : "Preencher com IA"}
                </button>
                <button onClick={() => setModal(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Tipo *</label>
                <select value={form.tipo} onChange={e => set("tipo", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                  {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Fabricante *", key: "fabricante" },
                  { label: "Modelo *", key: "modelo" },
                  { label: "Potência (kVA)", key: "potencia_kva", type: "number" },
                  { label: "Eficiência (%)", key: "eficiencia", type: "number" },
                  { label: "Garantia (anos)", key: "garantia_anos", type: "number" },
                  { label: "Dimensões (mm)", key: "dimensoes" },
                  { label: "Peso (kg)", key: "peso", type: "number" },
                ].map(f => (
                  <div key={f.key} className={f.key === "fabricante" || f.key === "modelo" ? "col-span-2" : ""}>
                    <label className="text-slate-400 text-xs mb-1.5 block">{f.label}</label>
                    <input type={f.type || "text"} value={form[f.key] || ""} onChange={e => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                ))}
              </div>

              {/* Campos técnicos de inversores */}
              {["inversor_string", "microinversor", "hibrido"].includes(form.tipo) && (
                <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                  <p className="text-blue-400 text-xs font-semibold">Dados Elétricos AC</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Potência AC (W)", key: "potencia_ac_w", type: "number" },
                      { label: "Tensão Nominal AC (V)", key: "tensao_nominal_ac_v" },
                      { label: "Corrente Máx. AC (A)", key: "corrente_max_ac_a", type: "number" },
                      { label: "Frequência (Hz)", key: "frequencia_operacao_hz", type: "number" },
                      { label: "Range de Frequência", key: "range_frequencia_hz" },
                      { label: "Fator de Potência", key: "fator_potencia", type: "number" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-slate-400 text-xs mb-1.5 block">{f.label}</label>
                        <input type={f.type || "text"} value={form[f.key] || ""} onChange={e => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {["inversor_string", "microinversor", "hibrido"].includes(form.tipo) && (
                <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                  <p className="text-violet-400 text-xs font-semibold">Dados Elétricos DC</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Corrente Máx. DC (A)", key: "corrente_max_dc_a", type: "number" },
                      { label: "Tensão Mín. DC / Start (V)", key: "tensao_min_dc_v", type: "number" },
                      { label: "Tensão Máx. DC (V)", key: "tensao_max_dc_v", type: "number" },
                      { label: "Nº MPPT", key: "num_mppt", type: "number" },
                      { label: "Entradas por MPPT", key: "entradas_por_mppt", type: "number" },
                      { label: "Range de Temperatura", key: "range_temperatura" },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="text-slate-400 text-xs mb-1.5 block">{f.label}</label>
                        <input type={f.type || "text"} value={form[f.key] || ""} onChange={e => set(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* INMETRO (para inversores e micro) */}
              {["inversor_string", "microinversor", "hibrido"].includes(form.tipo) && (
                <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                  <p className="text-amber-400 text-xs font-semibold">Certificado INMETRO</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 text-xs mb-1.5 block">Nº Certificado</label>
                      <input value={form.inmetro_numero || ""} onChange={e => set("inmetro_numero", e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs mb-1.5 block">Validade</label>
                      <input type="date" value={form.inmetro_validade || ""} onChange={e => set("inmetro_validade", e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                    </div>
                  </div>
                  <label className="cursor-pointer">
                    <div className={`border border-dashed rounded-xl p-3 text-center transition-all ${form.inmetro_url ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-600 hover:border-amber-500/40"}`}>
                      {uploadingInmetro ? (
                        <Loader2 size={14} className="animate-spin text-amber-400 mx-auto" />
                      ) : form.inmetro_url ? (
                        <p className="text-emerald-400 text-xs flex items-center justify-center gap-1"><CheckCircle size={12} /> PDF INMETRO enviado</p>
                      ) : (
                        <p className="text-slate-500 text-xs">Upload do certificado INMETRO (PDF)</p>
                      )}
                    </div>
                    <input type="file" className="hidden" accept=".pdf" onChange={handleUploadInmetro} />
                  </label>
                </div>
              )}

              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Observações</label>
                <textarea value={form.observacoes || ""} onChange={e => set("observacoes", e.target.value)} rows={2}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm transition-all">Cancelar</button>
                <button
                  onClick={handleSalvar}
                  disabled={saving || !form.fabricante || !form.modelo}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}