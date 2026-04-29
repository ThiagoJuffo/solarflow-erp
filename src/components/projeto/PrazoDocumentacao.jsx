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
    <div className={`mt-2 rounded-xl px-3 py-2 border text-xs flex flex-col gap-1.5 ${
      atrasado
        ? "bg-red-500/10 border-red-500/20"
        : diasRestantes <= 1
        ? "bg-amber-500/10 border-amber-500/20"
        : "bg-slate-800/60 border-slate-700"
    }`}>
      <div className="flex items-center gap-2 flex-wrap">
        {atrasado ? (
          <AlertCircle size={13} className="text-red-400 shrink-0" />
        ) : (
          <Clock size={13} className={diasRestantes <= 1 ? "text-amber-400 shrink-0" : "text-slate-400 shrink-0"} />
        )}
        <span className={atrasado ? "text-red-300 font-medium" : diasRestantes <= 1 ? "text-amber-300 font-medium" : "text-slate-300"}>
          {atrasado
            ? `Docs atrasados ${diasAtraso}d útil${diasAtraso !== 1 ? "is" : ""}`
            : diasRestantes === 0
            ? "Último dia útil para entregar os docs"
            : `${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""} útil${diasRestantes !== 1 ? "is" : ""} restante${diasRestantes !== 1 ? "s" : ""}`
          }
        </span>
        <span className="text-slate-500">·</span>
        <span className="text-slate-400">{faltando.join(", ")}</span>
      </div>

      {/* Motivo do atraso */}
      {atrasado && (
        <div>
          {editandoMotivo ? (
            <div className="flex gap-2 items-end mt-0.5">
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Informe o motivo do atraso..."
                rows={2}
                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-500 resize-none placeholder-slate-600"
              />
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleSalvar}
                  disabled={salvando}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                >
                  {salvando ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                  Salvar
                </button>
                <button
                  onClick={() => { setMotivo(projeto.motivo_atraso_documentacao || ""); setEditandoMotivo(false); }}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              {projeto.motivo_atraso_documentacao ? (
                <span className="text-slate-400 italic flex-1">"{projeto.motivo_atraso_documentacao}"</span>
              ) : (
                <span className="text-red-400/70 flex-1">Nenhum motivo informado.</span>
              )}
              {canEdit && (
                <button
                  onClick={() => setEditandoMotivo(true)}
                  className="text-slate-500 hover:text-white underline transition-colors shrink-0"
                >
                  {projeto.motivo_atraso_documentacao ? "Editar" : "Informar motivo"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}