import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format, isPast, isToday, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, Plus,
  CheckCircle, Clock, X, Upload, ChevronDown, ChevronUp, Filter
} from "lucide-react";
import LancamentoModal from "../components/financeiro/LancamentoModal";
import ResumoFluxo from "../components/financeiro/ResumoFluxo";

const CATEGORIA_LABELS = {
  venda_projeto: "Venda de Projeto",
  comissao: "Comissão",
  kit_equipamentos: "Kit / Equipamentos",
  mao_de_obra: "Mão de Obra",
  despesa_operacional: "Despesa Operacional",
  despesa_marketing: "Marketing",
  despesa_financeira: "Custo Financeiro",
  imposto: "Impostos",
  pro_labore: "Pró-labore",
  distribuicao_lucro: "Distrib. de Lucro",
  capex: "CAPEX",
  outros: "Outros"
};

const STATUS_CONFIG = {
  pendente:  { label: "Pendente",  color: "text-amber-400  bg-amber-400/10  border-amber-400/20" },
  pago:      { label: "Pago",      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  atrasado:  { label: "Atrasado",  color: "text-red-400    bg-red-400/10    border-red-400/20" },
  cancelado: { label: "Cancelado", color: "text-slate-400  bg-slate-700     border-slate-600" },
};

export default function FluxoCaixa() {
  const [lancamentos, setLancamentos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [mesAtual, setMesAtual] = useState(new Date());
  const [user, setUser] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Lancamento.list("-data_vencimento", 500),
      base44.entities.Projeto.list("-created_date", 200),
      base44.auth.me()
    ]).then(([l, p, u]) => {
      setLancamentos(atualizarAtrasados(l));
      setProjetos(p);
      setUser(u);
      setLoading(false);
    });
  }, []);

  const atualizarAtrasados = (lista) =>
    lista.map(l => {
      if (l.status === "pendente" && l.data_vencimento && isPast(parseISO(l.data_vencimento)) && !isToday(parseISO(l.data_vencimento))) {
        return { ...l, status: "atrasado" };
      }
      return l;
    });

  const inicio = startOfMonth(mesAtual);
  const fim = endOfMonth(mesAtual);

  const lancamentosMes = lancamentos.filter(l => {
    const data = parseISO(l.data_vencimento);
    return data >= inicio && data <= fim;
  });

  const filtrados = lancamentosMes.filter(l => {
    if (filtroTipo !== "todos" && l.tipo !== filtroTipo) return false;
    if (filtroStatus !== "todos" && l.status !== filtroStatus) return false;
    return true;
  });

  const totalReceitas = lancamentosMes.filter(l => l.tipo === "receita").reduce((s, l) => s + (l.valor || 0), 0);
  const totalDespesas = lancamentosMes.filter(l => l.tipo === "despesa").reduce((s, l) => s + (l.valor || 0), 0);
  const saldo = totalReceitas - totalDespesas;
  const atrasados = lancamentos.filter(l => l.status === "atrasado").length;

  const handleSalvar = async (dados) => {
    if (editando) {
      const updated = await base44.entities.Lancamento.update(editando.id, dados);
      setLancamentos(prev => atualizarAtrasados(prev.map(l => l.id === editando.id ? updated : l)));
    } else {
      const novo = await base44.entities.Lancamento.create(dados);
      setLancamentos(prev => atualizarAtrasados([novo, ...prev]));
    }
    setModalOpen(false);
    setEditando(null);
  };

  const handleBaixar = async (lancamento) => {
    const updated = await base44.entities.Lancamento.update(lancamento.id, {
      status: "pago",
      data_pagamento: new Date().toISOString().split("T")[0]
    });
    setLancamentos(prev => prev.map(l => l.id === lancamento.id ? updated : l));
  };

  const handleDeletar = async (id) => {
    if (!window.confirm("Remover este lançamento?")) return;
    await base44.entities.Lancamento.delete(id);
    setLancamentos(prev => prev.filter(l => l.id !== id));
  };

  const navMes = (delta) => {
    const d = new Date(mesAtual);
    d.setMonth(d.getMonth() + delta);
    setMesAtual(d);
  };

  const canEdit = user?.role === "admin" || user?.role === "financeiro";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <DollarSign className="text-amber-400" size={22} /> Fluxo de Caixa
          </h1>
          <p className="text-slate-400 text-sm mt-1">Controle de receitas e despesas</p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditando(null); setModalOpen(true); }}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            <Plus size={16} /> Novo Lançamento
          </button>
        )}
      </div>

      {/* Alertas atrasados */}
      {atrasados > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-red-400 shrink-0" />
          <p className="text-red-300 text-sm">
            <strong>{atrasados}</strong> lançamento{atrasados > 1 ? "s" : ""} em atraso. Verifique e realize a baixa ou atualize o status.
          </p>
        </div>
      )}

      {/* Resumo cards */}
      <ResumoFluxo
        receitas={totalReceitas}
        despesas={totalDespesas}
        saldo={saldo}
        mesAtual={mesAtual}
        onNavMes={navMes}
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-slate-500" />
        {["todos", "receita", "despesa"].map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filtroTipo === t ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"}`}>
            {t === "todos" ? "Todos" : t === "receita" ? "Receitas" : "Despesas"}
          </button>
        ))}
        <div className="w-px h-4 bg-slate-700 mx-1" />
        {["todos", "pendente", "pago", "atrasado"].map(s => (
          <button key={s} onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filtroStatus === s ? "bg-amber-500 text-white" : "bg-slate-800 text-slate-400 hover:text-white border border-slate-700"}`}>
            {s === "todos" ? "Todos status" : STATUS_CONFIG[s]?.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-slate-900 rounded-2xl animate-pulse" />)}</div>
      ) : filtrados.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <DollarSign size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400">Nenhum lançamento encontrado para este período</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento)).map(l => {
            const projeto = projetos.find(p => p.id === l.projeto_id);
            const statusCfg = STATUS_CONFIG[l.status] || STATUS_CONFIG.pendente;
            return (
              <div key={l.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl px-5 py-4 flex items-center gap-4 transition-all">
                {/* Ícone tipo */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${l.tipo === "receita" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                  {l.tipo === "receita"
                    ? <TrendingUp size={16} className="text-emerald-400" />
                    : <TrendingDown size={16} className="text-red-400" />
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium text-sm truncate">{l.descricao}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-lg border ${statusCfg.color}`}>{statusCfg.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-slate-500 text-xs">{CATEGORIA_LABELS[l.categoria] || l.categoria}</span>
                    {projeto && <span className="text-amber-400/70 text-xs">↗ {projeto.nome_cliente}</span>}
                    {l.nome_cliente_fornecedor && <span className="text-slate-500 text-xs">{l.nome_cliente_fornecedor}</span>}
                    <span className="text-slate-600 text-xs flex items-center gap-1">
                      <Clock size={10} /> Vence: {format(parseISO(l.data_vencimento), "dd/MM/yyyy")}
                    </span>
                    {l.data_pagamento && (
                      <span className="text-emerald-400/70 text-xs flex items-center gap-1">
                        <CheckCircle size={10} /> Pago: {format(parseISO(l.data_pagamento), "dd/MM/yyyy")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Valor */}
                <div className="text-right shrink-0">
                  <p className={`font-bold text-base ${l.tipo === "receita" ? "text-emerald-400" : "text-red-400"}`}>
                    {l.tipo === "despesa" ? "−" : "+"}R$ {(l.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                  {l.forma_pagamento && <p className="text-slate-500 text-xs capitalize">{l.forma_pagamento}</p>}
                </div>

                {/* Ações */}
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    {l.status !== "pago" && l.status !== "cancelado" && (
                      <button onClick={() => handleBaixar(l)} title="Dar baixa"
                        className="w-8 h-8 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center text-emerald-400 transition-all">
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button onClick={() => { setEditando(l); setModalOpen(true); }} title="Editar"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button onClick={() => handleDeletar(l.id)} title="Remover"
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-500/20 flex items-center justify-center text-slate-400 hover:text-red-400 transition-all">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <LancamentoModal
          lancamento={editando}
          projetos={projetos}
          onSalvar={handleSalvar}
          onFechar={() => { setModalOpen(false); setEditando(null); }}
        />
      )}
    </div>
  );
}