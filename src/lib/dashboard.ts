import { addDays, getISODay } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type ClassBlock, type Item } from "@/db/schema";
import { findFreeSlots, type FreeSlot } from "./availability";
import { listCalendarBusy } from "./calendar/google";
import { listClassBlocks } from "./classes";
import { DEFAULT_TIMEZONE, ISO_DAY_LABELS } from "./datetime";
import { isCalendarConnected } from "./google-token";
import { listItems } from "./items";
import { buildTodayAtmosphere, type TodayAtmosphere } from "./today-atmosphere";
import { getCurrentWeather } from "./weather";

export type DashboardData = {
  userName: string | null;
  timeZone: string;
  calendarConnected: boolean;
  todayLabel: string;
  todayClasses: Array<ClassBlock & { when: string }>;
  todayItems: Item[];
  priorities: Item[];
  upcoming: Item[];
  freeSlots: FreeSlot[];
  todayAtmosphere: TodayAtmosphere;
};

function priorityRank(priority: Item["priority"]) {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const timeZone = user?.timezone || DEFAULT_TIMEZONE;
  const now = new Date();
  const rangeEnd = addDays(now, 7);

  const [allItems, classes, calendarConnected, calendarBusy, weather] = await Promise.all([
    listItems(userId),
    listClassBlocks(userId),
    isCalendarConnected(userId),
    listCalendarBusy(userId, now, rangeEnd).catch(() => []),
    getCurrentWeather(timeZone),
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

  const priorities = [...pending]
    .sort((a, b) => {
      const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
      if (byPriority !== 0) return byPriority;
      const aDue = a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDue = b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })
    .slice(0, 8);

  const upcoming = pending
    .filter((item) => (item.type === "assignment" || item.type === "exam") && item.dueAt)
    .sort((a, b) => (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0))
    .slice(0, 8);

  const freeSlots = findFreeSlots({
    from: now,
    to: rangeEnd,
    timeZone,
    classBlocks: classes,
    items: pending,
    calendarBusy,
  }).slice(0, 8);

  return {
    userName: user?.name ?? null,
    timeZone,
    calendarConnected,
    todayLabel: `${ISO_DAY_LABELS[isoDay] ?? ""} ${formatInTimeZone(now, timeZone, "d MMM")}`,
    todayClasses,
    todayItems,
    priorities,
    upcoming,
    freeSlots,
    todayAtmosphere: buildTodayAtmosphere({
      now,
      timeZone,
      weather,
      todayItems,
      priorities,
      todayClasses,
    }),
  };
}
