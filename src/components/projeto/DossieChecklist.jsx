import { CheckCircle, Circle, AlertTriangle, FileText } from "lucide-react";

const ITEMS_CHECKLIST = [
  { key: "procuracao", label: "Procuração gerada e assinada", obrigatorio: true },
  { key: "art", label: "ART anexada e assinada", obrigatorio: true },
  { key: "memorial_tecnico", label: "Memorial Técnico gerado", obrigatorio: true },
  { key: "inmetro", label: "Certificado INMETRO anexado", obrigatorio: true },
  { key: "projeto_unifilar", label: "Projeto Unifilar", obrigatorio: true },
  { key: "formulario_creditos", label: "Formulário de créditos (se aplicável)", obrigatorio: false },
];

export default function DossieChecklist({ documentos = [], envioCreditos = false, temInmetro = false }) {
  const getDocStatus = (tipo) => {
    if (tipo === "inmetro" && temInmetro) return "assinado";
    const doc = documentos.find(d => d.tipo === tipo);
    if (!doc) return "pendente";
    return doc.status;
  };

  const dossieOk = ITEMS_CHECKLIST.filter(item => {
    if (!item.obrigatorio && item.key === "formulario_creditos" && !envioCreditos) return false;
    return item.obrigatorio || (item.key === "formulario_creditos" && envioCreditos);
  }).every(item => {
    const s = getDocStatus(item.key);
    return s === "assinado" || s === "nao_aplicavel";
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <FileText size={16} className="text-amber-400" /> Checklist do Dossiê
        </h3>
        {dossieOk ? (
          <span className="text-xs bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <CheckCircle size={11} /> Dossiê OK
          </span>
        ) : (
          <span className="text-xs bg-amber-400/10 text-amber-400 border border-amber-400/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <AlertTriangle size={11} /> Incompleto
          </span>
        )}
      </div>

      <div className="space-y-2">
        {ITEMS_CHECKLIST.map(item => {
          if (item.key === "formulario_creditos" && !envioCreditos) return null;
          const status = getDocStatus(item.key);
          const ok = status === "assinado" || status === "nao_aplicavel";
          const gerado = status === "gerado" || status === "enviado_para_assinatura";
          return (
            <div key={item.key} className={`flex items-center gap-3 p-3 rounded-xl ${ok ? "bg-emerald-400/5" : gerado ? "bg-amber-400/5" : "bg-slate-800/50"}`}>
              {ok ? <CheckCircle size={15} className="text-emerald-400 shrink-0" /> : gerado ? <AlertTriangle size={15} className="text-amber-400 shrink-0" /> : <Circle size={15} className="text-slate-600 shrink-0" />}
              <div className="flex-1">
                <p className={`text-sm ${ok ? "text-emerald-300" : gerado ? "text-amber-300" : "text-slate-400"}`}>{item.label}</p>
                {!item.obrigatorio && <p className="text-slate-500 text-xs">Opcional</p>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-md ${ok ? "bg-emerald-400/10 text-emerald-400" : gerado ? "bg-amber-400/10 text-amber-400" : "bg-slate-700 text-slate-500"}`}>
                {status === "assinado" ? "Assinado" : status === "gerado" ? "Gerado" : status === "enviado_para_assinatura" ? "Enviado" : "Pendente"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}