// Autenticação + autorização por papel para funções de backend.
// Retorna { user } quando autorizado ou { error: Response } (401/403).
export const ROLES_AGENDAMENTO = ['admin', 'engenharia', 'financeiro', 'suprimentos', 'instalacao'];
export const ROLES_INTERNOS = ['admin', 'vendas', 'engenharia', 'financeiro', 'suprimentos', 'instalacao'];

export async function requireRole(base44, roles) {
  const user = await base44.auth.me().catch((e) => (e?.status === 401 ? null : Promise.reject(e)));
  if (!user) return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!roles.includes(user.role)) return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) };
  return { user };
}

export function isHttpsUrl(u) {
  return typeof u === 'string' && /^https:\/\//i.test(u.trim());
}