import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Plus, Pencil, Trash2, CheckCircle, X, Loader2 } from "lucide-react";

export default function Vendedores() {
  const [vendedores, setVendedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ nome: "", telefone: "", email: "", ativo: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Vendedor.list("-created_date"),
      base44.auth.me()
    ]).then(([v, u]) => {
      setVendedores(v);
      setUser(u);
      setLoading(false);
    });
  }, []);

  const isAdmin = user?.role === "admin";

  const openNew = () => {
    setEditing(null);
    setForm({ nome: "", telefone: "", email: "", ativo: true });
    setShowForm(true);
  };

  const openEdit = (v) => {
    setEditing(v);
    setForm({ nome: v.nome, telefone: v.telefone || "", email: v.email || "", ativo: v.ativo !== false });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editing) {
      const updated = await base44.entities.Vendedor.update(editing.id, form);
      setVendedores(prev => prev.map(v => v.id === editing.id ? updated : v));
    } else {
      const novo = await base44.entities.Vendedor.create(form);
      setVendedores(prev => [novo, ...prev]);
    }
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Vendedor.delete(id);
    setVendedores(prev => prev.filter(v => v.id !== id));
  };

  const toggleAtivo = async (v) => {
    const updated = await base44.entities.Vendedor.update(v.id, { ativo: !v.ativo });
    setVendedores(prev => prev.map(x => x.id === v.id ? updated : x));
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-slate-400">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-amber-400" size={22} /> Vendedores
          </h1>
          <p className="text-slate-400 text-sm mt-1">{vendedores.filter(v => v.ativo !== false).length} vendedores ativos</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
        >
          <Plus size={16} /> Novo Vendedor
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">{editing ? "Editar Vendedor" : "Novo Vendedor"}</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Nome Completo *</label>
              <input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome do vendedor"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">Telefone / WhatsApp</label>
              <input
                value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(11) 99999-9999"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-medium block mb-1.5">E-mail</label>
              <input
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="vendedor@email.com"
                type="email"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowForm(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2.5 rounded-xl text-sm font-medium transition-all">Cancelar</button>
            <button
              onClick={handleSave}
              disabled={!form.nome || saving}
              className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-900 rounded-2xl animate-pulse" />)}
        </div>
      ) : vendedores.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Users size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Nenhum vendedor cadastrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vendedores.map(v => (
            <div key={v.id} className={`bg-slate-900 border rounded-2xl px-5 py-4 flex items-center gap-4 transition-all ${v.ativo === false ? "border-slate-800 opacity-50" : "border-slate-800 hover:border-slate-700"}`}>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <span className="text-amber-400 font-bold text-sm">{v.nome?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm">{v.nome}</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  {[v.telefone, v.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-lg border ${v.ativo !== false ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : "bg-slate-700 text-slate-500 border-slate-600"}`}>
                  {v.ativo !== false ? "Ativo" : "Inativo"}
                </span>
                <button onClick={() => toggleAtivo(v)} className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-800 transition-all" title="Ativar/Desativar">
                  <CheckCircle size={14} />
                </button>
                <button onClick={() => openEdit(v)} className="text-slate-500 hover:text-amber-400 p-1.5 rounded-lg hover:bg-slate-800 transition-all">
                  <Pencil size={14} />
                </button>
                <button onClick={() => handleDelete(v.id)} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}