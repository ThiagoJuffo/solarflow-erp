export async function createCalendarEvent(accessToken, { summary, startDateTime, endDateTime, colorId, calendarId = 'primary' }) {
  const event = {
    summary,
    colorId,
    start: { dateTime: startDateTime.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: endDateTime.toISOString(), timeZone: 'America/Sao_Paulo' }
  };
  const calId = encodeURIComponent(calendarId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Falha ao criar evento no calendário (HTTP ${res.status})`);
  if (!data.id) throw new Error('Resposta inválida do calendário: ID ausente');
  return data.id;
}

export async function deleteCalendarEvent(accessToken, { eventId, calendarId = 'primary' }) {
  if (!eventId) return;
  const calId = encodeURIComponent(calendarId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  // 204 = sucesso, 404 = já não existe — ambos OK
  if (res.status !== 204 && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    throw new Error(`Falha ao excluir evento no calendário (HTTP ${res.status}): ${data.error?.message || ''}`);
  }
}

export async function updateCalendarEvent(accessToken, { eventId, summary, startDateTime, endDateTime, calendarId = 'primary', allDay = false }) {
  const event = {
    summary,
    start: allDay
      ? { date: startDateTime.toISOString().split('T')[0] }
      : { dateTime: startDateTime.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: allDay
      ? { date: endDateTime.toISOString().split('T')[0] }
      : { dateTime: endDateTime.toISOString(), timeZone: 'America/Sao_Paulo' }
  };
  const calId = encodeURIComponent(calendarId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Falha ao atualizar evento no calendário (HTTP ${res.status}): ${data.error?.message || JSON.stringify(data)}`);
  if (!data.id) throw new Error('Resposta inválida do calendário: ID ausente');
  return data.id;
}