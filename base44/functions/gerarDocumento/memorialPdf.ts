import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';

// Imagens fixas do modelo oficial do memorial
const IMG_PROTECOES = "https://base44.app/api/apps/69a4e8e0a7fedaf0ea728241/files/mp/public/69a4e8e0a7fedaf0ea728241/2c0c46125b3c501e06d003e7babb5658_memorial_image1.png";
const IMG_PLACA = "https://base44.app/api/apps/69a4e8e0a7fedaf0ea728241/files/mp/public/69a4e8e0a7fedaf0ea728241/5a5204ff518e5304de325c25f773da68_memorial_image2.png";
const IMG_ASSINATURA = "https://base44.app/api/apps/69a4e8e0a7fedaf0ea728241/files/mp/public/69a4e8e0a7fedaf0ea728241/715cef51cc0d4f3e821e510d792e153a_memorial_image3.png";

// Fatores mensais de geração (% da média mensal)
const FATORES_MENSAIS = {
  Jan: 1.1491, Fev: 1.1014, Mar: 1.1068,
  Abr: 0.9964, Mai: 0.9840, Jun: 0.8471,
  Jul: 0.9134, Ago: 1.0152, Set: 0.8919,
  Out: 1.0296, Nov: 0.9154, Dez: 1.0496
};

const A4 = [595.28, 841.89];
const ML = 85, MT = 71, MB = 71;
const LARG = A4[0] - ML * 2;
const PRETO = rgb(0, 0, 0), BRANCO = rgb(1, 1, 1), VERDE = rgb(0, 0.69, 0.31), CINZA = rgb(0.8, 0.8, 0.8);

// Remove caracteres que as fontes padrão do PDF não conseguem escrever
const limpo = (s) => String(s ?? "").replace(/[^\x20-\x7E\u00A0-\u00FF\u2013\u2014]/g, "");
const ou = (v, sufixo = "") => (v || v === 0) ? `${typeof v === "number" ? String(v).replace(".", ",") : v}${sufixo}` : "—";
const num = (n, casas = 2) => n ? Number(n).toFixed(casas).replace(".", ",") : "—";

