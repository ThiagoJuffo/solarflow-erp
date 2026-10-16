import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import GarantiaModal from "@/components/garantias/GarantiaModal";

const STATUS = {
  aberto: ["Aberto", "bg-blue-500/20 text-blue-300"],
  aprovado: ["Aprovado", "bg-green-500/20 text-green-300"],
  recusado: ["Recusado", "bg-red-500/20 text-red-300"],
  concluido: ["Concluído", "bg-slate-500/20 text-slate-300"],
};

export default function Garantias() {
  const [itens, setItens] = useState(null);
  const [open, setOpen] = useState(false);

  const carregar = async () => {
    const page = await base44.entities.Garantia.filter({}, { sort: "-created_date", limit: 100 });
    setItens(page.items);
  };
  useEffect(() => { carregar(); }, []);

  const mudarStatus = async (id, status) => {
    await base44.entities.Garantia.update(id, { status });
    carregar();
  };

  return (
    <div className="p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Garantias</h1>
        <Button onClick={() => setOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-black">
          <Plus size={16} className="mr-1" /> Adicionar garantia
        </Button>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-slate-400 border-b border-slate-800">
            <tr>{["Nome", "Marca", "SN", "Protocolo", "Status"].map(h => <th key={h} className="text-left p-3">{h}</th>)}</tr>
          </thead>
          <tbody>
            {itens === null && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Carregando...</td></tr>}
            {itens?.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-500">Nenhuma garantia cadastrada</td></tr>}
            {itens?.map(g => (
              <tr key={g.id} className="border-b border-slate-800/60">
                <td className="p-3"><Link to={`/GarantiaDetalhe?id=${g.id}`} className="text-amber-400 hover:underline">{g.nome}</Link></td>
                <td className="p-3 text-slate-300">{g.marca || "—"}</td>
                <td className="p-3 text-slate-300">{g.sn || "—"}</td>
                <td className="p-3 text-slate-300">{g.numero_protocolo || "—"}</td>
                <td className="p-3">
                  <select value={g.status} onChange={e => mudarStatus(g.id, e.target.value)}
                    className={`rounded-md px-2 py-1 text-xs border-0 ${STATUS[g.status]?.[1]}`}>
                    {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k} className="bg-slate-900 text-white">{l}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <GarantiaModal open={open} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); carregar(); }} />
    </div>
  );
}