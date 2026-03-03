import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StatusTimeline from "../components/projeto/StatusTimeline";
import DossieChecklist from "../components/projeto/DossieChecklist";
import ProtocoloCard from "../components/projeto/ProtocoloCard";
import {
  ChevronLeft, Sun, MapPin, Zap, FileText, Camera, Package,
  Settings, Eye, EyeOff, CheckCircle, AlertTriangle, Loader2,
  Upload, Plus, Clock
} from "lucide-react";

const TABS = ["Resumo", "UC & Técnico", "Documentos", "Visita", "Protocolos", "Monitoramento"];

const STATUS_FLOW = [
  "pago_projeto_iniciado","kit_confirmado","documentos_gerados","assinaturas_pendentes",
  "assinaturas_concluidas","dossie_ok","protocolado_edp","aguardando_aprovacao","aprovado",
  "instalacao_agendada","sistema_instalado","vistoria_solicitada","aguardando_vistoria",
  "vistoria_aprovada","monitoramento_cadastrado","concluido"
];

const STATUS_LABELS = {
  pago_projeto_iniciado: "Projeto Iniciado", kit_confirmado: "Kit Confirmado",
  documentos_gerados: "Docs Gerados", assinaturas_pendentes: "Assinaturas Pend.",
  assinaturas_concluidas: "Assinaturas OK", dossie_ok: "Dossiê OK",
  protocolado_edp: "Protocolado EDP", aguardando_aprovacao: "Aguard. Aprovação",
  aprovado: "Aprovado", instalacao_agendada: "Instal. Agendada",
  sistema_instalado: "Instalado", vistoria_solicitada: "Vistoria Solic.",
  aguardando_vistoria: "Aguard. Vistoria", vistoria_aprovada: "Vistoria Aprovada",
  monitoramento_cadastrado: "Monitoramento OK", concluido: "Concluído"
};

