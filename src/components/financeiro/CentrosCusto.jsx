import { useMemo, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, Edit3, Loader2, Plus, Target, X } from "lucide-react";

const moeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const campoClass = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500";

function CentroModal({ centro, centros, projetos, onSalvar, onFechar }) {
  const [form, setForm] = useState(centro || {
    nome: "",
    codigo: "",
    tipo: "projeto_cliente",
    projeto_id: "",
    centro_pai_id: "",
    cliente_nome: "",
    orcamento: "",
    ativo: true,
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const selecionarProjeto = (projetoId) => {
    const projeto = projetos.find((item) => item.id === projetoId);
    setForm((atual) => ({
      ...atual,
      projeto_id: projetoId,
      cliente_nome: projeto?.nome_cliente || atual.cliente_nome,
      nome: projetoId && !atual.nome ? `Projeto — ${projeto?.nome_cliente || ""}` : atual.nome,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSalvar({ ...form, orcamento: Number(form.orcamento || 0) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h3 className="font-bold text-white">{centro ? "Editar centro de custo" : "Novo centro de custo"}</h3>
            <p className="text-xs text-slate-500">Separe resultados por projeto, cliente ou área.</p>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Nome *</label>
              <input required value={form.nome} onChange={(e) => set("nome", e.target.value)}
                placeholder="Ex: Projeto João Silva" className={campoClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Código</label>
              <input value={form.codigo || ""} onChange={(e) => set("codigo", e.target.value)}
                placeholder="CC-001" className={campoClass} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Tipo</label>
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} className={campoClass}>
                <option value="projeto_cliente">Projeto / Cliente</option>
                <option value="departamento">Departamento</option>
                <option value="administrativo">Administrativo</option>
                <option value="subcentro">Subcentro</option>
                <option value="outros">Outros</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Orçamento</label>
              <input type="number" min="0" step="0.01" value={form.orcamento || ""}
                onChange={(e) => set("orcamento", e.target.value)} placeholder="0,00" className={campoClass} />
            </div>
          </div>

          {form.tipo === "subcentro" && (
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Centro principal *</label>
              <select required value={form.centro_pai_id || ""} onChange={(e) => set("centro_pai_id", e.target.value)} className={campoClass}>
                <option value="">Selecionar centro principal...</option>
                {centros.filter((item) => item.id !== centro?.id && item.tipo !== "subcentro").map((item) => (
                  <option key={item.id} value={item.id}>{item.nome}</option>
                ))}
              </select>
            </div>
          )}

          {form.tipo === "projeto_cliente" && (
            <>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Projeto relacionado</label>
                <select value={form.projeto_id || ""} onChange={(e) => selecionarProjeto(e.target.value)} className={campoClass}>
                  <option value="">Selecionar projeto...</option>
                  {projetos.map((projeto) => (
                    <option key={projeto.id} value={projeto.id}>{projeto.nome_cliente} — {projeto.cpf}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Cliente</label>
                <input value={form.cliente_nome || ""} onChange={(e) => set("cliente_nome", e.target.value)}
                  placeholder="Nome do cliente" className={campoClass} />
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Observações</label>
            <textarea rows={3} value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)}
              className={`${campoClass} resize-none`} />
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <input type="checkbox" checked={form.ativo !== false} onChange={(e) => set("ativo", e.target.checked)}
              className="h-4 w-4 accent-amber-500" />
            <span className="text-sm text-slate-300">Centro de custo ativo</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CentrosCusto({ centros, projetos, lancamentos, canEdit, onSalvar, onAlternar }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);

  const cards = useMemo(() => centros.map((centro) => {
    const vinculados = lancamentos.filter((l) =>
      l.centro_custo_id === centro.id ||
      (!l.centro_custo_id && centro.projeto_id && l.projeto_id === centro.projeto_id)
    ).filter((l) => l.status !== "cancelado");
    const receitas = vinculados.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor || 0), 0);
    const despesas = vinculados.filter((l) => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor || 0), 0);
    return { ...centro, receitas, despesas, resultado: receitas - despesas, quantidade: vinculados.length };
  }), [centros, lancamentos]);

  const salvar = async (dados) => {
    await onSalvar(dados, editando);
    setModalOpen(false);
    setEditando(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Centros de custo</h2>
          <p className="text-sm text-slate-500">Resultado separado por projeto, cliente ou departamento.</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditando(null); setModalOpen(true); }}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-400">
            <Plus size={16} /> Novo centro
          </button>
        )}
      </div>

      {cards.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((centro) => {
            const consumo = centro.orcamento > 0 ? Math.min((centro.despesas / centro.orcamento) * 100, 100) : 0;
            return (
              <div key={centro.id} className={`rounded-2xl border bg-slate-900 p-5 ${centro.ativo === false ? "border-slate-800 opacity-60" : "border-slate-700"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                      {centro.tipo === "projeto_cliente" ? <BriefcaseBusiness size={18} /> : <Target size={18} />}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{centro.nome}</p>
                      <p className="text-xs text-slate-500">{centro.codigo || centro.cliente_nome || centro.tipo.replaceAll("_", " ")}</p>
                    </div>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-[11px] ${centro.ativo === false ? "bg-slate-800 text-slate-500" : "bg-emerald-500/10 text-emerald-400"}`}>
                    {centro.ativo === false ? "Inativo" : "Ativo"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-800/70 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">Receitas</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-400">{moeda(centro.receitas)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-800/70 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-slate-500">Despesas</p>
                    <p className="mt-1 text-sm font-semibold text-red-400">{moeda(centro.despesas)}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Resultado</span>
                  <span className={`font-bold ${centro.resultado >= 0 ? "text-white" : "text-red-400"}`}>{moeda(centro.resultado)}</span>
                </div>

                {centro.orcamento > 0 && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[11px] text-slate-500">
                      <span>Orçamento utilizado</span><span>{consumo.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${consumo > 90 ? "bg-red-500" : consumo > 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${consumo}%` }} />
                    </div>
                  </div>
                )}

                {canEdit && (
                  <div className="mt-5 flex gap-2 border-t border-slate-800 pt-4">
                    <button onClick={() => { setEditando(centro); setModalOpen(true); }}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-800 py-2 text-xs font-medium text-slate-300 hover:text-white">
                      <Edit3 size={13} /> Editar
                    </button>
                    <button onClick={() => onAlternar(centro)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white">
                      {centro.ativo === false ? "Ativar" : "Inativar"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-12 text-center">
          <Target size={34} className="mx-auto mb-3 text-slate-700" />
          <p className="font-medium text-white">Nenhum centro de custo cadastrado</p>
          <p className="mt-1 text-sm text-slate-500">Crie um centro para cada projeto ou cliente.</p>
        </div>
      )}

      {modalOpen && (
        <CentroModal centro={editando} centros={centros} projetos={projetos} onSalvar={salvar}
          onFechar={() => { setModalOpen(false); setEditando(null); }} />
      )}
    </div>
  );
}
