import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  Sun, LayoutDashboard, FolderKanban, Users, Package,
  FileText, ChevronLeft, ChevronRight, LogOut, Menu, X,
  Zap, ShieldCheck, TrendingUp, UserCheck, DollarSign, BarChart2
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", page: "Dashboard", icon: LayoutDashboard, roles: ["admin","vendas","engenharia","financeiro","suprimentos","instalacao"] },
  { label: "Projetos", page: "Projetos", icon: FolderKanban, roles: ["admin","vendas","engenharia","financeiro","suprimentos","instalacao"] },
  { label: "Novo Cliente", page: "NovoPréProjeto", icon: Zap, roles: ["admin","vendas"] },
  { label: "Biblioteca Produtos", page: "Produtos", icon: Package, roles: ["admin","engenharia","suprimentos"] },
  { label: "Vendedores", page: "Vendedores", icon: UserCheck, roles: ["admin"] },
  { label: "Dashboard de Vendas", page: "DashboardVendas", icon: TrendingUp, roles: ["admin","financeiro"] },
  { label: "Fluxo de Caixa", page: "FluxoCaixa", icon: DollarSign, roles: ["admin","financeiro"] },
  { label: "DRE por Projeto", page: "DREProjeto", icon: BarChart2, roles: ["admin","financeiro","engenharia"] },
  { label: "Usuários", page: "Usuarios", icon: Users, roles: ["admin"] },
];

export default function Layout({ children, currentPageName }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const allowedItems = NAV_ITEMS.filter(item =>
    !user || item.roles.includes(user.role) || user.role === "admin"
  );

  const NavLink = ({ item }) => {
    const isActive = location.pathname.includes(item.page.replace(" ", ""));
    return (
      <Link
        to={createPageUrl(item.page)}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
          ${isActive
            ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
            : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
      >
        <item.icon size={18} className="shrink-0" />
        {!collapsed && (
          <span className="text-sm font-medium truncate">{item.label}</span>
        )}
      </Link>
    );
  };

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full bg-slate-900 ${mobile ? "w-72" : collapsed ? "w-16" : "w-60"} transition-all duration-300`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-800 ${collapsed && !mobile ? "justify-center" : ""}`}>
        <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/40">
          <Sun size={16} className="text-white" />
        </div>
        {(!collapsed || mobile) && (
          <div>
            <p className="text-white font-bold text-sm leading-tight">SolarERP</p>
            <p className="text-amber-500 text-xs">EDP First v0.1</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {allowedItems.map(item => <NavLink key={item.page} item={item} />)}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-800">
        {user && (!collapsed || mobile) && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800 mb-2">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <span className="text-amber-400 text-xs font-bold">{user.full_name?.[0] || "U"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user.full_name}</p>
              <p className="text-slate-400 text-xs capitalize">{user.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => base44.auth.logout()}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all ${collapsed && !mobile ? "justify-center" : ""}`}
        >
          <LogOut size={16} />
          {(!collapsed || mobile) && <span className="text-xs">Sair</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      {!mobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 hover:bg-amber-500 hover:text-white transition-all z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <style>{`
        :root {
          --color-primary: #f59e0b;
          --color-primary-dark: #d97706;
        }
        * { scrollbar-width: thin; scrollbar-color: #334155 transparent; }
        *::-webkit-scrollbar { width: 4px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
      `}</style>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex relative shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="relative flex">
            <Sidebar mobile />
          </div>
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="flex md:hidden items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
          <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center">
              <Sun size={12} className="text-white" />
            </div>
            <span className="text-white font-semibold text-sm">SolarERP</span>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
}