import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Exclui um agendamento da agenda do SolarFlow (sem tocar no Google Calendar).
// Zera data_instalacao, event IDs, continuacoes e reverte status se necessário.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const tipo = body.tipo; // 'instalacao' | 'manutencao'

    if (tipo === 'instalacao') {
      const projetoId = body.projeto_id;
      if (typeof projetoId !== 'string' || projetoId.trim() === '') {
        return Response.json({ error: 'projeto_id obrigatório' }, { status: 400 });
      }

      let fresh;
      try {
        fresh = await base44.entities.Projeto.get(projetoId);
      } catch {
        return Response.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 });
      }
      if (!fresh) return Response.json({ error: 'Projeto não encontrado ou sem acesso' }, { status: 403 });

      const updateData = {
        data_instalacao: null,
        google_calendar_event_id: null,
        google_calendar_event_ids: [],
        continuacoes: [],
        reagendamentos: [],
        evento_orfao_google: false,
        sync_origem: 'app'
      };

      // Se o projeto estava em fase de instalação agendada, volta para aprovado
      if (fresh.status === 'instalacao_agendada') {
        updateData.status = 'aprovado';
      }

      await base44.asServiceRole.entities.Projeto.update(projetoId, updateData);
      return Response.json({ success: true });
    }

    if (tipo === 'manutencao') {
      const manutencaoId = body.manutencao_id;
      if (typeof manutencaoId !== 'string' || manutencaoId.trim() === '') {
        return Response.json({ error: 'manutencao_id obrigatório' }, { status: 400 });
      }

      let fresh;
      try {
        fresh = await base44.entities.Manutencao.get(manutencaoId);
      } catch {
        return Response.json({ error: 'Manutenção não encontrada ou sem acesso' }, { status: 403 });
      }
      if (!fresh) return Response.json({ error: 'Manutenção não encontrada ou sem acesso' }, { status: 403 });

      await base44.asServiceRole.entities.Manutencao.update(manutencaoId, {
        data_agendamento: null,
        google_calendar_event_id: null,
        status: 'cancelada',
        evento_orfao_google: false,
        sync_origem: 'app'
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'tipo inválido (use "instalacao" ou "manutencao")' }, { status: 400 });
  } catch (error) {
    console.error('[excluirAgendamentoSolarFlow]', error);
    return Response.json({ error: 'Erro interno ao excluir agendamento: ' + (error?.message || 'desconhecido') }, { status: 500 });
  }
}