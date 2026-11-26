// Sugere a disposição dos módulos nas entradas de cada inversor quando o arranjo
// não foi informado manualmente. Retorna uma tabela para cada inversor.
const T_MIN = 10, T_STC = 25; // °C

export function sugerirArranjo({ modulo, qtdModulos, inversores }) {
  const unidades = (inversores || []).flatMap(inv => Array.from({ length: Number(inv.quantidade) || 0 }, () => inv.produto || {}));
  if (!unidades.length || !qtdModulos) return [];

  // Tensão do módulo no frio (pior caso para a tensão máxima de entrada)
  const coefVoc = parseFloat(String(modulo?.coef_temp_voc || "-0.30").replace(",", ".")) / 100 || -0.003;
  const vocFrio = (modulo?.voc || 0) * (1 + coefVoc * (T_MIN - T_STC));

  // Divide os módulos entre os inversores proporcionalmente à potência
  const potencia = (p) => p.potencia_ac_w || (p.potencia_kva || 0) * 1000 || 1;
  const potTotal = unidades.reduce((s, p) => s + potencia(p), 0);
  const modulosPorUnidade = unidades.map(p => Math.floor((qtdModulos * potencia(p)) / potTotal));
  let sobra = qtdModulos - modulosPorUnidade.reduce((s, n) => s + n, 0);
  for (let i = 0; sobra > 0; i = (i + 1) % unidades.length, sobra--) modulosPorUnidade[i]++;

  const tabelas = [];
  unidades.forEach((p, i) => {
    const n = modulosPorUnidade[i];
    if (!n) return;
    // Máximo de módulos em série sem passar da tensão máxima de entrada
    const maxSerie = (p.tensao_max_dc_v && vocFrio) ? Math.max(1, Math.floor(p.tensao_max_dc_v / vocFrio)) : n;
    const numStrings = Math.ceil(n / maxSerie);
    const linhas = Array.from({ length: numStrings }, (_v, s) => [
      String(Math.floor(n / numStrings) + (s < n % numStrings ? 1 : 0)),
      `Entrada ${s + 1}`,
    ]);
    tabelas.push({ titulo: `Arranjo dos Painéis Inversor ${i + 1}`, linhas });
  });

  return tabelas;
}