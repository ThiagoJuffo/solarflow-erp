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

  // Buscar produto do módulo para obter potência em Wp
  let moduloProduto = null;
  if (preProjeto?.modulo_marca_modelo) {
    try {
      const produtos = await base44.asServiceRole.entities.Produto.filter({ ativo: true });
      moduloProduto = produtos.find(p => `${p.fabricante} ${p.modelo}` === preProjeto.modulo_marca_modelo) || null;
    } catch (_e) {}
  }

  // Buscar produtos dos inversores (suporta múltiplos modelos)
  let inversorProdutos = []; // array de { produto, quantidade }
  let inversorProduto = null; // legado: primeiro inversor
  {
    try {
      const todosProdutos = await base44.asServiceRole.entities.Produto.filter({ ativo: true });
      // Suporte ao novo campo "inversores" (array)
      const inversoresArr = preProjeto?.inversores?.length
        ? preProjeto.inversores
        : preProjeto?.inversor_marca_modelo
          ? [{ marca_modelo: preProjeto.inversor_marca_modelo, quantidade: preProjeto?.inversor_quantidade || 1 }]
          : [];

      inversorProdutos = inversoresArr.map(inv => ({
        produto: todosProdutos.find(p => `${p.fabricante} ${p.modelo}` === inv.marca_modelo) || null,
        marca_modelo: inv.marca_modelo,
        quantidade: Number(inv.quantidade) || 1,
      }));
      inversorProduto = inversorProdutos[0]?.produto || null;
    } catch (_e) {}
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
  } else {
    return Response.json({ error: 'Tipo de documento não suportado' }, { status: 400 });
  }

  return Response.json({ html: htmlContent, tipo, projeto_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function gerarProcuracao({ projeto, uc, rt, RESP_TECNICO, RESP_CPF, RESP_RG, RESP_ENDERECO, dataExtenso, cidade, estado }) {
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
<p>${projeto.nome_cliente}, CPF: ${projeto.cpf}, estabelecido na ${endereco}, ${cidadeUF}. CEP: ${cep}</p>

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
    <p>${projeto.nome_cliente}<br>CPF: ${projeto.cpf}</p>
  </div>
  <div class="sig-line">
    <hr />
    <p>${RESP_TECNICO}<br>CPF: ${RESP_CPF}</p>
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
  const modArea = moduloProduto?.area_m2 ? `${moduloProduto.area_m2} m²` : "—";
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
  const dataInstalacao = rt.data_prevista_instalacao || "—";
  const dataComissionamento = rt.data_prevista_comissionamento || "—";

  const nomeCliente = projeto.nome_cliente;
  const cpfCliente = projeto.cpf;
  const numeroUC = uc.numero_uc || "—";
  const endereco = uc.endereco || "—";
  const cep = uc.cep || "—";
  const cidadeEstado = `${uc.cidade || cidade} - ${uc.estado || estado}`;
  const tipoLigacao = uc.tipo_ligacao === "monofasico" ? "Monofásico" : uc.tipo_ligacao === "bifasico" ? "Bifásico (220V/127V)" : uc.tipo_ligacao === "trifasico" ? "Trifásico" : "—";
  const telefone = projeto.telefone || "—";
  const email = projeto.email || "—";

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
  <tr><td style="background-color:#00b050;color:#fff;"><u>Ppeak</u></td><td>${moduloProduto?.coef_temperatura || "—"}</td><td>/C°</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;"><u>Voc</u></td><td></td><td>/C°</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;"><u>Isc</u></td><td></td><td>/C°</td></tr>
</table>

<table>
  <tr><th colspan="2" style="background-color:#00b050;color:#fff;font-weight:bold;text-align:center;">Aspecto Físico do Painel Fotovoltaico</th></tr>
  <tr><td style="background-color:#00b050;color:#fff;text-align:center;">Área dos Arranjos (m2)</td><td>${moduloProduto?.area_m2 ? (moduloProduto.area_m2 * qtdModulos).toFixed(2) : "—"}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;text-align:center;">Peso adicional (kg)</td><td>${moduloProduto?.peso ? (moduloProduto.peso * qtdModulos).toFixed(1) : "—"}</td></tr>
</table>

<h3>4.2 Inversor(es)</h3>
${tabelasInversores}

<table>
  <tr><th colspan="2" style="background-color:#00b050;color:#fff;font-weight:bold;text-align:center;">Estimativa de geração e Considerações Gerais</th></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Potência instalada do circuito DC (<u>kWp</u>)</td><td>${potKwp}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Potência instalada do circuito AC (kW)</td><td>${potInversorKw}</td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Hora de Sol Pico</td><td></td></tr>
  <tr><td style="background-color:#00b050;color:#fff;">Estimativa de geração média mensal (kWh/Mês)</td><td>${preProjeto?.kwh_prometidos || "—"}</td></tr>
</table>

<h2>5. Descritivo Técnico do Sistema</h2>
<p>O presente sistema de microgeração distribuída utiliza a tecnologia dos sistemas fotovoltaicos para a geração de energia em montante necessário para a compensação do consumo médio mensal da unidade consumidora onde está instalado.</p>
<p>O sistema fotovoltaico conectado à rede possui sistema de proteção contra <strong><em>ilhamento</em></strong>, relês e temporizadores para sincronismo, e controle de frequência, tensão e fator de potência.</p>

<h3>5.1 Arranjo dos Painéis</h3>
<table>
  <tr><th colspan="2">Arranjo do Gerador Fotovoltaico</th></tr>
  <tr><td>Módulo Utilizado</td><td>${modDescricao}</td></tr>
  <tr><td>Módulos por String</td><td>${modPorString}</td></tr>
  <tr><td>Número de Strings</td><td>${numStrings}</td></tr>
  <tr><td>Total de Módulos</td><td>${qtdModulos}</td></tr>
  <tr><td>Potência Total (kWp)</td><td>${potKwp} kWp</td></tr>
</table>

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

<div class="field"><span class="label">NOME:</span> ${projeto.nome_cliente}</div>
<div class="field"><span class="label">CPF:</span> ${projeto.cpf}</div>
<div class="field"><span class="label">INSTALAÇÃO (UC):</span> ${uc.numero_uc || "—"}</div>
<div class="field"><span class="label">ENDEREÇO:</span> ${uc.endereco || "—"}${uc.cidade ? ` - ${uc.cidade}` : ""}${uc.estado ? ` / ${uc.cidade} - ${uc.estado}` : ""}${uc.cep ? ` CEP: ${uc.cep}` : ""}</div>
<div class="field"><span class="label">TELEFONE:</span> ${projeto.telefone || "—"}</div>
<div class="field"><span class="label">EMAIL:</span> ${projeto.email || "—"}</div>
<br/>
<div class="field"><span class="label">KIT:</span> ${kit}</div>
<div class="field"><span class="label">Potência Placas kWp:</span> ${potKwp}</div>
<div class="field"><span class="label">Potência Inversor kW:</span> ${potInversor}</div>
<div class="field"><span class="label">Potência de Geração (Menor entre os 2 acima):</span> ${potGeracao}</div>
<div class="field"><span class="label">ART:</span> ${rt.art_numero || "A definir"}</div>

<br/><br/>
<p>${dataExtenso}</p>
</body>
</html>`;
}