import { useEffect, useRef, useState } from "react";
import { Plus, Check, Loader2, Search } from "lucide-react";
import useGoogleMaps from "@/hooks/useGoogleMaps";
import AguaCard from "./AguaCard";
import { CORES, medidas, areaReal } from "./aguaUtils";

const toPath = (poly) => poly.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));

export default function MapaTelhado({ onChange }) {
  const ready = useGoogleMaps();
  const mapDiv = useRef(null), inputRef = useRef(null), map = useRef(null);
  const polys = useRef({}), drawing = useRef(null); // drawing = { id, poly }
  const [aguas, setAguas] = useState([]);
  const [desenhando, setDesenhando] = useState(null);
  const contador = useRef(0);

  const upd = (id, patch) => setAguas(a => a.map(x => x.id === id ? { ...x, ...patch } : x));

  const concluir = () => {
    const d = drawing.current;
    if (!d) return;
    drawing.current = null;
    setDesenhando(null);
    Object.values(polys.current).forEach(p => p.setOptions({ clickable: true }));
    if (d.poly.getPath().getLength() < 3) { d.poly.setMap(null); delete polys.current[d.id]; upd(d.id, { path: [] }); return; }
    d.poly.setEditable(true);
    const path = d.poly.getPath();
    const sync = () => upd(d.id, { path: toPath(d.poly) });
    ["set_at", "insert_at", "remove_at"].forEach(ev => path.addListener(ev, sync));
    sync();
  };

  const iniciar = (agua) => {
    if (drawing.current) concluir();
    polys.current[agua.id]?.setMap(null);
    const poly = new window.google.maps.Polygon({ map: map.current, paths: [], strokeColor: agua.cor, fillColor: agua.cor, fillOpacity: 0.3, strokeWeight: 2, clickable: false });
    polys.current[agua.id] = poly;
    Object.values(polys.current).forEach(p => p.setOptions({ clickable: false }));
    drawing.current = { id: agua.id, poly };
    setDesenhando(agua.id);
  };

  const adicionar = () => {
    contador.current += 1;
    const n = contador.current;
    const agua = { id: n, nome: `Água ${n}`, cor: CORES[(n - 1) % CORES.length], path: [], inclinacao: "15", orientacao: "N" };
    setAguas(a => [...a, agua]);
    iniciar(agua);
  };

  const excluir = (id) => {
    if (drawing.current?.id === id) { drawing.current = null; setDesenhando(null); }
    polys.current[id]?.setMap(null);
    delete polys.current[id];
    setAguas(a => a.filter(x => x.id !== id));
  };

  useEffect(() => {
    if (!ready || map.current) return;
    const g = window.google.maps;
    map.current = new g.Map(mapDiv.current, { center: { lat: -20.3155, lng: -40.3128 }, zoom: 18, mapTypeId: "satellite", tilt: 0, disableDoubleClickZoom: true, streetViewControl: false });
    map.current.addListener("click", e => drawing.current?.poly.getPath().push(e.latLng));
    map.current.addListener("dblclick", () => concluir());
    const ac = new g.places.Autocomplete(inputRef.current, { fields: ["geometry"], componentRestrictions: { country: "br" } });
    ac.addListener("place_changed", () => {
      const loc = ac.getPlace().geometry?.location;
      if (!loc) return;
      map.current.setCenter(loc);
      map.current.setZoom(21);
    });
  }, [ready]);

  const totais = aguas.reduce((t, a) => {
    const { areaProj } = medidas(a.path);
    return { proj: t.proj + areaProj, real: t.real + areaReal(areaProj, a.inclinacao) };
  }, { proj: 0, real: 0 });

  useEffect(() => { onChange?.({ aguas, totalProjetada: totais.proj, totalReal: totais.real }); }, [aguas]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-3 text-slate-500" />
        <input ref={inputRef} placeholder="Buscar endereço do imóvel..." className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      <div className="relative rounded-xl overflow-hidden border border-slate-700 h-80">
        <div ref={mapDiv} className="w-full h-full" />
        {!ready && <div className="absolute inset-0 flex items-center justify-center bg-slate-900"><Loader2 className="animate-spin text-amber-500" /></div>}
      </div>
      <div className="flex gap-2">
        <button onClick={adicionar} disabled={!ready} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium bg-amber-500 text-white disabled:opacity-50"><Plus size={14} /> Adicionar água</button>
        {desenhando && <button onClick={concluir} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-sm font-medium bg-emerald-500 text-white"><Check size={14} /> Concluir</button>}
      </div>
      {desenhando && <p className="text-xs text-slate-400">Clique no mapa para adicionar vértices. Duplo clique ou "Concluir" fecha a água.</p>}
      {aguas.map(a => (
        <AguaCard key={a.id} agua={a} onChange={p => upd(a.id, p)} onExcluir={() => excluir(a.id)} onRedesenhar={() => { upd(a.id, { path: [] }); iniciar(a); }} />
      ))}
      {aguas.length > 0 && (
        <div className="flex justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-sm">
          <span className="text-slate-300">Total projetada: <b className="text-white">{totais.proj.toFixed(2)} m²</b></span>
          <span className="text-slate-300">Área útil: <b className="text-amber-400">{totais.real.toFixed(2)} m²</b></span>
        </div>
      )}
    </div>
  );
}