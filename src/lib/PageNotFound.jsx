import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Sun, Home } from "lucide-react";

export default function PageNotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Sun size={36} className="text-amber-400" />
        </div>
        <h1 className="text-6xl font-bold text-white mb-2">404</h1>
        <p className="text-slate-400 text-lg mb-8">Página não encontrada</p>
        <Link
          to={createPageUrl("Dashboard")}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-6 py-3 rounded-xl font-semibold transition-all"
        >
          <Home size={16} /> Voltar ao início
        </Link>
      </div>
    </div>
  );
}