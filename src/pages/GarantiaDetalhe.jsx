import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const inp = "bg-slate-800 border-slate-700 text-white";
const sel = "w-full h-9 rounded-md bg-slate-800 border border-slate-700 text-white px-2 text-sm";
const Campo = ({ label, children }) => <label className="block text-xs text-slate-400 space-y-1"><span>{label}</span>{children}</label>;

export default function GarantiaDetalhe() {
  const id = new URLSearchParams(window.location.search).get("id");
  const [g, setG] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => { base44.entities.Garantia.get(id).then(setG).catch(() => setG(null)); }, [id]);
  const set = (k) => (e) => { setG({ ...g, [k]: e.target.value }); setSalvo(false); };

  const salvar = async () => {
    setSaving(true);
    const { nome, sn, tipo, marca, status, inicio_tratativas, numero_protocolo, endereco, observacoes } = g;
    await base44.entities.Garantia.update(id, { nome, sn, tipo, marca, status, inicio_tratativas, numero_protocolo, endereco, observacoes });
    setSaving(false); setSalvo(true);
  };

  if (g === undefined) return <div className="p-6 text-slate-400">Carregando...</div>;
  if (g === null) return <div className="p-6 text-slate-400">Garantia não encontrada.</div>;

  return (
    <div className="p-6 text-white max-w-2xl">
      <Link to="/Garantias" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4"><ArrowLeft size={14} /> Voltar</Link>
      <h1 className="text-2xl font-bold mb-6">{g.nome}</h1>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid sm:grid-cols-2 gap-4">
        <Campo label="Nome"><Input className={inp} value={g.nome || ""} onChange={set("nome")} /></Campo>
        <Campo label="SN"><Input className={inp} value={g.sn || ""} onChange={set("sn")} /></Campo>
        <Campo label="Tipo de dispositivo">
          <select className={sel} value={g.tipo} onChange={set("tipo")}><option value="inversor">Inversor</option><option value="antena">Antena</option></select>
        </Campo>
        <Campo label="Marca"><Input className={inp} value={g.marca || ""} onChange={set("marca")} /></Campo>
        <Campo label="Status">
          <select className={sel} value={g.status} onChange={set("status")}>
            <option value="aberto">Aberto</option><option value="aprovado">Aprovado</option>
            <option value="recusado">Recusado</option><option value="concluido">Concluído</option>
          </select>
        </Campo>
        <Campo label="Número de protocolo"><Input className={inp} value={g.numero_protocolo || ""} onChange={set("numero_protocolo")} /></Campo>
        <Campo label="Início das tratativas"><Input type="date" className={inp} value={g.inicio_tratativas || ""} onChange={set("inicio_tratativas")} /></Campo>
        <div className="sm:col-span-2"><Campo label="Endereço"><Input className={inp} value={g.endereco || ""} onChange={set("endereco")} /></Campo></div>
        <div className="sm:col-span-2"><Campo label="Observação"><Textarea rows={5} className={inp} value={g.observacoes || ""} onChange={set("observacoes")} /></Campo></div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button onClick={salvar} disabled={saving} className="bg-amber-500 hover:bg-amber-600 text-black">{saving ? "Salvando..." : "Salvar"}</Button>
          {salvo && <span className="text-sm text-green-400">Salvo!</span>}
        </div>
      </div>
    </div>
  );
}