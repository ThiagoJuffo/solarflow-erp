import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { requireRole, ROLES_INTERNOS } from '../../shared/auth.ts';
import { gerarMemorialPDF } from './memorialPdf.ts';

// Modelo oficial (PDF estático) do Relatório de Entrega — os campos são escritos por cima
// Reimplantado em 2026-09-28 para incluir branch relatorio_entrega (pdf-lib)
const MODELO_RELATORIO_ENTREGA_URL = "https://media.base44.com/files/public/69a4e8e0a7fedaf0ea728241/1889369a6_modelo_relatorio_entrega.pdf";

Deno.serve(async (req) => {
  try {
  const base44 = createClientFromRequest(req);
  const { user, error: authError } = await requireRole(base44, ROLES_INTERNOS);
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const { tipo, projeto_id } = body;
  if (!projeto_id) return Response.json({ error: 'projeto_id obrigatório' }, { status: 400 });
  // O relatório de entrega inclui credenciais de monitoramento: só quem pode criar documentos
  if (tipo === 'relatorio_entrega' && !['admin', 'engenharia', 'financeiro'].includes(user.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Buscar dados do projeto
  const [ucs, resumos] = await Promise.all([
    base44.asServiceRole.entities.UC.filter({ projeto_id }),
    base44.asServiceRole.entities.ResumoTecnico.filter({ projeto_id }),
  ]);

  let projeto = null;
  try {
    // Leitura com o usuário logado: aplica as regras de acesso do Projeto
    projeto = await base44.entities.Projeto.get(projeto_id);
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
    const pdfBytes = await gerarProcuracaoPDF({ projeto, uc, RESP_TECNICO, RESP_CPF, RESP_RG, RESP_ENDERECO, dataExtenso, cidade, estado });
    const nomeArquivo = `Procuracao_${String(uc.titular || projeto.nome_cliente || "cliente").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_")}.pdf`;
    return Response.json({ pdf_base64: bytesToBase64(pdfBytes), filename: nomeArquivo, tipo, projeto_id });
  } else if (tipo === "memorial_tecnico") {
    const pdfBytes = await gerarMemorialPDF({ projeto, uc, rt, preProjeto, moduloProduto, inversorProdutos, RESP_TECNICO, CREA, RESP_ENDERECO, RESP_TELEFONE, RESP_EMAIL, dataExtenso, cidade, estado });
    const nomeArquivo = `Memorial_Tecnico_${String(uc.titular || projeto.nome_cliente || "cliente").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_")}.pdf`;
    return Response.json({ pdf_base64: bytesToBase64(pdfBytes), filename: nomeArquivo, tipo, projeto_id });
  } else if (tipo === "solicitacao_art") {
    htmlContent = gerarSolicitacaoART({ projeto, uc, rt, preProjeto, moduloProduto, inversorProdutos, dataExtenso });
  } else if (tipo === "relatorio_entrega") {
    const pdfBytes = await gerarRelatorioEntregaPDF({ projeto, uc, preProjeto, moduloProduto, inversorProdutos });
    const nomeArquivo = `Relatorio_Entrega_${String(uc.titular || projeto.nome_cliente || "cliente").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_")}.pdf`;
    return Response.json({ pdf_base64: bytesToBase64(pdfBytes), filename: nomeArquivo, tipo, projeto_id });
  } else {
    return Response.json({ error: 'Tipo de documento não suportado' }, { status: 400 });
  }

  return Response.json({ html: htmlContent, tipo, projeto_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function gerarProcuracaoPDF({ projeto, uc, RESP_TECNICO, RESP_CPF, RESP_RG, RESP_ENDERECO, dataExtenso, cidade, estado }) {
  // Remove caracteres que as fontes padrão do PDF não conseguem escrever
  const limpo = (s) => String(s ?? "").replace(/[^\x20-\x7E\u00A0-\u00FF–—]/g, "");
  const nomeCliente = limpo(uc.titular || projeto.nome_cliente);
  const cpfCliente = limpo(uc.cpf || projeto.cpf);
  const endereco = limpo(uc.endereco || "—");
  const cep = limpo(uc.cep || "—");
  const cidadeUF = limpo(`${uc.cidade || cidade} – ${estado}`);

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const margem = 85; // 3 cm
  const largura = 595.28 - margem * 2;
  const tamanho = 12;
  const entrelinha = 19;
  let y = 841.89 - margem;

  // Parágrafo justificado com quebra automática de linha
  const paragrafo = (texto) => {
    const palavras = limpo(texto).split(/\s+/).filter(Boolean);
    const linhas = [];
    let atual = [];
    for (const p of palavras) {
      if (atual.length && font.widthOfTextAtSize([...atual, p].join(" "), tamanho) > largura) {
        linhas.push(atual);
        atual = [];
      }
      atual.push(p);
    }
    if (atual.length) linhas.push(atual);
    linhas.forEach((linha, i) => {
      const ultima = i === linhas.length - 1;
      const larguraPalavras = linha.reduce((s, p) => s + font.widthOfTextAtSize(p, tamanho), 0);
      const espaco = ultima || linha.length === 1
        ? font.widthOfTextAtSize(" ", tamanho)
        : (largura - larguraPalavras) / (linha.length - 1);
      let x = margem;
      for (const p of linha) {
        page.drawText(p, { x, y, size: tamanho, font, color: rgb(0, 0, 0) });
        x += font.widthOfTextAtSize(p, tamanho) + espaco;
      }
      y -= entrelinha;
    });
    y -= 8;
  };
  const titulo = (texto) => {
    y -= 10;
    page.drawText(texto, { x: margem, y, size: 13, font: bold, color: rgb(0, 0, 0) });
    y -= entrelinha + 4;
  };

  const cabecalho = "PROCURAÇÃO";
  page.drawText(cabecalho, { x: (595.28 - bold.widthOfTextAtSize(cabecalho, 16)) / 2, y, size: 16, font: bold, color: rgb(0, 0, 0) });
  y -= 45;

  titulo("Outorgante");
  paragrafo(`${nomeCliente}, CPF: ${cpfCliente}, estabelecido na ${endereco}, ${cidadeUF}. CEP: ${cep}`);
  titulo("Outorgado");
  paragrafo(`${RESP_TECNICO}, brasileiro, Casado(a), engenheiro eletricista, portador do RG nº ${RESP_RG}, expedido pelo SPTC - ES, inscrito no CPF sob o nº ${RESP_CPF}, residente e domiciliado(a) na ${RESP_ENDERECO}.`);
  titulo("Poderes");
  paragrafo("Concede plenos poderes ao(à) OUTORGADO, a fim de que possa defender os direitos e interesses do(a) OUTORGANTE, podendo assinar requerimentos, ofícios, termos e compromissos, concordar e discordar de declarações, solicitar, providenciar e ter acesso a documentos, além de poder formular reclamações eventualmente necessárias. Todos os poderes acima citados em relação ao processo de microgeração durante o processo junto à EDP ESCELSA.");
  titulo("Validade");
  paragrafo("Esta procuração tem validade de 200 dias, a contar da data de sua assinatura.");
  paragrafo(`${cidade} / ${estado}, ${dataExtenso}.`);

  // Área de assinatura
  y -= 55;
  const larguraAssinatura = 230;
  page.drawLine({ start: { x: margem, y }, end: { x: margem + larguraAssinatura, y }, thickness: 1, color: rgb(0, 0, 0) });
  for (const linha of [nomeCliente, `CPF: ${cpfCliente}`]) {
    y -= entrelinha - 2;
    const w = font.widthOfTextAtSize(linha, tamanho);
    page.drawText(linha, { x: margem + Math.max(0, (larguraAssinatura - w) / 2), y, size: tamanho, font, color: rgb(0, 0, 0) });
  }

  return await pdf.save();
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

async function gerarRelatorioEntregaPDF({ projeto, uc, preProjeto, moduloProduto, inversorProdutos }) {
  const nomeCliente = uc.titular || projeto.nome_cliente || "";
  const endereco = uc.endereco || "";
  const cidadeUF = [uc.cidade, uc.estado].filter(Boolean).join(" / ");

  const potWpModulo = moduloProduto?.potencia_wp || 0;
  const qtdMod = preProjeto?.modulo_quantidade || 0;
  const potKwpCalc = (potWpModulo && qtdMod) ? ((potWpModulo * qtdMod) / 1000).toFixed(2) : null;
  const potKwp = String(potKwpCalc || preProjeto?.potencia_pico_kwp || "").replace(".", ",");

  const inversoresArr = inversorProdutos?.length ? inversorProdutos : [];
  const inversorDesc = inversoresArr.length > 0
    ? inversoresArr.map(inv => `${inv.quantidade}x ${inv.marca_modelo}`).join(" + ")
    : (preProjeto?.inversor_marca_modelo || "");

  let dia = "", mes = "", ano = "";
  if (projeto.data_instalacao) {
    [ano, mes, dia] = String(projeto.data_instalacao).slice(0, 10).split("-");
  }

  const aplicativo = projeto.monitoramento_portal || "";
  const login = projeto.monitoramento_login || "";
  const senha = projeto.monitoramento_senha_encrypted || "";

  const tplBytes = await fetch(MODELO_RELATORIO_ENTREGA_URL).then(r => {
    if (!r.ok) throw new Error("Não foi possível baixar o modelo do Relatório de Entrega");
    return r.arrayBuffer();
  });
  const pdf = await PDFDocument.load(tplBytes);
  const page = pdf.getPages()[0];
  const H = page.getHeight(); // 1536
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const cor = rgb(0.13, 0.13, 0.13);

  // Remove caracteres fora do WinAnsi (Helvetica padrão)
  const limpa = (s) => String(s ?? "").replace(/\s+/g, " ").trim()
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E -ÿ–—•€]/g, "");

  // Escreve texto sobre a linha (coordenadas em pt a partir do topo da página)
  const escreve = (texto, { x1, x2, linhaY, tam = 13, centro = false }) => {
    let t = limpa(texto);
    if (!t) return;
    const largMax = x2 - x1 - 6;
    let s = tam;
    while (s > 7 && font.widthOfTextAtSize(t, s) > largMax) s -= 0.5;
    while (t.length > 1 && font.widthOfTextAtSize(t, s) > largMax) t = t.slice(0, -2) + "…";
    const w = font.widthOfTextAtSize(t, s);
    const x = centro ? (x1 + x2) / 2 - w / 2 : x1 + 4;
    page.drawText(t, { x, y: H - linhaY + 4, size: s, font, color: cor });
  };

  // Bloco "SEU SISTEMA"
  escreve(nomeCliente, { x1: 119, x2: 419, linhaY: 1101 });
  escreve(endereco,    { x1: 135, x2: 419, linhaY: 1141 });
  escreve(cidadeUF,    { x1: 142, x2: 419, linhaY: 1181 });
  escreve(potKwp,      { x1: 202, x2: 359, linhaY: 1223, centro: true });
  escreve(inversorDesc,{ x1: 124, x2: 419, linhaY: 1264 });
  escreve(dia,         { x1: 191, x2: 249, linhaY: 1304, centro: true });
  escreve(mes,         { x1: 259, x2: 316, linhaY: 1304, centro: true });
  escreve(ano,         { x1: 326, x2: 404, linhaY: 1304, centro: true });

  // Bloco "ACOMPANHE SUA GERAÇÃO"
  escreve(aplicativo,  { x1: 783, x2: 940, linhaY: 1127 });
  escreve(login,       { x1: 745, x2: 940, linhaY: 1196 });
  escreve(senha,       { x1: 747, x2: 940, linhaY: 1265 });

  return await pdf.save();
}

function bytesToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}