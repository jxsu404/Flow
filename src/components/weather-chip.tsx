import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  Moon,
  Snowflake,
  Sun,
} from "lucide-react";
import type { WeatherNow } from "@/lib/weather";
import { cn } from "@/lib/utils";

function WeatherIcon({ weather, className }: { weather: WeatherNow; className?: string }) {
  if (weather.condition === "rain") return <CloudRain className={className} />;
  if (weather.condition === "storm") return <CloudLightning className={className} />;
  if (weather.condition === "snow") return <Snowflake className={className} />;
  if (weather.condition === "fog") return <CloudFog className={className} />;
  if (weather.condition === "clouds") {
    return weather.isDay ? <Cloud className={className} /> : <CloudMoon className={className} />;
  }
  return weather.isDay ? <Sun className={className} /> : <Moon className={className} />;
}

export function WeatherChip({ weather, className }: { weather: WeatherNow; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl bg-secondary/40 px-3.5 py-2.5 ring-1 ring-foreground/8",
        className,
      )}
    >
      <WeatherIcon weather={weather} className="size-6 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-sm font-medium tabular-nums">
          {weather.temperatureC}°C
          <span className="ml-1.5 font-normal text-muted-foreground">· {weather.label}</span>
        </p>
        {weather.place ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{weather.place}</p>
        ) : null}
      </div>
    </div>
  );
}
