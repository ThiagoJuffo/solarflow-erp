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
  if (!res.ok) throw new Error(`Calendar API error: ${JSON.stringify(data)}`);
  return data.id;
}