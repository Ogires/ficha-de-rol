import { describe, expect, it } from "vitest";
import { claveIp, idPublico, leerJson, rechazoCsrf } from "../src/http/util";

const peticion = (cabeceras: Record<string, string>, cuerpo = "{}") =>
  new Request("https://rol.webninja.fyi/api/ficha", { method: "POST", headers: cabeceras, body: cuerpo });

describe("rechazoCsrf", () => {
  it("exige JSON (415) y la misma web (403)", () => {
    expect(rechazoCsrf(peticion({ "content-type": "text/plain" }))?.status).toBe(415);
    expect(rechazoCsrf(peticion({ "content-type": "application/json", origin: "https://malvada.example" }))?.status).toBe(403);
    expect(rechazoCsrf(peticion({ "content-type": "application/json", origin: "https://excusotron.webninja.fyi" }))?.status).toBe(403);
    expect(rechazoCsrf(peticion({ "content-type": "application/json", "sec-fetch-site": "cross-site" }))?.status).toBe(403);
    expect(rechazoCsrf(peticion({ "content-type": "application/json", origin: "https://rol.webninja.fyi", "sec-fetch-site": "same-origin" }))).toBeNull();
  });
});

describe("leerJson", () => {
  it("acepta un objeto y rechaza arrays, JSON roto y cuerpos enormes", async () => {
    expect(await leerJson(peticion({}, '{"a":1}'))).toEqual({ a: 1 });
    expect(await leerJson(peticion({}, "[1]"))).toBeNull();
    expect(await leerJson(peticion({}, "{roto"))).toBeNull();
    expect(await leerJson(peticion({}, JSON.stringify({ t: "x".repeat(60_000) })))).toBeNull();
  });
});

describe("claveIp e idPublico", () => {
  it("agrupa IPv6 por /64 y deja IPv4 igual", () => {
    expect(claveIp("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(claveIp("203.0.113.7")).toBe("203.0.113.7");
    expect(claveIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });
  it("genera ids de 12 caracteres alfanuméricos", () => {
    expect(idPublico()).toMatch(/^[A-Za-z0-9]{12}$/);
  });
});
