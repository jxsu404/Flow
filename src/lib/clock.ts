import { formatInTimeZone } from "date-fns-tz";
import { AWAKE_START_HOUR } from "./calendar-grid";

export function clockInZone(timeZone: string, at = new Date()): {
  hour: number;
  minute: number;
  startMin: number;
} {
  const [hour, minute] = formatInTimeZone(at, timeZone, "HH:mm").split(":").map(Number);
  return {
    hour: hour ?? 0,
    minute: minute ?? 0,
    startMin: (hour ?? 0) * 60 + (minute ?? 0) - AWAKE_START_HOUR * 60,
  };
}
