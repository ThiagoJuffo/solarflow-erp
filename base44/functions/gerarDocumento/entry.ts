import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { tipo, projeto_id } = body;

  // Buscar dados do projeto
  const [ucs, resumos] = await Promise.all([
    base44.asServiceRole.entities.UC.filter({ projeto_id }),
    base44.asServiceRole.entities.ResumoTecnico.filter({ projeto_id }),
  ]);

  let projeto = null;
  try {
    projeto = await base44.asServiceRole.entities.Projeto.get(projeto_id);
  } catch (_e) {
    // projeto não encontrado
  }

  const projetos = projeto ? [projeto] : [];

  const projetoData = projetos[0];
  const uc = ucs[0] || {};
  const rt = resumos[0] || {};

  // Buscar pré-projeto para dados do kit (módulos, inversor, potência)
  let preProjeto = null;
  if (projetoData?.pre_projeto_id) {
    try {
      preProjeto = await base44.asServiceRole.entities.PreProjeto.get(projetoData.pre_projeto_id);
    } catch (_e) {}
  }

  // Normalização de nome para matching robusto (trim + colapsa espaços múltiplos)
  const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
  const nomeProduto = (p) => norm(`${p.fabricante} ${p.modelo}`);

  // Buscar TODOS os produtos (inclusive inativos) — um produto pode ter sido
  // desativado depois que o pré-projeto foi salvo, mas ainda precisa casar
  let todosProdutos = [];
  try {
    todosProdutos = await base44.asServiceRole.entities.Produto.list("-created_date", 500);
  } catch (_e) {}

  // Buscar produto do módulo para obter potência em Wp
  let moduloProduto = null;
  if (preProjeto?.modulo_marca_modelo) {
    const alvo = norm(preProjeto.modulo_marca_modelo);
    moduloProduto = todosProdutos.find(p => nomeProduto(p) === alvo) || null;
  }

  // Buscar produtos dos inversores (suporta múltiplos modelos)
  let inversorProdutos = []; // array de { produto, quantidade }
  let inversorProduto = null; // legado: primeiro inversor
  {
    // Suporte ao novo campo "inversores" (array)
    const inversoresArr = preProjeto?.inversores?.length
      ? preProjeto.inversores
      : preProjeto?.inversor_marca_modelo
        ? [{ marca_modelo: preProjeto.inversor_marca_modelo, quantidade: preProjeto?.inversor_quantidade || 1 }]
        : [];

    inversorProdutos = inversoresArr.map(inv => {
      const alvo = norm(inv.marca_modelo);
      return {
        produto: todosProdutos.find(p => nomeProduto(p) === alvo) || null,
        marca_modelo: inv.marca_modelo,
        quantidade: Number(inv.quantidade) || 1,
      };
    });
    inversorProduto = inversorProdutos[0]?.produto || null;
  }

  if (!projetoData) return Response.json({ error: 'Projeto não encontrado' }, { status: 404 });
  projeto = projetoData;

  // Responsável técnico fixo (configurável no futuro)
  const RESP_TECNICO = rt.responsavel_tecnico || "Thiago Fernandes Juffo Fontes";
  const CREA = rt.crea_responsavel || "ES-033278/D";
  const RESP_ENDERECO = "Avenida Saint Hilaire 126 / Serra - ES, Casa 30";
  const RESP_TELEFONE = "27-992385570";
  const RESP_EMAIL = "Thiago@ecomarneg.com";
  const RESP_CPF = "125.971.157-98";
  const RESP_RG = "2.242.767";
  const EMPRESA = "Ecomarné Engenharia";

  // Data atual formatada em português
  const agora = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const dataExtenso = `${agora.getDate()} de ${meses[agora.getMonth()]} de ${agora.getFullYear()}`;
  const cidade = uc.cidade || projeto.cidade || "Vitória";
  const estado = uc.estado || "ES";

  let htmlContent = "";

  if (tipo === "procuracao") {
    htmlContent = gerarProcuracao({ projeto, uc, rt, RESP_TECNICO, RESP_CPF, RESP_RG, RESP_ENDERECO, dataExtenso, cidade, estado });
  } else if (tipo === "memorial_tecnico") {
    htmlContent = gerarMemorial({ projeto, uc, rt, preProjeto, moduloProduto, inversorProdutos, RESP_TECNICO, CREA, RESP_ENDERECO, RESP_TELEFONE, RESP_EMAIL, dataExtenso, cidade, estado, EMPRESA });
  } else if (tipo === "solicitacao_art") {
    htmlContent = gerarSolicitacaoART({ projeto, uc, rt, preProjeto, moduloProduto, inversorProdutos, dataExtenso });
  } else if (tipo === "relatorio_entrega") {
    htmlContent = gerarRelatorioEntrega({ projeto, uc, preProjeto, moduloProduto, inversorProdutos });
  } else {
    return Response.json({ error: 'Tipo de documento não suportado' }, { status: 400 });
  }

  return Response.json({ html: htmlContent, tipo, projeto_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function gerarProcuracao({ projeto, uc, rt, RESP_TECNICO, RESP_CPF, RESP_RG, RESP_ENDERECO, dataExtenso, cidade, estado }) {
  const nomeCliente = uc.titular || projeto.nome_cliente;
  const cpfCliente = uc.cpf || projeto.cpf;
  const endereco = uc.endereco || "—";
  const cep = uc.cep || "—";
  const cidadeUF = `${uc.cidade || cidade} – ${estado}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; margin: 3cm 3cm 2cm 3cm; color: #000; line-height: 1.6; }
  h1 { text-align: center; font-size: 16pt; margin-bottom: 2em; }
  .section-title { font-weight: bold; font-size: 13pt; margin-top: 1.5em; }
  .signature-area { margin-top: 4em; display: flex; justify-content: space-between; }
  .sig-line { text-align: center; width: 45%; }
  .sig-line hr { border: none; border-top: 1px solid #000; margin-bottom: 0.3em; }
  p { margin-bottom: 0.8em; text-align: justify; }
</style>
</head>
<body>
<h1>PROCURAÇÃO</h1>

<p class="section-title">Outorgante</p>
<p>${nomeCliente}, CPF: ${cpfCliente}, estabelecido na ${endereco}, ${cidadeUF}. CEP: ${cep}</p>

<p class="section-title">Outorgado</p>
<p>${RESP_TECNICO}, brasileiro, Casado(a), engenheiro eletricista, portador do RG nº ${RESP_RG}, expedido pelo SPTC - ES, inscrito no CPF sob o nº ${RESP_CPF}, residente e domiciliado(a) na ${RESP_ENDERECO}.</p>

<p class="section-title">Poderes</p>
<p>Concede plenos poderes ao(à) OUTORGADO, a fim de que possa defender os direitos e interesses do(a) OUTORGANTE, podendo assinar requerimentos, ofícios, termos e compromissos, concordar e discordar de declarações, solicitar, providenciar e ter acesso a documentos, além de poder formular reclamações eventualmente necessárias. Todos os poderes acima citados em relação ao processo de microgeração durante o processo junto à EDP ESCELSA.</p>

<p class="section-title">Validade</p>
<p>Esta procuração tem validade de 200 dias, a contar da data de sua assinatura.</p>

<p>${cidade} / ${estado}, ${dataExtenso}.</p>

<div class="signature-area">
  <div class="sig-line">
    <hr />
    <p>${nomeCliente}<br>CPF: ${cpfCliente}</p>
  </div>
</div>
</body>
</html>`;
}

// Fatores mensais de irradiação (% relativa à média anual) para ES/Serra
const FATORES_MENSAIS = {
  Jan: 1.1491, Fev: 1.1014, Mar: 1.1068,
  Abr: 0.9964, Mai: 0.9840, Jun: 0.8471,
  Jul: 0.9134, Ago: 1.0152, Set: 0.8919,
  Out: 1.0296, Nov: 0.9154, Dez: 1.0496
};

function gerarMemorial({ projeto, uc, rt, preProjeto, moduloProduto, inversorProdutos, RESP_TECNICO, CREA, RESP_ENDERECO, RESP_TELEFONE, RESP_EMAIL, dataExtenso, cidade, estado, EMPRESA }) {
  // --- Dados dos equipamentos (prioridade: produto cadastrado > preProjeto > rt) ---
  const qtdModulos = preProjeto?.modulo_quantidade || rt.quantidade_modulos || "—";
  const modDescricao = preProjeto?.modulo_marca_modelo || rt.modulo_descricao || "—";

  // Potência em kWp calculada a partir dos módulos
  const potWpModulo = moduloProduto?.potencia_wp || 0;
  const potKwpCalculado = (potWpModulo && preProjeto?.modulo_quantidade)
    ? ((potWpModulo * preProjeto.modulo_quantidade) / 1000).toFixed(2)
    : null;
  const potKwp = potKwpCalculado || rt.potencia_kwp || preProjeto?.potencia_pico_kwp || "—";

  // Dados do módulo da biblioteca de produtos
  const modPotencia = moduloProduto?.potencia_wp ? `${moduloProduto.potencia_wp} Wp` : "—";
  const modVmp = moduloProduto?.vmp ? `${moduloProduto.vmp} V` : "—";
  const modImp = moduloProduto?.imp ? `${moduloProduto.imp} A` : "—";
  const modVoc = moduloProduto?.voc ? `${moduloProduto.voc} V` : "—";
  const modIsc = moduloProduto?.isc ? `${moduloProduto.isc} A` : "—";
  const modEficiencia = moduloProduto?.eficiencia_modulo ? `${moduloProduto.eficiencia_modulo}%` : "—";
  // Área do módulo em m²: usa area_m2 se preenchido, senão calcula a partir de dimensoes
  // (pega todos os números da string, ex: "2382x1134x35", "2278MM 1134MM 30MM", "2382x1134x35/30")
  const areaModuloM2 = (p) => {
    if (p?.area_m2) return p.area_m2;
    if (!p?.dimensoes) return null;
    const nums = (String(p.dimensoes).match(/\d+(?:[.,]\d+)?/g) || []).map(s => parseFloat(s.replace(",", "."))).filter(n => !isNaN(n));
    if (nums.length < 2) return null;
    return (nums[0] / 1000) * (nums[1] / 1000);
  };
  const _areaModulo = areaModuloM2(moduloProduto);
  const modArea = _areaModulo ? `${_areaModulo.toFixed(2)} m²` : "—";
  const modCoefTemp = moduloProduto?.coef_temperatura || "—";
  const modFusivel = moduloProduto?.corrente_max_fusivel_a ? `${moduloProduto.corrente_max_fusivel_a} A` : "—";
  const modGarantia = moduloProduto?.garantia_anos ? `${moduloProduto.garantia_anos} anos` : "—";
  const modInmetro = moduloProduto?.inmetro_numero || "—";

  // Inversores
  const inversoresArr = inversorProdutos.length ? inversorProdutos : [];
  let invDescricao = "—";
  if (inversoresArr.length > 0) {
    invDescricao = inversoresArr.map(inv => `${inv.quantidade}x ${inv.marca_modelo}`).join(" + ");
  } else if (preProjeto?.inversor_marca_modelo) {
    invDescricao = preProjeto.inversor_marca_modelo;
  } else {
    invDescricao = rt.inversor_descricao || "—";
  }

  // Potência total dos inversores
  let potInversorTotal = 0;
  for (const inv of inversoresArr) {
    const potUnit = inv.produto?.potencia_ac_w
      ? inv.produto.potencia_ac_w / 1000
      : inv.produto?.potencia_kva || 0;
    potInversorTotal += potUnit * inv.quantidade;
  }
  const potInversorKw = potInversorTotal > 0 ? `${potInversorTotal.toFixed(2)} kW` : "—";

  // Strings e arranjo
  const numStrings = rt.num_strings || "—";
  const modPorString = rt.modulos_por_string || "—";
  const artNumero = rt.art_numero || "—";
  const hoje = new Date();
  const dataInstalacaoObj = new Date(hoje.getTime() + 60 * 24 * 60 * 60 * 1000);
  const dataInstalacaoFormatada = dataInstalacaoObj.toLocaleDateString("pt-BR");
  const dataInstalacao = rt.data_prevista_instalacao ? new Date(rt.data_prevista_instalacao + "T12:00:00").toLocaleDateString("pt-BR") : dataInstalacaoFormatada;
  const dataComissionamentoObj = new Date(hoje.getTime() + 65 * 24 * 60 * 60 * 1000);
  const dataComissionamento = rt.data_prevista_comissionamento ? new Date(rt.data_prevista_comissionamento + "T12:00:00").toLocaleDateString("pt-BR") : dataComissionamentoObj.toLocaleDateString("pt-BR");

  // Usar o titular da UC como nome do proprietário nos documentos (pode ser diferente do nome do contrato)
  const nomeCliente = uc.titular || projeto.nome_cliente;
  const cpfCliente = uc.cpf || projeto.cpf;
  const numeroUC = uc.numero_uc || "—";
  const endereco = uc.endereco || "—";
  const cep = uc.cep || "—";
  const cidadeEstado = `${uc.cidade || cidade} - ${uc.estado || estado}`;
  const tipoLigacao = uc.tipo_ligacao === "monofasico" ? "Monofásico" : uc.tipo_ligacao === "bifasico" ? "Bifásico (220V/127V)" : uc.tipo_ligacao === "trifasico" ? "Trifásico" : "—";
  const telefone = uc.telefone || projeto.telefone || "—";
  const email = uc.email || projeto.email || "—";

  // Tabelas de specs por inversor
  const tabelasInversores = inversoresArr.map(inv => {
    const p = inv.produto;
    if (!p) return `<p><strong>${inv.quantidade}x ${inv.marca_modelo}</strong> — especificações não cadastradas na biblioteca de produtos.</p>`;
    const potNominal = p.potencia_ac_w ? `${p.potencia_ac_w} W` : p.potencia_kva ? `${p.potencia_kva} kVA` : "—";
    const potTotal = p.potencia_ac_w
      ? `${(p.potencia_ac_w * inv.quantidade / 1000).toFixed(2)} kW`
      : p.potencia_kva ? `${(p.potencia_kva * inv.quantidade).toFixed(2)} kVA` : "—";
    return `
<table>
  <tr><th colspan="2" style="background-color:#00b050;color:#fff;font-weight:bold;text-align:center;">Especificações Técnicas do Inversor</th></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Fabricante do(s) Inversor(es)</td><td>${p.fabricante || inv.marca_modelo.split(" ")[0] || "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Modelo do(s) Inversor(es)</td><td>${p.modelo || inv.marca_modelo || "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Potência Nominal dos(s) Inversor(es)</td><td>${potNominal}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Quantidade dos Inversor(es)</td><td>${inv.quantidade}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Potência de Saída AC</td><td>${potTotal}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Tensão nominal AC</td><td>${p.tensao_nominal_ac_v || "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Corrente de saída Max AC</td><td>${p.corrente_max_ac_a ? `${p.corrente_max_ac_a} A` : "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Frequência de operação</td><td>${p.frequencia_operacao_hz ? `${p.frequencia_operacao_hz} Hz` : "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Range de frequência</td><td>${p.range_frequencia_hz || "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Max Corrente DC</td><td>${p.corrente_max_dc_a ? `${p.corrente_max_dc_a} A` : "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Fator de potência</td><td>${p.fator_potencia || "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Range de temperatura</td><td>${p.range_temperatura || "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Tensão Máxima Entrada do Inversor</td><td>${p.tensao_max_dc_v ? `${p.tensao_max_dc_v} V` : "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Tensão Mínima Entrada do Inversor</td><td>${p.tensao_min_dc_v ? `${p.tensao_min_dc_v} V` : "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Rendimento do Inversor</td><td>${p.eficiencia ? `${p.eficiencia}%` : "—"}</td></tr>
</table>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; margin: 2.5cm 2.5cm 2cm 3cm; color: #000; line-height: 1.5; }
  h1 { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 0.3em; }
  h2 { font-size: 12pt; font-weight: bold; margin-top: 1.4em; margin-bottom: 0.5em; border-bottom: 1px solid #999; padding-bottom: 2px; }
  h3 { font-size: 11pt; font-weight: bold; margin-top: 1em; }
  p { text-align: justify; margin-bottom: 0.6em; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1em; font-size: 10pt; }
  table td, table th { border: 1px solid #555; padding: 5px 8px; }
  table th { background-color: #ddd; font-weight: bold; text-align: left; }
  .header-subtitle { text-align: center; font-size: 11pt; margin-bottom: 0.2em; }
  .center { text-align: center; }
</style>
</head>
<body>

<h1>MEMORIAL TÉCNICO DESCRITIVO – MICRO GERAÇÃO DISTRIBUÍDA EM BAIXA TENSÃO</h1>
<p class="header-subtitle">Instalação <strong>${nomeCliente}</strong></p>
<p class="header-subtitle">${dataExtenso}</p>
<p class="center">${cidadeEstado}</p>

<h2>1. Escopo</h2>
<p>Este documento apresenta a <strong>Documentação Técnica</strong>, conforme as <em>normas técnicas</em> válidas no Brasil, para o projeto do sistema de microgeração distribuída. São aqui apresentados os dados e as informações técnicas sobre o projeto e a instalação; pessoas físicas e jurídicas envolvidas; especificação dos componentes; testes de comissionamento.</p>

<h2>2. Objetivo</h2>
<p>O sistema fotovoltaico conectado à rede que será instalado na unidade habitacional abaixo identificada tem por finalidade a <strong>Compensação de Energia Elétrica</strong>, modalidade de micro ou minigeração distribuída que permite ao consumidor gerar energia em paralelismo com a rede pública de distribuição de energia elétrica, para fins de auto consumo.</p>
<p>O Sistema de Compensação de Energia Elétrica é regulamentado pela <strong>Agência Nacional de Energia Elétrica</strong> (ANEEL), através da Resolução Normativa 482 de 17 de Abril de 2012; o projeto aqui apresentado segue as determinações desta resolução normativa, bem como os Procedimentos de Distribuição de Energia Elétrica (PRODIST), as normas técnicas vigentes para instalações elétricas em baixa tensão (NBR-5410), proteção de estruturas contra descargas atmosféricas (NBR-5419).</p>
<p>O projeto elétrico segue às determinações da concessionária de energia elétrica local, a <strong>EDP Escelsa</strong>, através da observância da norma interna de <strong>CONEXÃO DE MINI E MICROGERADORES AO SISTEMA DE DISTRIBUIÇÃO EM BAIXA TENSÃO</strong> (PR.DT.PDN.03.14.002).</p>

<h2>3. Dados Preliminares</h2>
<table>
  <tr><th colspan="2" style="background-color:#00b050;color:#fff;font-weight:bold;text-align:center;">Nome para Registro:<br/>${nomeCliente}</th></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Potência-pico do Sistema Fotovoltaico conectado à rede (kWp)</td><td>${potKwp}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Fabricante dos módulos</td><td>${moduloProduto?.fabricante || "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Modelo dos módulos</td><td>${moduloProduto?.modelo || modDescricao}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Tecnologia dos módulos</td><td>Silício Monocristalino</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Quantidade Total de módulos fotovoltaicos</td><td>${qtdModulos}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Fabricante do(s) Inversor(es)</td><td>${inversoresArr.map(inv => inv.produto?.fabricante || inv.marca_modelo.split(" ")[0]).join(" / ") || "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Modelo do(s) Inversor(es)</td><td>${inversoresArr.map(inv => inv.produto?.modelo || inv.marca_modelo).join(" / ") || "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Potência Nominal Total do(s) Inversor(es) (kW)</td><td>${potInversorKw}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Quantidade de Inversores</td><td>${inversoresArr.reduce((sum, inv) => sum + inv.quantidade, 0) || "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Data de Instalação (Previsão)</td><td>${dataInstalacao}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Data de Comissionamento (Previsão)</td><td>${dataComissionamento}</td></tr>
</table>

<h3>3.1 Identificação do Proprietário e Local de Instalação</h3>
<table>
  <tr><th colspan="2">Identificação da Unidade Consumidora</th></tr>
  <tr><td>Proprietário</td><td>${nomeCliente}</td></tr>
  <tr><td>Número da Unidade Consumidora</td><td>${numeroUC}</td></tr>
  <tr><td>Endereço</td><td>${endereco}</td></tr>
  <tr><td>CEP</td><td>${cep}</td></tr>
  <tr><td>Cidade e Estado</td><td>${cidadeEstado}</td></tr>
  <tr><td>CPF Proprietário</td><td>${cpfCliente}</td></tr>
  <tr><td>Telefone Proprietário</td><td>${telefone}</td></tr>
  <tr><td>E-mail</td><td>${email}</td></tr>
  <tr><td>Latitude</td><td>${uc.latitude || "—"}</td></tr>
  <tr><td>Longitude</td><td>${uc.longitude || "—"}</td></tr>
  <tr><td>Classificação da Unidade Consumidora</td><td>Residencial</td></tr>
  <tr><td>Tipo de Ligação da Unidade Consumidora</td><td>${tipoLigacao}</td></tr>
</table>

<h3>3.2 Responsabilidade Técnica</h3>
<table>
  <tr><th colspan="2" style="background-color:#00b050;color:#fff;font-weight:bold;text-align:center;">Responsável Técnico</th></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Responsável Pelo Projeto Técnico</td><td>${RESP_TECNICO}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Número de Registro (CREA)</td><td>${CREA}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Endereço</td><td>${RESP_ENDERECO}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Telefone</td><td>${RESP_TELEFONE}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">E-mail</td><td>${RESP_EMAIL}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Anotação de Responsabilidade Técnica (ART) Projeto</td><td>${artNumero}</td></tr>
</table>

<h2>4. Especificação Técnica dos Equipamentos</h2>

<h3>4.1 Módulo Fotovoltaico – ${modDescricao}</h3>
<table>
  <tr><th colspan="3" style="background-color:#00b050;color:#fff;font-weight:bold;text-align:center;">Características Elétricas - Modelos Fotovoltaicos</th></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Fabricante</td><td>${moduloProduto?.fabricante || "—"}</td><td></td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Modelo</td><td>${moduloProduto?.modelo || modDescricao}</td><td></td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Tensão de funcionamento Ótima (<u>Vmp</u>)</td><td>${moduloProduto?.vmp || "—"}</td><td>V</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Corrente de funcionamento Ótima (<u>Imp</u>)</td><td>${moduloProduto?.imp || "—"}</td><td>A</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Tensão em circuito aberto (<u>Voc</u>)</td><td>${moduloProduto?.voc || "—"}</td><td>V</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Corrente de curto-circuito (<u>Isc</u>)</td><td>${moduloProduto?.isc || "—"}</td><td>A</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Potência máxima (<u>Pmax</u>) em condições de teste padrão</td><td>${moduloProduto?.potencia_wp || "—"}</td><td>Wp</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Eficiência do módulo</td><td>${moduloProduto?.eficiencia_modulo || moduloProduto?.eficiencia || "—"}</td><td></td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Corrente máxima por fusível em série</td><td>${moduloProduto?.corrente_max_fusivel_a || "—"}</td><td>A</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Coeficiente de temperatura</td><td colspan="2"></td></tr>
  <tr><td style="background-color:#00b050;color:#fff;"><u>Ppeak</u></td><td>${moduloProduto?.coef_temp_ppeak || "—"}</td><td>/C°</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;"><u>Voc</u></td><td>${moduloProduto?.coef_temp_voc || "—"}</td><td>/C°</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;"><u>Isc</u></td><td>${moduloProduto?.coef_temp_isc || "—"}</td><td>/C°</td></tr>
</table>

<table>
  <tr><th colspan="2" style="background-color:#00b050;color:#fff;font-weight:bold;text-align:center;">Aspecto Físico do Painel Fotovoltaico</th></tr>
  <tr><td style="background-color:#00b050;color:#fff;text-align:center;">Área dos Arranjos (m2)</td><td>${(() => { const a = areaModuloM2(moduloProduto); return a ? (a * qtdModulos).toFixed(2) : "—"; })()}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;text-align:center;">Peso adicional (kg)</td><td>${moduloProduto?.peso && qtdModulos ? (moduloProduto.peso * Number(qtdModulos)).toFixed(1) : "—"}</td></tr>
</table>

<h3>4.2 Inversor(es)</h3>
${tabelasInversores}

${(() => {
  const kwhMedio = parseFloat(preProjeto?.kwh_prometidos) || 0;
  const meses = Object.keys(FATORES_MENSAIS);
  const geracoes = meses.map(m => kwhMedio ? (kwhMedio * FATORES_MENSAIS[m]).toFixed(0) : null);
  const maxVal = kwhMedio ? Math.max(...geracoes.map(Number)) : 0;
  const barMaxHeight = 120; // px

  const linhaFatores = meses.map(m => `<td>${(FATORES_MENSAIS[m]*100).toFixed(2)}%</td>`).join("");
  const linhaGeracoes = geracoes.map(v => `<td>${v || "—"}</td>`).join("");

  const barras = meses.map((m, i) => {
    const val = geracoes[i] ? Number(geracoes[i]) : 0;
    const h = maxVal ? Math.round((val / maxVal) * barMaxHeight) : 0;
    return `
      <div style="display:flex;flex-direction:column;align-items:center;width:30px;">
        <span style="font-size:7pt;margin-bottom:2px;">${val}</span>
        <div style="width:22px;height:${h}px;background:#00b050;border-radius:2px 2px 0 0;"></div>
        <span style="font-size:7pt;margin-top:3px;">${m}</span>
      </div>`;
  }).join("");

  return `
<table>
  <tr><th colspan="2" style="background-color:#00b050;color:#fff;font-weight:bold;text-align:center;">Estimativa de geração e Considerações Gerais</th></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Potência instalada do circuito DC (<u>kWp</u>)</td><td>${potKwp}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Potência instalada do circuito AC (kW)</td><td>${potInversorKw}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Hora de Sol Pico</td><td>${(() => { const kwp = parseFloat(potKwp); return (kwhMedio && kwp) ? (kwhMedio / kwp / 30).toFixed(2) + " h" : "—"; })()}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Estimativa de geração média mensal (kWh/Mês)</td><td>${kwhMedio || "—"}</td></tr>
</table>

${kwhMedio ? `
<table style="margin-top:0.5em;">
  <tr>
    <th style="background-color:#00b050;color:#fff;text-align:center;">Mês</th>
    ${meses.map(m => `<th style="background-color:#00b050;color:#fff;text-align:center;font-size:9pt;">${m}</th>`).join("")}
    <th style="background-color:#00b050;color:#fff;text-align:center;">Média</th>
  </tr>
  <tr>
    <td style="background-color:#00b050;color:#fff;">Fator</td>
    ${linhaFatores}
    <td>100%</td>
  </tr>
  <tr>
    <td style="background-color:#00b050;color:#fff;">Geração Mensal (kWh)</td>
    ${linhaGeracoes}
    <td>${kwhMedio}</td>
  </tr>
</table>

<div style="margin-top:1em;padding:10px;border:1px solid #ccc;border-radius:4px;">
  <p style="text-align:center;font-size:9pt;font-weight:bold;margin-bottom:8px;">Geração Estimada Anual (kWh)</p>
  <div style="display:flex;align-items:flex-end;justify-content:center;gap:6px;height:${barMaxHeight + 40}px;padding:0 10px;">
    ${barras}
  </div>
</div>
` : ""}`;
})()}

<h2>5. Descritivo Técnico do Sistema</h2>
<p>O presente sistema de microgeração distribuída utiliza a tecnologia dos sistemas fotovoltaicos para a geração de energia em montante necessário para a compensação do consumo médio mensal da unidade consumidora onde está instalado.</p>
<p>O sistema fotovoltaico conectado à rede possui sistema de proteção contra <strong><em>ilhamento</em></strong>, relês e temporizadores para sincronismo, e controle de frequência, tensão e fator de potência.</p>


<h3>5.2 Cabos e Conexões</h3>
<p>Serão utilizados cabos solares com proteção UV de 4,0mm². As conexões serão feitas por conectores MC4 com proteção UV e resistência a amoníaco.</p>

<h3>5.3 String Box</h3>
<p>A proteção do circuito de corrente contínua será através de String Box. A proteção de cada String é feita através de fusível de 15A montado em porta-fusível, um Disjuntor de 20A e um DPS de 1000V.</p>

<h2>6. Sinalização de Segurança</h2>
<p>Será afixada, no poste-padrão do ramal de entrada, uma placa indicativa de que a unidade consumidora possui sistema de geração própria, conforme definição da norma GED-15303.</p>

<h2>7. Observações Técnicas</h2>
<p>${rt.observacoes_tecnicas || "Nenhuma observação adicional."}</p>

<br/><br/>
<p>${cidadeEstado}, ${dataExtenso}.</p>
<br/><br/>
<p>___________________________<br/>${RESP_TECNICO}<br/>Engenheiro Eletricista - CREA: ${CREA}</p>

</body>
</html>`;
}

function gerarSolicitacaoART({ projeto, uc, rt, preProjeto, moduloProduto, inversorProdutos, dataExtenso }) {
  // Potência das placas em kWp: calculada a partir dos módulos
  const qtdModulos = preProjeto?.modulo_quantidade || rt.quantidade_modulos || 0;
  const potWpModulo = moduloProduto?.potencia_wp || 0;
  const potKwpCalculado = (qtdModulos && potWpModulo) ? ((potWpModulo * qtdModulos) / 1000).toFixed(2) : null;
  const potKwp = potKwpCalculado || rt.potencia_kwp || preProjeto?.potencia_pico_kwp || "—";

  // Potência total dos inversores = soma de (potência unitária × quantidade) para cada modelo
  let potInversorTotal = 0;
  const inversoresArr = inversorProdutos.length ? inversorProdutos : [];
  for (const inv of inversoresArr) {
    const potUnit = inv.produto?.potencia_ac_w
      ? inv.produto.potencia_ac_w / 1000
      : inv.produto?.potencia_kva || 0;
    potInversorTotal += potUnit * inv.quantidade;
  }
  const potInversor = potInversorTotal > 0
    ? potInversorTotal.toFixed(2)
    : rt.potencia_kva || "—";

  // Potência de geração = menor entre os dois
  const numKwp = parseFloat(potKwp) || 0;
  const numInv = parseFloat(potInversor) || 0;
  const potGeracao = (numKwp && numInv) ? Math.min(numKwp, numInv).toFixed(2) : "—";

  const modDesc = preProjeto?.modulo_marca_modelo || rt.modulo_descricao || "";
  // Descrição do kit com múltiplos inversores
  let invDesc = "";
  if (inversorProdutos.length > 0) {
    invDesc = inversorProdutos.map(inv => `${inv.quantidade}x ${inv.marca_modelo}`).join(" + ");
  } else {
    invDesc = preProjeto?.inversor_marca_modelo || rt.inversor_descricao || "";
  }
  const kit = rt.arranjo_descricao || `${qtdModulos || "?"} módulos ${modDesc} + ${invDesc}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 12pt; margin: 3cm; color: #000; line-height: 1.8; }
  h1 { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 2em; }
  .field { margin-bottom: 0.5em; }
  .label { font-weight: bold; }
</style>
</head>
<body>
<h1>SOLICITAÇÃO DE ART – MICROGERAÇÃO DISTRIBUÍDA</h1>

<div class="field"><span class="label">NOME:</span> ${uc.titular || projeto.nome_cliente}</div>
<div class="field"><span class="label">CPF:</span> ${uc.cpf || projeto.cpf}</div>
<div class="field"><span class="label">INSTALAÇÃO (UC):</span> ${uc.numero_uc || "—"}</div>
<div class="field"><span class="label">ENDEREÇO:</span> ${uc.endereco || "—"}${uc.cidade ? ` - ${uc.cidade}` : ""}${uc.estado ? ` / ${uc.cidade} - ${uc.estado}` : ""}${uc.cep ? ` CEP: ${uc.cep}` : ""}</div>
<div class="field"><span class="label">TELEFONE:</span> ${uc.telefone || projeto.telefone || "—"}</div>
<div class="field"><span class="label">EMAIL:</span> ${uc.email || projeto.email || "—"}</div>
<br/>
<div class="field"><span class="label">KIT:</span> ${kit}</div>
<div class="field"><span class="label">Potência Placas kWp:</span> ${potKwp}</div>
<div class="field"><span class="label">Potência Inversor kW:</span> ${potInversor}</div>
<div class="field"><span class="label">Potência de Geração (Menor entre os 2 acima):</span> ${potGeracao}</div>
<div class="field"><span class="label">ART:</span> ${rt.art_numero || "Definir"}</div>

<br/><br/>
<p>${dataExtenso}</p>
</body>
</html>`;
}

function gerarRelatorioEntrega({ projeto, uc, preProjeto, moduloProduto, inversorProdutos }) {
  const nomeCliente = uc.titular || projeto.nome_cliente || "—";
  const endereco = uc.endereco || "—";
  const cidadeUF = `${uc.cidade || "—"} / ${uc.estado || "—"}`;

  // Potência em kWp
  const potWpModulo = moduloProduto?.potencia_wp || 0;
  const qtdMod = preProjeto?.modulo_quantidade || 0;
  const potKwpCalc = (potWpModulo && qtdMod) ? ((potWpModulo * qtdMod) / 1000).toFixed(2) : null;
  const potKwp = potKwpCalc || preProjeto?.potencia_pico_kwp || "—";

  // Inversores
  const inversoresArr = inversorProdutos.length ? inversorProdutos : [];
  const inversorDesc = inversoresArr.length > 0
    ? inversoresArr.map(inv => `${inv.quantidade}x ${inv.marca_modelo}`).join(" + ")
    : preProjeto?.inversor_marca_modelo || "—";

  // Data da instalação
  const dataInstalacao = projeto.data_instalacao
    ? new Date(projeto.data_instalacao + "T12:00:00").toLocaleDateString("pt-BR")
    : "—";

  // Monitoramento
  const aplicativo = projeto.monitoramento_portal || "—";
  const login = projeto.monitoramento_login || "—";
  const senha = projeto.monitoramento_senha_encrypted || "—";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { width: 210mm; min-height: 297mm; margin: 0 auto; position: relative; overflow: hidden; background: #fff; }

  /* Decorative dotted patterns */
  .dot-tl { position: absolute; top: 0; left: 0; width: 45mm; height: 45mm;
    background-image: radial-gradient(circle, #d1e0d9 1px, transparent 1.5px);
    background-size: 5mm 5mm; opacity: 0.7; }
  .dot-br { position: absolute; bottom: 0; right: 0; width: 45mm; height: 45mm;
    background-image: radial-gradient(circle, #d1e0d9 1px, transparent 1.5px);
    background-size: 5mm 5mm; opacity: 0.7; }

  .content { position: relative; z-index: 1; padding: 14mm 16mm 10mm; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8mm; }
  .logo { display: flex; align-items: center; gap: 2.5mm; }
  .logo-icon { width: 9mm; height: 9mm; }
  .logo-text { font-size: 13pt; font-weight: 700; color: #333; letter-spacing: 0.5px; }
  .logo-text .eng { color: #007337; }
  .sun-icon { width: 10mm; height: 10mm; }

  /* Hero */
  .hero { display: flex; gap: 8mm; margin-bottom: 8mm; align-items: center; }
  .hero-left { flex: 1; }
  .hero-left h1 { font-size: 24pt; font-weight: 800; color: #007337; line-height: 1.15; margin-bottom: 4mm; }
  .hero-left p { font-size: 10pt; color: #555; line-height: 1.6; }
  .hero-left p strong { color: #333; font-weight: 600; }
  .hero-img { width: 55mm; height: 40mm; border-radius: 3mm; overflow: hidden; flex-shrink: 0; }
  .hero-img img { width: 100%; height: 100%; object-fit: cover; }

  /* Steps */
  .steps-section { text-align: center; margin-bottom: 9mm; }
  .steps-title { font-size: 11pt; font-weight: 700; color: #333; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6mm; }
  .steps { display: flex; justify-content: space-between; align-items: flex-start; position: relative; }
  .step { text-align: center; width: 20%; position: relative; z-index: 2; }
  .step-circle { width: 18mm; height: 18mm; border-radius: 50%; background: #f0f7f3; border: 2px solid #007337; margin: 0 auto 3mm; display: flex; align-items: center; justify-content: center; }
  .step-circle svg { width: 10mm; height: 10mm; }
  .step-num { position: absolute; top: -1mm; right: 30%; background: #007337; color: #fff; width: 6mm; height: 6mm; border-radius: 50%; font-size: 8pt; font-weight: 700; display: flex; align-items: center; justify-content: center; }
  .step-label { font-size: 7.5pt; font-weight: 700; color: #333; text-transform: uppercase; line-height: 1.3; }
  .step-desc { font-size: 7pt; color: #666; margin-top: 1mm; line-height: 1.3; }
  .step-arrow { position: absolute; top: 8mm; height: 2px; border-top: 2px dashed #b0c4b8; z-index: 1; }

  /* Two columns */
  .two-col { display: flex; gap: 6mm; margin-bottom: 8mm; }
  .col { flex: 1; }
  .col-badge { display: inline-flex; align-items: center; gap: 2mm; background: #007337; color: #fff; font-size: 9pt; font-weight: 700; padding: 2mm 4mm; border-radius: 2mm; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5mm; }
  .col-badge svg { width: 4.5mm; height: 4.5mm; }
  .field-line { display: flex; align-items: baseline; padding: 2.5mm 0; border-bottom: 1px solid #ccc; font-size: 9.5pt; }
  .field-line .lbl { font-weight: 600; color: #555; white-space: nowrap; }
  .field-line .val { flex: 1; color: #333; margin-left: 1.5mm; }

  /* Monitor phone mockup */
  .phone-mock { display: flex; gap: 4mm; align-items: flex-start; margin-bottom: 4mm; }
  .phone { width: 20mm; height: 34mm; background: #007337; border-radius: 3mm; padding: 1.5mm; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .phone-screen { width: 100%; height: 100%; background: #fff; border-radius: 1.5mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5mm; }
  .phone-screen .ps-logo { font-size: 5pt; font-weight: 700; color: #007337; }
  .phone-screen .ps-house { width: 8mm; height: 6mm; }
  .monitor-fields { flex: 1; }
  .mf-row { display: flex; align-items: center; gap: 2mm; padding: 2mm 0; border-bottom: 1px solid #ccc; font-size: 9pt; }
  .mf-row svg { width: 4mm; height: 4mm; flex-shrink: 0; color: #007337; }
  .mf-row .lbl { font-weight: 600; color: #555; white-space: nowrap; }
  .mf-row .val { color: #333; }

  /* Footer */
  .footer { display: flex; justify-content: space-between; align-items: flex-end; padding-top: 6mm; border-top: 1px solid #e0e0e0; position: relative; }
  .footer-left { flex: 1; }
  .footer-left .duvida { font-size: 9pt; font-weight: 600; color: #333; margin-bottom: 2.5mm; }
  .footer-contact { display: flex; align-items: center; gap: 1.5mm; font-size: 8.5pt; color: #555; margin-bottom: 1mm; }
  .footer-contact svg { width: 3.5mm; height: 3.5mm; color: #007337; }
  .footer-center { text-align: center; flex: 0 0 auto; }
  .footer-center .logo { justify-content: center; }
  .footer-right { flex: 1; text-align: right; }
  .footer-right .slogan { font-size: 8pt; font-weight: 700; color: #007337; text-transform: uppercase; line-height: 1.5; letter-spacing: 0.3px; }
  .footer-illust { position: absolute; bottom: -2mm; left: 50%; transform: translateX(-50%); width: 30mm; opacity: 0.5; }

  @media print { .page { width: auto; min-height: auto; } }
</style>
</head>
<body>
<div class="page">
  <div class="dot-tl"></div>
  <div class="dot-br"></div>

  <div class="content">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <svg class="logo-icon" viewBox="0 0 40 40" fill="none">
          <path d="M20 4 L34 14 L34 32 L6 32 L6 14 Z" fill="#007337" opacity="0.15"/>
          <path d="M20 4 L34 14 L34 32 L6 32 L6 14 Z" stroke="#007337" stroke-width="2"/>
          <path d="M20 8 L30 15 L30 30 L10 30 L10 15 Z" fill="#007337"/>
          <circle cx="20" cy="20" r="3" fill="#fff"/>
        </svg>
        <span class="logo-text">Ecomar <span class="eng">Engenharia</span></span>
      </div>
      <svg class="sun-icon" viewBox="0 0 40 40" fill="none" stroke="#007337" stroke-width="1.5">
        <circle cx="20" cy="20" r="7"/>
        <line x1="20" y1="4" x2="20" y2="9"/>
        <line x1="20" y1="31" x2="20" y2="36"/>
        <line x1="4" y1="20" x2="9" y2="20"/>
        <line x1="31" y1="20" x2="36" y2="20"/>
        <line x1="8" y1="8" x2="12" y2="12"/>
        <line x1="28" y1="28" x2="32" y2="32"/>
        <line x1="32" y1="8" x2="28" y2="12"/>
        <line x1="12" y1="28" x2="8" y2="32"/>
      </svg>
    </div>

    <!-- Hero -->
    <div class="hero">
      <div class="hero-left">
        <h1>SEU SISTEMA<br>ESTÁ PRONTO!</h1>
        <p>Obrigado por confiar em nosso trabalho! Com a instalação do seu sistema concluída, o próximo passo é aguardar a vistoria e aprovação da EDP. Assim que o processo for concluído pela concessionária, <strong>você já poderá ligar o disjuntor do sistema solar.</strong></p>
      </div>
      <div class="hero-img">
        <img src="https://images.unsplash.com/photo-1508515044-3d7e8e4e4e4e?w=400" alt="Casa com painéis solares"/>
      </div>
    </div>

    <!-- Steps -->
    <div class="steps-section">
      <div class="steps-title">Como Funciona:</div>
      <div class="steps">
        <div class="step-arrow" style="left: 18%; width: 64%;"></div>
        <div class="step">
          <div class="step-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="#007337" stroke-width="1.5">
              <rect x="3" y="8" width="18" height="12" rx="1"/>
              <path d="M7 8 L7 5 L17 5 L17 8"/>
              <path d="M10 14 L14 14 M12 12 L12 16"/>
            </svg>
            <div class="step-num">1</div>
          </div>
          <div class="step-label">Instalação<br>Concluída</div>
          <div class="step-desc">Seu sistema já está<br>pronto para gerar.</div>
        </div>
        <div class="step">
          <div class="step-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="#007337" stroke-width="1.5">
              <rect x="5" y="3" width="14" height="18" rx="1"/>
              <line x1="8" y1="7" x2="16" y2="7"/>
              <line x1="8" y1="11" x2="16" y2="11"/>
              <line x1="8" y1="15" x2="13" y2="15"/>
            </svg>
            <div class="step-num">2</div>
          </div>
          <div class="step-label">EDP<br>Solicitação<br>da Vistoria</div>
        </div>
        <div class="step">
          <div class="step-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="#007337" stroke-width="1.5">
              <rect x="4" y="4" width="16" height="14" rx="1"/>
              <line x1="9" y1="20" x2="15" y2="20"/>
              <line x1="12" y1="18" x2="12" y2="20"/>
            </svg>
            <div class="step-num">3</div>
          </div>
          <div class="step-label">Vistoria<br>Realizada<br>pela EDP</div>
        </div>
        <div class="step">
          <div class="step-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="#007337" stroke-width="1.5">
              <path d="M12 3 L9 12 L15 12 L12 21"/>
            </svg>
            <div class="step-num">4</div>
          </div>
          <div class="step-label">Geração<br>Liberada</div>
          <div class="step-desc">Pode ligar<br>o disjuntor.</div>
        </div>
      </div>
    </div>

    <!-- Two columns -->
    <div class="two-col">
      <div class="col">
        <div class="col-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
            <path d="M6 3 L6 21 L18 21 L18 7 L14 3 Z"/>
            <line x1="9" y1="9" x2="15" y2="9"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
          Seu Sistema
        </div>
        <div class="field-line"><span class="lbl">Cliente:</span><span class="val">${nomeCliente}</span></div>
        <div class="field-line"><span class="lbl">Endereço:</span><span class="val">${endereco}</span></div>
        <div class="field-line"><span class="lbl">Cidade/UF:</span><span class="val">${cidadeUF}</span></div>
        <div class="field-line"><span class="lbl">Potência do Sistema:</span><span class="val">${potKwp} kWp</span></div>
        <div class="field-line"><span class="lbl">Inversor:</span><span class="val">${inversorDesc}</span></div>
        <div class="field-line"><span class="lbl">Data da Instalação:</span><span class="val">${dataInstalacao}</span></div>
      </div>

      <div class="col">
        <div class="col-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
            <line x1="5" y1="20" x2="19" y2="20"/>
            <rect x="5" y="14" width="3" height="6"/>
            <rect x="10" y="10" width="3" height="10"/>
            <rect x="15" y="6" width="3" height="14"/>
          </svg>
          Acompanhe sua Geração
        </div>
        <p style="font-size:9pt;color:#555;margin-bottom:3mm;">Seu acesso ao aplicativo de <strong>monitoramento:</strong></p>
        <div class="phone-mock">
          <div class="phone">
            <div class="phone-screen">
              <div class="ps-logo">ECOMAR</div>
              <svg class="ps-house" viewBox="0 0 30 24" fill="none" stroke="#007337" stroke-width="1.5">
                <path d="M3 12 L15 4 L27 12"/>
                <path d="M6 12 L6 22 L24 22 L24 12"/>
                <path d="M12 22 L12 16 L18 16 L18 22"/>
              </svg>
            </div>
          </div>
          <div class="monitor-fields">
            <div class="mf-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="7" y="2" width="10" height="20" rx="2"/><circle cx="12" cy="18" r="1" fill="currentColor"/></svg>
              <span class="lbl">APLICATIVO:</span><span class="val">${aplicativo}</span>
            </div>
            <div class="mf-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 22 C4 17 8 15 12 15 C16 15 20 17 20 22"/></svg>
              <span class="lbl">LOGIN:</span><span class="val">${login}</span>
            </div>
            <div class="mf-row">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="10" width="12" height="11" rx="1"/><path d="M9 10 L9 7 C9 5 10 4 12 4 C14 4 15 5 15 7 L15 10"/></svg>
              <span class="lbl">SENHA:</span><span class="val">${senha}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-left">
        <div class="duvida">Qualquer dúvida, fico à disposição!</div>
        <div class="footer-contact">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4 L9 4 L11 9 L8 11 C9 14 11 16 14 17 L16 14 L21 16 L21 20 C21 21 20 22 19 22 C10 22 2 14 2 5 C2 4 3 4 5 4"/></svg>
          (27) 3011-7819
        </div>
        <div class="footer-contact">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>
          @ecomarengharia
        </div>
        <div class="footer-contact">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7 L12 13 L21 7"/></svg>
          contato@ecomareng.com.br
        </div>
        <div class="footer-contact">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12 L21 12 M12 3 C15 7 15 17 12 21 M12 3 C9 7 9 17 12 21"/></svg>
          ecomareng.com
        </div>
      </div>
      <div class="footer-center">
        <div class="logo" style="justify-content:center;">
          <svg class="logo-icon" style="width:7mm;height:7mm;" viewBox="0 0 40 40" fill="none">
            <path d="M20 4 L34 14 L34 32 L6 32 L6 14 Z" fill="#007337" opacity="0.15"/>
            <path d="M20 4 L34 14 L34 32 L6 32 L6 14 Z" stroke="#007337" stroke-width="2"/>
            <path d="M20 8 L30 15 L30 30 L10 30 L10 15 Z" fill="#007337"/>
          </svg>
          <span class="logo-text" style="font-size:10pt;">Ecomar <span class="eng">Engenharia</span></span>
        </div>
      </div>
      <div class="footer-right">
        <div class="slogan">Do Projeto<br>à Geração,<br>A Gente Cuida<br>de Tudo Para Você.</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}