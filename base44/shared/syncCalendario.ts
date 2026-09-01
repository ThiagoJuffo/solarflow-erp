// Módulo compartilhado de sincronização Google Calendar <-> App
// Usado por sincronizarEventoGoogle (webhook) e sincronizarPollingCalendario (polling)

export const CALENDAR_IDS = [
  'primary',
  'c_pqve749ida09u4nnpb1ts1ivkg@group.calendar.google.com',
  'atendimento@ecomareng.com'
];

// Extrai ID entre colchetes do título do evento (ex: "Instalação João [abc123]")
export function parseIdFromTitle(title) {
  const match = (title || '').match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
}

// Extrai data (YYYY-MM-DD) do start do evento Google
export function extractDateFromEventStart(event) {
  const start = event.start?.dateTime || event.start?.date;
  if (!start) return null;
  return start.split('T')[0];
}

// Extrai datetime ISO do start do evento Google
export function extractDateTimeFromEventStart(event) {
  const start = event.start?.dateTime || event.start?.date;
  if (!start) return null;
  return start;
}

// Carrega projetos e manutenções que têm vínculo com Google Calendar
export async function loadSyncableRecords(base44) {
  const [projetos, manutencoes, ucs] = await Promise.all([
    base44.asServiceRole.entities.Projeto.list('-updated_date', 500),
    base44.asServiceRole.entities.Manutencao.list('-updated_date', 500),
    base44.asServiceRole.entities.UC.list('-updated_date', 500),
  ]);
  return { projetos, manutencoes, ucs };
}

// Encontra projeto pelo event ID (single, multi-day array ou continuação)
export function findProjetoByEventId(projetos, eventId) {
  const byMain = projetos.find(p =>
    p.google_calendar_event_id === eventId ||
    (Array.isArray(p.google_calendar_event_ids) && p.google_calendar_event_ids.includes(eventId))
  );
  if (byMain) return byMain;
  return projetos.find(p =>
    Array.isArray(p.continuacoes) && p.continuacoes.some(c => c.google_calendar_event_id === eventId)
  ) || null;
}

// Encontra manutenção pelo event ID
export function findManutencaoByEventId(manutencoes, eventId) {
  return manutencoes.find(m => m.google_calendar_event_id === eventId) || null;
}

// Encontra registro (projeto ou manutenção) pelo ID extraído do título
export function findRecordByParsedId(projetos, manutencoes, parsedId) {
  if (!parsedId) return null;
  const proj = projetos.find(p => p.id === parsedId);
  if (proj) return { type: 'projeto', record: proj };
  const man = manutencoes.find(m => m.id === parsedId);
  if (man) return { type: 'manutencao', record: man };
  return null;
}

// Encontra registro por event ID — tenta projeto primeiro, depois manutenção
export function findRecordByEventId(projetos, manutencoes, eventId) {
  const proj = findProjetoByEventId(projetos, eventId);
  if (proj) return { type: 'projeto', record: proj };
  const man = findManutencaoByEventId(manutencoes, eventId);
  if (man) return { type: 'manutencao', record: man };
  return null;
}

// Aplica last-write-wins: só atualiza o registro se o Google for mais recente
// Retorna { updated: boolean, reason: string }
export async function applyGoogleEventToRecord(base44, type, record, event, ucs) {
  const googleUpdated = new Date(event.updated);
  const recordUpdated = new Date(record.updated_date);

  // Last-write-wins: só atualiza se o Google for mais recente
  if (googleUpdated <= recordUpdated) {
    return { updated: false, reason: 'app_wins' };
  }

  if (type === 'projeto') {
    // Verifica se é um evento de continuação
    const isContinuation = Array.isArray(record.continuacoes) &&
      record.continuacoes.some(c => c.google_calendar_event_id === event.id);

    if (isContinuation) {
      const contDateStr = extractDateFromEventStart(event);
      const continuacoes = record.continuacoes.map(c =>
        c.google_calendar_event_id === event.id
          ? { ...c, data: contDateStr || c.data }
          : c
      );
      await base44.asServiceRole.entities.Projeto.update(record.id, {
        continuacoes,
        sync_origem: 'google',
        evento_orfao_google: false
      });
      return { updated: true, reason: 'google_wins_continuation' };
    }

    const updateData = { sync_origem: 'google', evento_orfao_google: false };
    const dateStr = extractDateFromEventStart(event);
    if (dateStr) updateData.data_instalacao = dateStr;
    if (event.description !== undefined) updateData.observacoes = event.description || '';

    // Atualiza endereço na UC vinculada
    if (event.location && ucs) {
      const uc = ucs.find(u => u.projeto_id === record.id);
      if (uc) {
        await base44.asServiceRole.entities.UC.update(uc.id, { endereco: event.location });
      }
    }

    await base44.asServiceRole.entities.Projeto.update(record.id, updateData);
    return { updated: true, reason: 'google_wins' };
  } else {
    const updateData = { sync_origem: 'google', evento_orfao_google: false };
    const dateTimeStr = extractDateTimeFromEventStart(event);
    if (dateTimeStr) updateData.data_agendamento = dateTimeStr;
    if (event.location !== undefined) updateData.endereco = event.location || '';
    if (event.description !== undefined) updateData.observacoes = event.description || '';

    await base44.asServiceRole.entities.Manutencao.update(record.id, updateData);
    return { updated: true, reason: 'google_wins' };
  }
}

