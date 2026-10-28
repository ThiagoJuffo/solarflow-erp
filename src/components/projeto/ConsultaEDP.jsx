import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { consultarEDP } from "@/lib/consultarEDP";
import { RefreshCw, Loader2 } from "lucide-react";

const CAMPOS = [
  ["descricao", "Descrição"], ["status", "Status EDP"], ["dataAbertura", "Abertura"],
  ["previsaoConclusao", "Previsão"], ["nota", "Nota"], ["ordemVenda", "Ordem de venda"],
  ["statusOrdemVenda", "Status OV"], ["parecerOrdemVenda", "Parecer"],
];

export default function ConsultaEDP({ protocolo, onSalvo }) {
  const [res, setRes] = useState(protocolo.edp_consulta || null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const consultar = async () => {
    setLoading(true); setErro("");
    const r = await consultarEDP(protocolo.numero_protocolo).catch(e => ({ ok: false, erro: e.message }));
    setLoading(false);
    if (!r.ok) return setErro(r.erro || "Falha na consulta");
    const dados = { ...r, notas: undefined, ordensVenda: undefined };
    await base44.entities.Protocolo.update(protocolo.id, { edp_consulta: dados });
    setRes(dados);
    onSalvo && onSalvo(dados);
  };

  return (
    <div className="border-t border-slate-700 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs font-semibold">Status no EDP Online</p>
        <button onClick={consultar} disabled={loading || !protocolo.numero_protocolo}
          className="flex items-center gap-1 text-xs bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 px-3 py-1.5 rounded-lg disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Consultar EDP
        </button>
      </div>
      {erro && <p className="text-red-400 text-xs">{erro}</p>}
      {res && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {CAMPOS.filter(([k]) => res[k]).map(([k, l]) => (
            <div key={k} className={k === "parecerOrdemVenda" || k === "descricao" ? "col-span-2" : ""}>
              <span className="text-slate-500">{l}: </span><span className="text-white">{res[k]}</span>
            </div>
          ))}
          {res.consultadoEm && <p className="col-span-2 text-slate-500 mt-1">Consultado em {new Date(res.consultadoEm).toLocaleString("pt-BR")}</p>}
        </div>
      )}
    </div>
  );
}