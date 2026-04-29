import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Buscar todos os projetos e manutenções em paralelo
    const [todosProjetos, todasManutencoes] = await Promise.all([
      base44.asServiceRole.entities.Projeto.list('-created_date', 500),
      base44.asServiceRole.entities.Manutencao.list('-created_date', 200),
    ]);

    // --- 1. Confirmação de Pagamento ---
    // Projetos com status pago_projeto_iniciado e sem data_pagamento registrada
    const pendentesPagamento = todosProjetos.filter(p =>
      p.status === 'pago_projeto_iniciado' && !p.data_pagamento
    );

    // --- 2. Confirmação de Kit ---
    // Projetos com status pago_projeto_iniciado e equipamentos_confirmados false/nulo
    const pendentesKit = todosProjetos.filter(p =>
      p.status === 'pago_projeto_iniciado' && !p.equipamentos_confirmados
    );

    // --- 3. Manutenções a agendar ---
    const pendentesManutencao = todasManutencoes.filter(m =>
      m.status === 'agendar'
    );

    // Se não há nenhuma pendência, não envia e-mail
    const totalPendencias = pendentesPagamento.length + pendentesKit.length + pendentesManutencao.length;
    if (totalPendencias === 0) {
      return Response.json({ message: 'Nenhuma pendência encontrada. E-mail não enviado.' });
    }

    // Função para formatar lista de clientes (máx 5)
    const listarClientes = (items, campo = 'nome_cliente') => {
      const top5 = items.slice(0, 5);
      const linhas = top5.map(i => `<li style="margin:4px 0; color:#334155;">${i[campo] || '(sem nome)'}</li>`).join('');
      const extra = items.length > 5 ? `<li style="color:#94a3b8; font-style:italic;">+ ${items.length - 5} mais...</li>` : '';
      return `<ul style="margin:8px 0 0 0; padding-left:18px; font-size:14px;">${linhas}${extra}</ul>`;
    };

    // Seções do e-mail (só renderiza se houver pendências)
    const secoes = [];

    if (pendentesPagamento.length > 0) {
      secoes.push(`
        <div style="background:#fffbeb; border-left:4px solid #f59e0b; border-radius:8px; padding:16px 20px; margin-bottom:16px;">
          <p style="margin:0 0 4px 0; font-size:16px; font-weight:600; color:#92400e;">
            💳 Confirmação de Pagamento
            <span style="background:#f59e0b; color:#fff; font-size:12px; font-weight:700; border-radius:20px; padding:2px 10px; margin-left:8px;">${pendentesPagamento.length}</span>
          </p>
          <p style="margin:0; font-size:13px; color:#78350f;">Projetos sem data de pagamento registrada:</p>
          ${listarClientes(pendentesPagamento)}
        </div>
      `);
    }

    if (pendentesKit.length > 0) {
      secoes.push(`
        <div style="background:#f0fdf4; border-left:4px solid #22c55e; border-radius:8px; padding:16px 20px; margin-bottom:16px;">
          <p style="margin:0 0 4px 0; font-size:16px; font-weight:600; color:#14532d;">
            📦 Confirmação de Kit
            <span style="background:#22c55e; color:#fff; font-size:12px; font-weight:700; border-radius:20px; padding:2px 10px; margin-left:8px;">${pendentesKit.length}</span>
          </p>
          <p style="margin:0; font-size:13px; color:#166534;">Projetos aguardando validação dos equipamentos (marca, modelo, quantidade):</p>
          ${listarClientes(pendentesKit)}
        </div>
      `);
    }

    if (pendentesManutencao.length > 0) {
      secoes.push(`
        <div style="background:#eff6ff; border-left:4px solid #3b82f6; border-radius:8px; padding:16px 20px; margin-bottom:16px;">
          <p style="margin:0 0 4px 0; font-size:16px; font-weight:600; color:#1e3a8a;">
            🔧 Manutenções a Agendar
            <span style="background:#3b82f6; color:#fff; font-size:12px; font-weight:700; border-radius:20px; padding:2px 10px; margin-left:8px;">${pendentesManutencao.length}</span>
          </p>
          <p style="margin:0; font-size:13px; color:#1d4ed8;">Manutenções cadastradas aguardando agendamento:</p>
          ${listarClientes(pendentesManutencao)}
        </div>
      `);
    }

    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });

    const htmlEmail = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"></head>
      <body style="margin:0; padding:0; background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="max-width:600px; margin:32px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%); padding:28px 32px;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:4px;">
              <div style="width:36px; height:36px; background:#f59e0b; border-radius:10px; display:inline-flex; align-items:center; justify-content:center;">
                <span style="font-size:18px;">☀️</span>
              </div>
              <span style="color:#f59e0b; font-size:18px; font-weight:700;">SolarERP</span>
            </div>
            <h1 style="margin:12px 0 4px 0; color:#fff; font-size:22px; font-weight:700;">📋 Resumo Diário de Pendências</h1>
            <p style="margin:0; color:#94a3b8; font-size:13px;">${agora} · ${totalPendencias} pendência${totalPendencias !== 1 ? 's' : ''} aguardando sua atenção</p>
          </div>

          <!-- Corpo -->
          <div style="padding:28px 32px;">
            <p style="margin:0 0 24px 0; color:#475569; font-size:14px;">Olá, Gabriela! Aqui está o resumo das pendências que precisam da sua atenção hoje:</p>

            ${secoes.join('')}

            <div style="margin-top:28px; padding:16px 20px; background:#f1f5f9; border-radius:10px; text-align:center;">
              <p style="margin:0; font-size:13px; color:#64748b;">Acesse o sistema para resolver as pendências.</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding:16px 32px; background:#f8fafc; border-top:1px solid #e2e8f0; text-align:center;">
            <p style="margin:0; font-size:12px; color:#94a3b8;">SolarERP · EDP First · Enviado automaticamente às 08h</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'gabriela@ecomareng.com',
      subject: `☀️ SolarERP — ${totalPendencias} pendência${totalPendencias !== 1 ? 's' : ''} hoje (${agora})`,
      body: htmlEmail,
    });

    return Response.json({
      success: true,
      totalPendencias,
      pendentesPagamento: pendentesPagamento.length,
      pendentesKit: pendentesKit.length,
      pendentesManutencao: pendentesManutencao.length,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});