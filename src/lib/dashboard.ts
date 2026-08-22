import { addDays, getISODay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type ClassBlock, type Item } from "@/db/schema";
import { listCalendarBusy } from "./calendar/google";
import { listClassBlocks } from "./classes";
import { buildDayPlans, toScheduleDays, type DayPlan, type ScheduleDay } from "./day-plan";
import { DEFAULT_TIMEZONE, ISO_DAY_LABELS, weekDateRange } from "./datetime";
import { isCalendarConnected } from "./google-token";
import { listItems } from "./items";

export type DashboardData = {
  userName: string | null;
  timeZone: string;
  today: string;
  calendarConnected: boolean;
  todayLabel: string;
  todayClasses: Array<ClassBlock & { when: string }>;
  todayItems: Item[];
  upcoming: Item[];
  todayPlan: DayPlan | null;
  weekDays: ScheduleDay[];
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const timeZone = user?.timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const week = weekDateRange(now, timeZone);
  const rangeEnd = addDays(now, 7);
  const calendarFrom = week.start < now ? week.start : now;

  const [allItems, classes, calendarConnected, calendarBusy] = await Promise.all([
    listItems(userId),
    listClassBlocks(userId),
    isCalendarConnected(userId),
    listCalendarBusy(userId, calendarFrom, rangeEnd > week.end ? rangeEnd : week.end).catch(() => []),
  ]);

  const pending = allItems.filter((item) => item.status === "pending");
  const todayStr = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  const isoDay = getISODay(fromZonedTime(`${todayStr}T12:00:00`, timeZone));

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

  const days = buildDayPlans({
    from: week.start,
    to: week.end,
    now,
    timeZone,
    classBlocks: classes,
    items: pending,
    calendarBusy,
  });

  return {
    userName: user?.name ?? null,
    timeZone,
    today: todayStr,
    calendarConnected,
    todayLabel: `${ISO_DAY_LABELS[isoDay] ?? ""} ${formatInTimeZone(now, timeZone, "d MMM")}`,
    todayClasses,
    todayItems,
    upcoming,
    todayPlan: days.find((day) => day.isToday) ?? days[0] ?? null,
    weekDays: toScheduleDays(days, todayStr, timeZone),
  };
}
