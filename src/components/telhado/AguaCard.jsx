import { Trash2, RotateCcw } from "lucide-react";
import { ORIENTACOES, medidas, areaReal } from "./aguaUtils";

export default function AguaCard({ agua, onChange, onExcluir, onRedesenhar }) {
  const { lados, areaProj } = medidas(agua.path);
  const real = areaReal(areaProj, agua.inclinacao);
  const input = "w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500";

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ background: agua.cor }} />
        <span className="text-white text-sm font-semibold flex-1">{agua.nome}</span>
        <button onClick={onRedesenhar} title="Redesenhar" className="text-slate-400 hover:text-amber-400"><RotateCcw size={14} /></button>
        <button onClick={onExcluir} title="Excluir" className="text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
      </div>
      {lados.length > 0 && (
        <p className="text-xs text-slate-400">Lados: {lados.map((l, i) => `L${i + 1} ${l.toFixed(2)}m`).join(" · ")}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-400">Inclinação (°)
          <input type="number" value={agua.inclinacao} onChange={e => onChange({ inclinacao: e.target.value })} className={input} />
        </label>
        <label className="text-xs text-slate-400">Orientação (sigla ou °)
          <input list="orientacoes" value={agua.orientacao} onChange={e => onChange({ orientacao: e.target.value })} className={input} />
        </label>
      </div>
      <datalist id="orientacoes">{Object.keys(ORIENTACOES).map(o => <option key={o} value={o} />)}</datalist>
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">Projetada: <b className="text-white">{areaProj.toFixed(2)} m²</b></span>
        <span className="text-slate-400">Real: <b className="text-amber-400">{real.toFixed(2)} m²</b></span>
      </div>
    </div>
  );
}