import { useState } from "react";
import { X, CheckCircle, Loader2 } from "lucide-react";

const CATEGORIAS_RECEITA = [
  { value: "venda_projeto", label: "Venda de Projeto" },
  { value: "outros", label: "Outros" },
];

const CATEGORIAS_DESPESA = [
  { value: "kit_equipamentos", label: "Kit / Equipamentos" },
  { value: "mao_de_obra", label: "Mão de Obra" },
  { value: "comissao", label: "Comissão de Vendedor" },
  { value: "despesa_operacional", label: "Despesa Operacional" },
  { value: "despesa_marketing", label: "Marketing" },
  { value: "despesa_financeira", label: "Custo Financeiro / Banco" },
  { value: "imposto", label: "Impostos" },
  { value: "pro_labore", label: "Pró-labore" },
  { value: "distribuicao_lucro", label: "Distribuição de Lucro" },
  { value: "capex", label: "CAPEX / Investimento" },
  { value: "outros", label: "Outros" },
];

export default function LancamentoModal({ lancamento, projetos, onSalvar, onFechar }) {
  const [form, setForm] = useState(lancamento || {
    tipo: "despesa",
    categoria: "",
    descricao: "",
    valor: "",
    data_vencimento: new Date().toISOString().split("T")[0],
    status: "pendente",
    forma_pagamento: "",
    projeto_id: "",
    nome_cliente_fornecedor: "",
    observacoes: "",
    recorrente: false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSalvar({ ...form, valor: Number(form.valor) });
    setSaving(false);
  };

  const categorias = form.tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-white font-bold">{lancamento ? "Editar Lançamento" : "Novo Lançamento"}</h3>
          <button onClick={onFechar} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tipo */}
          <div className="flex gap-2">
            {["receita", "despesa"].map(t => (
              <button key={t} type="button" onClick={() => { set("tipo", t); set("categoria", ""); }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${form.tipo === t
                  ? t === "receita" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                {t === "receita" ? "↑ Receita" : "↓ Despesa"}
              </button>
            ))}
          </div>

          {/* Campos principais */}
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Descrição *</label>
            <input value={form.descricao} onChange={e => set("descricao", e.target.value)} required
              placeholder="Ex: Pagamento projeto João Silva"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Valor (R$) *</label>
              <input type="number" step="0.01" min="0" value={form.valor} onChange={e => set("valor", e.target.value)} required
                placeholder="0,00"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Data de Vencimento *</label>
              <input type="date" value={form.data_vencimento} onChange={e => set("data_vencimento", e.target.value)} required
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Categoria *</label>
              <select value={form.categoria} onChange={e => set("categoria", e.target.value)} required
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                <option value="">Selecionar...</option>
                {categorias.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Forma de Pagamento</label>
              <select value={form.forma_pagamento || ""} onChange={e => set("forma_pagamento", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
                <option value="">Selecionar...</option>
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="cartao">Cartão</option>
                <option value="transferencia">Transferência</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="financiamento">Financiamento</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Cliente / Fornecedor</label>
            <input value={form.nome_cliente_fornecedor || ""} onChange={e => set("nome_cliente_fornecedor", e.target.value)}
              placeholder="Nome do cliente ou fornecedor"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Vincular a Projeto (opcional)</label>
            <select value={form.projeto_id || ""} onChange={e => set("projeto_id", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="">Nenhum projeto</option>
              {projetos.map(p => <option key={p.id} value={p.id}>{p.nome_cliente} — {p.cpf}</option>)}
            </select>
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Status</label>
            <select value={form.status} onChange={e => set("status", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {form.status === "pago" && (
            <div>
              <label className="text-slate-400 text-xs mb-1.5 block">Data do Pagamento</label>
              <input type="date" value={form.data_pagamento || ""} onChange={e => set("data_pagamento", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          )}

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Observações</label>
            <textarea value={form.observacoes || ""} onChange={e => set("observacoes", e.target.value)} rows={2}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}