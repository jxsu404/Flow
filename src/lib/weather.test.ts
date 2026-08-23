import assert from "node:assert/strict";
import test from "node:test";
import { describeWeatherCode, placeFromHeaders, placeFromTimeZone } from "./weather";

const TZ = "America/Costa_Rica";

function headerReader(values: Record<string, string>) {
  return (name: string) => values[name] ?? null;
}

test("los códigos WMO se traducen a condición y etiqueta en español", () => {
  assert.deepEqual(describeWeatherCode(0), { condition: "clear", label: "Despejado" });
  assert.equal(describeWeatherCode(3).condition, "clouds");
  assert.equal(describeWeatherCode(61).condition, "rain");
  assert.equal(describeWeatherCode(80).condition, "rain");
  assert.equal(describeWeatherCode(95).condition, "storm");
  assert.equal(describeWeatherCode(73).condition, "snow");
  assert.equal(describeWeatherCode(45).condition, "fog");
});

test("un código desconocido no inventa lluvia ni sol", () => {
  const unknown = describeWeatherCode(1234);
  assert.equal(unknown.condition, "clouds");
  assert.match(unknown.label, /sin datos/i);
});

test("la geolocalización de la request manda sobre el huso", () => {
  const place = placeFromHeaders(
    headerReader({
      "x-vercel-ip-latitude": "25.686",
      "x-vercel-ip-longitude": "-100.316",
      "x-vercel-ip-city": "Monterrey",
    }),
    TZ,
  );
  assert.equal(place?.place, "Monterrey");
  assert.equal(Math.round(place!.latitude), 26);
});

test("las ciudades con acento llegan codificadas en el header", () => {
  const place = placeFromHeaders(
    headerReader({
      "x-vercel-ip-latitude": "19.43",
      "x-vercel-ip-longitude": "-99.13",
      "x-vercel-ip-city": "Ciudad%20de%20M%C3%A9xico",
    }),
    TZ,
  );
  assert.equal(place?.place, "Ciudad de México");
});

test("sin geolocalización se usa el huso del usuario", () => {
  const place = placeFromHeaders(headerReader({}), TZ);
  assert.equal(place?.place, "San José");
  const broken = placeFromHeaders(headerReader({ "x-vercel-ip-latitude": "no-es-número" }), TZ);
  assert.equal(broken?.place, "San José");
});

test("un huso desconocido deja a Flow sin clima, no con datos inventados", () => {
  assert.equal(placeFromTimeZone("Antarctica/Troll"), null);
  assert.equal(placeFromHeaders(headerReader({}), "Antarctica/Troll"), null);
});