export default function ProjetoDetalhe() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  const [projeto, setProjeto] = useState(null);
  const [uc, setUC] = useState(null);
  const [preProjeto, setPreProjeto] = useState(null);
  const [resumoTec, setResumoTec] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [protocolos, setProtocolos] = useState([]);
  const [visita, setVisita] = useState(null);
  const [tab, setTab] = useState("Resumo");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      base44.entities.Projeto.filter({ id }),
      base44.entities.UC.filter({ projeto_id: id }),
      base44.entities.ResumoTecnico.filter({ projeto_id: id }),
      base44.entities.Documento.filter({ projeto_id: id }),
      base44.entities.Protocolo.filter({ projeto_id: id }),
      base44.entities.VisitaTecnica.filter({ projeto_id: id }),
      base44.auth.me()
    ]).then(async ([p, ucs, rt, docs, prots, vis, u]) => {
      const proj = p[0] || null;
      setProjeto(proj);
      setUC(ucs[0] || null);
      setResumoTec(rt[0] || null);
      setDocumentos(docs);
      setProtocolos(prots);
      setVisita(vis[0] || null);
      setUser(u);
      // Buscar pré-projeto para pré-preencher dados da UC
      if (proj?.pre_projeto_id) {
        const pps = await base44.entities.PreProjeto.filter({ id: proj.pre_projeto_id });
        setPreProjeto(pps[0] || null);
      }
      setLoading(false);
    });
  }, [id]);

  const updateProjeto = async (data) => {
    const updated = await base44.entities.Projeto.update(id, data);
    setProjeto(updated);
  };

  const avancarStatus = async () => {
    const idx = STATUS_FLOW.indexOf(projeto.status);
    if (idx < STATUS_FLOW.length - 1) {
      const novoStatus = STATUS_FLOW[idx + 1];
      const timeline = [...(projeto.timeline_eventos || []), {
        tipo: "status_alterado",
        de: projeto.status,
        para: novoStatus,
        data: new Date().toISOString(),
        usuario: user?.email
      }];
      await updateProjeto({ status: novoStatus, timeline_eventos: timeline });
    }
  };

  const saveUC = async (data) => {
    if (uc?.id) {
      const updated = await base44.entities.UC.update(uc.id, data);
      setUC(updated);
    } else {
      const novo = await base44.entities.UC.create({ projeto_id: id, ...data });
      setUC(novo);
    }
  };

  const saveResumo = async (data) => {
    if (resumoTec?.id) {
      const updated = await base44.entities.ResumoTecnico.update(resumoTec.id, data);
      setResumoTec(updated);
    } else {
      const novo = await base44.entities.ResumoTecnico.create({ projeto_id: id, ...data });
      setResumoTec(novo);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="text-amber-400 animate-spin" size={32} />
    </div>
  );

  if (!projeto) return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-slate-400">Projeto não encontrado</p>
      <Link to={createPageUrl("Projetos")} className="text-amber-400 hover:underline">← Voltar</Link>
    </div>
  );

  const canEdit = user?.role === "admin" || user?.role === "engenharia";
  const canEditFinancial = user?.role === "admin" || user?.role === "financeiro";
  const canSeePassword = user?.role === "admin";

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Link to={createPageUrl("Projetos")} className="text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-lg truncate">{projeto.nome_cliente}</h1>
            <p className="text-slate-400 text-xs">CPF: {projeto.cpf}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              {STATUS_LABELS[projeto.status] || projeto.status}
            </span>
            {(user?.role === "admin" || user?.role === "engenharia") && (
              <button
                onClick={avancarStatus}
                disabled={projeto.status === "concluido"}
                className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
              >
                <Zap size={12} /> Próxima etapa
              </button>
            )}
          </div>
        </div>
        <StatusTimeline status={projeto.status} />
      </div>

      {/* Tabs */}
      <div className="bg-slate-900 border-b border-slate-800 px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 ${tab === t ? "text-amber-400 border-amber-500" : "text-slate-400 border-transparent hover:text-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">

          {/* TAB: RESUMO */}
          {tab === "Resumo" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {/* Info básica */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Sun size={16} className="text-amber-400" /> Dados do Projeto</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Cliente</p>
                      <p className="text-white text-sm font-medium">{projeto.nome_cliente}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">CPF</p>
                      <p className="text-white text-sm">{projeto.cpf}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Telefone</p>
                      <p className="text-white text-sm">{projeto.telefone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">UC Geradora</p>
                      <p className="text-white text-sm">{projeto.uc_geradora || uc?.numero_uc || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Data Pagamento</p>
                      <p className="text-white text-sm">{projeto.data_pagamento || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Envio de Créditos</p>
                      <span className={`text-xs px-2 py-1 rounded-lg ${projeto.envio_creditos ? "bg-amber-400/10 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
                        {projeto.envio_creditos ? "Sim" : "Não"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                {projeto.timeline_eventos?.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Clock size={16} className="text-amber-400" /> Histórico</h3>
                    <div className="space-y-2">
                      {[...projeto.timeline_eventos].reverse().map((ev, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 shrink-0" />
                          <div>
                            <p className="text-slate-300">{ev.tipo === "status_alterado" ? `Status: ${ev.de} → ${ev.para}` : ev.tipo}</p>
                            <p className="text-slate-500 text-xs">{ev.data ? new Date(ev.data).toLocaleString("pt-BR") : ""} · {ev.usuario}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                <DossieChecklist documentos={documentos} envioCreditos={projeto.envio_creditos} />
                <ProtocoloCard projetoId={id} protocolos={protocolos} onUpdate={p => setProtocolos(prev => [...prev, p])} />
              </div>
            </div>
          )}

          {/* TAB: UC & TÉCNICO */}
          {tab === "UC & Técnico" && (
            <UCTecnicoTab uc={uc} resumoTec={resumoTec} saveUC={saveUC} saveResumo={saveResumo} canEdit={canEdit} preProjeto={preProjeto} />
          )}

          {/* TAB: DOCUMENTOS */}
          {tab === "Documentos" && (
            <DocumentosTab projetoId={id} documentos={documentos} setDocumentos={setDocumentos} canEdit={canEdit} />
          )}

          {/* TAB: VISITA */}
          {tab === "Visita" && (
            <VisitaTab projetoId={id} visita={visita} setVisita={setVisita} canEdit={canEdit} />
          )}

          {/* TAB: PROTOCOLOS */}
          {tab === "Protocolos" && (
            <div className="max-w-2xl">
              <ProtocoloCard projetoId={id} protocolos={protocolos} onUpdate={p => setProtocolos(prev => [...prev, p])} />
            </div>
          )}

          {/* TAB: MONITORAMENTO */}
          {tab === "Monitoramento" && (
            <MonitoramentoTab projeto={projeto} updateProjeto={updateProjeto} canSeePassword={canSeePassword} user={user} senhaVisivel={senhaVisivel} setSenhaVisivel={setSenhaVisivel} />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Sub-componentes inline para cada aba ----

function UCTecnicoTab({ uc, resumoTec, saveUC, saveResumo, canEdit, preProjeto }) {
  const [produtos, setProdutos] = useState([]);

  useEffect(() => {
    base44.entities.Produto.filter({ ativo: true }).then(setProdutos).catch(() => {});
  }, []);
  // Pré-preencher com dados extraídos do pré-projeto se UC ainda não tiver dados
  const dadosIniciais = () => {
    if (uc && Object.keys(uc).length > 1) return uc;
    const de = preProjeto?.dados_extraidos || {};
    return {
      numero_uc: uc?.numero_uc || de.numero_uc || "",
      titular: uc?.titular || de.titular || preProjeto?.nome_cliente || "",
      concessionaria: uc?.concessionaria || de.concessionaria || "EDP",
      endereco: uc?.endereco || de.endereco || "",
      cidade: uc?.cidade || de.cidade || "",
      estado: uc?.estado || de.estado || "",
      cep: uc?.cep || de.cep || "",
      tipo_ligacao: uc?.tipo_ligacao || de.tipo_ligacao || "",
      situacao_padrao: uc?.situacao_padrao || "",
      ...(uc || {})
    };
  };

  const [ucForm, setUcForm] = useState(dadosIniciais);
  const [rtForm, setRtForm] = useState(resumoTec || {});
  const [saving, setSaving] = useState(false);

  const handleSaveUC = async () => {
    setSaving(true);
    await saveUC(ucForm);
    setSaving(false);
  };
  const handleSaveRT = async () => {
    setSaving(true);
    await saveResumo(rtForm);
    setSaving(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* UC */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2"><MapPin size={16} className="text-amber-400" /> Unidade Consumidora</h3>
        {[
          { label: "Número UC / Instalação", key: "numero_uc" },
          { label: "Titular na Conta", key: "titular" },
          { label: "Concessionária", key: "concessionaria" },
          { label: "Endereço", key: "endereco" },
          { label: "Cidade", key: "cidade" },
          { label: "Estado (UF)", key: "estado" },
          { label: "CEP", key: "cep" },
        ].map(f => (
          <div key={f.key}>
            <label className="text-slate-400 text-xs mb-1.5 block">{f.label}</label>
            <input
              value={ucForm[f.key] || ""}
              onChange={e => setUcForm(p => ({ ...p, [f.key]: e.target.value }))}
              disabled={!canEdit}
              className="w-full bg-slate-800 border border-slate-700 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        ))}
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Tipo de Ligação</label>
          <select
            value={ucForm.tipo_ligacao || ""}
            onChange={e => setUcForm(p => ({ ...p, tipo_ligacao: e.target.value }))}
            disabled={!canEdit}
            className="w-full bg-slate-800 border border-slate-700 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">Selecionar...</option>
            <option value="monofasico">Monofásico</option>
            <option value="bifasico">Bifásico</option>
            <option value="trifasico">Trifásico</option>
          </select>
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Situação do Padrão *</label>
          <select
            value={ucForm.situacao_padrao || ""}
            onChange={e => setUcForm(p => ({ ...p, situacao_padrao: e.target.value }))}
            disabled={!canEdit}
            className="w-full bg-slate-800 border border-slate-700 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="">Selecionar...</option>
            <option value="adequado">Adequado</option>
            <option value="precisa_aumento_carga">Precisa aumento de carga</option>
            <option value="a_confirmar">A confirmar (vistoria necessária)</option>
          </select>
          {ucForm.situacao_padrao === "precisa_aumento_carga" && (
            <div className="mt-2 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-amber-300 text-xs">Pendência criada: adequação de padrão necessária antes de protocolar.</p>
            </div>
          )}
        </div>
        {canEdit && (
          <button onClick={handleSaveUC} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Salvar UC
          </button>
        )}
      </div>

      {/* Resumo Técnico */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-white font-semibold flex items-center gap-2"><Zap size={16} className="text-amber-400" /> Resumo Técnico</h3>
        {[
          { label: "Potência (kWp)", key: "potencia_kwp", type: "number" },
          { label: "Qtd. Módulos", key: "quantidade_modulos", type: "number" },
          { label: "Potência (kWp)", key: "potencia_kwp", type: "number" },
          { label: "Qtd. Módulos", key: "quantidade_modulos", type: "number" },
          { label: "Nº de Strings", key: "num_strings", type: "number" },
          { label: "Módulos por String", key: "modulos_por_string", type: "number" },
          { label: "ART Nº", key: "art_numero" },
          { label: "Responsável Técnico", key: "responsavel_tecnico" },
          { label: "CREA", key: "crea_responsavel" },
        ].map(f => (
          <div key={f.key}>
            <label className="text-slate-400 text-xs mb-1.5 block">{f.label}</label>
            <input
              type={f.type || "text"}
              value={rtForm[f.key] || ""}
              onChange={e => setRtForm(p => ({ ...p, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
              disabled={!canEdit}
              className="w-full bg-slate-800 border border-slate-700 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
          </div>
        ))}
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Observações Técnicas</label>
          <textarea
            value={rtForm.observacoes_tecnicas || ""}
            onChange={e => setRtForm(p => ({ ...p, observacoes_tecnicas: e.target.value }))}
            disabled={!canEdit}
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>
        {canEdit && (
          <button onClick={handleSaveRT} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Salvar Técnico
          </button>
        )}
      </div>
    </div>
  );
}

function DocumentosTab({ projetoId, documentos, setDocumentos, canEdit }) {
  const [uploading, setUploading] = useState(null);
  const [gerando, setGerando] = useState(null);

  const TIPOS = [
    { key: "procuracao", label: "Procuração", gerarivel: true },
    { key: "memorial_tecnico", label: "Memorial Técnico", gerarivel: true },
    { key: "solicitacao_art", label: "Solicitação ART", gerarivel: true },
    { key: "formulario_creditos", label: "Form. Envio de Créditos", gerarivel: false },
    { key: "art", label: "ART", gerarivel: false },
    { key: "inmetro", label: "Certificado INMETRO", gerarivel: false },
    { key: "outros_anexos", label: "Outros Anexos", gerarivel: false },
  ];

  const getDoc = (tipo) => documentos.find(d => d.tipo === tipo);

  const handleGerar = async (tipo) => {
    setGerando(tipo);
    const response = await base44.functions.invoke('gerarDocumento', { tipo, projeto_id: projetoId });
    const { html } = response.data;

    // Abrir HTML em nova aba para visualizar/imprimir
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');

    // Salvar como gerado
    const existing = getDoc(tipo);
    if (existing) {
      const updated = await base44.entities.Documento.update(existing.id, { status: "gerado" });
      setDocumentos(prev => prev.map(d => d.id === existing.id ? updated : d));
    } else {
      const TIPOS_LABELS = { procuracao: "Procuração", memorial_tecnico: "Memorial Técnico", solicitacao_art: "Solicitação ART" };
      const novo = await base44.entities.Documento.create({
        projeto_id: projetoId, tipo,
        status: "gerado",
        titulo: TIPOS_LABELS[tipo] || tipo
      });
      setDocumentos(prev => [...prev, novo]);
    }
    setGerando(null);
  };

  const handleUpload = async (tipo, file, signed = false) => {
    setUploading(tipo);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const existing = getDoc(tipo);
    if (existing) {
      const updated = await base44.entities.Documento.update(existing.id, {
        ...(signed ? { url_assinado: file_url, status: "assinado", data_assinatura: new Date().toISOString() } : { url_gerado: file_url, status: "gerado" })
      });
      setDocumentos(prev => prev.map(d => d.id === existing.id ? updated : d));
    } else {
      const novo = await base44.entities.Documento.create({
        projeto_id: projetoId, tipo,
        url_gerado: signed ? undefined : file_url,
        url_assinado: signed ? file_url : undefined,
        status: signed ? "assinado" : "gerado",
        titulo: TIPOS.find(t => t.key === tipo)?.label
      });
      setDocumentos(prev => [...prev, novo]);
    }
    setUploading(null);
  };

  return (
    <div className="space-y-4 max-w-3xl">
      {TIPOS.map(tipo => {
        const doc = getDoc(tipo.key);
        return (
          <div key={tipo.key} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
                <FileText size={16} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-medium text-sm">{tipo.label}</p>
                  {doc && (
                    <span className={`text-xs px-2.5 py-1 rounded-lg border ${doc.status === "assinado" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : doc.status === "gerado" ? "bg-blue-400/10 text-blue-400 border-blue-400/20" : "bg-slate-700 text-slate-400 border-slate-600"}`}>
                      {doc.status === "assinado" ? "Assinado" : doc.status === "gerado" ? "Gerado" : doc.status}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {tipo.gerarivel && canEdit && (
                    <button
                      onClick={() => handleGerar(tipo.key)}
                      disabled={gerando === tipo.key}
                      className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                    >
                      {gerando === tipo.key ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      Gerar documento
                    </button>
                  )}
                  {doc?.url_gerado && (
                    <a href={doc.url_gerado} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                      <FileText size={12} /> Ver original
                    </a>
                  )}
                  {doc?.url_assinado && (
                    <a href={doc.url_assinado} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                      <CheckCircle size={12} /> Ver assinado
                    </a>
                  )}
                  {canEdit && (
                    <>
                      <label className="cursor-pointer">
                        <span className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1">
                          {uploading === tipo.key ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                          {doc ? "Substituir PDF" : "Upload PDF"}
                        </span>
                        <input type="file" className="hidden" accept=".pdf,image/*" onChange={e => e.target.files[0] && handleUpload(tipo.key, e.target.files[0])} />
                      </label>
                      {doc && doc.status !== "assinado" && (
                        <label className="cursor-pointer">
                          <span className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1">
                            <CheckCircle size={12} /> Upload assinado
                          </span>
                          <input type="file" className="hidden" accept=".pdf,image/*" onChange={e => e.target.files[0] && handleUpload(tipo.key, e.target.files[0], true)} />
                        </label>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VisitaTab({ projetoId, visita, setVisita, canEdit }) {
  const [form, setForm] = useState(visita || { status: "agendada" });
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    if (form.id) {
      const updated = await base44.entities.VisitaTecnica.update(form.id, form);
      setVisita(updated);
      setForm(updated);
    } else {
      const novo = await base44.entities.VisitaTecnica.create({ projeto_id: projetoId, ...form });
      setVisita(novo);
      setForm(novo);
    }
    setSaving(false);
  };

  const uploadFoto = async (campo, file) => {
    setUploadingFoto(campo);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(p => ({ ...p, [campo]: file_url }));
    setUploadingFoto(null);
  };

  const FotoUpload = ({ label, campo }) => (
    <div>
      <label className="text-slate-400 text-xs mb-1.5 block">{label}</label>
      <div className={`border border-dashed rounded-xl p-3 transition-all ${form[campo] ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-700 hover:border-amber-500/40"}`}>
        {form[campo] ? (
          <div className="flex items-center gap-2">
            <img src={form[campo]} alt="" className="w-14 h-14 rounded-lg object-cover" />
            <div>
              <p className="text-emerald-400 text-xs font-medium">Foto enviada</p>
              <label className="text-slate-400 text-xs cursor-pointer hover:text-white underline">
                Substituir
                <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => e.target.files[0] && uploadFoto(campo, e.target.files[0])} />
              </label>
            </div>
          </div>
        ) : (
          <label className="cursor-pointer flex items-center justify-center gap-2 py-2">
            {uploadingFoto === campo ? <Loader2 size={14} className="animate-spin text-amber-400" /> : <Camera size={14} className="text-slate-500" />}
            <span className="text-slate-400 text-xs">Clique para enviar foto</span>
            <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => e.target.files[0] && uploadFoto(campo, e.target.files[0])} />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2"><Camera size={16} className="text-amber-400" /> Visita Técnica</h3>

      <div>
        <label className="text-slate-400 text-xs mb-1.5 block">Status da Visita</label>
        <select
          value={form.status || "agendada"}
          onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
          disabled={!canEdit}
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        >
          <option value="agendada">Agendada</option>
          <option value="realizada">Realizada</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Data da Visita</label>
          <input type="date" value={form.data_visita || ""} onChange={e => setForm(p => ({ ...p, data_visita: e.target.value }))} disabled={!canEdit}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Tipo de Instalação</label>
          <select value={form.tipo_instalacao || ""} onChange={e => setForm(p => ({ ...p, tipo_instalacao: e.target.value }))} disabled={!canEdit}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
            <option value="">Selecionar...</option>
            <option value="telhado">Telhado</option>
            <option value="solo">Solo</option>
            <option value="carport">Carport</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div>
          <label className="text-slate-400 text-xs mb-1.5 block">Tipo de Telhado</label>
          <select value={form.tipo_telhado || ""} onChange={e => setForm(p => ({ ...p, tipo_telhado: e.target.value }))} disabled={!canEdit}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
            <option value="">Selecionar...</option>
            <option value="ceramica">Cerâmica</option>
            <option value="fibrocimento">Fibrocimento</option>
            <option value="metalico">Metálico</option>
            <option value="laje">Laje</option>
            <option value="sanduiche">Sanduíche</option>
            <option value="outro">Outro</option>
          </select>
        </div>
      </div>

      <FotoUpload label="Foto Drone/Telhado *" campo="foto_drone_telhado_url" />
      <FotoUpload label="Foto Padrão/Medidor *" campo="foto_padrao_medidor_url" />

      {form.status === "realizada" && (!form.foto_drone_telhado_url || !form.foto_padrao_medidor_url) && (
        <div className="bg-amber-400/10 border border-amber-400/20 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300 text-xs">Para visita "Realizada", é obrigatório enviar foto do telhado e do padrão/medidor.</p>
        </div>
      )}

      <div>
        <label className="text-slate-400 text-xs mb-1.5 block">Observações e Especificidades</label>
        <textarea value={form.observacoes || ""} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} disabled={!canEdit}
          rows={4} placeholder="Descreva condições do telhado, sombreamento, acesso, particularidades..."
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none placeholder-slate-600" />
      </div>

      {canEdit && (
        <button onClick={handleSave} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Salvar Visita
        </button>
      )}
    </div>
  );
}

function MonitoramentoTab({ projeto, updateProjeto, canSeePassword, user, senhaVisivel, setSenhaVisivel }) {
  const [form, setForm] = useState({
    monitoramento_portal: projeto.monitoramento_portal || "",
    monitoramento_login: projeto.monitoramento_login || "",
    monitoramento_senha_encrypted: projeto.monitoramento_senha_encrypted || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const auditoria = [...(projeto.monitoramento_auditoria || [])];
    await updateProjeto({ ...form, monitoramento_auditoria: auditoria });
    setSaving(false);
  };

  const handleReveal = () => {
    if (canSeePassword) {
      const auditoria = [...(projeto.monitoramento_auditoria || []), {
        acao: "visualizou_senha",
        usuario: user?.email,
        data: new Date().toISOString()
      }];
      updateProjeto({ monitoramento_auditoria: auditoria });
      setSenhaVisivel(true);
    }
  };

  return (
    <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2"><Settings size={16} className="text-amber-400" /> Acesso ao Monitoramento</h3>

      <div>
        <label className="text-slate-400 text-xs mb-1.5 block">Portal</label>
        <input value={form.monitoramento_portal} onChange={e => setForm(p => ({ ...p, monitoramento_portal: e.target.value }))}
          placeholder="ex: Solarman, TSUN, Growatt..."
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600" />
      </div>
      <div>
        <label className="text-slate-400 text-xs mb-1.5 block">Login</label>
        <input value={form.monitoramento_login} onChange={e => setForm(p => ({ ...p, monitoramento_login: e.target.value }))}
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      <div>
        <label className="text-slate-400 text-xs mb-1.5 block flex items-center gap-1">
          Senha
          {!canSeePassword && <span className="text-slate-500 text-xs">(apenas admin pode visualizar)</span>}
        </label>
        <div className="relative">
          <input
            type={senhaVisivel && canSeePassword ? "text" : "password"}
            value={form.monitoramento_senha_encrypted}
            onChange={e => setForm(p => ({ ...p, monitoramento_senha_encrypted: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 pr-10 text-sm focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => canSeePassword ? (senhaVisivel ? setSenhaVisivel(false) : handleReveal()) : null}
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${canSeePassword ? "text-slate-400 hover:text-white cursor-pointer" : "text-slate-700 cursor-not-allowed"}`}
          >
            {senhaVisivel ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Salvar
      </button>

      {projeto.monitoramento_auditoria?.length > 0 && canSeePassword && (
        <div className="pt-3 border-t border-slate-800">
          <p className="text-slate-400 text-xs font-medium mb-2">Auditoria de acesso</p>
          {projeto.monitoramento_auditoria.map((ev, i) => (
            <p key={i} className="text-slate-500 text-xs">
              {ev.usuario} · {ev.acao} · {ev.data ? new Date(ev.data).toLocaleString("pt-BR") : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}