import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { requireRole } from '../../shared/auth.ts';

const num = { type: 'number' };
const str = { type: 'string' };
const SCHEMA_MODULO = { type: 'object', properties: {
  potencia_wp: num, vmp: num, imp: num, voc: num, isc: num, eficiencia_modulo: num,
  corrente_max_fusivel_a: num, coef_temperatura: str, area_m2: num, dimensoes: str, peso: num, garantia_anos: num,
} };
const SCHEMA_INVERSOR = { type: 'object', properties: {
  potencia_kva: num, potencia_ac_w: num, tensao_nominal_ac_v: str, corrente_max_ac_a: num,
  frequencia_operacao_hz: num, range_frequencia_hz: str, fator_potencia: num, corrente_max_dc_a: num,
  tensao_min_dc_v: num, tensao_max_dc_v: num, num_mppt: num, entradas_por_mppt: num,
  range_temperatura: str, eficiencia: num, peso: num, dimensoes: str, garantia_anos: num,
} };

// Busca na internet as especificações técnicas de um módulo ou inversor.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { error: authError } = await requireRole(base44, ['admin', 'engenharia', 'suprimentos']);
    if (authError) return authError;

    const { fabricante, modelo, tipo } = await req.json().catch(() => ({}));
    const fab = String(fabricante || '').trim().slice(0, 100);
    const mod = String(modelo || '').trim().slice(0, 100);
    if (!fab || !mod) return Response.json({ error: 'Fabricante e modelo obrigatórios' }, { status: 400 });

    const isModulo = tipo === 'modulo_fv';
    const prompt = isModulo
      ? `Busque as especificações técnicas completas do módulo fotovoltaico: Fabricante: ${fab}, Modelo: ${mod}.
Retorne os dados em JSON com os campos: potencia_wp (Ppeak), vmp (Tensão Vmp), imp (Corrente Imp), voc (Tensão Voc), isc (Corrente Isc), eficiencia_modulo (% eficiência), corrente_max_fusivel_a (corrente máx fusível série), coef_temperatura (ex: "-0.35%/°C"), area_m2, dimensoes, peso, garantia_anos.
Preencha apenas os campos que encontrar com certeza. Deixe null para os demais.`
      : `Busque as especificações técnicas completas do inversor/microinversor solar: Fabricante: ${fab}, Modelo: ${mod}.
Retorne os dados em JSON com os campos: potencia_kva, potencia_ac_w, tensao_nominal_ac_v (string com range, ex: "220 V (176/224V)"), corrente_max_ac_a, frequencia_operacao_hz, range_frequencia_hz, fator_potencia, corrente_max_dc_a, tensao_min_dc_v, tensao_max_dc_v, num_mppt, entradas_por_mppt, range_temperatura, eficiencia, peso, dimensoes, garantia_anos.
Preencha apenas os campos que encontrar com certeza. Deixe null para os demais.`;

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt, add_context_from_internet: true, response_json_schema: isModulo ? SCHEMA_MODULO : SCHEMA_INVERSOR,
    });
    return Response.json(res);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}