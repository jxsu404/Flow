import { getISODay } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type ClassBlock, type Item } from "@/db/schema";
import { listCalendarBusy } from "./calendar/google";
import { listClassBlocks } from "./classes";
import { buildDayPlans, toScheduleDays, type DayPlan, type ScheduleDay } from "./day-plan";
import {
  DEFAULT_TIMEZONE,
  ISO_DAY_LABELS,
  formatMonthTitle,
  formatWeekSpan,
  isIsoDate,
  monthGridRange,
  weekContaining,
} from "./datetime";
import { isCalendarConnected } from "./google-token";
import { listItems } from "./items";
import { getWeatherNow, type WeatherNow } from "./weather";

export type ScheduleData = {
  today: string;
  timeZone: string;
  weekDays: ScheduleDay[];
  monthDays: ScheduleDay[];
  weekLabel: string;
  monthLabel: string;
  month: string;
};

export type DashboardData = ScheduleData & {
  userName: string | null;
  calendarConnected: boolean;
  todayLabel: string;
  todayLongLabel: string;
  weather: WeatherNow | null;
  todayClasses: Array<ClassBlock & { when: string }>;
  todayItems: Item[];
  pendingItems: Item[];
  items: Item[];
  upcoming: Item[];
  todayPlan: DayPlan | null;
};

async function loadUserContext(userId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return {
    user,
    timeZone: user?.timezone || DEFAULT_TIMEZONE,
  };
}

export async function getScheduleData(userId: string, dateStr?: string): Promise<ScheduleData> {
  const { timeZone } = await loadUserContext(userId);
  const now = new Date();
  const todayStr = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  const anchor = dateStr && isIsoDate(dateStr) ? dateStr : todayStr;
  const week = weekContaining(anchor, timeZone);
  const month = monthGridRange(anchor, timeZone);
  const from = week.start < month.start ? week.start : month.start;
  const to = week.end > month.end ? week.end : month.end;

  const [allItems, classes, calendarBusy] = await Promise.all([
    listItems(userId),
    listClassBlocks(userId),
    listCalendarBusy(userId, from, to).catch(() => []),
  ]);

  const pending = allItems.filter((item) => item.status === "pending");
  const plans = buildDayPlans({
    from,
    to,
    now,
    timeZone,
    classBlocks: classes,
    items: pending,
    calendarBusy,
  });
  const allDays = toScheduleDays(plans, todayStr, timeZone);
  const weekStart = formatInTimeZone(week.start, timeZone, "yyyy-MM-dd");
  const weekEnd = formatInTimeZone(week.end, timeZone, "yyyy-MM-dd");
  const monthStart = formatInTimeZone(month.start, timeZone, "yyyy-MM-dd");
  const monthEnd = formatInTimeZone(month.end, timeZone, "yyyy-MM-dd");

  return {
    today: todayStr,
    timeZone,
    weekDays: allDays.filter((day) => day.date >= weekStart && day.date <= weekEnd),
    monthDays: allDays.filter((day) => day.date >= monthStart && day.date <= monthEnd),
    weekLabel: formatWeekSpan(week.start, week.end, timeZone),
    monthLabel: formatMonthTitle(anchor, timeZone),
    month: month.month,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const { user, timeZone } = await loadUserContext(userId);
  const now = new Date();
  const todayStr = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  const week = weekContaining(todayStr, timeZone);
  const month = monthGridRange(todayStr, timeZone);
  const from = week.start < month.start ? week.start : month.start;
  const to = week.end > month.end ? week.end : month.end;
  const isoDay = getISODay(fromZonedTime(`${todayStr}T12:00:00`, timeZone));

  const [allItems, classes, calendarConnected, calendarBusy, weather] = await Promise.all([
    listItems(userId),
    listClassBlocks(userId),
    isCalendarConnected(userId),
    listCalendarBusy(userId, from, to).catch(() => []),
    getWeatherNow(timeZone).catch(() => null),
  ]);

  const pending = allItems.filter((item) => item.status === "pending");
  const plans = buildDayPlans({
    from,
    to,
    now,
    timeZone,
    classBlocks: classes,
    items: pending,
    calendarBusy,
  });
  const allDays = toScheduleDays(plans, todayStr, timeZone);
  const weekStart = formatInTimeZone(week.start, timeZone, "yyyy-MM-dd");
  const weekEnd = formatInTimeZone(week.end, timeZone, "yyyy-MM-dd");
  const monthStart = formatInTimeZone(month.start, timeZone, "yyyy-MM-dd");
  const monthEnd = formatInTimeZone(month.end, timeZone, "yyyy-MM-dd");

  const todayClasses = classes
    .filter((block) => block.dayOfWeek === isoDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((block) => ({
      ...block,
      when: `${block.startTime}–${block.endTime}`,
    }));

  const todayItems = pending.filter((item) => {
    const date = item.startAt ?? item.dueAt;
    if (!date) return false;
    return formatInTimeZone(date, timeZone, "yyyy-MM-dd") === todayStr;
  });

  const upcoming = pending
    .filter((item) => item.dueAt && (item.type === "assignment" || item.type === "exam" || item.type === "task"))
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0));

  return {
    userName: user?.name ?? null,
    timeZone,
    today: todayStr,
    calendarConnected,
    todayLabel: `${ISO_DAY_LABELS[isoDay] ?? ""} ${formatInTimeZone(now, timeZone, "d")}`.trim(),
    todayLongLabel: `${ISO_DAY_LABELS[isoDay] ?? ""}, ${formatInTimeZone(now, timeZone, "d 'de' MMMM", { locale: es })}`,
    weather,
    todayClasses,
    todayItems,
    pendingItems: pending,
    items: allItems,
    upcoming,
    todayPlan: plans.find((day) => day.isToday) ?? plans[0] ?? null,
    weekDays: allDays.filter((day) => day.date >= weekStart && day.date <= weekEnd),
    monthDays: allDays.filter((day) => day.date >= monthStart && day.date <= monthEnd),
    weekLabel: formatWeekSpan(week.start, week.end, timeZone),
    monthLabel: formatMonthTitle(todayStr, timeZone),
    month: month.month,
  };
}
