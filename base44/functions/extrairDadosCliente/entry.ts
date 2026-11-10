import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireRole, isHttpsUrl } from '../../shared/auth.ts';

const PROMPT = `Analise os documentos fornecidos (conta de energia e documento de identidade) e extraia as seguintes informações em JSON:
- numero_uc: número da unidade consumidora / instalação
- titular: nome do titular na conta
- cpf_extraido: CPF encontrado
- endereco: endereço completo da UC
- cidade: cidade
- estado: UF
- cep: CEP
- tipo_ligacao: monofasico/bifasico/trifasico (se identificado)
- concessionaria: nome da concessionária
- classe_consumo: residencial/comercial/industrial (se identificado)
- score_confianca: objeto com score 0-1 para cada campo extraído

Retorne apenas o JSON.`;

const SCHEMA = {
  type: 'object',
  properties: {
    numero_uc: { type: 'string' },
    titular: { type: 'string' },
    cpf_extraido: { type: 'string' },
    endereco: { type: 'string' },
    cidade: { type: 'string' },
    estado: { type: 'string' },
    cep: { type: 'string' },
    tipo_ligacao: { type: 'string' },
    concessionaria: { type: 'string' },
    classe_consumo: { type: 'string' },
    score_confianca: { type: 'object' },
  },
};

// Extrai dados da UC/cliente a partir da conta de energia e do documento.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { error: authError } = await requireRole(base44, ['admin', 'vendas']);
    if (authError) return authError;

    const { conta_url, documento_url } = await req.json().catch(() => ({}));
    const urls = [conta_url, documento_url].filter(Boolean);
    if (!urls.length || !urls.every(isHttpsUrl)) {
      return Response.json({ error: 'Envie a conta de energia ou o documento' }, { status: 400 });
    }

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: PROMPT, file_urls: urls, response_json_schema: SCHEMA,
    });
    return Response.json(res);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}