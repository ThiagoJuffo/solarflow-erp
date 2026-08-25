import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertCircle, CheckCircle2, FileUp, Loader2, X } from "lucide-react";

const campoClass = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500";
const moeda = (valor) => Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function BaixaFinanceiraModal({ lancamento, contas, onSalvar, onFechar }) {
  const saldoAberto = Math.max(Number(lancamento.valor || 0) - Number(lancamento.valor_pago || 0), 0);
  const [form, setForm] = useState({
    valor: saldoAberto,
    data: new Date().toISOString().split("T")[0],
    conta_financeira_id: lancamento.conta_financeira_id || "",
    forma_pagamento: lancamento.forma_pagamento || "",
    comprovante_uri: "",
    observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [erro, setErro] = useState("");
  const set = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const enviarComprovante = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      set("comprovante_uri", file_uri);
      set("comprovante_nome", file.name);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const valor = Number(form.valor || 0);
    if (valor <= 0 || valor > saldoAberto + 0.01) return;
    if (!form.conta_financeira_id) {
      setErro("Selecione a conta financeira usada no pagamento ou recebimento.");
      return;
    }
    setErro("");
    setSaving(true);
    try {
      await onSalvar({ ...form, valor });
    } catch (error) {
      setErro(error?.message || "Não foi possível registrar a baixa.");
    } finally {
      setSaving(false);
    }
  };

  const valorInformado = Number(form.valor || 0);
  const saldoDepois = Math.max(saldoAberto - valorInformado, 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h3 className="font-bold text-white">{lancamento.tipo === "receita" ? "Registrar recebimento" : "Registrar pagamento"}</h3>
            <p className="text-xs text-slate-500">Baixa parcial ou total do lançamento.</p>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm font-medium text-white">{lancamento.descricao}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] uppercase text-slate-500">Total</p>
                <p className="mt-1 text-xs font-semibold text-white">{moeda(lancamento.valor)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Já baixado</p>
                <p className="mt-1 text-xs font-semibold text-emerald-400">{moeda(lancamento.valor_pago)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Em aberto</p>
                <p className="mt-1 text-xs font-semibold text-amber-400">{moeda(saldoAberto)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Valor da baixa *</label>
              <input required type="number" min="0.01" max={saldoAberto} step="0.01" value={form.valor}
                onChange={(e) => set("valor", e.target.value)} className={campoClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Data *</label>
              <input required type="date" value={form.data} onChange={(e) => set("data", e.target.value)} className={campoClass} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Conta financeira *</label>
              <select required value={form.conta_financeira_id} onChange={(e) => set("conta_financeira_id", e.target.value)} className={campoClass}>
                <option value="">Selecione a conta...</option>
                {contas.filter((conta) => conta.ativa !== false).map((conta) => (
                  <option key={conta.id} value={conta.id}>{conta.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Forma de pagamento</label>
              <select value={form.forma_pagamento} onChange={(e) => set("forma_pagamento", e.target.value)} className={campoClass}>
                <option value="">Selecionar...</option>
                <option value="pix">Pix</option>
                <option value="boleto">Boleto</option>
                <option value="cartao">Cartão</option>
                <option value="transferencia">Transferência</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="financiamento">Financiamento</option>
                <option value="debito_automatico">Débito automático</option>
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-4 hover:border-amber-500/50">
            {uploading ? <Loader2 size={18} className="animate-spin text-amber-400" /> : <FileUp size={18} className="text-amber-400" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-300">{form.comprovante_nome || "Anexar comprovante"}</p>
              <p className="text-xs text-slate-500">O arquivo será armazenado de forma privada.</p>
            </div>
            <input type="file" className="hidden" onChange={enviarComprovante} />
          </label>

          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Observações</label>
            <textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)}
              className={`${campoClass} resize-none`} />
          </div>

          <div className={`rounded-xl px-4 py-3 text-sm ${saldoDepois < 0.01 ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-300"}`}>
            {saldoDepois < 0.01 ? "Esta baixa liquidará o lançamento." : `Saldo restante: ${moeda(saldoDepois)}`}
          </div>

          {erro && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertCircle size={14} /> {erro}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700">
              Cancelar
            </button>
            <button type="submit" disabled={saving || uploading || !form.conta_financeira_id || valorInformado <= 0 || valorInformado > saldoAberto + 0.01}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {saving ? "Salvando..." : "Confirmar baixa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
