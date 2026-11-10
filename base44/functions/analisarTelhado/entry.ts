import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireRole, isHttpsUrl } from '../../shared/auth.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    largura_m: { type: 'number' },
    comprimento_m: { type: 'number' },
    inclinacao_graus: { type: 'number' },
    tipo_telhado: { type: 'string' },
    observacoes: { type: 'string' },
  },
};

// Estima dimensões do telhado a partir de imagem de satélite ou foto de drone.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { error: authError } = await requireRole(base44, ['admin', 'engenharia', 'instalacao']);
    if (authError) return authError;

    const { modo, image_url, area_m2 } = await req.json().catch(() => ({}));
    if (!['satelite', 'drone'].includes(modo) || !isHttpsUrl(image_url)) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const area = Number(area_m2);
    const prompt = modo === 'satelite'
      ? `Esta é uma imagem de satélite com zoom máximo (zoom 20) de uma edificação.
Identifique o telhado principal visível e estime suas dimensões reais em metros.
O Google Solar API informou área total do telhado de ${Number.isFinite(area) ? area.toFixed(0) : '?'} m².
Retorne:
- largura_m: largura do maior plano utilizável do telhado (número, em metros)
- comprimento_m: comprimento do maior plano utilizável (número, em metros)
- inclinacao_graus: inclinação estimada (0 para laje plana, 15-30 para telha comum)
- tipo_telhado: tipo (laje, ceramica, metalico, fibrocimento, outro)
- observacoes: sombreamentos, obstáculos, múltiplos planos relevantes`
      : `Analise esta foto de drone de um telhado residencial/comercial e estime:
- largura_m: largura útil do telhado em metros (número)
- comprimento_m: comprimento útil do telhado em metros (número)
- inclinacao_graus: inclinação estimada do telhado em graus (número, ex: 15, 30)
- tipo_telhado: tipo (ceramica, fibrocimento, metalico, laje, outro)
- observacoes: observações importantes sobre sombreamento ou obstáculos

Retorne apenas JSON com esses campos. Se não conseguir identificar, use null.`;

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt, file_urls: [image_url], response_json_schema: SCHEMA,
    });
    return Response.json(res);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}