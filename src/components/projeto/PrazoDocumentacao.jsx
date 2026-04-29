import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { AlertCircle, Clock, CheckCircle, Loader2 } from "lucide-react";

// Calcula dias úteis entre duas datas (seg-sex, sem feriados nacionais fixos BR)
const FERIADOS_FIXOS = [
  "01-01","04-21","05-01","09-07","10-12","11-02","11-15","12-25"
];

function isFeriado(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return FERIADOS_FIXOS.includes(`${mm}-${dd}`);
}

function diasUteisEntre(inicio, fim) {
  let count = 0;
  const cur = new Date(inicio);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(fim);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !isFeriado(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function diasUteisApos(inicio, dias) {
  const cur = new Date(inicio);
  cur.setHours(0, 0, 0, 0);
  let count = 0;
  while (count < dias) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6 && !isFeriado(cur)) count++;
  }
  return cur;
}

const PRAZO_DIAS_UTEIS = 5;

export default function PrazoDocumentacao({ projeto, documentos, user, onUpdate }) {
  const [editandoMotivo, setEditandoMotivo] = useState(false);
  const [motivo, setMotivo] = useState(projeto.motivo_atraso_documentacao || "");
  const [salvando, setSalvando] = useState(false);

  // Só exibir se kit foi confirmado e projeto está em status relevante
  if (!projeto.equipamentos_confirmados_em) return null;

  // Verificar se memorial_tecnico e projeto_unifilar já foram assinados/feito upload
  const memorialOk = documentos.some(d =>
    d.tipo === "memorial_tecnico" && (d.status === "assinado" || d.url_assinado)
  );
  const unifilarOk = documentos.some(d =>
    d.tipo === "projeto_unifilar" && (d.status === "assinado" || d.url_assinado)
  );

  if (memorialOk && unifilarOk) return null;

  const inicio = new Date(projeto.equipamentos_confirmados_em);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazoFinal = diasUteisApos(inicio, PRAZO_DIAS_UTEIS);
  const diasDecorridos = diasUteisEntre(inicio, hoje);
  const diasRestantes = PRAZO_DIAS_UTEIS - diasDecorridos;
  const atrasado = diasRestantes < 0;
  const diasAtraso = Math.abs(diasRestantes);

  const canEdit = user?.role === "admin" || user?.role === "engenharia";

  const handleSalvar = async () => {
    setSalvando(true);
    const updated = await base44.entities.Projeto.update(projeto.id, {
      motivo_atraso_documentacao: motivo
    });
    onUpdate && onUpdate(updated);
    setEditandoMotivo(false);
    setSalvando(false);
  };

  const faltando = [];
  if (!memorialOk) faltando.push("Memorial Descritivo");
  if (!unifilarOk) faltando.push("Diagrama Unifilar");

  return (
    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
      {atrasado ? (
        <AlertCircle size={12} className="text-red-400 shrink-0" />
      ) : (
        <Clock size={12} className={diasRestantes <= 1 ? "text-amber-400 shrink-0" : "text-slate-500 shrink-0"} />
      )}
      <span className={`text-xs ${atrasado ? "text-red-400" : diasRestantes <= 1 ? "text-amber-400" : "text-slate-500"}`}>
        {atrasado
          ? `Documentação atrasada ${diasAtraso} dia${diasAtraso !== 1 ? "s" : ""} útil${diasAtraso !== 1 ? "is" : ""}`
          : diasRestantes === 0
          ? "Último dia útil para entregar os documentos"
          : `${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""} úteis restantes`
        }
      </span>

      {/* Motivo do atraso */}
      {atrasado && !editandoMotivo && (
        <>
          {projeto.motivo_atraso_documentacao && (
            <span className="text-xs text-slate-500 italic">— "{projeto.motivo_atraso_documentacao}"</span>
          )}
          {canEdit && (
            <button onClick={() => setEditandoMotivo(true)} className="text-xs text-slate-600 hover:text-slate-300 underline transition-colors">
              {projeto.motivo_atraso_documentacao ? "editar motivo" : "informar motivo"}
            </button>
          )}
        </>
      )}

      {atrasado && editandoMotivo && (
        <div className="flex gap-2 items-center w-full mt-1">
          <input
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Motivo do atraso..."
            className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500 placeholder-slate-600"
          />
          <button onClick={handleSalvar} disabled={salvando} className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white px-2.5 py-1 rounded-lg transition-all flex items-center gap-1">
            {salvando ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />} Salvar
          </button>
          <button onClick={() => { setMotivo(projeto.motivo_atraso_documentacao || ""); setEditandoMotivo(false); }} className="text-xs text-slate-500 hover:text-white transition-colors">Cancelar</button>
        </div>
      )}
    </div>
  );
}