import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Upload, User, FileText, CheckCircle, AlertTriangle, Loader2, ChevronRight, Zap, PartyPopper } from "lucide-react";

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
  });

  const [contaEnergiaFile, setContaEnergiaFile] = useState(null);
  const [docFotoFile, setDocFotoFile] = useState(null);
  const [contaEnergiaUrl, setContaEnergiaUrl] = useState("");
  const [docFotoUrl, setDocFotoUrl] = useState("");
  const [extraido, setExtraido] = useState(null);
  const [cpfMismatch, setCpfMismatch] = useState(false);

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
        setCpfMismatch(cpfLimpo1 !== cpfLimpo2 && cpfLimpo2.length >= 11);
      }
    } finally {
      setExtracting(false);
    }
  };

  const handleSalvar = async () => {
    setSaving(true);
    const preProjeto = await base44.entities.PreProjeto.create({
      ...form,
      conta_energia_url: contaEnergiaUrl,
      documento_foto_url: docFotoUrl,
      dados_extraidos: extraido,
      cpf_extraido: extraido?.cpf_extraido,
      cpf_validado: !cpfMismatch,
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
        fonte_extracao: "conta_energia",
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

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Zap className="text-amber-400" size={22} /> Novo Pré-Projeto
        </h1>
        <p className="text-slate-400 text-sm mt-1">Cadastro rápido de cliente e pré-projeto solar</p>
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-white font-semibold flex items-center gap-2"><User size={16} className="text-amber-400" /> Dados do Cliente</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Nome Completo *", key: "nome_cliente", type: "text", placeholder: "João da Silva" },
              { label: "CPF *", key: "cpf", type: "text", placeholder: "000.000.000-00" },
              { label: "Telefone / WhatsApp", key: "telefone", type: "text", placeholder: "(11) 99999-9999" },
              { label: "E-mail", key: "email", type: "email", placeholder: "joao@email.com" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-slate-400 text-xs font-medium block mb-1.5">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <input
              type="checkbox"
              id="usina"
              checked={form.usina_fechada}
              onChange={e => set("usina_fechada", e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            <label htmlFor="usina" className="text-slate-300 text-sm cursor-pointer">
              <span className="font-semibold text-white">Usina fechada</span> — cliente já aprovou a proposta comercial
            </label>
          </div>
          <button
            onClick={() => setStep(1)}
            disabled={!form.nome_cliente || !form.cpf}
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

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-medium transition-all">Voltar</button>
            <button
              onClick={() => setStep(2)}
              disabled={!contaEnergiaUrl && !docFotoUrl}
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
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-300 font-semibold text-sm">Divergência de CPF detectada!</p>
                    <p className="text-red-400/80 text-xs mt-0.5">CPF digitado: {form.cpf} | CPF no documento: {extraido.cpf_extraido}</p>
                    <p className="text-red-400/80 text-xs mt-1">Revise os dados antes de prosseguir.</p>
                  </div>
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
              onClick={() => setStep(3)}
              disabled={cpfMismatch || !extraido}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              Próximo <ChevronRight size={16} />
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