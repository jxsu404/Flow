import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { ISO_DAY_SHORT } from "../datetime";
import type { Interval } from "../availability";
import { getGoogleAccessToken } from "../google-token";

const CALENDAR_ID = "primary";

async function calendarClient(userId: string) {
  const token = await getGoogleAccessToken(userId);
  if (!token) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  return google.calendar({ version: "v3", auth });
}

function reminderOverrides(type: string) {
  if (type === "assignment") {
    return [
      { method: "popup" as const, minutes: 24 * 60 },
      { method: "popup" as const, minutes: 60 },
    ];
  }
  if (type === "exam") {
    return [
      { method: "popup" as const, minutes: 24 * 60 },
      { method: "popup" as const, minutes: 60 },
      { method: "popup" as const, minutes: 10 },
    ];
  }
  return [
    { method: "popup" as const, minutes: 60 },
    { method: "popup" as const, minutes: 10 },
  ];
}

export type CalendarEventInput = {
  title: string;
  notes?: string | null;
  start: Date;
  end: Date;
  timeZone: string;
  type: string;
  allDay?: boolean;
};

export async function createCalendarEvent(
  userId: string,
  input: CalendarEventInput,
): Promise<string | null> {
  const calendar = await calendarClient(userId);
  if (!calendar) return null;

  const event: calendar_v3.Schema$Event = {
    summary: input.title,
    description: input.notes ?? undefined,
    reminders: { useDefault: false, overrides: reminderOverrides(input.type) },
  };

  if (input.allDay) {
    const startDay = input.start.toISOString().slice(0, 10);
    const endDay = new Date(input.end.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    event.start = { date: startDay };
    event.end = { date: endDay };
  } else {
    event.start = { dateTime: input.start.toISOString(), timeZone: input.timeZone };
    event.end = { dateTime: input.end.toISOString(), timeZone: input.timeZone };
  }

  const created = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: event,
  });
  return created.data.id ?? null;
}

export async function createRecurringClassEvent(
  userId: string,
  input: {
    title: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    timeZone: string;
    location?: string | null;
    date: string;
  },
): Promise<string | null> {
  const calendar = await calendarClient(userId);
  if (!calendar) return null;

  const date = input.date;
  const byDay = ISO_DAY_SHORT[input.dayOfWeek];
  if (!byDay) return null;

  const created = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: input.title,
      location: input.location ?? undefined,
      start: {
        dateTime: `${date}T${input.startTime}:00`,
        timeZone: input.timeZone,
      },
      end: {
        dateTime: `${date}T${input.endTime}:00`,
        timeZone: input.timeZone,
      },
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`],
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 15 }],
      },
    },
  });
  return created.data.id ?? null;
}

export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  input: Partial<CalendarEventInput>,
): Promise<boolean> {
  const calendar = await calendarClient(userId);
  if (!calendar) return false;

  const requestBody: calendar_v3.Schema$Event = {};
  if (input.title) requestBody.summary = input.title;
  if (input.notes !== undefined) requestBody.description = input.notes ?? undefined;
  if (input.start && input.end && input.timeZone) {
    requestBody.start = { dateTime: input.start.toISOString(), timeZone: input.timeZone };
    requestBody.end = { dateTime: input.end.toISOString(), timeZone: input.timeZone };
  }

  await calendar.events.patch({
    calendarId: CALENDAR_ID,
    eventId,
    requestBody,
  });
  return true;
}

export async function deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  const calendar = await calendarClient(userId);
  if (!calendar) return false;
  try {
    await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
    return true;
  } catch {
    return false;
  }
}

export async function listCalendarBusy(
  userId: string,
  from: Date,
  to: Date,
): Promise<Interval[]> {
  const calendar = await calendarClient(userId);
  if (!calendar) return [];

  const listed = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const busy: Interval[] = [];
  for (const event of listed.data.items ?? []) {
    if (event.status === "cancelled") continue;
    const start = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : event.start?.date
        ? new Date(`${event.start.date}T00:00:00`)
        : null;
    const end = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : event.end?.date
        ? new Date(`${event.end.date}T00:00:00`)
        : null;
    if (!start || !end) continue;
    busy.push({
      start,
      end,
      title: event.summary ?? "Evento",
      kind: "calendar",
    });
  }
  return busy;
}
