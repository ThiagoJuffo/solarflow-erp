import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Wrench, Search, Plus, ChevronRight, Calendar, DollarSign, X, Loader2, CheckCircle, Clock, Target } from "lucide-react";

const STATUS_LABELS = {
  agendar: "A Agendar",
  agendada: "Agendada",
  concluida: "Concluída",
  cancelada: "Cancelada"
};

const STATUS_COLORS = {
  agendar: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  agendada: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  concluida: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cancelada: "bg-red-500/10 text-red-400 border-red-500/20"
};

const fmt = (v) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—";

export default function Manutencoes() {
  const [manutencoes, setManutencoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metaValor, setMetaValor] = useState(10000);
  const [metaQuantidade, setMetaQuantidade] = useState(10);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [form, setForm] = useState({
    nome_cliente: "", kit: "", endereco: "", valor: "", condicao_pagamento: ""
  });

  useEffect(() => {
    base44.entities.Manutencao.list("-created_date", 200).then(setManutencoes).finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleCriar = async () => {
    if (!form.nome_cliente) return;
    setSaving(true);
    const nova = await base44.entities.Manutencao.create({
      ...form,
      valor: form.valor ? Number(form.valor) : null,
      status: "agendar"
    });
    setManutencoes(prev => [nova, ...prev]);
    setForm({ nome_cliente: "", kit: "", endereco: "", valor: "", condicao_pagamento: "" });
    setShowModal(false);
    setSaving(false);
  };

  // Manutenções do mês atual
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const manutencoesDoMes = manutencoes.filter(m => {
    const data = m.data_agendamento ? new Date(m.data_agendamento) : new Date(m.created_date);
    return data >= inicioMes && m.status !== "cancelada";
  });
  const valorMes = manutencoesDoMes.reduce((acc, m) => acc + (m.valor || 0), 0);
  const qtdAgendadas = manutencoesDoMes.filter(m => m.status === "agendada" || m.status === "concluida").length;

  const pctValor = Math.min((valorMes / metaValor) * 100, 100);
  const pctQtd = Math.min((qtdAgendadas / metaQuantidade) * 100, 100);

  const filtered = manutencoes.filter(m => {
    const matchSearch = !search || m.nome_cliente?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === "todos" || m.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wrench className="text-amber-400" size={22} /> Manutenções
          </h1>
          <p className="text-slate-400 text-sm mt-1">{manutencoes.length} manutenções cadastradas</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/20"
        >
          <Plus size={16} /> Nova Manutenção
        </button>
      </div>

      {/* Meta Mensal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Target size={16} className="text-amber-400" /> Meta Mensal — {agora.toLocaleString("pt-BR", { month: "long", year: "numeric" })}
          </h2>
          <button
            onClick={() => setEditandoMeta(v => !v)}
            className="text-xs text-slate-400 hover:text-white underline transition-colors"
          >
            {editandoMeta ? "Fechar" : "Editar meta"}
          </button>
        </div>

        {editandoMeta && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Meta de Valor (R$)</label>
              <input type="number" value={metaValor} onChange={e => setMetaValor(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1 block">Meta de Quantidade</label>
              <input type="number" value={metaQuantidade} onChange={e => setMetaQuantidade(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Meta Valor */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-xs flex items-center gap-1"><DollarSign size={12} /> Valor faturado</span>
              <span className="text-white text-xs font-semibold">{fmt(valorMes)} / {fmt(metaValor)}</span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pctValor >= 100 ? "bg-emerald-500" : pctValor >= 60 ? "bg-amber-500" : "bg-amber-500/60"}`}
                style={{ width: `${pctValor}%` }}
              />
            </div>
            <p className={`text-xs font-medium ${pctValor >= 100 ? "text-emerald-400" : "text-slate-400"}`}>
              {pctValor >= 100 ? "✓ Meta atingida!" : `${pctValor.toFixed(0)}% da meta`}
            </p>
          </div>

          {/* Meta Quantidade */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-xs flex items-center gap-1"><Wrench size={12} /> Manutenções agendadas</span>
              <span className="text-white text-xs font-semibold">{qtdAgendadas} / {metaQuantidade}</span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pctQtd >= 100 ? "bg-emerald-500" : pctQtd >= 60 ? "bg-blue-500" : "bg-blue-500/60"}`}
                style={{ width: `${pctQtd}%` }}
              />
            </div>
            <p className={`text-xs font-medium ${pctQtd >= 100 ? "text-emerald-400" : "text-slate-400"}`}>
              {pctQtd >= 100 ? "✓ Meta atingida!" : `${pctQtd.toFixed(0)}% da meta`}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome do cliente..."
            className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["todos", "agendar", "agendada", "concluida", "cancelada"].map(s => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all capitalize ${filtroStatus === s ? "bg-amber-500 text-white" : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"}`}
            >
              {s === "todos" ? "Todos" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-slate-900 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center">
          <Wrench size={32} className="text-amber-400/30 mx-auto mb-4" />
          <p className="text-slate-400">Nenhuma manutenção encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 md:p-5 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
                  <Wrench size={16} className="text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{m.nome_cliente}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <DollarSign size={10} /> {m.valor ? fmt(m.valor) : "—"}
                    </span>
                    <span className="text-slate-400 text-xs flex items-center gap-1">
                      <Calendar size={10} />
                      {m.data_agendamento ? new Date(m.data_agendamento).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Sem data"}
                    </span>
                    {m.condicao_pagamento && (
                      <span className="text-slate-400 text-xs">{m.condicao_pagamento}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${STATUS_COLORS[m.status]}`}>
                    {STATUS_LABELS[m.status]}
                  </span>
                  <Link
                    to={createPageUrl(`ManutencaoDetalhe?id=${m.id}`)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
                  >
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Manutenção */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base flex items-center gap-2"><Wrench size={16} className="text-amber-400" /> Nova Manutenção</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Nome do Cliente *</label>
                <input value={form.nome_cliente} onChange={e => set("nome_cliente", e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Kit (Sistema Solar)</label>
                <textarea value={form.kit} onChange={e => set("kit", e.target.value)}
                  placeholder="Ex: 12x Canadian 550W + Inversor Solplanet 5kW"
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600 resize-none" />
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1.5 block">Endereço</label>
                <input value={form.endereco} onChange={e => set("endereco", e.target.value)}
                  placeholder="Ex: Rua X, 123 - Bairro, Cidade-ES"
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">Valor (R$)</label>
                  <input type="number" value={form.valor} onChange={e => set("valor", e.target.value)}
                    placeholder="Ex: 500"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs mb-1.5 block">Condição de Pagamento</label>
                  <input value={form.condicao_pagamento} onChange={e => set("condicao_pagamento", e.target.value)}
                    placeholder="Ex: À vista, Pix"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder-slate-600" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium transition-all">Cancelar</button>
              <button onClick={handleCriar} disabled={saving || !form.nome_cliente}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}