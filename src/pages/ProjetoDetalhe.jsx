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
  Upload, Plus, Clock, ShieldCheck, Pencil, Trash2, X
} from "lucide-react";

const TABS = ["Resumo", "UC & Técnico", "Documentos", "Visita", "Instalação", "Protocolos", "Monitoramento"];

const STATUS_FLOW = [
  "pago_projeto_iniciado","kit_confirmado","documentos_gerados","assinaturas_pendentes",
  "assinaturas_concluidas","dossie_ok","protocolado_edp","aguardando_aprovacao","aprovado",
  "instalacao_agendada","sistema_instalado","protocolo_vistoria","vistoria_aprovada",
  "monitoramento_cadastrado","concluido"
];

const STATUS_LABELS = {
  pago_projeto_iniciado: "Projeto Iniciado", kit_confirmado: "Kit Confirmado",
  documentos_gerados: "Docs Gerados", assinaturas_pendentes: "Assinaturas Pend.",
  assinaturas_concluidas: "Assinaturas OK", dossie_ok: "Dossiê OK",
  protocolado_edp: "Protocolado EDP", aguardando_aprovacao: "Aguard. Aprovação",
  aprovado: "Aprovado", indeferido: "Indeferido", em_revisao: "Em Revisão",
  instalacao_agendada: "Instal. Agendada",
  sistema_instalado: "Instalado", protocolo_vistoria: "Protocolo Vistoria",
  vistoria_aprovada: "Vistoria Aprovada",
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
  const [temInmetro, setTemInmetro] = useState(false);
  const [showIndeferirModal, setShowIndeferirModal] = useState(false);
  const [motivoIndeferimento, setMotivoIndeferimento] = useState("");

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
        const pp = pps[0] || null;
        setPreProjeto(pp);
        // Verificar se há INMETRO no documento ou no produto do inversor
        const temDocInmetro = docs.some(d => d.tipo === "inmetro" && (d.url_gerado || d.url_assinado));
        if (!temDocInmetro && pp?.inversor_marca_modelo) {
          const produtos = await base44.entities.Produto.filter({ ativo: true });
          const inv = produtos.find(p => `${p.fabricante} ${p.modelo}` === pp.inversor_marca_modelo);
          setTemInmetro(!!(inv?.inmetro_url));
        } else {
          setTemInmetro(temDocInmetro);
        }
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
  const canConfirmarEquipamentos = user?.role === "admin" || user?.role === "financeiro" || user?.role === "suprimentos";

  const handleIndeferir = async () => {
    if (!motivoIndeferimento.trim()) return;
    const timeline = [...(projeto.timeline_eventos || []), {
      tipo: "indeferido",
      motivo: motivoIndeferimento,
      data: new Date().toISOString(),
      usuario: user?.email
    }];
    await updateProjeto({ status: "indeferido", motivo_indeferimento: motivoIndeferimento, timeline_eventos: timeline });
    setShowIndeferirModal(false);
    setMotivoIndeferimento("");
  };

  const handleEnviarRevisao = async () => {
    const timeline = [...(projeto.timeline_eventos || []), {
      tipo: "status_alterado",
      de: projeto.status,
      para: "em_revisao",
      data: new Date().toISOString(),
      usuario: user?.email
    }];
    await updateProjeto({ status: "em_revisao", equipamentos_confirmados: false, timeline_eventos: timeline });
  };

  const handleEnviarNovaAprovacao = async () => {
    const timeline = [...(projeto.timeline_eventos || []), {
      tipo: "status_alterado",
      de: projeto.status,
      para: "protocolado_edp",
      data: new Date().toISOString(),
      usuario: user?.email
    }];
    await updateProjeto({ status: "protocolado_edp", timeline_eventos: timeline });
  };

  const confirmarTransformador = async () => {
    await updateProjeto({
      transformador_confirmado: true,
      transformador_confirmado_por: user?.email,
      transformador_confirmado_em: new Date().toISOString(),
    });
  };

  const confirmarEquipamentos = async () => {
    const timeline = [...(projeto.timeline_eventos || []), {
      tipo: "status_alterado",
      de: projeto.status,
      para: "kit_confirmado",
      data: new Date().toISOString(),
      usuario: user?.email
    }];
    await updateProjeto({
      equipamentos_confirmados: true,
      equipamentos_confirmados_por: user?.email,
      equipamentos_confirmados_em: new Date().toISOString(),
      status: "kit_confirmado",
      timeline_eventos: timeline
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <Link to={createPageUrl("Projetos")} className="text-slate-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white font-bold text-lg truncate">{projeto.nome_cliente}</h1>
              {preProjeto?.aprovacao_xpress && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 shrink-0">
                  <ShieldCheck size={10} /> Aprovação Xpress
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs">CPF: {projeto.cpf}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className={`text-xs border px-2.5 py-1 rounded-lg font-medium ${projeto.status === "indeferido" ? "bg-red-500/10 text-red-400 border-red-500/20" : projeto.status === "em_revisao" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
              {STATUS_LABELS[projeto.status] || projeto.status}
            </span>

            {/* Botões para projeto INDEFERIDO */}
            {projeto.status === "indeferido" && (user?.role === "admin" || user?.role === "engenharia") && (
              <button
                onClick={handleEnviarRevisao}
                className="text-xs bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
              >
                <Pencil size={12} /> Revisar projeto
              </button>
            )}

            {/* Botões para projeto EM REVISÃO */}
            {projeto.status === "em_revisao" && (user?.role === "admin" || user?.role === "engenharia") && (
              <button
                onClick={handleEnviarNovaAprovacao}
                className="text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
              >
                <Zap size={12} /> Enviar nova aprovação
              </button>
            )}

            {/* Botões do fluxo normal */}
            {!["indeferido", "em_revisao"].includes(projeto.status) && (user?.role === "admin" || user?.role === "engenharia") && (
              <>
                {STATUS_FLOW.indexOf(projeto.status) > 0 && (
                  <button
                    onClick={async () => {
                      const idx = STATUS_FLOW.indexOf(projeto.status);
                      const statusAnterior = STATUS_FLOW[idx - 1];
                      const timeline = [...(projeto.timeline_eventos || []), {
                        tipo: "status_alterado",
                        de: projeto.status,
                        para: statusAnterior,
                        data: new Date().toISOString(),
                        usuario: user?.email
                      }];
                      await updateProjeto({ status: statusAnterior, timeline_eventos: timeline });
                    }}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                  >
                    <ChevronLeft size={12} /> Etapa anterior
                  </button>
                )}
                <button
                  onClick={avancarStatus}
                  disabled={projeto.status === "concluido" || (projeto.status === "pago_projeto_iniciado" && !projeto.equipamentos_confirmados)}
                  title={projeto.status === "pago_projeto_iniciado" && !projeto.equipamentos_confirmados ? "Aguardando confirmação dos equipamentos" : ""}
                  className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                >
                  <Zap size={12} /> Próxima etapa
                </button>
                {/* Botão indeferir — disponível a partir de "protocolado_edp" */}
                {["protocolado_edp","aguardando_aprovacao"].includes(projeto.status) && (
                  <button
                    onClick={() => setShowIndeferirModal(true)}
                    className="text-xs bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                  >
                    <X size={12} /> Indeferido
                  </button>
                )}
              </>
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

      {/* Modal Indeferimento */}
      {showIndeferirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h3 className="text-white font-bold text-base mb-1">Marcar como Indeferido</h3>
            <p className="text-slate-400 text-sm mb-4">Informe o motivo do indeferimento pela EDP. O projeto entrará em modo de revisão.</p>
            <textarea
              value={motivoIndeferimento}
              onChange={e => setMotivoIndeferimento(e.target.value)}
              rows={4}
              placeholder="Descreva o motivo do indeferimento (ex: potência acima do limite do transformador, documentação incompleta...)"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-500 resize-none placeholder-slate-600 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowIndeferirModal(false); setMotivoIndeferimento(""); }} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium transition-all">Cancelar</button>
              <button onClick={handleIndeferir} disabled={!motivoIndeferimento.trim()} className="flex-1 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 border border-red-500/30 text-red-400 py-2.5 rounded-xl text-sm font-semibold transition-all">Confirmar Indeferimento</button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto">

          {/* TAB: RESUMO */}
          {tab === "Resumo" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                {/* Alerta Indeferimento */}
                {projeto.status === "indeferido" && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                        <X size={16} className="text-red-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-red-300 font-semibold text-sm">Projeto Indeferido pela EDP</p>
                        {projeto.motivo_indeferimento && <p className="text-red-400/80 text-xs mt-1">{projeto.motivo_indeferimento}</p>}
                      </div>
                    </div>
                    {(user?.role === "admin" || user?.role === "engenharia") && (
                      <button onClick={handleEnviarRevisao} className="text-xs bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                        <Pencil size={12} /> Iniciar revisão para projeto menor
                      </button>
                    )}
                  </div>
                )}
                {/* Alerta Em Revisão */}
                {projeto.status === "em_revisao" && (
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-start gap-3">
                    <div className="w-9 h-9 bg-orange-500/20 rounded-xl flex items-center justify-center shrink-0">
                      <Pencil size={16} className="text-orange-400" />
                    </div>
                    <div>
                      <p className="text-orange-300 font-semibold text-sm">Projeto em Revisão</p>
                      <p className="text-orange-400/80 text-xs mt-1">Edite os equipamentos na aba <strong>UC &amp; Técnico</strong> e, quando pronto, clique em "Enviar nova aprovação" no topo.</p>
                      {projeto.motivo_indeferimento && <p className="text-orange-400/60 text-xs mt-1">Motivo anterior: {projeto.motivo_indeferimento}</p>}
                    </div>
                  </div>
                )}
                {/* Alerta Aprovação Xpress */}
                {preProjeto?.aprovacao_xpress && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
                    <div className="w-9 h-9 bg-red-500/20 rounded-xl flex items-center justify-center shrink-0">
                      <ShieldCheck size={16} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-red-300 font-semibold text-sm">⚡ Este projeto requer Aprovação Xpress</p>
                      <p className="text-red-400/80 text-xs mt-1">
                        {[preProjeto.xpress_limite_fast_track && "Ultrapassa o limite do Fast Track", preProjeto.xpress_envio_credito && "Envio de crédito para outra UC obrigatório"].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                )}
                {/* Pendência: Transformador */}
                {preProjeto?.usar_transformador && (
                  <div className={`border rounded-2xl p-4 flex items-start gap-3 ${projeto.transformador_confirmado ? "bg-emerald-500/5 border-emerald-500/30" : "bg-orange-500/5 border-orange-500/30"}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${projeto.transformador_confirmado ? "bg-emerald-500/20" : "bg-orange-500/20"}`}>
                      <Zap size={16} className={projeto.transformador_confirmado ? "text-emerald-400" : "text-orange-400"} />
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${projeto.transformador_confirmado ? "text-emerald-300" : "text-orange-300"}`}>
                        {projeto.transformador_confirmado ? "Transformador: compra confirmada" : "Pendente: confirmação da compra do transformador"}
                      </p>
                      {projeto.transformador_confirmado ? (
                        <p className="text-emerald-400/70 text-xs mt-0.5">
                          Confirmado por <strong className="text-emerald-400">{projeto.transformador_confirmado_por}</strong>
                          {projeto.transformador_confirmado_em ? ` em ${new Date(projeto.transformador_confirmado_em).toLocaleString("pt-BR")}` : ""}
                        </p>
                      ) : (
                        <p className="text-orange-400/80 text-xs mt-0.5">O vendedor indicou que este projeto utiliza transformador. Aguardando confirmação da compra por Admin ou Financeiro.</p>
                      )}
                    </div>
                    {!projeto.transformador_confirmado && canEditFinancial && (
                      <button
                        onClick={confirmarTransformador}
                        className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 shrink-0"
                      >
                        <CheckCircle size={12} /> Confirmar
                      </button>
                    )}
                  </div>
                )}
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
                      <p className="text-white text-sm">{uc?.numero_uc || projeto.uc_geradora || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Data Pagamento</p>
                      <p className="text-white text-sm">{projeto.data_pagamento || "—"}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Envio de Créditos</p>
                      <span className={`text-xs px-2 py-1 rounded-lg ${(preProjeto?.envio_creditos || projeto.envio_creditos) ? "bg-amber-400/10 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
                        {(preProjeto?.envio_creditos || projeto.envio_creditos) ? "Sim" : "Não"}
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
                <DossieChecklist documentos={documentos} envioCreditos={projeto.envio_creditos} temInmetro={temInmetro} />
                <ProtocoloCard projetoId={id} protocolos={protocolos} onUpdate={p => setProtocolos(prev => [...prev, p])} />
              </div>
            </div>
          )}

          {/* TAB: UC & TÉCNICO */}
          {tab === "UC & Técnico" && (
            <UCTecnicoTab
              uc={uc} resumoTec={resumoTec} saveUC={saveUC} saveResumo={saveResumo}
              canEdit={canEdit} preProjeto={preProjeto} projeto={projeto}
              canConfirmarEquipamentos={canConfirmarEquipamentos}
              onConfirmarEquipamentos={confirmarEquipamentos}
            />
          )}

          {/* TAB: DOCUMENTOS */}
          {tab === "Documentos" && (
            <DocumentosTab projetoId={id} documentos={documentos} setDocumentos={setDocumentos} canEdit={canEdit} preProjeto={preProjeto} projeto={projeto} />
          )}

          {/* TAB: VISITA */}
          {tab === "Visita" && (
            <VisitaTab projetoId={id} visita={visita} setVisita={setVisita} canEdit={canEdit} preProjeto={preProjeto} />
          )}

          {/* TAB: INSTALAÇÃO */}
          {tab === "Instalação" && (
            <InstalacaoTab projeto={projeto} updateProjeto={updateProjeto} canEdit={canEdit} />
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

function UCTecnicoTab({ uc, resumoTec, saveUC, saveResumo, canEdit, preProjeto, projeto, canConfirmarEquipamentos, onConfirmarEquipamentos }) {
  const [produtos, setProdutos] = useState([]);
  const [editandoEq, setEditandoEq] = useState(false);
  const getInversoresIniciais = (pp) => {
    if (pp?.inversores?.length) return pp.inversores.map(i => ({ marca_modelo: i.marca_modelo, quantidade: i.quantidade }));
    if (pp?.inversor_marca_modelo) return [{ marca_modelo: pp.inversor_marca_modelo, quantidade: pp.inversor_quantidade || 1 }];
    return [{ marca_modelo: "", quantidade: 1 }];
  };
  const [eqForm, setEqForm] = useState({
    inversores: getInversoresIniciais(preProjeto),
    modulo_marca_modelo: preProjeto?.modulo_marca_modelo || "",
    modulo_quantidade: preProjeto?.modulo_quantidade || "",
    potencia_pico_kwp: preProjeto?.potencia_pico_kwp || "",
    kwh_prometidos: preProjeto?.kwh_prometidos || "",
  });
  const [savingEq, setSavingEq] = useState(false);

  useEffect(() => {
    base44.entities.Produto.filter({ ativo: true }).then(setProdutos).catch(() => {});
  }, []);

  useEffect(() => {
    setEqForm({
      inversores: getInversoresIniciais(preProjeto),
      modulo_marca_modelo: preProjeto?.modulo_marca_modelo || "",
      modulo_quantidade: preProjeto?.modulo_quantidade || "",
      potencia_pico_kwp: preProjeto?.potencia_pico_kwp || "",
      kwh_prometidos: preProjeto?.kwh_prometidos || "",
    });
  }, [preProjeto]);

  const handleSaveEq = async () => {
    setSavingEq(true);
    const inversoresFiltrados = (eqForm.inversores || []).filter(i => i.marca_modelo).map(i => ({ marca_modelo: i.marca_modelo, quantidade: Number(i.quantidade) || 1 }));
    await base44.entities.PreProjeto.update(preProjeto.id, {
      inversores: inversoresFiltrados,
      inversor_marca_modelo: inversoresFiltrados[0]?.marca_modelo || "",
      inversor_quantidade: inversoresFiltrados[0]?.quantidade || null,
      modulo_marca_modelo: eqForm.modulo_marca_modelo,
      modulo_quantidade: eqForm.modulo_quantidade ? Number(eqForm.modulo_quantidade) : null,
      potencia_pico_kwp: eqForm.potencia_pico_kwp ? Number(eqForm.potencia_pico_kwp) : null,
      kwh_prometidos: eqForm.kwh_prometidos ? Number(eqForm.kwh_prometidos) : null,
    });
    setSavingEq(false);
    setEditandoEq(false);
    Object.assign(preProjeto, { ...eqForm, inversores: inversoresFiltrados });
  };

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
  const [emailForm, setEmailForm] = useState(preProjeto?.email || "");
  const [savingEmail, setSavingEmail] = useState(false);

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
  const handleSaveEmail = async () => {
    setSavingEmail(true);
    await base44.entities.PreProjeto.update(preProjeto.id, { email: emailForm });
    setSavingEmail(false);
  };

  const [confirmandoEq, setConfirmandoEq] = useState(false);
  const handleConfirmarEquipamentos = async () => {
    setConfirmandoEq(true);
    await onConfirmarEquipamentos();
    setConfirmandoEq(false);
  };

  const inversores = produtos.filter(p => ["inversor_string", "microinversor", "hibrido"].includes(p.tipo));
  const modulos = produtos.filter(p => p.tipo === "modulo_fv");

  return (
    <div className="space-y-6">
      {preProjeto && (
        <div className={`border rounded-2xl p-5 space-y-4 ${projeto?.equipamentos_confirmados ? "bg-emerald-500/5 border-emerald-500/30" : "bg-amber-500/5 border-amber-500/30"}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Package size={16} className={projeto?.equipamentos_confirmados ? "text-emerald-400" : "text-amber-400"} />
              Equipamentos da Venda
              {projeto?.equipamentos_confirmados && (
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg ml-1">Confirmado</span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {(!projeto?.equipamentos_confirmados || projeto?.status === "em_revisao") && canConfirmarEquipamentos && !editandoEq && (
                <button
                  onClick={() => setEditandoEq(true)}
                  className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                >
                  <Pencil size={12} /> Editar
                </button>
              )}
              {(!projeto?.equipamentos_confirmados || projeto?.status === "em_revisao") && canConfirmarEquipamentos && !editandoEq && (
                <button
                  onClick={handleConfirmarEquipamentos}
                  disabled={confirmandoEq}
                  className="text-xs bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                >
                  {confirmandoEq ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                  Confirmar Kit
                </button>
              )}
            </div>
          </div>

          {!projeto?.equipamentos_confirmados && (
            <div className="flex items-start gap-2 bg-amber-400/10 border border-amber-400/20 rounded-xl p-3">
              <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300 text-xs">Aguardando confirmação do kit pelo financeiro / suprimentos. O projeto não pode avançar para "Kit Confirmado" sem esta aprovação.</p>
            </div>
          )}

          {editandoEq ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="col-span-2 space-y-2">
                  <label className="text-slate-400 text-xs mb-1.5 block">Inversores</label>
                  {(eqForm.inversores || []).map((inv, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={inv.marca_modelo || ""} onChange={e => { const arr = [...eqForm.inversores]; arr[i] = { ...arr[i], marca_modelo: e.target.value }; setEqForm(f => ({ ...f, inversores: arr })); }}
                        className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                        <option value="">Selecionar...</option>
                        {inversores.map(p => <option key={p.id} value={`${p.fabricante} ${p.modelo}`}>{p.fabricante} {p.modelo}{p.potencia_kva ? ` — ${p.potencia_kva} kVA` : ""}</option>)}
                      </select>
                      <input type="number" value={inv.quantidade || ""} onChange={e => { const arr = [...eqForm.inversores]; arr[i] = { ...arr[i], quantidade: e.target.value }; setEqForm(f => ({ ...f, inversores: arr })); }}
                        placeholder="Qtd" className="w-20 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                      {eqForm.inversores.length > 1 && (
                        <button onClick={() => setEqForm(f => ({ ...f, inversores: f.inversores.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={13} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setEqForm(f => ({ ...f, inversores: [...f.inversores, { marca_modelo: "", quantidade: 1 }] }))}
                    className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs font-medium transition-colors">
                    <Plus size={12} /> Adicionar modelo de inversor
                  </button>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">Módulos FV</label>
                  <select value={eqForm.modulo_marca_modelo} onChange={e => {
                    const novoModelo = e.target.value;
                    const moduloProd = modulos.find(p => `${p.fabricante} ${p.modelo}` === novoModelo);
                    const qtd = eqForm.modulo_quantidade ? Number(eqForm.modulo_quantidade) : 0;
                    const kwp = moduloProd?.potencia_wp && qtd ? ((moduloProd.potencia_wp * qtd) / 1000).toFixed(2) : eqForm.potencia_pico_kwp;
                    setEqForm(f => ({ ...f, modulo_marca_modelo: novoModelo, potencia_pico_kwp: kwp }));
                  }}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                    <option value="">Selecionar...</option>
                    {modulos.map(p => <option key={p.id} value={`${p.fabricante} ${p.modelo}`}>{p.fabricante} {p.modelo}{p.potencia_wp ? ` — ${p.potencia_wp} Wp` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">Qtd. Módulos</label>
                  <input type="number" value={eqForm.modulo_quantidade} onChange={e => {
                    const qtd = Number(e.target.value) || 0;
                    const moduloProd = modulos.find(p => `${p.fabricante} ${p.modelo}` === eqForm.modulo_marca_modelo);
                    const kwp = moduloProd?.potencia_wp && qtd ? ((moduloProd.potencia_wp * qtd) / 1000).toFixed(2) : eqForm.potencia_pico_kwp;
                    setEqForm(f => ({ ...f, modulo_quantidade: e.target.value, potencia_pico_kwp: kwp }));
                  }}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">Potência pico (kWp) <span className="text-slate-500 font-normal">— calculado automaticamente</span></label>
                  <div className="w-full bg-slate-800/50 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm opacity-70 cursor-not-allowed">
                    {eqForm.potencia_pico_kwp ? `${eqForm.potencia_pico_kwp} kWp` : "Aguardando módulo e quantidade"}
                  </div>
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">kWh prometidos</label>
                  <input type="number" value={eqForm.kwh_prometidos} onChange={e => setEqForm(f => ({ ...f, kwh_prometidos: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditandoEq(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-xl text-xs font-medium transition-all">Cancelar</button>
                <button onClick={handleSaveEq} disabled={savingEq} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1">
                  {savingEq ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Salvar alterações
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-800/60 rounded-xl p-3 col-span-2">
              <p className="text-slate-400 text-xs mb-2">Inversores</p>
              {(preProjeto.inversores?.length ? preProjeto.inversores : preProjeto.inversor_marca_modelo ? [{ marca_modelo: preProjeto.inversor_marca_modelo, quantidade: preProjeto.inversor_quantidade }] : []).map((inv, i) => (
                <div key={i} className="py-1 border-b border-slate-700/50 last:border-0">
                  <p className="text-white text-sm font-medium">{inv.marca_modelo || "—"}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Qtd: {inv.quantidade || "—"}</p>
                </div>
              ))}
              {!preProjeto.inversores?.length && !preProjeto.inversor_marca_modelo && <p className="text-slate-500 text-sm">—</p>}
            </div>
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">Módulos FV</p>
                <p className="text-white text-sm font-medium">{preProjeto.modulo_marca_modelo || "—"}</p>
                <p className="text-slate-500 text-xs mt-0.5">Qtd: {preProjeto.modulo_quantidade || "—"}</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">Potência pico</p>
                <p className="text-white text-sm font-medium">{preProjeto.potencia_pico_kwp ? `${preProjeto.potencia_pico_kwp} kWp` : "—"}</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">kWh prometidos</p>
                <p className="text-white text-sm font-medium">{preProjeto.kwh_prometidos ? `${preProjeto.kwh_prometidos} kWh/mês` : "—"}</p>
              </div>
            </div>
          )}

          {projeto?.equipamentos_confirmados && (
            <p className="text-emerald-400/70 text-xs">
              Confirmado por <strong className="text-emerald-400">{projeto.equipamentos_confirmados_por}</strong>
              {projeto.equipamentos_confirmados_em ? ` em ${new Date(projeto.equipamentos_confirmados_em).toLocaleString("pt-BR")}` : ""}
            </p>
          )}
        </div>
      )}

      {/* Compartilhamento de Créditos */}
      {preProjeto?.envio_creditos && (
        <UCsCreditoSection preProjeto={preProjeto} projeto={projeto} canEdit={canEdit} />
      )}

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
            { label: "Latitude", key: "latitude", type: "number" },
            { label: "Longitude", key: "longitude", type: "number" },
            ].map(f => (
            <div key={f.key}>
              <label className="text-slate-400 text-xs mb-1.5 block">{f.label}</label>
              <input
                type={f.type || "text"}
                value={ucForm[f.key] ?? ""}
                onChange={e => setUcForm(p => ({ ...p, [f.key]: f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value }))}
                disabled={!canEdit}
                placeholder={f.key === "latitude" ? "ex: -20.277672" : f.key === "longitude" ? "ex: -40.406445" : ""}
                className="w-full bg-slate-800 border border-slate-700 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600"
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

          {/* Email do cliente */}
          <div className="pt-3 border-t border-slate-800">
            <label className="text-slate-400 text-xs mb-1.5 block">E-mail do Cliente</label>
            <input
              type="email"
              value={emailForm}
              onChange={e => setEmailForm(e.target.value)}
              disabled={!canEdit}
              placeholder="email@exemplo.com"
              className="w-full bg-slate-800 border border-slate-700 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600"
            />
            {canEdit && (
              <button onClick={handleSaveEmail} disabled={savingEmail} className="w-full mt-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-slate-300 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2">
                {savingEmail ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Salvar E-mail
              </button>
            )}
          </div>
        </div>

        {/* Resumo Técnico */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-white font-semibold flex items-center gap-2"><Zap size={16} className="text-amber-400" /> Resumo Técnico</h3>

          {/* Responsável Técnico e CREA - valores fixos */}
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Responsável Técnico</label>
            <div className="w-full bg-slate-800/50 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm opacity-70 cursor-not-allowed">
              Thiago Fernandes Juffo Fontes
            </div>
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">CREA</label>
            <div className="w-full bg-slate-800/50 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm opacity-70 cursor-not-allowed">
              ES-033278/D
            </div>
          </div>

          {/* Módulo FV - espelhado dos equipamentos confirmados */}
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Módulo FV</label>
            <div className="w-full bg-slate-800/50 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm opacity-70 cursor-not-allowed">
              {preProjeto?.modulo_marca_modelo || "Não definido"}
              {preProjeto?.modulo_quantidade ? ` — ${preProjeto.modulo_quantidade} un.` : ""}
            </div>
          </div>

          {/* Inversores - espelhado dos equipamentos confirmados */}
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Inversores</label>
            <div className="w-full bg-slate-800/50 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm opacity-70 cursor-not-allowed space-y-1">
              {(preProjeto?.inversores?.length
                ? preProjeto.inversores
                : preProjeto?.inversor_marca_modelo
                  ? [{ marca_modelo: preProjeto.inversor_marca_modelo, quantidade: preProjeto.inversor_quantidade }]
                  : []
              ).map((inv, i) => (
                <div key={i}>{inv.marca_modelo || "—"} — {inv.quantidade || "?"} un.</div>
              ))}
              {!preProjeto?.inversores?.length && !preProjeto?.inversor_marca_modelo && "Não definido"}
            </div>
          </div>

          {/* Potência calculada automaticamente */}
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Potência (kWp) <span className="text-slate-500 normal-case font-normal">— calculado automaticamente</span></label>
            {(() => {
              const moduloProd = produtos.find(p => `${p.fabricante} ${p.modelo}` === preProjeto?.modulo_marca_modelo);
              const qtd = preProjeto?.modulo_quantidade;
              const potWp = moduloProd?.potencia_wp;
              const kwp = moduloProd && qtd && potWp ? ((potWp * qtd) / 1000).toFixed(2) : rtForm.potencia_kwp || "";
              return (
                <div className="w-full bg-slate-800/50 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm opacity-70 cursor-not-allowed">
                  {kwp ? `${kwp} kWp` : "Aguardando dados dos equipamentos"}
                </div>
              );
            })()}
          </div>

          {/* Qtd. Módulos - espelhado */}
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Qtd. Módulos</label>
            <div className="w-full bg-slate-800/50 border border-slate-700 text-slate-300 rounded-xl px-3 py-2 text-sm opacity-70 cursor-not-allowed">
              {preProjeto?.modulo_quantidade || "—"}
            </div>
          </div>

          {[
            { label: "ART Nº", key: "art_numero" },
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
    </div>
  );
}

function DocumentosTab({ projetoId, documentos, setDocumentos, canEdit, preProjeto, projeto }) {
  const [uploading, setUploading] = useState(null);
  const [gerando, setGerando] = useState(null);
  const [inversorProduto, setInversorProduto] = useState(null);
  const [limpando, setLimpando] = useState(null);

  const handleLimpar = async (tipo, campo) => {
    const doc = getDoc(tipo);
    if (!doc) return;
    setLimpando(`${tipo}_${campo}`);
    const updates = { [campo]: null };
    if (campo === "url_assinado") updates.status = doc.url_gerado ? "gerado" : "pendente";
    if (campo === "url_gerado" && !doc.url_assinado) updates.status = "pendente";
    const updated = await base44.entities.Documento.update(doc.id, updates);
    setDocumentos(prev => prev.map(d => d.id === doc.id ? { ...d, ...updates } : d));
    setLimpando(null);
  };

  useEffect(() => {
    if (!preProjeto?.inversor_marca_modelo) return;
    base44.entities.Produto.filter({ ativo: true }).then(produtos => {
      const inv = produtos.find(p => `${p.fabricante} ${p.modelo}` === preProjeto.inversor_marca_modelo);
      setInversorProduto(inv || null);
    }).catch(() => {});
  }, [preProjeto?.inversor_marca_modelo]);

  const TIPOS = [
    { key: "procuracao", label: "Procuração", gerarivel: true },
    { key: "memorial_tecnico", label: "Memorial Técnico", gerarivel: true },
    { key: "solicitacao_art", label: "Solicitação ART", gerarivel: true },
    { key: "formulario_creditos", label: "Form. Envio de Créditos", gerarivel: false },
    { key: "art", label: "ART", gerarivel: false },
    { key: "projeto_unifilar", label: "Projeto Unifilar", gerarivel: false },
    { key: "inmetro", label: "Certificado INMETRO", gerarivel: false, fromProduto: true },
    { key: "conta_energia", label: "Conta de Energia", gerarivel: false, fromPreProjeto: "conta_energia_url" },
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

  // Tipos que pulam diretamente para "assinado" no upload (não passam por "gerado")
  const UPLOAD_DIRETO_ASSINADO = ["projeto_unifilar"];

  const handleUpload = async (tipo, file, signed = false) => {
    setUploading(tipo);
    const forcarAssinado = UPLOAD_DIRETO_ASSINADO.includes(tipo);
    const isAssinado = signed || forcarAssinado;
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const existing = getDoc(tipo);
    if (existing) {
      const updated = await base44.entities.Documento.update(existing.id, {
        ...(isAssinado ? { url_assinado: file_url, status: "assinado", data_assinatura: new Date().toISOString() } : { url_gerado: file_url, status: "gerado" })
      });
      setDocumentos(prev => prev.map(d => d.id === existing.id ? updated : d));
    } else {
      const novo = await base44.entities.Documento.create({
        projeto_id: projetoId, tipo,
        url_gerado: isAssinado ? undefined : file_url,
        url_assinado: isAssinado ? file_url : undefined,
        status: isAssinado ? "assinado" : "gerado",
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
                  {tipo.fromPreProjeto && preProjeto?.[tipo.fromPreProjeto] ? (
                    <span className="text-xs px-2.5 py-1 rounded-lg border bg-blue-400/10 text-blue-400 border-blue-400/20">
                      Disponível
                    </span>
                  ) : tipo.fromProduto && inversorProduto?.inmetro_url && !doc ? (
                    <span className="text-xs px-2.5 py-1 rounded-lg border bg-emerald-400/10 text-emerald-400 border-emerald-400/20">
                      Assinado
                    </span>
                  ) : doc ? (
                    <span className={`text-xs px-2.5 py-1 rounded-lg border ${doc.status === "assinado" ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : doc.status === "gerado" ? "bg-blue-400/10 text-blue-400 border-blue-400/20" : "bg-slate-700 text-slate-400 border-slate-600"}`}>
                      {doc.status === "assinado" ? "Assinado" : doc.status === "gerado" ? "Gerado" : doc.status}
                    </span>
                  ) : null}
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
                  {tipo.fromProduto && inversorProduto?.inmetro_url && (
                    <a href={inversorProduto.inmetro_url} target="_blank" rel="noreferrer" className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-all flex items-center gap-1">
                      <FileText size={12} /> Download INMETRO ({preProjeto?.inversor_marca_modelo})
                    </a>
                  )}
                  {tipo.fromProduto && inversorProduto && !inversorProduto.inmetro_url && (
                    <span className="text-xs text-slate-500 italic">Certificado não cadastrado para este inversor</span>
                  )}
                  {tipo.fromPreProjeto && preProjeto?.[tipo.fromPreProjeto] && (
                    <a href={preProjeto[tipo.fromPreProjeto]} target="_blank" rel="noreferrer" className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1.5 rounded-lg hover:bg-blue-500/20 transition-all flex items-center gap-1">
                      <FileText size={12} /> Download Conta de Energia
                    </a>
                  )}
                  {tipo.fromPreProjeto && !preProjeto?.[tipo.fromPreProjeto] && (
                    <span className="text-xs text-slate-500 italic">Não enviada pelo vendedor</span>
                  )}
                  {doc?.url_gerado && (
                    <div className="flex items-center gap-1">
                      <a href={doc.url_gerado} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                        <FileText size={12} /> Ver original
                      </a>
                      {canEdit && (
                        <button
                          onClick={() => handleLimpar(tipo.key, "url_gerado")}
                          disabled={limpando === `${tipo.key}_url_gerado`}
                          title="Remover arquivo"
                          className="ml-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          {limpando === `${tipo.key}_url_gerado` ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                        </button>
                      )}
                    </div>
                  )}
                  {doc?.url_assinado && (
                    <div className="flex items-center gap-1">
                      <a href={doc.url_assinado} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline flex items-center gap-1">
                        <CheckCircle size={12} /> Ver assinado
                      </a>
                      {canEdit && (
                        <button
                          onClick={() => handleLimpar(tipo.key, "url_assinado")}
                          disabled={limpando === `${tipo.key}_url_assinado`}
                          title="Remover arquivo assinado"
                          className="ml-1 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          {limpando === `${tipo.key}_url_assinado` ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                        </button>
                      )}
                    </div>
                  )}
                  {canEdit && (
                    <>
                      {UPLOAD_DIRETO_ASSINADO.includes(tipo.key) ? (
                        // Para tipos que vão direto para assinado (ex: Projeto Unifilar)
                        <label className="cursor-pointer">
                          <span className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1">
                            {uploading === tipo.key ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                            {doc ? "Substituir PDF" : "Upload PDF"}
                          </span>
                          <input type="file" className="hidden" accept=".pdf,image/*" onChange={e => e.target.files[0] && handleUpload(tipo.key, e.target.files[0])} />
                        </label>
                      ) : (
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

function VisitaTab({ projetoId, visita, setVisita, canEdit, preProjeto }) {
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
    <div className="max-w-2xl space-y-4">
      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
        <h4 className="text-slate-300 font-semibold text-sm mb-3 flex items-center gap-2">
          <FileText size={14} className="text-slate-400" /> Arquivos enviados pelo vendedor
        </h4>
        <div className="flex flex-wrap gap-2">
          {preProjeto?.conta_energia_url ? (
            <a href={preProjeto.conta_energia_url} target="_blank" rel="noreferrer"
              className="text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
              <FileText size={12} /> Ver Conta de Energia
            </a>
          ) : (
            <span className="text-xs text-slate-500 italic">Conta de energia não enviada</span>
          )}
          {preProjeto?.documento_foto_url ? (
            <a href={preProjeto.documento_foto_url} target="_blank" rel="noreferrer"
              className="text-xs bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 border border-violet-500/20 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
              <FileText size={12} /> Ver CNH / Documento
            </a>
          ) : (
            <span className="text-xs text-slate-500 italic">CNH/Documento não enviado</span>
          )}
        </div>
      </div>

    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
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
  </div>
  );
}

function UCsCreditoSection({ preProjeto, projeto, canEdit }) {
  const ucs = preProjeto?.ucs_credito || [];
  return (
    <div className="bg-slate-900 border border-amber-500/20 rounded-2xl p-5 space-y-3">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <Zap size={16} className="text-amber-400" /> Compartilhamento de Créditos
      </h3>
      <p className="text-slate-400 text-xs">Este projeto possui envio de créditos de energia para outras UCs:</p>
      {ucs.length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhuma UC receptora cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {ucs.map((uc, i) => (
            <div key={i} className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-2.5">
              <div>
                <p className="text-white text-sm font-medium">UC: {uc.numero_uc || "—"}</p>
              </div>
              <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg font-semibold">
                {uc.percentual != null ? `${uc.percentual}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InstalacaoTab({ projeto, updateProjeto, canEdit }) {
  const [form, setForm] = useState({
    data_instalacao: projeto.data_instalacao || "",
    data_comissionamento: projeto.data_comissionamento || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await updateProjeto(form);
    setSaving(false);
  };

  return (
    <div className="max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <h3 className="text-white font-semibold flex items-center gap-2">
        <Clock size={16} className="text-amber-400" /> Agendamento de Instalação
      </h3>

      <div>
        <label className="text-slate-400 text-xs mb-1.5 block">Data de Instalação</label>
        <input
          type="date"
          value={form.data_instalacao}
          onChange={e => setForm(p => ({ ...p, data_instalacao: e.target.value }))}
          disabled={!canEdit}
          className="w-full bg-slate-800 border border-slate-700 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      <div>
        <label className="text-slate-400 text-xs mb-1.5 block">Data de Comissionamento</label>
        <input
          type="date"
          value={form.data_comissionamento}
          onChange={e => setForm(p => ({ ...p, data_comissionamento: e.target.value }))}
          disabled={!canEdit}
          className="w-full bg-slate-800 border border-slate-700 disabled:opacity-50 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      {canEdit && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Salvar
        </button>
      )}

      {projeto.data_instalacao && (
        <div className="pt-3 border-t border-slate-800 space-y-1">
          <p className="text-slate-400 text-xs">Instalação agendada para: <span className="text-white font-medium">{new Date(projeto.data_instalacao + "T12:00:00").toLocaleDateString("pt-BR")}</span></p>
          {projeto.data_comissionamento && (
            <p className="text-slate-400 text-xs">Comissionamento previsto: <span className="text-white font-medium">{new Date(projeto.data_comissionamento + "T12:00:00").toLocaleDateString("pt-BR")}</span></p>
          )}
        </div>
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