function quebrar(texto, font, size, maxW) {
  const linhas = [];
  let atual = "";
  for (let p of limpo(texto).split(/\s+/).filter(Boolean)) {
    // Palavra maior que a linha (ex.: e-mail longo): quebra por caracteres
    while (p.length > 1 && font.widthOfTextAtSize(p, size) > maxW) {
      let n = p.length - 1;
      while (n > 1 && font.widthOfTextAtSize(p.slice(0, n), size) > maxW) n--;
      if (atual) { linhas.push(atual); atual = ""; }
      linhas.push(p.slice(0, n));
      p = p.slice(n);
    }
    const tentativa = atual ? `${atual} ${p}` : p;
    if (atual && font.widthOfTextAtSize(tentativa, size) > maxW) { linhas.push(atual); atual = p; }
    else atual = tentativa;
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [""];
}

export async function gerarMemorialPDF({ projeto, uc, rt, preProjeto, moduloProduto, inversorProdutos, RESP_TECNICO, CREA, RESP_ENDERECO, RESP_TELEFONE, RESP_EMAIL, dataExtenso, cidade, estado }) {
  // ---------- Dados ----------
  const m = moduloProduto || {};
  const qtdModulos = Number(preProjeto?.modulo_quantidade || rt.quantidade_modulos) || 0;
  const modDescricao = preProjeto?.modulo_marca_modelo || rt.modulo_descricao || "—";
  const potKwp = (m.potencia_wp && qtdModulos)
    ? (m.potencia_wp * qtdModulos) / 1000
    : parseFloat(rt.potencia_kwp || preProjeto?.potencia_pico_kwp) || 0;

  const inversores = inversorProdutos || [];
  const potInversorKw = inversores.reduce((s, inv) => {
    const unit = inv.produto?.potencia_ac_w ? inv.produto.potencia_ac_w / 1000 : inv.produto?.potencia_kva || 0;
    return s + unit * inv.quantidade;
  }, 0);

  const emDias = (dias) => new Date(Date.now() + dias * 86400000).toLocaleDateString("pt-BR");
  const dataBR = (s, padraoDias) => s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : emDias(padraoDias);
  const dataInstalacao = dataBR(rt.data_prevista_instalacao, 60);
  const dataComissionamento = dataBR(rt.data_prevista_comissionamento, 65);

  const nomeCliente = uc.titular || projeto.nome_cliente || "—";
  const cidadeEstado = `${uc.cidade || cidade} - ${uc.estado || estado}`;
  const tipoLigacao = { monofasico: "Monofásico", bifasico: "Bifásico (220V/127V)", trifasico: "Trifásico" }[uc.tipo_ligacao] || "—";

  // Área do módulo: usa area_m2 ou calcula pelas dimensões (ex.: "2382x1134x35")
  let areaModulo = m.area_m2 || 0;
  if (!areaModulo && m.dimensoes) {
    const n = (String(m.dimensoes).match(/\d+(?:[.,]\d+)?/g) || []).map(s => parseFloat(s.replace(",", ".")));
    if (n.length >= 2) areaModulo = (n[0] / 1000) * (n[1] / 1000);
  }

  const kwhMedio = parseFloat(preProjeto?.kwh_prometidos) || 0;
  const meses = Object.keys(FATORES_MENSAIS);
  const geracoes = meses.map(mes => kwhMedio * FATORES_MENSAIS[mes]);

  // ---------- Documento ----------
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [imgProtecoes, imgPlaca, imgAssinatura] = await Promise.all([IMG_PROTECOES, IMG_PLACA, IMG_ASSINATURA].map(async (url) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("Não foi possível carregar as imagens do modelo do memorial");
    return pdf.embedPng(new Uint8Array(await r.arrayBuffer()));
  }));

  const capa = pdf.addPage(A4);
  const sumario = [];
  let page, y;
  const novaPagina = () => { page = pdf.addPage(A4); y = A4[1] - MT; };
  const garantir = (h) => { if (y - h < MB) novaPagina(); };
  novaPagina();

  const texto = (pg, t, x, yy, size, f = font, cor = PRETO) => pg.drawText(limpo(t), { x, y: yy, size, font: f, color: cor });
  const centro = (pg, t, yy, size, f = font, cx = A4[0] / 2, cor = PRETO) =>
    texto(pg, t, cx - f.widthOfTextAtSize(limpo(t), size) / 2, yy, size, f, cor);

  // Parágrafo justificado
  const paragrafo = (t, recuo = 0) => {
    const size = 11, lh = 16, w = LARG - recuo;
    const linhas = quebrar(t, font, size, w);
    linhas.forEach((linha, i) => {
      garantir(lh);
      y -= lh;
      const palavras = linha.split(" ");
      const larguraPalavras = palavras.reduce((s, p) => s + font.widthOfTextAtSize(p, size), 0);
      const espaco = (i === linhas.length - 1 || palavras.length === 1)
        ? font.widthOfTextAtSize(" ", size)
        : (w - larguraPalavras) / (palavras.length - 1);
      let x = ML + recuo;
      for (const p of palavras) {
        texto(page, p, x, y, size);
        x += font.widthOfTextAtSize(p, size) + espaco;
      }
    });
    y -= 8;
  };

  // Título numerado (entra no sumário)
  const titulo = (numero, t) => {
    const nivel = numero.split(".").length;
    const size = [14, 12, 11][nivel - 1];
    garantir(120); // mantém o título junto do conteúdo que vem depois
    y -= nivel === 1 ? 14 : 8;
    for (const linha of quebrar(`${numero}. ${t}`, bold, size, LARG)) {
      y -= size + 5;
      texto(page, linha, ML, y, size, bold);
    }
    y -= 6;
    sumario.push({ nivel, rotulo: `${numero}. ${t}`, pagina: pdf.getPageCount() });
  };

  // Tabela no padrão do modelo: cabeçalho verde e primeira coluna verde
  const tabela = (cabecalho, linhas, colunas = [0.55, 0.45], verde = (_l, c) => c === 0) => {
    const size = 10, lh = 13, pad = 5;
    const celula = (x, w, h, linhasTexto, fundoVerde, centralizar) => {
      page.drawRectangle({ x, y: y - h, width: w, height: h, color: fundoVerde ? VERDE : BRANCO, borderColor: PRETO, borderWidth: 0.5 });
      linhasTexto.forEach((lt, j) => {
        const yy = y - pad - (j + 1) * lh + 3;
        const f = centralizar ? bold : font;
        if (centralizar) centro(page, lt, yy, size, f, x + w / 2, BRANCO);
        else texto(page, lt, x + pad, yy, size, f, fundoVerde ? BRANCO : PRETO);
      });
    };
    const linhasCab = cabecalho.split("\n").flatMap(l => quebrar(l, bold, size, LARG - pad * 2));
    const hCab = linhasCab.length * lh + pad * 2;
    garantir(hCab + 30);
    celula(ML, LARG, hCab, linhasCab, true, true);
    y -= hCab;
    linhas.forEach((linha, l) => {
      const larguras = colunas.map(c => c * LARG);
      const textos = linha.map((c, i) => quebrar(c, font, size, larguras[i] - pad * 2));
      const h = Math.max(...textos.map(t => t.length)) * lh + pad * 2;
      garantir(h);
      let x = ML;
      textos.forEach((t, c) => { celula(x, larguras[c], h, t, verde(l, c), false); x += larguras[c]; });
      y -= h;
    });
    y -= 14;
  };

  const imagem = (img, w, h) => {
    garantir(h + 12);
    y -= h;
    page.drawImage(img, { x: (A4[0] - w) / 2, y, width: w, height: h });
    y -= 12;
  };

  // Gráfico de colunas da geração mensal
  const grafico = () => {
    const H = 210;
    garantir(H + 14);
    const topo = y;
    y -= H;
    page.drawRectangle({ x: ML, y, width: LARG, height: H, borderColor: CINZA, borderWidth: 0.75 });
    texto(page, "Energia (kWh)", ML + 8, topo - 16, 8, bold);
    const legenda = "Gerado (kWh)";
    const xLeg = A4[0] / 2 - (font.widthOfTextAtSize(legenda, 8) + 12) / 2;
    page.drawRectangle({ x: xLeg, y: topo - 17, width: 8, height: 8, color: VERDE });
    texto(page, legenda, xLeg + 12, topo - 16, 8);

    const x0 = ML + 42, x1 = ML + LARG - 10, yBase = y + 26, yTopo = topo - 40;
    const maximo = Math.ceil((Math.max(...geracoes) * 1.1) / 50) * 50;
    for (let i = 0; i <= 4; i++) {
      const yy = yBase + ((yTopo - yBase) * i) / 4;
      page.drawLine({ start: { x: x0, y: yy }, end: { x: x1, y: yy }, thickness: i === 0 ? 0.75 : 0.4, color: i === 0 ? PRETO : CINZA });
      const rotulo = String(Math.round((maximo * i) / 4));
      texto(page, rotulo, x0 - 6 - font.widthOfTextAtSize(rotulo, 8), yy - 3, 8);
    }
    const passo = (x1 - x0) / meses.length;
    geracoes.forEach((v, i) => {
      const h = (v / maximo) * (yTopo - yBase);
      const cx = x0 + passo * (i + 0.5);
      page.drawRectangle({ x: cx - passo * 0.3, y: yBase, width: passo * 0.6, height: h, color: VERDE });
      centro(page, String(Math.round(v)), yBase + h + 3, 7, font, cx);
      centro(page, meses[i], yBase - 12, 8, font, cx);
    });
    y -= 14;
  };

  // ---------- Conteúdo ----------
  titulo("1", "Escopo");
  paragrafo("Este documento apresenta a Documentação Técnica, conforme as normas técnicas válidas no Brasil, para o projeto do sistema de microgeração distribuída. São aqui apresentados os dados e as informações técnicas sobre o projeto e a instalação; pessoas físicas e jurídicas envolvidas; especificação dos componentes; testes de comissionamento.");

  titulo("2", "Objetivo");
  paragrafo("O sistema fotovoltaico conectado à rede que será instalado na unidade habitacional abaixo identificada tem por finalidade a Compensação de Energia Elétrica, modalidade de micro ou minigeração distribuída que permite ao consumidor gerar energia em paralelismo com a rede pública de distribuição de energia elétrica, para fins de autoconsumo.");
  paragrafo("O Sistema de Compensação de Energia Elétrica é regulamentado pela Agência Nacional De Energia Elétrica (ANEEL), através da Resolução Normativa 482 de 17 de Abril de 2012; o projeto aqui apresentado segue as determinações desta resolução normativa, bem como os Procedimentos de Distribuição de Energia Elétrica (PRODIST), as normas técnicas vigentes para instalações elétricas em baixa tensão (NBR-5410), proteção de estruturas contra descargas atmosféricas (NBR-5419).");
  paragrafo("O projeto elétrico segue à risca as determinações da concessionaria de energia elétrica local, a EDP Escelsa, através da observância da norma interna de CONEXÃO DE MINI E MICROGERADORES AO SISTEMA DE DISTRIBUIÇÃO EM BAIXA TENSÃO (PR.DT.PDN.03.14.002), vigente na data de apresentação deste projeto.");

  titulo("3", "Dados Preliminares");
  paragrafo("A tabela abaixo demonstra as informações preliminares sobre os sistemas fotovoltaicos conectados à rede, a potência nominal máxima (em condições ideais de funcionamento), os dispositivos utilizados para a concepção do sistema fotovoltaico e seus respectivos fabricantes e modelos.");
  tabela(`Nome para Registro:\n${nomeCliente}`, [
    ["Potência-pico do Sistema Fotovoltaico conectado à rede (kWp)", num(potKwp)],
    ["Fabricante dos módulos", ou(m.fabricante)],
    ["Modelo dos módulos", m.modelo || modDescricao],
    ["Tecnologia dos módulos", "Silício Monocristalino"],
    ["Quantidade Total de módulos fotovoltaicos", ou(qtdModulos || null)],
    ["Fabricante do(s) Inversor(es)", inversores.map(inv => inv.produto?.fabricante || String(inv.marca_modelo || "").split(" ")[0]).join(" / ") || "—"],
    ["Modelo do(s) Inversor(es)", inversores.map(inv => inv.produto?.modelo || inv.marca_modelo).join(" / ") || "—"],
    ["Potência Nominal Total do(s) Inversor(es) (kW)", num(potInversorKw)],
    ["Quantidade de Inversores", ou(inversores.reduce((s, inv) => s + inv.quantidade, 0) || null)],
    ["Data de Instalação (Previsão)", dataInstalacao],
    ["Data de Comissionamento (Previsão)", dataComissionamento],
  ]);
  paragrafo("As folhas de dados (datasheets) dos componentes fazem parte dos anexos deste documento.");

  titulo("3.1", "Identificação do Proprietário e Local de Instalação");
  paragrafo("O responsável pela operação e manutenção do sistema fotovoltaico conectado à rede para geração própria é o seu proprietário, identificado na tabela abaixo:");
  tabela("Identificação da Unidade Consumidora", [
    ["Proprietário", nomeCliente],
    ["Número da Unidade Consumidora", ou(uc.numero_uc)],
    ["Endereço", ou(uc.endereco)],
    ["CEP", ou(uc.cep)],
    ["Cidade e Estado", cidadeEstado],
    ["CPF Proprietário", ou(uc.cpf || projeto.cpf)],
    ["Telefone Proprietário", ou(uc.telefone || projeto.telefone)],
    ["E-mail", ou(uc.email || projeto.email)],
    ["Latitude", ou(uc.latitude)],
    ["Longitude", ou(uc.longitude)],
    ["Classificação da Unidade Consumidora", "Residencial"],
    ["Tipo de Ligação da Unidade Consumidora", tipoLigacao],
  ]);

  titulo("3.2", "Responsabilidade Técnica");
  tabela("Responsável Técnico", [
    ["Responsável Pelo Projeto Técnico", RESP_TECNICO],
    ["Número de Registro (CREA)", CREA],
    ["Endereço", RESP_ENDERECO],
    ["Telefone", RESP_TELEFONE],
    ["E-mail", RESP_EMAIL],
    ["Anotação de Responsabilidade Técnica (ART) Projeto", ou(rt.art_numero)],
  ]);

  titulo("4", "Descritivo Técnico do Sistema de Geração Própria – SFCR");
  paragrafo("O presente sistema de microgeração distribuída utiliza a tecnologia dos sistemas fotovoltaicos para a geração de energia em montante necessário para a compensação do consumo médio mensal da unidade consumidora onde está instalado.");
  paragrafo("Um sistema fotovoltaico é um gerador de energia elétrica (potencial e corrente), que aproveita o efeito fotovoltaico (transformação de luz em corrente elétrica, no interior de materiais semicondutores). O sistema fotovoltaico aqui apresentado é do tipo conectado à rede, cuja principal característica é possuir um dispositivo automatizado de condicionamento de potência e acoplamento à rede, capaz de sincronizar automaticamente a geração (em corrente contínua) das células fotovoltaicas (o elemento ativo de geração) em corrente alternada de acordo aos valores de frequência e tensão da rede à qual está conectado.");
  paragrafo("O sistema fotovoltaico conectado à rede possui sistema de proteção contra ilhamento, relês e temporizadores para sincronismo, e controle de frequência, tensão e fator de potência. Todas essas funcionalidades são implementadas através do inversor interativo à rede, que é o componente principal do sistema fotovoltaico conectado à rede, responsável pelo gerenciamento, controle e coleta de dados operacionais.");
  paragrafo("Devido às características do dispositivo de condicionamento de potência (inversor interativo) o sistema fotovoltaico conectado à rede (SFCR) é totalmente dependente da rede, não funcionando de forma autônoma.");

  titulo("4.1", "Generalidades");
  paragrafo("Para melhor compreensão, o sistema fotovoltaico é divido nos seguintes subsistemas:");
  paragrafo("1. Gerador Fotovoltaico: subsistema de geração, composto pelo arranjo fotovoltaico (conjunto de módulos fotovoltaicos), cabeamento e dispositivos de seccionamento e proteção.", 18);
  paragrafo("2. Inversor Interativo: subsistema de condicionamento de potência, responsável pela proteção do gerador e da rede de distribuição, qualidade de energia e coleta de dados operacionais.", 18);
  paragrafo("3. Dispositivo de Acoplamento à Rede: composto pelo sistema de medição bidirecional (para medição da energia consumida e da energia gerada)", 18);

  titulo("4.2", "Gerador (Arranjo) Fotovoltaico");
  paragrafo(`O gerador (arranjo) fotovoltaico é composto por módulos fotovoltaicos de fabricante ${ou(m.fabricante)} modelo ${m.modelo || modDescricao} conforme a tabela abaixo:`);
  tabela("Características Elétricas - Modelos Fotovoltaicos", [
    ["Fabricante", ou(m.fabricante), ""],
    ["Modelo", m.modelo || modDescricao, ""],
    ["Tensão de funcionamento Ótima (Vmp)", ou(m.vmp), "V"],
    ["Corrente de funcionamento Ótima (Imp)", ou(m.imp), "A"],
    ["Tensão em circuito aberto (Voc)", ou(m.voc), "V"],
    ["Corrente de curto-circuito (Isc)", ou(m.isc), "A"],
    ["Potência máxima (Pmax) em condições de teste padrão", ou(m.potencia_wp), "Wp"],
    ["Eficiência do módulo", ou(m.eficiencia_modulo || m.eficiencia), "%"],
    ["Corrente máxima por fusível em série", ou(m.corrente_max_fusivel_a), "A"],
    ["Coeficiente de temperatura", "", ""],
    ["Ppeak", ou(m.coef_temp_ppeak), "/C°"],
    ["Voc", ou(m.coef_temp_voc), "/C°"],
    ["Isc", ou(m.coef_temp_isc), "/C°"],
  ], [0.55, 0.33, 0.12]);

  titulo("4.2.1", "Aspecto Físico do Painel Fotovoltaico e Arranjo dos Painéis");
  paragrafo("Os painéis fotovoltaicos serão montados rente às telhas, sem ângulo de inclinação em relação à face do telhado, não foi previsto carga adicional provocada pela ação do vento.");
  tabela("Aspecto Físico do Painel Fotovoltaico", [
    ["Área dos Arranjos (m2)", num(areaModulo * qtdModulos)],
    ["Peso adicional (kg)", num(m.peso * qtdModulos, 1)],
  ]);

  titulo("4.2.2", "Arranjo dos Painéis");
  const numStrings = Number(rt.num_strings) || 0;
  tabela("Arranjo dos Painéis", [
    ["Nº de Módulos Ligados em Serie", "Entrada Inversor"],
    ...(numStrings
      ? Array.from({ length: numStrings }, (_v, i) => [ou(rt.modulos_por_string), `Entrada ${i + 1}`])
      : [["—", "—"]]),
  ], [0.5, 0.5], (l) => l === 0);
  if (rt.entradas_mppt) paragrafo(`Configuração das entradas MPPT: ${rt.entradas_mppt}`);

  titulo("4.2.3", "Estrutura de Fixação dos painéis fotovoltaicos");
  paragrafo("Serão utilizados trilhos em alumínio para fixação dos painéis nas telhas da edificação.");

  titulo("4.2.4", "Cabos e Conexões");
  paragrafo("Serão utilizados cabos solares com proteção UV de 4,0mm². As conexões serão feitas por conectores MC4 com proteção UV e resistência a amoníaco.");

  titulo("4.2.5", "String Box");
  paragrafo("A proteção do circuito de corrente contínua será através de String Box Externa. A proteção de cada String é feita através de fusível de 15A montado em Porta fusível, um Disjuntor de 20 A e um DPS de 1000V.");

  titulo("4.3", "Inversor Interativo à Rede");
  paragrafo("Serão utilizados inversor(es) conforme a tabela abaixo:");
  for (const inv of (inversores.length ? inversores : [{ quantidade: null, marca_modelo: "" }])) {
    const p = inv.produto || {};
    tabela("Especificações Técnicas do Inversor", [
      ["Fabricante do(s) Inversor(es)", p.fabricante || String(inv.marca_modelo || "").split(" ")[0] || "—"],
      ["Modelo do(s) Inversor(es)", p.modelo || inv.marca_modelo || "—"],
      ["Potência Nominal dos(s) Inversor(es)", p.potencia_ac_w ? `${p.potencia_ac_w} W` : ou(p.potencia_kva, " kVA")],
      ["Quantidade dos Inversor(es)", ou(inv.quantidade)],
      ["Potência de Saída AC", p.potencia_ac_w ? `${num((p.potencia_ac_w * inv.quantidade) / 1000)} kW` : p.potencia_kva ? `${num(p.potencia_kva * inv.quantidade)} kVA` : "—"],
      ["Tensão nominal AC", ou(p.tensao_nominal_ac_v)],
      ["Corrente de saída Max AC", ou(p.corrente_max_ac_a, " A")],
      ["Frequência de operação", ou(p.frequencia_operacao_hz, " Hz")],
      ["Range de frequência", ou(p.range_frequencia_hz)],
      ["Max Corrente DC", ou(p.corrente_max_dc_a, " A")],
      ["Fator de potência", ou(p.fator_potencia)],
      ["Range de temperatura", ou(p.range_temperatura)],
      ["Tensão Máxima Entrada do Inversor", ou(p.tensao_max_dc_v, " V")],
      ["Tensão Mínima Entrada do Inversor", ou(p.tensao_min_dc_v, " V")],
      ["Rendimento do Inversor", ou(p.eficiencia, "%")],
    ]);
  }
  paragrafo("As funções de manutenção e proteção do inversor estão de acordo com os requisitos mínimos em função da potência instalada, presente na Seção 3.7 do PRODIST da ANEEL, requisitos estes indicados na Tabela a seguir");
  imagem(imgProtecoes, 425, 353);

  titulo("4.3.1", "Especificação do cabeamento");
  paragrafo("Os condutores para a ligação do inversor até o quadro geral de distribuição possuem isolação para tensão nominal de trabalho para 750 volts em corrente alternada com seção transversal mínima (calculada pelo método de seção mínima) de 6,00 mm².");

  titulo("4.3.2", "Dispositivo de Manobra e Proteção contra Sobrecorrentes");
  paragrafo("O dispositivo seccionador geral, possui uma corrente nominal de 25A. O dispositivo localiza-se no interior do quadro de proteção e controle e possui características de disparo conforme curva C e uma corrente nominal de atuação de 5kA.");

  titulo("4.4", "Sinalização de Segurança");
  paragrafo("Será afixada, no poste-padrão do ramal de entrada, uma placa indicativa de que a unidade consumidora possui sistema de geração própria, conforme definição da norma \"Conexão de Micro e Minigeração Distribuída Sob Sistema de Compensação de Energia Elétrica\" (GED-15303). A placa sinalizadora é composta de acrílico, com formato, dimensões e conteúdo conforme imagem abaixo:");
  imagem(imgPlaca, 283, 205);

  titulo("5", "Estimativa de geração e Considerações Gerais");
  paragrafo("Este projeto foi elaborado com base nas informações fornecidas pelos fabricantes de cada equipamento, com os dados de placa dos mesmos, e a partir dessas informações foi feito o dimensionamento do sistema de geração solar fotovoltaico com as seguintes características:");
  tabela("Estimativa de geração e Considerações Gerais", [
    ["Potência instalada do circuito DC (kWp)", num(potKwp)],
    ["Potência instalada do circuito AC (kW)", num(potInversorKw)],
    ["Hora de Sol Pico", (kwhMedio && potKwp) ? `${num(kwhMedio / potKwp / 30)} h` : "—"],
    ["Estimativa de geração média mensal (kWh/Mês)", ou(kwhMedio || null)],
  ]);
  if (kwhMedio) grafico();
  paragrafo("E importante salientar que a geração elétrica de um sistema fotovoltaico varia (muito) de acordo à disponibilidade solar (e temperatura ambiente) do local onde é instalado; como esse recurso natural é extremamente variável, a geração também o é não sendo essa estimativa passível de verificação de performance. As estimativas de geração acima apresentadas se baseiam nos dados de radiação solar e temperatura ambiente obtidas do banco de dados do Projeto SWERA (http://en.openei.org/apps/SWERA/).");
  paragrafo("Quaisquer alterações neste projeto deverão ser previamente avaliadas e aprovadas pelo responsável técnico do projeto. Caso contrário, fica eximida da responsabilidade ante de tais alterações.");

  // Assinatura do responsável técnico
  garantir(175);
  y -= 30;
  centro(page, "Responsável Técnico", y, 11, bold);
  y -= 58;
  page.drawImage(imgAssinatura, { x: (A4[0] - 59) / 2, y, width: 59, height: 49 });
  y -= 4;
  page.drawLine({ start: { x: A4[0] / 2 - 130, y }, end: { x: A4[0] / 2 + 130, y }, thickness: 0.75, color: PRETO });
  for (const linha of ["Thiago Fernandes Juffo Fontes", "Engenheiro Eletricista", "Thiago@ecomareng.com", "Telefone: (27) 99238-5570"]) {
    y -= 15;
    centro(page, linha, y, 11);
  }

  // ---------- Capa e sumário ----------
  let yc = A4[1] - MT - 30;
  for (const linha of quebrar("MEMORIAL TÉCNICO DESCRITIVO – MICRO GERAÇÃO DISTRIBUIDA EM BAIXA TENSÃO", bold, 16, LARG)) {
    centro(capa, linha, yc, 16, bold);
    yc -= 22;
  }
  yc -= 14;
  for (const linha of quebrar(`Instalação ${nomeCliente}`, bold, 13, LARG)) {
    centro(capa, linha, yc, 13, bold);
    yc -= 18;
  }
  yc -= 4;
  centro(capa, dataExtenso, yc, 12);
  yc -= 18;
  centro(capa, cidadeEstado, yc, 12);
  yc -= 50;
  texto(capa, "Sumário", ML, yc, 14, bold);
  yc -= 10;
  for (const item of sumario) {
    yc -= 16;
    const x = ML + (item.nivel - 1) * 12;
    const pagina = String(item.pagina);
    const xPagina = ML + LARG - font.widthOfTextAtSize(pagina, 10);
    texto(capa, item.rotulo, x, yc, 10);
    const inicio = x + font.widthOfTextAtSize(limpo(item.rotulo), 10) + 4;
    const pontos = Math.floor((xPagina - 4 - inicio) / font.widthOfTextAtSize(".", 10));
    if (pontos > 0) texto(capa, ".".repeat(pontos), inicio, yc, 10);
    texto(capa, pagina, xPagina, yc, 10);
  }

  // Numeração das páginas no rodapé
  pdf.getPages().forEach((pg, i) => {
    const n = String(i + 1);
    texto(pg, n, ML + LARG - font.widthOfTextAtSize(n, 10), 38, 10);
  });

  return await pdf.save();
}