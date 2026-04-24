import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  BarChart2, Search, ChevronRight, TrendingUp, TrendingDown,
  Plus, X, CheckCircle, Loader2, AlertTriangle, Package
} from "lucide-react";
import CustoProjetoModal from "../components/financeiro/CustoProjetoModal";

const CATEGORIA_LABELS = {
  kit_equipamentos: "Kit / Equipamentos",
  frete: "Frete",
  mao_de_obra: "Mão de Obra",
  comissao_vendedor: "Comissão Vendedor",
  art_taxas: "ART / Taxas",
  materiais_extras: "Materiais Extras",
  deslocamento: "Deslocamento",
  hospedagem: "Hospedagem",
  outros: "Outros",
};

const STATUS_PROJETO = {
  pago_projeto_iniciado: "Iniciado",
  kit_confirmado: "Kit Confirmado",
  documentos_gerados: "Docs Gerados",
  assinaturas_concluidas: "Assin. OK",
  dossie_ok: "Dossiê OK",
  protocolado_edp: "Protocolado",
  aprovado: "Aprovado",
  instalacao_agendada: "Instal. Agendada",
  sistema_instalado: "Instalado",
  concluido: "Concluído",
};

export default function DREProjeto() {
  const [projetos, setProjetos] = useState([]);
  const [preProjetos, setPreProjetos] = useState([]);
  const [custos, setCustos] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [projetoSelecionado, setProjetoSelecionado] = useState(null);
  const [modalCusto, setModalCusto] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    Promise.all([
      base44.entities.Projeto.list("-created_date", 200),
      base44.entities.PreProjeto.list("-created_date", 200),
      base44.entities.CustoProjeto.list("-created_date", 500),
      base44.entities.Lancamento.list("-created_date", 500),
      base44.auth.me()
    ]).then(([p, pp, c, l, u]) => {
      setProjetos(p);
      setPreProjetos(pp);
      setCustos(c);
      setLancamentos(l);
      setUser(u);
      setLoading(false);
    });
  }, []);

  const canEdit = user?.role === "admin" || user?.role === "financeiro" || user?.role === "engenharia";

  const getDRE = (projeto) => {
    const pp = preProjetos.find(p => p.id === projeto.pre_projeto_id);
    const valorVenda = pp?.valor_projeto ? parseFloat(pp.valor_projeto.toString().replace(/[^\d,.-]/g, "").replace(",", ".")) : 0;
    const custosDir = custos.filter(c => c.projeto_id === projeto.id);
    const totalCustos = custosDir.reduce((s, c) => s + (c.valor || 0), 0);
    // Receitas recebidas via lançamentos vinculados ao projeto
    const receitasRecebidas = lancamentos
      .filter(l => l.projeto_id === projeto.id && l.tipo === "receita" && l.status === "pago")
      .reduce((s, l) => s + (l.valor || 0), 0);
    const margem = valorVenda - totalCustos;
    const margemPct = valorVenda > 0 ? (margem / valorVenda) * 100 : 0;
    return { pp, valorVenda, totalCustos, receitasRecebidas, margem, margemPct, custosDir };
  };

  const filtered = projetos.filter(p =>
    !search ||
    p.nome_cliente?.toLowerCase().includes(search.toLowerCase()) ||
    p.cpf?.includes(search)
  );

  const handleSalvarCusto = async (dados) => {
    const novo = await base44.entities.CustoProjeto.create({ projeto_id: projetoSelecionado.id, ...dados });
    setCustos(prev => [...prev, novo]);
    setModalCusto(false);
  };

  const handleDeletarCusto = async (id) => {
    if (!window.confirm("Remover este custo?")) return;
    await base44.entities.CustoProjeto.delete(id);
    setCustos(prev => prev.filter(c => c.id !== id));
  };

  // Totais globais
  const totalReceitas = projetos.reduce((s, p) => s + getDRE(p).valorVenda, 0);
  const totalCustos = projetos.reduce((s, p) => s + getDRE(p).totalCustos, 0);
  const margemGlobal = totalReceitas > 0 ? ((totalReceitas - totalCustos) / totalReceitas) * 100 : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart2 className="text-amber-400" size={22} /> DRE por Projeto
        </h1>
        <p className="text-slate-400 text-sm mt-1">Margem de contribuição e custos diretos por projeto</p>
      </div>

      {/* Cards globais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5">
          <p className="text-slate-400 text-sm mb-1">Receita Total (portfólio)</p>
          <p className="text-emerald-400 text-2xl font-bold">R$ {totalReceitas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5">
          <p className="text-slate-400 text-sm mb-1">Custos Diretos (lançados)</p>
          <p className="text-red-400 text-2xl font-bold">R$ {totalCustos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`border rounded-2xl p-5 ${margemGlobal >= 20 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"}`}>
          <p className="text-slate-400 text-sm mb-1">Margem Média do Portfólio</p>
          <p className={`text-2xl font-bold ${margemGlobal >= 20 ? "text-amber-400" : "text-red-400"}`}>{margemGlobal.toFixed(1)}%</p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar projeto..."
          className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500" />
      </div>

      {/* Lista de projetos */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-900 rounded-2xl animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(projeto => {
            const { pp, valorVenda, totalCustos: tc, margem, margemPct, custosDir, receitasRecebidas } = getDRE(projeto);
            const isOpen = projetoSelecionado?.id === projeto.id;
            const margemOk = margemPct >= 20;

            return (
              <div key={projeto.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all">
                {/* Linha resumo */}
                <button
                  onClick={() => setProjetoSelecionado(isOpen ? null : projeto)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-800/50 transition-all text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm">{projeto.nome_cliente}</p>
                      <span className="text-xs bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-lg">
                        {STATUS_PROJETO[projeto.status] || projeto.status}
                      </span>
                      {pp?.vendedor_nome && <span className="text-amber-400/60 text-xs">{pp.vendedor_nome}</span>}
                    </div>
                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      <span className="text-slate-500 text-xs">Venda: <span className="text-emerald-400 font-medium">R$ {valorVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                      <span className="text-slate-500 text-xs">Custos: <span className="text-red-400 font-medium">R$ {tc.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-lg ${margemOk ? "text-emerald-400" : tc === 0 ? "text-slate-500" : "text-red-400"}`}>
                      {tc === 0 ? "—" : `${margemPct.toFixed(1)}%`}
                    </p>
                    <p className="text-slate-500 text-xs">margem</p>
                  </div>
                  <ChevronRight size={16} className={`text-slate-500 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
                </button>

                {/* Detalhe expandido */}
                {isOpen && (
                  <div className="border-t border-slate-800 p-5 space-y-4">
                    {/* DRE resumida */}
                    <div className="bg-slate-800/50 rounded-xl p-4 space-y-2">
                      <p className="text-slate-300 font-semibold text-sm mb-3">DRE Simplificada</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">(+) Receita bruta do contrato</span>
                        <span className="text-emerald-400 font-medium">R$ {valorVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                      {custosDir.map(c => (
                        <div key={c.id} className="flex justify-between text-sm">
                          <span className="text-slate-400">(−) {CATEGORIA_LABELS[c.categoria] || c.categoria}{c.descricao ? ` — ${c.descricao}` : ""}</span>
                          <span className="text-red-400">R$ {(c.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                      {custosDir.length === 0 && (
                        <p className="text-slate-600 text-xs italic">Nenhum custo lançado ainda</p>
                      )}
                      <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-bold">
                        <span className={margem >= 0 ? "text-emerald-400" : "text-red-400"}>= Margem de Contribuição</span>
                        <span className={margem >= 0 ? "text-emerald-400" : "text-red-400"}>
                          R$ {margem.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({margemPct.toFixed(1)}%)
                        </span>
                      </div>
                      {receitasRecebidas > 0 && receitasRecebidas < valorVenda && (
                        <div className="flex justify-between text-xs text-amber-400/80 pt-1">
                          <span>↳ Recebido até agora (caixa)</span>
                          <span>R$ {receitasRecebidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>

                    {/* Aviso sem custo de kit */}
                    {!custosDir.some(c => c.categoria === "kit_equipamentos") && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
                        <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                        <p className="text-amber-300 text-xs">Custo do kit não lançado — a margem pode estar superestimada.</p>
                      </div>
                    )}

                    {/* Lista de custos */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">Custos Lançados</p>
                        {canEdit && (
                          <button onClick={() => setModalCusto(true)}
                            className="flex items-center gap-1 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg transition-all">
                            <Plus size={11} /> Adicionar Custo
                          </button>
                        )}
                      </div>
                      {custosDir.length === 0 ? (
                        <p className="text-slate-600 text-sm italic">Nenhum custo lançado.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {custosDir.map(c => (
                            <div key={c.id} className="flex items-center gap-3 bg-slate-800 rounded-xl px-3 py-2.5">
                              <Package size={13} className="text-slate-500 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-300 text-xs font-medium">{CATEGORIA_LABELS[c.categoria] || c.categoria}</p>
                                {c.descricao && <p className="text-slate-500 text-xs truncate">{c.descricao}</p>}
                              </div>
                              <p className="text-red-400 text-sm font-semibold shrink-0">
                                R$ {(c.valor || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </p>
                              {canEdit && (
                                <button onClick={() => handleDeletarCusto(c.id)}
                                  className="w-6 h-6 rounded-lg bg-slate-700 hover:bg-red-500/20 flex items-center justify-center text-slate-500 hover:text-red-400 transition-all shrink-0">
                                  <X size={11} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Link to={createPageUrl(`ProjetoDetalhe?id=${projeto.id}`)}
                      className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:underline">
                      Abrir projeto completo <ChevronRight size={12} />
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal custo */}
      {modalCusto && projetoSelecionado && (
        <CustoProjetoModal
          onSalvar={handleSalvarCusto}
          onFechar={() => setModalCusto(false)}
        />
      )}
    </div>
  );
}