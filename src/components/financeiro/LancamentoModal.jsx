import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, CheckCircle, FileUp, Loader2, ReceiptText } from "lucide-react";

const CATEGORIAS_RECEITA = [
  { value: "venda_projeto", label: "Venda de projeto" },
  { value: "outros", label: "Outras receitas" },
];

const CATEGORIAS_DESPESA = [
  { value: "kit_equipamentos", label: "Kit / Equipamentos" },
  { value: "mao_de_obra", label: "Mão de obra" },
  { value: "comissao", label: "Comissão de vendedor" },
  { value: "despesa_operacional", label: "Despesa operacional" },
  { value: "despesa_marketing", label: "Marketing" },
  { value: "despesa_financeira", label: "Custo financeiro / Banco" },
  { value: "imposto", label: "Impostos" },
  { value: "pro_labore", label: "Pró-labore" },
  { value: "distribuicao_lucro", label: "Distribuição de lucro" },
  { value: "capex", label: "CAPEX / Investimento" },
  { value: "outros", label: "Outras despesas" },
];

const campoClass = "w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-amber-500";

export default function LancamentoModal({ lancamento, projetos, contas, centros = [], onSalvar, onFechar }) {
  const hoje = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState(lancamento || {
    tipo: "despesa",
    categoria: "",
    descricao: "",
    valor: "",
    data_competencia: hoje,
    data_vencimento: hoje,
    data_pagamento: "",
    status: "pendente",
    forma_pagamento: "",
    projeto_id: "",
    conta_financeira_id: "",
    centro_custo_id: "",
    nome_cliente_fornecedor: "",
    documento_cliente_fornecedor: "",
    numero_documento: "",
    parcela_atual: 1,
    total_parcelas: 1,
    observacoes: "",
    recorrente: false,
    frequencia_recorrencia: "mensal",
    quantidade_recorrencias: 1,
    anexos: [],
    conciliado: false,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const set = (campo, valor) => setForm((atual) => ({ ...atual, [campo]: valor }));

  const categorias = useMemo(
    () => form.tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA,
    [form.tipo]
  );
  const centrosPrincipais = useMemo(
    () => centros.filter((centro) => centro.ativo !== false && centro.tipo !== "subcentro"),
    [centros]
  );
  const centroSelecionado = centros.find((centro) => centro.id === form.centro_custo_id);
  const centroPrincipalId = centroSelecionado?.tipo === "subcentro"
    ? centroSelecionado.centro_pai_id
    : centroSelecionado?.id || "";
  const subcentrosDisponiveis = centros.filter((centro) =>
    centro.ativo !== false &&
    centro.tipo === "subcentro" &&
    centro.centro_pai_id === centroPrincipalId
  );

  const selecionarProjeto = (projetoId) => {
    const centroDoProjeto = centrosPrincipais.find((centro) => centro.projeto_id === projetoId);
    setForm((atual) => ({
      ...atual,
      projeto_id: projetoId,
      centro_custo_id: centroDoProjeto?.id || "",
      centro_custo: projetoId ? "projetos" : "",
    }));
  };

  const selecionarCentroPrincipal = (centroId) => {
    const centro = centros.find((item) => item.id === centroId);
    setForm((atual) => ({
      ...atual,
      centro_custo_id: centroId,
      projeto_id: centroId ? (centro?.projeto_id || atual.projeto_id) : "",
      centro_custo: centro?.tipo === "projeto_cliente" ? "projetos" : "",
    }));
  };

  const enviarAnexo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      setForm((atual) => ({
        ...atual,
        anexos: [...(atual.anexos || []), {
          nome: file.name,
          tipo: file.type || "documento",
          file_uri,
          data_upload: new Date().toISOString(),
        }],
      }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const dados = {
        ...form,
        valor: Number(form.valor),
        parcela_atual: Number(form.parcela_atual || 1),
        total_parcelas: Number(form.total_parcelas || 1),
        quantidade_recorrencias: Number(form.quantidade_recorrencias || 1),
        valor_pago: form.status === "pago" ? Number(form.valor) : Number(form.valor_pago || 0),
      };
      if (dados.status === "pago" && !dados.data_pagamento) dados.data_pagamento = hoje;
      await onSalvar(dados);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
              <ReceiptText size={17} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white">{lancamento ? "Editar lançamento" : "Novo lançamento"}</h3>
              <p className="text-xs text-slate-500">Contas a pagar e a receber</p>
            </div>
          </div>
          <button type="button" onClick={onFechar} className="text-slate-400 transition-colors hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid grid-cols-2 gap-2">
            {["receita", "despesa"].map((tipo) => (
              <button key={tipo} type="button"
                onClick={() => { set("tipo", tipo); set("categoria", ""); }}
                className={`rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  form.tipo === tipo
                    ? tipo === "receita" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}>
                {tipo === "receita" ? "↑ Conta a receber" : "↓ Conta a pagar"}
              </button>
            ))}
          </div>

          <section className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dados principais</p>
            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Descrição *</label>
              <input required value={form.descricao} onChange={(e) => set("descricao", e.target.value)}
                placeholder={form.tipo === "receita" ? "Ex: Parcela do projeto João Silva" : "Ex: Pagamento do fornecedor"}
                className={campoClass} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Valor (R$) *</label>
                <input required type="number" min="0" step="0.01" value={form.valor}
                  onChange={(e) => set("valor", e.target.value)} placeholder="0,00" className={campoClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Competência</label>
                <input type="date" value={form.data_competencia || ""} onChange={(e) => set("data_competencia", e.target.value)}
                  className={campoClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Vencimento *</label>
                <input required type="date" value={form.data_vencimento} onChange={(e) => set("data_vencimento", e.target.value)}
                  className={campoClass} />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">Categoria financeira *</label>
              <select required value={form.categoria} onChange={(e) => set("categoria", e.target.value)} className={campoClass}>
                <option value="">Selecionar...</option>
                {categorias.map((categoria) => <option key={categoria.value} value={categoria.value}>{categoria.label}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">A categoria informa o tipo da receita ou despesa; não é um centro de custo.</p>
            </div>
          </section>

          <section className="space-y-4 border-t border-slate-800 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Relacionamentos e documento</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Cliente / Fornecedor</label>
                <input value={form.nome_cliente_fornecedor || ""} onChange={(e) => set("nome_cliente_fornecedor", e.target.value)}
                  placeholder="Nome ou razão social" className={campoClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">CPF / CNPJ</label>
                <input value={form.documento_cliente_fornecedor || ""} onChange={(e) => set("documento_cliente_fornecedor", e.target.value)}
                  placeholder="Documento" className={campoClass} />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Projeto relacionado</label>
                <select value={form.projeto_id || ""} onChange={(e) => selecionarProjeto(e.target.value)} className={campoClass}>
                  <option value="">Nenhum projeto</option>
                  {projetos.map((projeto) => (
                    <option key={projeto.id} value={projeto.id}>{projeto.nome_cliente} — {projeto.cpf}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Número do documento</label>
                <input value={form.numero_documento || ""} onChange={(e) => set("numero_documento", e.target.value)}
                  placeholder="NF, boleto ou referência" className={campoClass} />
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="mb-3">
                <p className="text-sm font-medium text-white">Destino do lançamento</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  O centro principal identifica o projeto ou área. O subcentro é uma divisão opcional.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">Centro de custo principal</label>
                  <select value={centroPrincipalId} onChange={(e) => selecionarCentroPrincipal(e.target.value)} className={campoClass}>
                    <option value="">Não informado</option>
                    {centrosPrincipais.map((centro) => (
                      <option key={centro.id} value={centro.id}>
                        {centro.tipo === "projeto_cliente" ? "Projeto: " : ""}{centro.nome}
                      </option>
                    ))}
                  </select>
                  {form.projeto_id && centroPrincipalId && (
                    <p className="mt-1 text-[11px] text-emerald-400">Preenchido automaticamente pelo projeto.</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">Subcentro de custo (opcional)</label>
                  <select disabled={!centroPrincipalId || !subcentrosDisponiveis.length}
                    value={centroSelecionado?.tipo === "subcentro" ? centroSelecionado.id : ""}
                    onChange={(e) => set("centro_custo_id", e.target.value || centroPrincipalId)}
                    className={`${campoClass} disabled:cursor-not-allowed disabled:opacity-50`}>
                    <option value="">Sem divisão adicional</option>
                    {subcentrosDisponiveis.map((centro) => (
                      <option key={centro.id} value={centro.id}>{centro.nome}</option>
                    ))}
                  </select>
                  {centroPrincipalId && !subcentrosDisponiveis.length && (
                    <p className="mt-1 text-[11px] text-slate-500">Este centro ainda não possui subcentros.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Parcelamento</label>
                <input type="number" min="1" max="120" value={form.total_parcelas || 1}
                  onChange={(e) => set("total_parcelas", e.target.value)} className={campoClass} />
                {!lancamento && Number(form.total_parcelas || 1) > 1 && (
                  <p className="mt-1 text-[11px] text-slate-500">O valor total será dividido e os vencimentos serão mensais.</p>
                )}
              </div>
              <label className="mt-6 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <input type="checkbox" checked={Boolean(form.recorrente)}
                  onChange={(e) => {
                    set("recorrente", e.target.checked);
                    if (e.target.checked) set("total_parcelas", 1);
                  }} className="h-4 w-4 accent-amber-500" />
                <span className="text-sm text-slate-300">Lançamento recorrente</span>
              </label>
            </div>

            {form.recorrente && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">Frequência</label>
                  <select value={form.frequencia_recorrencia || "mensal"}
                    onChange={(e) => set("frequencia_recorrencia", e.target.value)} className={campoClass}>
                    <option value="semanal">Semanal</option>
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">Quantidade de lançamentos</label>
                  <input type="number" min="1" max="120" value={form.quantidade_recorrencias || 1}
                    onChange={(e) => set("quantidade_recorrencias", e.target.value)} className={campoClass} />
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 border-t border-slate-800 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Liquidação</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Status</label>
                <select value={form.status} onChange={(e) => set("status", e.target.value)} className={campoClass}>
                  <option value="pendente">Pendente</option>
                  <option value="parcial">Parcialmente liquidado</option>
                  <option value="pago">{form.tipo === "receita" ? "Recebido" : "Pago"}</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Forma de pagamento</label>
                <select value={form.forma_pagamento || ""} onChange={(e) => set("forma_pagamento", e.target.value)}
                  className={campoClass}>
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
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">Conta financeira</label>
                <select value={form.conta_financeira_id || ""} onChange={(e) => set("conta_financeira_id", e.target.value)}
                  className={campoClass}>
                  <option value="">Não informada</option>
                  {contas.filter((conta) => conta.ativa !== false).map((conta) => (
                    <option key={conta.id} value={conta.id}>{conta.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {form.status === "pago" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs text-slate-400">Data da liquidação</label>
                  <input type="date" value={form.data_pagamento || ""} onChange={(e) => set("data_pagamento", e.target.value)}
                    className={campoClass} />
                </div>
                <label className="mt-6 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <input type="checkbox" checked={Boolean(form.conciliado)}
                    onChange={(e) => set("conciliado", e.target.checked)} className="h-4 w-4 accent-amber-500" />
                  <span className="text-sm text-slate-300">Movimento conciliado</span>
                </label>
              </div>
            )}
          </section>

          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Notas, boletos e documentos</label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-4 hover:border-amber-500/50">
              {uploading ? <Loader2 size={18} className="animate-spin text-amber-400" /> : <FileUp size={18} className="text-amber-400" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-300">Adicionar arquivo privado</p>
                <p className="text-xs text-slate-500">{(form.anexos || []).length} arquivo(s) anexado(s)</p>
              </div>
              <input type="file" className="hidden" onChange={enviarAnexo} />
            </label>
            {(form.anexos || []).length > 0 && (
              <div className="mt-2 space-y-1">
                {form.anexos.map((anexo, indice) => (
                  <div key={`${anexo.file_uri}-${indice}`} className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-300">
                    <span className="truncate">{anexo.nome || `Arquivo ${indice + 1}`}</span>
                    <button type="button" onClick={() => set("anexos", form.anexos.filter((_, i) => i !== indice))}
                      className="ml-3 text-slate-500 hover:text-red-400">Remover</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Observações</label>
            <textarea rows={3} value={form.observacoes || ""} onChange={(e) => set("observacoes", e.target.value)}
              className={`${campoClass} resize-none`} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onFechar}
              className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700">
              Cancelar
            </button>
            <button type="submit" disabled={saving || uploading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-400 disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? "Salvando..." : "Salvar lançamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
