import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const sel = "w-full h-9 rounded-md bg-slate-800 border border-slate-700 text-white px-2 text-sm";
const inp = "bg-slate-800 border-slate-700 text-white";

export default function GarantiaModal({ open, onClose, onSaved }) {
  const [f, setF] = useState({ tipo: "inversor", status: "aberto" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const salvar = async () => {
    setSaving(true);
    await base44.entities.Garantia.create(f);
    setSaving(false);
    setF({ tipo: "inversor", status: "aberto" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white">
        <DialogHeader><DialogTitle>Nova garantia</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input className={inp} placeholder="Nome" value={f.nome || ""} onChange={set("nome")} />
          <Input className={inp} placeholder="SN" value={f.sn || ""} onChange={set("sn")} />
          <select className={sel} value={f.tipo} onChange={set("tipo")}>
            <option value="inversor">Inversor</option><option value="antena">Antena</option>
          </select>
          <Input className={inp} placeholder="Marca do dispositivo" value={f.marca || ""} onChange={set("marca")} />
          <select className={sel} value={f.status} onChange={set("status")}>
            <option value="aberto">Aberto</option><option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option><option value="concluido">Concluído</option>
          </select>
          <label className="text-xs text-slate-400 block">Início das tratativas
            <Input type="date" className={inp} value={f.inicio_tratativas || ""} onChange={set("inicio_tratativas")} />
          </label>
          <Input className={inp} placeholder="Número de protocolo" value={f.numero_protocolo || ""} onChange={set("numero_protocolo")} />
          <Button disabled={!f.nome || saving} onClick={salvar} className="w-full bg-amber-500 hover:bg-amber-600 text-black">
            {saving ? "Salvando..." : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}