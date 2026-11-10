import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireRole } from '../../shared/auth.ts';

// Entrega a chave do Maps JS apenas para quem usa o planejamento de telhado.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { error: authError } = await requireRole(base44, ['admin', 'engenharia', 'instalacao']);
    if (authError) return authError;
    return Response.json({ key: Deno.env.get('GOOGLE_MAPS_API_KEY') });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}