import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Upload, User, FileText, CheckCircle, AlertTriangle, Loader2, ChevronRight, Zap, PartyPopper, Plus, Trash2 } from "lucide-react";

const STEPS = ["Dados do Cliente", "Upload de Documentos", "Extração & Revisão", "Confirmar"];

export default function NovoPréProjeto() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const [form, setForm] = useState({
    nome_cliente: "",
    cpf: "",
    telefone: "",
    email: "",
    usina_fechada: false,
    potencia_pico_kwp: "",
    kwh_prometidos: "",
    inversor_marca_modelo: "",
    inversor_quantidade: "",
    modulo_marca_modelo: "",
    modulo_quantidade: "",
    tipo_telhado: "",
    modificacao_padrao: false,
    aumento_carga: false,
    usar_transformador: false,
    tipo_instalacao: "simples",
    envio_creditos: false,
    ucs_credito: [],
  });

  const [contaEnergiaFile, setContaEnergiaFile] = useState(null);
  const [docFotoFile, setDocFotoFile] = useState(null);
  const [contaEnergiaUrl, setContaEnergiaUrl] = useState("");
  const [docFotoUrl, setDocFotoUrl] = useState("");
  const [modoManual, setModoManual] = useState(false);
  const [dadosManuais, setDadosManuais] = useState({
    numero_uc: "", titular: "", cpf_extraido: "", endereco: "", cidade: "",
    estado: "", cep: "", tipo_ligacao: "", concessionaria: "EDP"
  });
  const [extraido, setExtraido] = useState(null);
  const [cpfMismatch, setCpfMismatch] = useState(false);
  const [cpfDivergenceOption, setCpfDivergenceOption] = useState(null);
  const [vendedores, setVendedores] = useState([]);

  useEffect(() => {
    base44.entities.Vendedor.filter({ ativo: true }).then(setVendedores).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Upload de arquivo
  const uploadFile = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return file_url;
  };

  const handleUploadConta = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setContaEnergiaFile(file);
    const url = await uploadFile(file);
    setContaEnergiaUrl(url);
  };

  const handleUploadDoc = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocFotoFile(file);
    const url = await uploadFile(file);
    setDocFotoUrl(url);
  };

  const handleExtrair = async () => {
    setExtracting(true);
    try {
      const prompt = `Analise os documentos fornecidos (conta de energia e documento de identidade) e extraia as seguintes informações em JSON:
- numero_uc: número da unidade consumidora / instalação
- titular: nome do titular na conta
- cpf_extraido: CPF encontrado
- endereco: endereço completo da UC
- cidade: cidade
- estado: UF
- cep: CEP
- tipo_ligacao: monofasico/bifasico/trifasico (se identificado)
- concessionaria: nome da concessionária
- classe_consumo: residencial/comercial/industrial (se identificado)
- score_confianca: objeto com score 0-1 para cada campo extraído

Retorne apenas o JSON.`;

      const urls = [contaEnergiaUrl, docFotoUrl].filter(Boolean);
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: urls,
        response_json_schema: {
          type: "object",
          properties: {
            numero_uc: { type: "string" },
            titular: { type: "string" },
            cpf_extraido: { type: "string" },
            endereco: { type: "string" },
            cidade: { type: "string" },
            estado: { type: "string" },
            cep: { type: "string" },
            tipo_ligacao: { type: "string" },
            concessionaria: { type: "string" },
            classe_consumo: { type: "string" },
            score_confianca: { type: "object" }
          }
        }
      });

      setExtraido(resultado);

      // Verificar divergência de CPF
      if (resultado.cpf_extraido && form.cpf) {
        const cpfLimpo1 = form.cpf.replace(/\D/g, "");
        const cpfLimpo2 = resultado.cpf_extraido.replace(/\D/g, "");
        const hasMismatch = cpfLimpo1 !== cpfLimpo2 && cpfLimpo2.length >= 11;
        setCpfMismatch(hasMismatch);
        if (!hasMismatch) setCpfDivergenceOption(null);
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleSalvar = async () => {
    setSaving(true);
    const preProjeto = await base44.entities.PreProjeto.create({
      nome_cliente: form.nome_cliente,
      cpf: form.cpf,
      telefone: form.telefone,
      email: form.email,
      usina_fechada: form.usina_fechada,
      valor_projeto: form.valor_projeto,
      forma_pagamento: form.forma_pagamento,
      potencia_pico_kwp: form.potencia_pico_kwp ? Number(form.potencia_pico_kwp) : null,
      kwh_prometidos: form.kwh_prometidos ? Number(form.kwh_prometidos) : null,
      inversor_marca_modelo: form.inversor_marca_modelo,
      inversor_quantidade: form.inversor_quantidade ? Number(form.inversor_quantidade) : null,
      modulo_marca_modelo: form.modulo_marca_modelo,
      modulo_quantidade: form.modulo_quantidade ? Number(form.modulo_quantidade) : null,
      tipo_telhado: form.tipo_telhado,
      modificacao_padrao: form.modificacao_padrao || false,
      aumento_carga: form.aumento_carga || false,
      usar_transformador: form.usar_transformador || false,
      tipo_instalacao: form.tipo_instalacao,
      envio_creditos: form.envio_creditos || false,
      ucs_credito: form.envio_creditos ? form.ucs_credito : [],
      conta_energia_url: contaEnergiaUrl,
      documento_foto_url: docFotoUrl,
      dados_extraidos: extraido,
      cpf_extraido: extraido?.cpf_extraido,
      cpf_validado: !cpfMismatch,
      cpf_divergence_resolution: cpfMismatch ? cpfDivergenceOption : null,
      original_uc_holder_name: cpfDivergenceOption === "different_holder" ? extraido?.titular : null,
      ownership_change_pending: cpfDivergenceOption === "ownership_change_pending",
      vendedor_id: form.vendedor_id || null,
      vendedor_nome: vendedores.find(v => v.id === form.vendedor_id)?.nome || null,
      status: "aguardando_pagamento"
    });

    // Criar UC
    if (extraido) {
      await base44.entities.UC.create({
        pre_projeto_id: preProjeto.id,
        numero_uc: extraido.numero_uc,
        titular: extraido.titular || form.nome_cliente,
        endereco: extraido.endereco,
        cidade: extraido.cidade,
        estado: extraido.estado,
        cep: extraido.cep,
        tipo_ligacao: extraido.tipo_ligacao,
        concessionaria: extraido.concessionaria || "EDP",
        score_confianca: extraido.score_confianca,
        fonte_extracao: modoManual ? "manual" : "conta_energia",
        situacao_padrao: "a_confirmar"
      });
    }

    setSaving(false);
    setConcluido(true);
  };

  const ScoreIndicator = ({ score }) => {
    if (score === undefined || score === null) return null;
    const pct = Math.round(score * 100);
    const color = pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-amber-400" : "text-red-400";
    return <span className={`text-xs ${color} ml-2`}>{pct}%</span>;
  };

  if (concluido) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto flex items-center justify-center min-h-[60vh]">
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-10 text-center space-y-5 shadow-xl shadow-amber-500/10">
          <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
            <PartyPopper size={40} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Parabéns pela venda! 🎉</h2>
            <p className="text-slate-300 text-base">O cliente <span className="text-amber-400 font-semibold">{form.nome_cliente}</span> foi cadastrado com sucesso.</p>
            <p className="text-slate-400 text-sm mt-2">O projeto está aguardando confirmação de pagamento pelo financeiro.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => navigate(createPageUrl("Projetos"))}
              className="bg-amber-500 hover:bg-amber-400 text-white font-semibold px-6 py-3 rounded-xl transition-all"
            >
              Ver Projetos
            </button>
            <button
              onClick={() => { setConcluido(false); setStep(0); setForm({ nome_cliente: "", cpf: "", telefone: "", email: "", usina_fechada: false }); setContaEnergiaUrl(""); setDocFotoUrl(""); setExtraido(null); }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-6 py-3 rounded-xl transition-all"
            >
              Cadastrar outro cliente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Zap className="text-amber-400" size={22} /> Novo Cliente
        </h1>
        <p className="text-slate-400 text-sm mt-1">Cadastro de novo cliente solar</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-2 ${i <= step ? "text-amber-400" : "text-slate-600"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${i < step ? "bg-amber-500 border-amber-500 text-white" : i === step ? "border-amber-500 text-amber-400" : "border-slate-700 text-slate-600"}`}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span className={`hidden md:block text-xs font-medium ${i === step ? "text-amber-400" : i < step ? "text-slate-300" : "text-slate-600"}`}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-amber-500" : "bg-slate-800"}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Dados */}
      {step === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h2 className="text-white font-semibold flex items-center gap-2"><User size={16} className="text-amber-400" /> Dados do Cliente</h2>

          {/* Cliente */}
          <div className="space-y-3">
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Identificação</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: "Nome Completo (contrato) *", key: "nome_cliente", placeholder: "João da Silva" },
                { label: "CPF *", key: "cpf", placeholder: "000.000.000-00" },
                { label: "Telefone / WhatsApp *", key: "telefone", placeholder: "(11) 99999-9999" },
                { label: "E-mail", key: "email", type: "email", placeholder: "joao@email.com" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-slate-400 text-xs font-medium block mb-1.5">{f.label}</label>
                  <input type={f.type || "text"} value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors" />
                </div>
              ))}
            </div>
          </div>

          {/* Comercial */}
          <div className="space-y-3">
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Comercial</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Valor do Projeto (R$) *</label>
                <input value={form.valor_projeto || ""} onChange={e => set("valor_projeto", e.target.value)} placeholder="R$ 25.000,00"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Forma de Pagamento *</label>
                <select value={form.forma_pagamento || ""} onChange={e => set("forma_pagamento", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors">
                  <option value="">Selecionar...</option>
                  <option value="a_vista">À Vista</option>
                  <option value="financiamento">Financiamento</option>
                  <option value="consorcio">Consórcio</option>
                  <option value="parcelado_cartao">Parcelado no Cartão</option>
                  <option value="boleto_parcelado">Boleto Parcelado</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Vendedor Responsável</label>
                <select value={form.vendedor_id || ""} onChange={e => set("vendedor_id", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors">
                  <option value="">Selecionar vendedor...</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Sistema */}
          <div className="space-y-3">
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Sistema Fotovoltaico</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Potência de Pico (kWp) *</label>
                <input type="number" value={form.potencia_pico_kwp || ""} onChange={e => set("potencia_pico_kwp", e.target.value)} placeholder="ex: 5.5"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">kWh prometidos na venda *</label>
                <input type="number" value={form.kwh_prometidos || ""} onChange={e => set("kwh_prometidos", e.target.value)} placeholder="ex: 600"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Marca e Modelo do Inversor *</label>
                <input value={form.inversor_marca_modelo || ""} onChange={e => set("inversor_marca_modelo", e.target.value)} placeholder="ex: Growatt MIN 5000TL-X"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Quantidade de Inversores *</label>
                <input type="number" value={form.inversor_quantidade || ""} onChange={e => set("inversor_quantidade", e.target.value)} placeholder="ex: 1"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Marca e Modelo dos Módulos *</label>
                <input value={form.modulo_marca_modelo || ""} onChange={e => set("modulo_marca_modelo", e.target.value)} placeholder="ex: Canadian Solar CS6R-405MS"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Quantidade de Módulos *</label>
                <input type="number" value={form.modulo_quantidade || ""} onChange={e => set("modulo_quantidade", e.target.value)} placeholder="ex: 12"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Tipo de Telhado *</label>
                <select value={form.tipo_telhado || ""} onChange={e => set("tipo_telhado", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors">
                  <option value="">Selecionar...</option>
                  <option value="ceramica">Cerâmica</option>
                  <option value="fibrocimento">Fibrocimento</option>
                  <option value="metalico">Metálico</option>
                  <option value="laje">Laje</option>
                  <option value="sanduiche">Sanduíche</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">Tipo de Instalação *</label>
                <select value={form.tipo_instalacao || "simples"} onChange={e => set("tipo_instalacao", e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 transition-colors">
                  <option value="simples">Simples</option>
                  <option value="agrupamento">Agrupamento de UCs</option>
                </select>
              </div>
            </div>
          </div>

          {/* Infraestrutura */}
          <div className="space-y-3">
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Infraestrutura Elétrica</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "Modificação de padrão?", key: "modificacao_padrao" },
                { label: "Aumento de carga?", key: "aumento_carga" },
                { label: "Vai usar transformador?", key: "usar_transformador" },
              ].map(f => (
                <label key={f.key} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 cursor-pointer hover:border-amber-500/40 transition-colors">
                  <input type="checkbox" checked={form[f.key] || false} onChange={e => set(f.key, e.target.checked)} className="w-4 h-4 accent-amber-500" />
                  <span className="text-slate-300 text-sm">{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Envio de créditos */}
          <div className="space-y-3">
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide">Envio de Créditos</p>
            <label className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 cursor-pointer hover:border-amber-500/40 transition-colors">
              <input type="checkbox" checked={form.envio_creditos || false} onChange={e => set("envio_creditos", e.target.checked)} className="w-4 h-4 accent-amber-500" />
              <span className="text-slate-300 text-sm">Haverá envio de crédito após a instalação?</span>
            </label>

            {form.envio_creditos && (
              <div className="space-y-2">
                <p className="text-slate-400 text-xs">Informe as UCs receptoras e o percentual a ser enviado para cada uma:</p>
                {(form.ucs_credito || []).map((uc, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input value={uc.numero_uc || ""} onChange={e => { const arr = [...form.ucs_credito]; arr[i] = { ...arr[i], numero_uc: e.target.value }; set("ucs_credito", arr); }} placeholder="Número UC receptora"
                      className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                    <input type="number" value={uc.percentual || ""} onChange={e => { const arr = [...form.ucs_credito]; arr[i] = { ...arr[i], percentual: Number(e.target.value) }; set("ucs_credito", arr); }} placeholder="% envio"
                      className="w-24 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                    <button onClick={() => set("ucs_credito", form.ucs_credito.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300 p-1.5"><Trash2 size={14} /></button>
                  </div>
                ))}
                <button onClick={() => set("ucs_credito", [...(form.ucs_credito || []), { numero_uc: "", percentual: "" }])}
                  className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors">
                  <Plus size={13} /> Adicionar UC receptora
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <input type="checkbox" id="usina" checked={form.usina_fechada} onChange={e => set("usina_fechada", e.target.checked)} className="w-4 h-4 accent-amber-500" />
            <label htmlFor="usina" className="text-slate-300 text-sm cursor-pointer">
              <span className="font-semibold text-white">Usina fechada</span> — cliente já aprovou a proposta comercial
            </label>
          </div>

          <button
            onClick={() => setStep(1)}
            disabled={!form.nome_cliente || !form.cpf || !form.telefone || !form.valor_projeto || !form.forma_pagamento || !form.potencia_pico_kwp || !form.kwh_prometidos || !form.inversor_marca_modelo || !form.modulo_marca_modelo || !form.tipo_telhado}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            Próximo <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-white font-semibold flex items-center gap-2"><Upload size={16} className="text-amber-400" /> Upload de Documentos</h2>
          
          {/* Toggle manual/automático */}
          <div className="flex gap-2">
            <button onClick={() => setModoManual(false)} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${!modoManual ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
              Upload automático (IA)
            </button>
            <button onClick={() => setModoManual(true)} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${modoManual ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
              Digitar manualmente
            </button>
          </div>

          {modoManual ? (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm">Preencha os dados da UC e do titular manualmente.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { label: "Número UC / Instalação *", key: "numero_uc" },
                  { label: "Nome do Titular (Conta)", key: "titular" },
                  { label: "CPF do Titular", key: "cpf_extraido" },
                  { label: "Concessionária", key: "concessionaria" },
                  { label: "Endereço completo", key: "endereco", full: true },
                  { label: "Cidade", key: "cidade" },
                  { label: "UF", key: "estado" },
                  { label: "CEP", key: "cep" },
                ].map(f => (
                  <div key={f.key} className={f.full ? "col-span-2" : ""}>
                    <label className="text-slate-400 text-xs mb-1.5 block">{f.label}</label>
                    <input value={dadosManuais[f.key] || ""} onChange={e => setDadosManuais(d => ({ ...d, [f.key]: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="text-slate-400 text-xs mb-1.5 block">Tipo de Ligação</label>
                  <select value={dadosManuais.tipo_ligacao || ""} onChange={e => setDadosManuais(d => ({ ...d, tipo_ligacao: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                    <option value="">Selecionar...</option>
                    <option value="monofasico">Monofásico</option>
                    <option value="bifasico">Bifásico</option>
                    <option value="trifasico">Trifásico</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <>
              <p className="text-slate-400 text-sm">Os documentos serão processados para extração automática de dados.</p>
              {[
                { label: "Conta de Energia (EDP) *", sub: "PDF ou foto. Usado para extrair UC, endereço e tipo de ligação.", handler: handleUploadConta, url: contaEnergiaUrl, icon: FileText },
                { label: "Documento com Foto (CNH/RG) *", sub: "Para validação de identidade e CPF.", handler: handleUploadDoc, url: docFotoUrl, icon: User },
              ].map((item) => (
                <div key={item.label} className="border border-slate-700 rounded-xl p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 bg-amber-500/10 rounded-lg flex items-center justify-center shrink-0">
                      <item.icon size={16} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{item.label}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{item.sub}</p>
                    </div>
                    {item.url && <CheckCircle size={16} className="text-emerald-400 ml-auto shrink-0" />}
                  </div>
                  <label className="cursor-pointer">
                    <div className="border border-dashed border-slate-600 hover:border-amber-500/50 rounded-lg p-3 text-center transition-colors">
                      <p className="text-slate-400 text-xs">{item.url ? "✓ Arquivo enviado — clique para substituir" : "Clique para selecionar arquivo"}</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={item.handler} />
                  </label>
                </div>
              ))}
            </>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-medium transition-all">Voltar</button>
            <button
              onClick={() => {
                if (modoManual) { setExtraido({ ...dadosManuais }); setCpfMismatch(false); setStep(3); }
                else { setStep(2); }
              }}
              disabled={modoManual ? !dadosManuais.numero_uc : (!contaEnergiaUrl && !docFotoUrl)}
              className="flex-2 flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              Próximo <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Extração */}
      {step === 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-white font-semibold flex items-center gap-2"><Zap size={16} className="text-amber-400" /> Extração Automática de Dados</h2>

          {!extraido && !extracting && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap size={28} className="text-amber-400" />
              </div>
              <p className="text-white font-semibold mb-2">Extrair dados automaticamente</p>
              <p className="text-slate-400 text-sm mb-6">O sistema irá analisar os documentos e preencher os dados da UC</p>
              <button
                onClick={handleExtrair}
                className="bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3 rounded-xl transition-all inline-flex items-center gap-2"
              >
                <Zap size={16} /> Extrair Dados
              </button>
            </div>
          )}

          {extracting && (
            <div className="text-center py-8">
              <Loader2 size={36} className="text-amber-400 animate-spin mx-auto mb-4" />
              <p className="text-white font-semibold">Analisando documentos...</p>
              <p className="text-slate-400 text-sm mt-1">Isso pode levar alguns segundos</p>
            </div>
          )}

          {extraido && (
            <div className="space-y-4">
              {cpfMismatch && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-300 font-semibold text-sm">Divergência de CPF detectada!</p>
                      <p className="text-red-400/80 text-xs mt-0.5">CPF do cliente: <strong>{form.cpf}</strong> | CPF na conta de energia: <strong>{extraido.cpf_extraido}</strong></p>
                    </div>
                  </div>

                  <p className="text-slate-300 text-sm font-medium">O projeto ficará em nome de uma pessoa diferente do cliente cadastrado?</p>

                  <div className="space-y-2">
                    {/* Opção 1 */}
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cpfDivergenceOption === "different_holder" ? "border-amber-500 bg-amber-500/10" : "border-slate-700 hover:border-slate-500"}`}>
                      <input type="radio" name="cpf_divergence" value="different_holder" checked={cpfDivergenceOption === "different_holder"} onChange={() => setCpfDivergenceOption("different_holder")} className="mt-0.5 accent-amber-500" />
                      <div>
                        <p className="text-white text-sm font-medium">Sim — titular da conta é uma pessoa diferente</p>
                        <p className="text-slate-400 text-xs mt-0.5">O projeto envolverá duas pessoas: o decisor (cliente cadastrado) e o titular da conta de energia <strong className="text-slate-300">({extraido?.titular || "—"})</strong>.</p>
                      </div>
                    </label>

                    {/* Opção 2 */}
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cpfDivergenceOption === "ownership_change_pending" ? "border-amber-500 bg-amber-500/10" : "border-slate-700 hover:border-slate-500"}`}>
                      <input type="radio" name="cpf_divergence" value="ownership_change_pending" checked={cpfDivergenceOption === "ownership_change_pending"} onChange={() => setCpfDivergenceOption("ownership_change_pending")} className="mt-0.5 accent-amber-500" />
                      <div>
                        <p className="text-white text-sm font-medium">O cliente fará a mudança de titularidade</p>
                        <p className="text-slate-400 text-xs mt-0.5">O cadastro será liberado, porém uma pendência de <strong className="text-amber-400">mudança de titularidade</strong> será registrada no projeto.</p>
                      </div>
                    </label>

                    {/* Opção 3 */}
                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${cpfDivergenceOption === "go_back_correct" ? "border-slate-500 bg-slate-700/50" : "border-slate-700 hover:border-slate-500"}`}>
                      <input type="radio" name="cpf_divergence" value="go_back_correct" checked={cpfDivergenceOption === "go_back_correct"} onChange={() => setCpfDivergenceOption("go_back_correct")} className="mt-0.5 accent-amber-500" />
                      <div>
                        <p className="text-white text-sm font-medium">Não — corrigir o CPF do cliente</p>
                        <p className="text-slate-400 text-xs mt-0.5">Volte ao passo 1 para corrigir o CPF cadastrado.</p>
                      </div>
                    </label>
                  </div>

                  {cpfDivergenceOption === "ownership_change_pending" && (
                    <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 mt-2">
                      <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-amber-300 text-xs">⚠️ Atenção: o projeto terá uma pendência de mudança de titularidade da conta de energia. Isso precisará ser resolvido antes do protocolo na EDP.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { label: "Número UC / Instalação", key: "numero_uc" },
                  { label: "Titular (Conta)", key: "titular" },
                  { label: "Concessionária", key: "concessionaria" },
                  { label: "Tipo de Ligação", key: "tipo_ligacao" },
                  { label: "Endereço UC", key: "endereco" },
                  { label: "Cidade / UF", key: "cidade" },
                ].map(f => (
                  <div key={f.key} className="bg-slate-800 rounded-xl p-3">
                    <p className="text-slate-400 text-xs mb-1 flex items-center">
                      {f.label}
                      <ScoreIndicator score={extraido.score_confianca?.[f.key]} />
                    </p>
                    <input
                      className="w-full bg-transparent text-white text-sm focus:outline-none"
                      value={extraido[f.key] || ""}
                      onChange={e => setExtraido(prev => ({ ...prev, [f.key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>

              <button onClick={handleExtrair} className="text-amber-400 hover:text-amber-300 text-xs underline">
                Reextrair dados
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-medium transition-all">Voltar</button>
            <button
              onClick={() => {
                if (cpfDivergenceOption === "go_back_correct") { setStep(0); return; }
                setStep(3);
              }}
              disabled={!extraido || (cpfMismatch && (!cpfDivergenceOption || cpfDivergenceOption === "go_back_correct"))}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {cpfDivergenceOption === "go_back_correct" ? "Voltar e corrigir CPF" : <>Próximo <ChevronRight size={16} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmar */}
      {step === 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-white font-semibold flex items-center gap-2"><CheckCircle size={16} className="text-amber-400" /> Confirmar Pré-Projeto</h2>

          <div className="space-y-3">
            <div className="bg-slate-800 rounded-xl p-4 space-y-2">
              <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">Cliente</p>
              <p className="text-white font-semibold">{form.nome_cliente}</p>
              <p className="text-slate-400 text-sm">CPF: {form.cpf}</p>
              {form.telefone && <p className="text-slate-400 text-sm">Tel: {form.telefone}</p>}
            </div>
            {extraido && (
              <div className="bg-slate-800 rounded-xl p-4 space-y-2">
                <p className="text-slate-400 text-xs uppercase tracking-wide font-medium">Unidade Consumidora</p>
                <p className="text-white font-semibold">UC: {extraido.numero_uc || "—"}</p>
                <p className="text-slate-400 text-sm">{extraido.endereco || "Endereço não extraído"}</p>
                <p className="text-slate-400 text-sm">Ligação: {extraido.tipo_ligacao || "—"} | {extraido.concessionaria || "EDP"}</p>
              </div>
            )}
            {cpfDivergenceOption === "different_holder" && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-2">
                <AlertTriangle size={14} className="text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-blue-300 text-sm font-medium">Projeto com 2 pessoas envolvidas</p>
                  <p className="text-slate-400 text-xs mt-1">Decisor: <strong className="text-white">{form.nome_cliente}</strong> (CPF: {form.cpf})</p>
                  <p className="text-slate-400 text-xs">Titular da conta: <strong className="text-white">{extraido?.titular || "—"}</strong></p>
                </div>
              </div>
            )}
            {cpfDivergenceOption === "ownership_change_pending" && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-2">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 text-sm font-medium">⚠️ Pendência: Mudança de Titularidade</p>
                  <p className="text-slate-400 text-xs mt-1">O cliente se comprometeu a efetuar a mudança de titularidade da conta de energia. Isso deverá ser resolvido antes do protocolo na EDP.</p>
                </div>
              </div>
            )}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
              <p className="text-amber-300 text-sm font-medium">Status inicial: <span className="text-white">Aguardando Pagamento</span></p>
              <p className="text-slate-400 text-xs mt-1">O projeto será iniciado após confirmação do pagamento pelo financeiro.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-medium transition-all">Voltar</button>
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {saving ? "Salvando..." : "Criar Pré-Projeto"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}