import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Sun, ChevronRight, Search, CheckCircle, Clock, Zap, X, Lock } from "lucide-react";

const STATUS_LABELS = {
  rascunho: "Rascunho",
  aguardando_pagamento: "Aguard. Pagamento",
  pago_projeto_iniciado: "Projeto Iniciado",
  kit_confirmado: "Kit Confirmado",
  documentos_gerados: "Docs Gerados",
  assinaturas_pendentes: "Assinaturas Pend.",
  assinaturas_concluidas: "Assinaturas OK",
  dossie_ok: "Dossiê OK",
  protocolado_edp: "Protocolado EDP",
  aguardando_aprovacao: "Aguard. Aprovação",
  aprovado: "Aprovado EDP",
  instalacao_agendada: "Instal. Agendada",
  sistema_instalado: "Instalado",
  vistoria_solicitada: "Vistoria Solic.",
  aguardando_vistoria: "Aguard. Vistoria",
  vistoria_aprovada: "Vistoria Aprovada",
  monitoramento_cadastrado: "Monitoramento OK",
  concluido: "Concluído"
};

const STATUS_GROUPS = {
  "Pré-Projeto": ["rascunho", "aguardando_pagamento"],
  "Em Andamento": ["pago_projeto_iniciado", "kit_confirmado", "documentos_gerados", "assinaturas_pendentes", "assinaturas_concluidas", "dossie_ok"],
  "EDP": ["protocolado_edp", "aguardando_aprovacao", "aprovado"],
  "Instalação": ["instalacao_agendada", "sistema_instalado", "vistoria_solicitada", "aguardando_vistoria", "vistoria_aprovada"],
  "Finalizado": ["monitoramento_cadastrado", "concluido"]
};

const statusColor = (status) => {
  if (["concluido", "vistoria_aprovada", "monitoramento_cadastrado", "aprovado"].includes(status)) return "bg-emerald-400/10 text-emerald-400 border-emerald-400/20";
  if (["aguardando_pagamento", "rascunho"].includes(status)) return "bg-slate-400/10 text-slate-400 border-slate-400/20";
  if (["aguardando_aprovacao", "aguardando_vistoria", "assinaturas_pendentes"].includes(status)) return "bg-amber-400/10 text-amber-400 border-amber-400/20";
  if (["protocolado_edp", "vistoria_solicitada"].includes(status)) return "bg-blue-400/10 text-blue-400 border-blue-400/20";
  return "bg-violet-400/10 text-violet-400 border-violet-400/20";
};

export default function Projetos() {
  const [projetos, setProjetos] = useState([]);
  const [preProjetos, setPreProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("Todos");
  const [user, setUser] = useState(null);
  const [avisoSemPermissao, setAvisoSemPermissao] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Projeto.list("-created_date", 200),
      base44.entities.PreProjeto.list("-created_date", 100),
      base44.auth.me()
    ]).then(([p, pp, u]) => {
      setProjetos(p);
      setPreProjetos(pp);
      setUser(u);
      setLoading(false);
    });
  }, []);

  const confirmarPagamento = async (pp) => {
    // Criar Projeto a partir do Pré-Projeto
    const projeto = await base44.entities.Projeto.create({
      pre_projeto_id: pp.id,
      nome_cliente: pp.nome_cliente,
      cpf: pp.cpf,
      telefone: pp.telefone,
      email: pp.email,
      status: "pago_projeto_iniciado",
      data_pagamento: new Date().toISOString().split("T")[0],
      pagamento_confirmado_por: user?.email,
      timeline_eventos: [{ tipo: "pagamento_confirmado", data: new Date().toISOString(), usuario: user?.email }]
    });
    await base44.entities.PreProjeto.update(pp.id, { status: "pago_projeto_iniciado", projeto_id: projeto.id });
    setPreProjetos(prev => prev.map(p => p.id === pp.id ? { ...p, status: "pago_projeto_iniciado" } : p));
    setProjetos(prev => [...prev, projeto]);
  };

  // Combinar pré-projetos não convertidos com projetos
  const prePendentes = preProjetos.filter(pp => pp.status !== "pago_projeto_iniciado");
  const allItems = [
    ...prePendentes.map(pp => ({ ...pp, _tipo: "pre_projeto" })),
    ...projetos.map(p => ({ ...p, _tipo: "projeto" }))
  ];

  const filtered = allItems.filter(item => {
    const searchMatch = !search || item.nome_cliente?.toLowerCase().includes(search.toLowerCase()) || item.cpf?.includes(search);
    const groupStatuses = filtroGrupo !== "Todos" ? STATUS_GROUPS[filtroGrupo] : null;
    const groupMatch = !groupStatuses || groupStatuses.includes(item.status);
    return searchMatch && groupMatch;
  });

  const canConfirmPayment = user?.role === "admin" || user?.role === "financeiro";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Modal aviso sem permissão */}
      {avisoSemPermissao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Lock size={18} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">Ação não permitida</p>
                <p className="text-slate-400 text-xs mt-1">Apenas usuários com perfil <strong className="text-amber-400">Financeiro</strong> ou <strong className="text-amber-400">Admin</strong> podem confirmar pagamentos. Por favor, solicite ao responsável financeiro.</p>
              </div>
              <button onClick={() => setAvisoSemPermissao(false)} className="text-slate-500 hover:text-white transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>
            <button
              onClick={() => setAvisoSemPermissao(false)}
              className="mt-4 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projetos EDP</h1>
          <p className="text-slate-400 text-sm mt-1">{allItems.length} projetos / pré-projetos</p>
        </div>
        <Link
          to={createPageUrl("NovoPréProjeto")}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/20"
        >
          <Zap size={16} /> Novo Cliente
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["Todos", ...Object.keys(STATUS_GROUPS)].map(g => (
            <button
              key={g}
              onClick={() => setFiltroGrupo(g)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${filtroGrupo === g ? "bg-amber-500 text-white" : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"}`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-slate-900 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
          <Sun size={32} className="text-amber-400/30 mx-auto mb-4" />
          <p className="text-slate-400">Nenhum projeto encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 md:p-5 transition-all">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item._tipo === "pre_projeto" ? "bg-slate-800" : "bg-amber-500/10"}`}>
                  {item._tipo === "pre_projeto" ? <Clock size={16} className="text-slate-400" /> : <Sun size={16} className="text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-semibold text-sm">{item.nome_cliente}</p>
                    {item._tipo === "pre_projeto" && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-md">Pré-Projeto</span>}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5">CPF: {item.cpf}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${statusColor(item.status)}`}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                    {item._tipo === "projeto" && item.status === "pago_projeto_iniciado" && !item.equipamentos_confirmados && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-lg border border-orange-400/20 text-orange-400 bg-orange-400/10 flex items-center gap-1">
                        <Package size={10} /> Kit Pendente
                      </span>
                    )}
                  </div>

                  {/* Ação: confirmar pagamento */}
                  {item._tipo === "pre_projeto" && item.status === "aguardando_pagamento" && (
                    <button
                      onClick={() => canConfirmPayment ? confirmarPagamento(item) : setAvisoSemPermissao(true)}
                      className="text-xs bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                    >
                      <CheckCircle size={12} /> Confirmar Pagamento
                    </button>
                  )}

                  {item._tipo === "projeto" && (
                    <Link
                      to={createPageUrl(`ProjetoDetalhe?id=${item.id}`)}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                    >
                      <ChevronRight size={14} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}