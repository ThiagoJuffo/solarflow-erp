import { useState } from "react";
import { X, CheckCircle, Loader2, Landmark } from "lucide-react";

const TIPOS = [
  { value: "conta_corrente", label: "Conta corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "caixa", label: "Caixa físico" },
  { value: "investimento", label: "Investimento" },
];

const CORES = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

export default function ContaFinanceiraModal({ conta, onSalvar, onFechar }) {
  const [form, setForm] = useState(conta || {
    nome: "",
    tipo: "conta_corrente",
    banco: "",
    agencia: "",
    numero_conta: "",
    saldo_inicial: "",
    cor: "#f59e0b",
    ativa: true,
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSalvar({ ...form, saldo_inicial: Number(form.saldo_inicial || 0) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
              <Landmark size={17} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">{conta ? "Editar conta" : "Nova conta financeira"}</h3>
              <p className="text-xs text-slate-500">Banco, investimento ou caixa físico</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} className="text-slate-400 transition-colors hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Nome da conta *</label>
            <input required value={form.nome} onChange={(e) => set("nome", e.target.value)}
              placeholder="Ex: Banco principal"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Tipo *</label>
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500">
                {TIPOS.map((tipo) => <option key={tipo.value} value={tipo.value}>{tipo.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Saldo inicial</label>
              <input type="number" step="0.01" value={form.saldo_inicial} onChange={(e) => set("saldo_inicial", e.target.value)}
                placeholder="0,00"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500" />
            </div>
          </div>

          {form.tipo !== "caixa" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Banco</label>
                <input value={form.banco || ""} onChange={(e) => set("banco", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Agência</label>
                <input value={form.agencia || ""} onChange={(e) => set("agencia", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Conta</label>
                <input value={form.numero_conta || ""} onChange={(e) => set("numero_conta", e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500" />
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs text-slate-400">Identificação visual</label>
            <div className="flex gap-2">
              {CORES.map((cor) => (
                <button key={cor} type="button" onClick={() => set("cor", cor)}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${form.cor === cor ? "scale-110 border-white" : "border-transparent"}`}
                  style={{ backgroundColor: cor }} aria-label={`Selecionar cor ${cor}`} />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            <input type="checkbox" checked={form.ativa !== false} onChange={(e) => set("ativa", e.target.checked)}
              className="h-4 w-4 accent-amber-500" />
            <span className="text-sm text-slate-300">Conta ativa para novos lançamentos</span>
          </label>

          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Observações</label>
            <textarea rows={2} value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)}
              className="w-full resize-none rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-400 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? "Salvando..." : "Salvar conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
