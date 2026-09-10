import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Agenda uma instalação no SolarFlow (sem Google Calendar).
// Multi-dia: data_instalacao = dia 1, continuações = dias 2..N.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const projetoId = body.projeto_id;
    const dataAgendamento = body.data_agendamento;
    const quantidadeDias = Math.max(1, Math.min(30, Number(body.quantidade_dias) || 1));

    if (typeof projetoId !== 'string' || projetoId.trim() === '' || projetoId.length > 200) {
      return Response.json({ error: 'ID de projeto inválido' }, { status: 400 });
    }
    if (!dataAgendamento) {
      return Response.json({ error: 'Data de agendamento obrigatória' }, { status: 400 });
    }

    const fresh = await base44.entities.Projeto.get(projetoId);
    if (!fresh) return Response.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 });

    if (fresh.data_instalacao) {
      return Response.json({ skipped: true, reason: 'already scheduled' });
    }

    const startDateTime = new Date(dataAgendamento);
    if (isNaN(startDateTime.getTime())) {
      return Response.json({ error: 'Data de agendamento inválida' }, { status: 400 });
    }

    const dataInstalacao = startDateTime.toISOString().split('T')[0];
    const updateData = {
      data_instalacao: dataInstalacao,
      sync_origem: 'app'
    };

    // Multi-dia: dias 2..N como continuações
    if (quantidadeDias > 1) {
      const continuacoes = Array.isArray(fresh.continuacoes) ? [...fresh.continuacoes] : [];
      for (let i = 1; i < quantidadeDias; i++) {
        const dayDate = new Date(startDateTime.getTime() + i * 24 * 60 * 60 * 1000);
        continuacoes.push({
          data: dayDate.toISOString().split('T')[0],
          concluida: false
        });
      }
      updateData.continuacoes = continuacoes;
    }

    const PRE_INSTALACAO = ['pago_projeto_iniciado','kit_confirmado','documentos_gerados','assinaturas_pendentes','assinaturas_concluidas','dossie_ok','protocolado_edp','aguardando_aprovacao','aprovado'];
    if (PRE_INSTALACAO.includes(fresh.status)) {
      updateData.status = 'instalacao_agendada';
    }

    await base44.asServiceRole.entities.Projeto.update(projetoId, updateData);
    return Response.json({ success: true, data_instalacao: dataInstalacao });
  } catch (error) {
    console.error('[agendarInstalacaoManual]', error);
    return Response.json({ error: 'Erro interno ao agendar instalação' }, { status: 500 });
  }
}