import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireRole, isHttpsUrl } from '../../shared/auth.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string' },
          fabricante: { type: 'string' },
          modelo: { type: 'string' },
          potencia_wp: { type: 'number' },
          potencia_kva: { type: 'number' },
          eficiencia: { type: 'number' },
          garantia_anos: { type: 'number' },
        },
      },
    },
  },
};

// Lê uma planilha de produtos enviada e devolve os itens extraídos.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { error: authError } = await requireRole(base44, ['admin', 'engenharia', 'suprimentos']);
    if (authError) return authError;

    const { file_url } = await req.json().catch(() => ({}));
    if (!isHttpsUrl(file_url)) return Response.json({ error: 'file_url inválido' }, { status: 400 });

    const res = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({ file_url, json_schema: SCHEMA });
    return Response.json(res);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}