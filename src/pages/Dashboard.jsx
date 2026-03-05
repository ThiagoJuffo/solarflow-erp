import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Sun, Zap, Clock, CheckCircle, AlertTriangle, TrendingUp, FolderKanban, ArrowRight, Package, ShieldCheck } from "lucide-react";

const STATUS_LABELS = {
  pago_projeto_iniciado: "Projeto Iniciado",
  kit_confirmado: "Kit Confirmado",
  documentos_gerados: "Docs Gerados",
  assinaturas_pendentes: "Assinaturas Pendentes",
  assinaturas_concluidas: "Assinaturas OK",
  dossie_ok: "Dossiê OK",
  protocolado_edp: "Protocolado EDP",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovado: "Aprovado",
  instalacao_agendada: "Instalação Agendada",
  sistema_instalado: "Instalado",
  vistoria_solicitada: "Vistoria Solicitada",
  aguardando_vistoria: "Aguardando Vistoria",
  vistoria_aprovada: "Vistoria Aprovada",
  monitoramento_cadastrado: "Monitoramento OK",
  concluido: "Concluído"
};

export default function Dashboard() {
  const [projetos, setProjetos] = useState([]);
  const [preProjetos, setPreProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Projeto.list("-created_date", 100),
      base44.entities.PreProjeto.list("-created_date", 50),
      base44.auth.me()
    ]).then(([p, pp, u]) => {
      setProjetos(p);
      setPreProjetos(pp);
      setUser(u);
      setLoading(false);
    });
  }, []);

  const total = projetos.length;
  const concluidos = projetos.filter(p => p.status === "concluido").length;
  const emAndamento = projetos.filter(p => p.status !== "concluido").length;
  const aguardandoAprovacao = projetos.filter(p => p.status === "aguardando_aprovacao").length;
  const canConfirmPayment = user?.role === "admin" || user?.role === "financeiro";
  const prePagas = preProjetos.filter(p => p.status === "aguardando_pagamento").length;
  const aguardandoKitConfirmacao = projetos.filter(p => p.status === "pago_projeto_iniciado" && !p.equipamentos_confirmados);

  const recentProjects = projetos.slice(0, 6);

  const statusColor = (status) => {
    if (["concluido", "vistoria_aprovada", "monitoramento_cadastrado"].includes(status)) return "text-emerald-400 bg-emerald-400/10";
    if (["aguardando_aprovacao", "aguardando_vistoria", "assinaturas_pendentes"].includes(status)) return "text-amber-400 bg-amber-400/10";
    if (status === "aprovado") return "text-blue-400 bg-blue-400/10";
    return "text-slate-400 bg-slate-400/10";
  };

  const cards = [
    { label: "Total de Projetos", value: total, icon: FolderKanban, color: "from-blue-500 to-blue-600" },
    { label: "Em Andamento", value: emAndamento, icon: TrendingUp, color: "from-amber-500 to-amber-600" },
    { label: "Concluídos", value: concluidos, icon: CheckCircle, color: "from-emerald-500 to-emerald-600" },
    { label: "Aguard. Aprovação EDP", value: aguardandoAprovacao, icon: Clock, color: "from-violet-500 to-violet-600" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-400 mt-1 text-sm">Visão geral dos projetos solares EDP</p>
        </div>
        <Link
          to={createPageUrl("NovoPréProjeto")}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/30"
        >
          <Zap size={16} />
          Novo Pré-Projeto
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-4 shadow-lg`}>
              <card.icon size={18} className="text-white" />
            </div>
            <p className="text-3xl font-bold text-white">{loading ? "—" : card.value}</p>
            <p className="text-slate-400 text-sm mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Alerta: equipamentos aguardando confirmação */}
      {aguardandoKitConfirmacao.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
            <Package size={18} className="text-orange-400" />
          </div>
          <div className="flex-1">
            <p className="text-orange-300 font-semibold text-sm">{aguardandoKitConfirmacao.length} projeto(s) aguardando confirmação de equipamentos</p>
            <p className="text-orange-400/70 text-xs mt-0.5">
              {aguardandoKitConfirmacao.slice(0, 3).map(p => p.nome_cliente).join(", ")}{aguardandoKitConfirmacao.length > 3 ? ` e mais ${aguardandoKitConfirmacao.length - 3}...` : ""}
            </p>
          </div>
          <Link to={createPageUrl("Projetos")} className="text-orange-400 hover:text-orange-300 text-sm flex items-center gap-1">
            Ver <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Pre-projetos alert - apenas para admin/financeiro */}
      {prePagas > 0 && canConfirmPayment && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-amber-300 font-semibold text-sm">{prePagas} pré-projeto(s) aguardando confirmação de pagamento</p>
            <p className="text-amber-400/70 text-xs mt-0.5">Confirme o pagamento para iniciar os projetos</p>
          </div>
          <Link to={createPageUrl("Projetos")} className="text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1">
            Ver <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Recent Projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg">Projetos Recentes</h2>
          <Link to={createPageUrl("Projetos")} className="text-amber-400 hover:text-amber-300 text-sm flex items-center gap-1">
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-slate-900 rounded-2xl animate-pulse" />)}
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sun size={28} className="text-amber-400" />
            </div>
            <p className="text-white font-semibold">Nenhum projeto ainda</p>
            <p className="text-slate-400 text-sm mt-1">Crie um pré-projeto para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentProjects.map(p => (
              <Link
                key={p.id}
                to={createPageUrl(`ProjetoDetalhe?id=${p.id}`)}
                className="flex items-center gap-4 bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Sun size={16} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{p.nome_cliente}</p>
                  <p className="text-slate-400 text-xs">UC: {p.uc_geradora || "—"}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${statusColor(p.status)}`}>
                    {STATUS_LABELS[p.status] || p.status}
                  </span>
                  {p.status === "pago_projeto_iniciado" && !p.equipamentos_confirmados && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-lg text-orange-400 bg-orange-400/10 flex items-center gap-1">
                      <Package size={10} /> Kit Pendente
                    </span>
                  )}
                </div>
                <ArrowRight size={14} className="text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}