// Marca registro como órfão (evento excluído no Google)
export async function markRecordAsOrphan(base44, type, record) {
  if (record.evento_orfao_google) return; // já está marcado
  if (type === 'projeto') {
    await base44.asServiceRole.entities.Projeto.update(record.id, {
      evento_orfao_google: true,
      sync_origem: 'google'
    });
  } else {
    await base44.asServiceRole.entities.Manutencao.update(record.id, {
      evento_orfao_google: true,
      sync_origem: 'google'
    });
  }
}

// Desmarca órfão (evento reapareceu no Google)
export async function unmarkOrphan(base44, type, record) {
  if (!record.evento_orfao_google) return; // não estava marcado
  if (type === 'projeto') {
    await base44.asServiceRole.entities.Projeto.update(record.id, {
      evento_orfao_google: false,
      sync_origem: 'google'
    });
  } else {
    await base44.asServiceRole.entities.Manutencao.update(record.id, {
      evento_orfao_google: false,
      sync_origem: 'google'
    });
  }
}

// Processa um único evento do Google (webhook incremental)
// Retorna { matched: boolean, action: string }
export async function processGoogleEvent(base44, event, projetos, manutencoes, ucs) {
  // Evento excluído no Google (status cancelled)
  if (event.status === 'cancelled') {
    const found = findRecordByEventId(projetos, manutencoes, event.id);
    if (found) {
      await markRecordAsOrphan(base44, found.type, found.record);
      return { matched: true, action: 'orphan_marked' };
    }
    return { matched: false, action: 'cancelled_no_match' };
  }

  // Evento criado/atualizado
  const foundByEventId = findRecordByEventId(projetos, manutencoes, event.id);
  if (foundByEventId) {
    const result = await applyGoogleEventToRecord(base44, foundByEventId.type, foundByEventId.record, event, ucs);
    if (foundByEventId.record.evento_orfao_google) {
      await unmarkOrphan(base44, foundByEventId.type, foundByEventId.record);
    }
    return { matched: true, action: result.reason };
  }

  // Tenta pelo ID no título
  const parsedId = parseIdFromTitle(event.summary);
  if (parsedId) {
    const foundByTitle = findRecordByParsedId(projetos, manutencoes, parsedId);
    if (foundByTitle) {
      // Vincula o event ID ao registro se não tinha
      if (foundByTitle.type === 'projeto' && !foundByTitle.record.google_calendar_event_id) {
        await base44.asServiceRole.entities.Projeto.update(foundByTitle.record.id, {
          google_calendar_event_id: event.id,
          sync_origem: 'google'
        });
      } else if (foundByTitle.type === 'manutencao' && !foundByTitle.record.google_calendar_event_id) {
        await base44.asServiceRole.entities.Manutencao.update(foundByTitle.record.id, {
          google_calendar_event_id: event.id,
          sync_origem: 'google'
        });
      }
      const freshRecord = foundByTitle.type === 'projeto'
        ? await base44.asServiceRole.entities.Projeto.get(foundByTitle.record.id)
        : await base44.asServiceRole.entities.Manutencao.get(foundByTitle.record.id);
      const result = await applyGoogleEventToRecord(base44, foundByTitle.type, freshRecord, event, ucs);
      return { matched: true, action: 'linked_' + result.reason };
    }
  }

  return { matched: false, action: 'no_match' };
}