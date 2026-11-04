import { describe, expect, it } from "vitest";
import { SELF } from "cloudflare:test";
import javaSenior from "./fixtures/java-senior.txt?raw";

const BASE = "https://rol.webninja.fyi";
const crear = (cabeceras: Record<string, string> = {}) =>
  SELF.fetch(`${BASE}/api/ficha`, {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "10.3.0.1", origin: BASE, ...cabeceras },
    body: JSON.stringify({ texto: javaSenior, raza: "enano", aspecto: "femenino" }),
  });

describe("API", () => {
  it("CSRF: 415 sin JSON y 403 desde otra web; 405 con otro método", async () => {
    expect((await crear({ "content-type": "text/plain" })).status).toBe(415);
    expect((await crear({ origin: "https://malvada.example" })).status).toBe(403);
    expect((await SELF.fetch(`${BASE}/api/ficha`)).status).toBe(405);
  });

  it("sin IA: ficha manual guardada, legible por la API y con cabeceras de seguridad", async () => {
    const r = await crear();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-security-policy")).toContain("default-src 'self'");
    const { id, ficha } = (await r.json()) as any;
    expect(ficha).toMatchObject({ origen: "manual", retrato: { tipo: "galeria", ruta: "/galeria/guerrero-enano-f.jpg" } });
    const leida = await SELF.fetch(`${BASE}/api/ficha/${id}`);
    expect(leida.status).toBe(200);
    expect(leida.headers.get("x-robots-tag")).toBe("noindex");
    expect(await leida.json()).toEqual(ficha);
  });

  it("ids inválidos o inexistentes → 404", async () => {
    expect((await SELF.fetch(`${BASE}/api/ficha/../../x`)).status).toBe(404);
    expect((await SELF.fetch(`${BASE}/api/ficha/AAAAAAAAAAAA`)).status).toBe(404);
  });
});
