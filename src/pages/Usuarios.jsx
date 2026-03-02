import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, UserPlus, Loader2, CheckCircle, Mail, Shield } from "lucide-react";

const ROLES = {
  admin: { label: "Admin", color: "bg-red-400/10 text-red-400" },
  vendas: { label: "Vendas", color: "bg-amber-400/10 text-amber-400" },
  engenharia: { label: "Engenharia", color: "bg-blue-400/10 text-blue-400" },
  financeiro: { label: "Financeiro", color: "bg-emerald-400/10 text-emerald-400" },
  suprimentos: { label: "Suprimentos", color: "bg-violet-400/10 text-violet-400" },
  instalacao: { label: "Instalação", color: "bg-slate-400/10 text-slate-300" },
};

export default function Usuarios() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("vendas");
  const [inviting, setInviting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    base44.entities.User.list("-created_date", 100).then(u => {
      setUsers(u);
      setLoading(false);
    });
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    setInviting(false);
    setSuccess(true);
    setInviteEmail("");
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleRoleChange = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Usuários</h1>
        <p className="text-slate-400 text-sm mt-1">Gerencie permissões e convites</p>
      </div>

      {/* Convite */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><UserPlus size={16} className="text-amber-400" /> Convidar Usuário</h3>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="email@empresa.com"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-9 pr-3 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
          >
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            {inviting ? <Loader2 size={14} className="animate-spin" /> : success ? <CheckCircle size={14} /> : <UserPlus size={14} />}
            {success ? "Enviado!" : "Convidar"}
          </button>
        </div>
      </div>

      {/* Permissões descrição */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(ROLES).map(([k, v]) => (
          <div key={k} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
            <span className={`text-xs px-2 py-1 rounded-lg ${v.color} font-medium`}>{v.label}</span>
            <p className="text-slate-500 text-xs mt-2">
              {k === "admin" && "Acesso total ao sistema"}
              {k === "vendas" && "Criar pré-projetos, ver status"}
              {k === "engenharia" && "Editar UC, gerar documentos, dossiê"}
              {k === "financeiro" && "Confirmar pagamentos, observações"}
              {k === "suprimentos" && "Confirmar kit/produtos"}
              {k === "instalacao" && "Visualização somente (read-only)"}
            </p>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h3 className="text-white font-semibold flex items-center gap-2"><Users size={16} className="text-amber-400" /> Membros da Equipe</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center"><Loader2 size={24} className="animate-spin text-amber-400 mx-auto" /></div>
        ) : (
          <div className="divide-y divide-slate-800">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <span className="text-amber-400 font-bold text-sm">{u.full_name?.[0] || u.email?.[0] || "?"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{u.full_name || "—"}</p>
                  <p className="text-slate-400 text-xs truncate">{u.email}</p>
                </div>
                <select
                  value={u.role || "vendas"}
                  onChange={e => handleRoleChange(u.id, e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-white rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500"
                >
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}