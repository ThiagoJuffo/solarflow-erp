import { useState } from "react";
import { X, CheckCircle, Loader2 } from "lucide-react";

const CATEGORIAS = [
  { value: "kit_equipamentos", label: "Kit / Equipamentos" },
  { value: "frete", label: "Frete" },
  { value: "mao_de_obra", label: "Mão de Obra" },
  { value: "comissao_vendedor", label: "Comissão Vendedor" },
  { value: "art_taxas", label: "ART / Taxas" },
  { value: "materiais_extras", label: "Materiais Extras" },
  { value: "deslocamento", label: "Deslocamento" },
  { value: "hospedagem", label: "Hospedagem" },
  { value: "outros", label: "Outros" },
];

export default function CustoProjetoModal({ onSalvar, onFechar }) {
  const [form, setForm] = useState({
    categoria: "",
    descricao: "",
    valor: "",
    data: new Date().toISOString().split("T")[0],
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSalvar({ ...form, valor: Number(form.valor) });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-white font-bold">Lançar Custo no Projeto</h3>
          <button onClick={onFechar} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Categoria *</label>
            <select value={form.categoria} onChange={e => set("categoria", e.target.value)} required
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
              <option value="">Selecionar...</option>
              {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Descrição</label>
            <input value={form.descricao} onChange={e => set("descricao", e.target.value)}
              placeholder="Ex: Solplanet 8kW x2 — Aldo Solar"
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
              <label className="text-slate-400 text-xs mb-1.5 block">Data</label>
              <input type="date" value={form.data} onChange={e => set("data", e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1.5 block">Observações</label>
            <textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm transition-all">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? "Salvando..." : "Lançar Custo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}