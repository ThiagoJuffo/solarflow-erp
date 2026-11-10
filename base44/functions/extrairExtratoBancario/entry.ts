import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireRole } from '../../shared/auth.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    banco: { type: 'string' },
    periodo_inicio: { type: 'string', format: 'date' },
    periodo_fim: { type: 'string', format: 'date' },
    movimentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          data: { type: 'string', format: 'date' },
          descricao: { type: 'string' },
          documento: { type: 'string' },
          tipo: { type: 'string', enum: ['credito', 'debito'] },
          valor: { type: 'number' },
          saldo: { type: 'number' },
        },
        required: ['data', 'descricao', 'tipo', 'valor'],
      },
    },
  },
  required: ['movimentos'],
};

// Extrai os movimentos de um extrato bancário privado de uma importação existente.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { error: authError } = await requireRole(base44, ['admin', 'financeiro']);
    if (authError) return authError;

    const { importacao_id } = await req.json().catch(() => ({}));
    if (!importacao_id) return Response.json({ error: 'importacao_id obrigatório' }, { status: 400 });

    const importacao = await base44.entities.ImportacaoExtrato.get(importacao_id)
      .catch((e) => (e?.status === 404 ? null : Promise.reject(e)));
    if (!importacao?.arquivo_uri) return Response.json({ error: 'Importação não encontrada' }, { status: 404 });

    const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: importacao.arquivo_uri, expires_in: 600,
    });
    const res = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: signed_url, json_schema: SCHEMA,
    });
    return Response.json(res);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}