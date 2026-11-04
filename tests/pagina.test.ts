import { describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";
import type { Ficha } from "../src/dominio/tipos";

const BASE = "https://rol.webninja.fyi";
const ficha = (extra: Partial<Ficha>): Ficha => ({
  v: 1, id: "AbCdEfGhJkLm", creada: "2026-11-04T10:00:00.000Z", clase: "Paladín de .NET", claseBase: "paladin",
  nivel: { valor: 18, motivo: "18 años" },
  atributos: { FUE: { valor: 15, motivos: [] }, DES: { valor: 12, motivos: [] }, CON: { valor: 19, motivos: [] }, INT: { valor: 14, motivos: [] }, SAB: { valor: 11, motivos: [] }, CAR: { valor: 8, motivos: [] } },
  hechizos: [], objetos: [], trasfondo: "t", defecto: "d", raza: "enano", aspecto: "masculino",
  retrato: { tipo: "propio" }, origen: "ia", ...extra,
});

describe("/f/{id}", () => {
  it("reescribe title y og con la clase, el nivel y el retrato propio", async () => {
    await env.KV.put("f:AbCdEfGhJkLm", JSON.stringify(ficha({})));
    const html = await (await SELF.fetch(`${BASE}/f/AbCdEfGhJkLm`)).text();
    expect(html).toContain('<meta property="og:title" content="Paladín de .NET · nivel 18"');
    expect(html).toContain(`content="${BASE}/f/AbCdEfGhJkLm/retrato.jpg"`);
    expect(html).toContain("FUE 15 · DES 12 · CON 19");
  });

  it("con retrato de galería apunta al asset", async () => {
    await env.KV.put("f:GaLeRiAaaaaa", JSON.stringify(ficha({ id: "GaLeRiAaaaaa", retrato: { tipo: "galeria", ruta: "/galeria/paladin-enano-m.jpg" } })));
    expect(await (await SELF.fetch(`${BASE}/f/GaLeRiAaaaaa`)).text()).toContain(`content="${BASE}/galeria/paladin-enano-m.jpg"`);
  });

  it("escapa lo que se cuela en los atributos (LLM05)", async () => {
    await env.KV.put("f:XsSxSsXsSxSs", JSON.stringify(ficha({ id: "XsSxSsXsSxSs", clase: '"><script>alert(1)</script>' })));
    const html = await (await SELF.fetch(`${BASE}/f/XsSxSsXsSxSs`)).text();
    // setAttribute escapa la comilla: el «<script>» se queda dentro del valor del atributo, inerte.
    // Escaparlo otra vez a mano haría que la vista previa de LinkedIn enseñara «&lt;»
    expect(html).not.toContain('""><script>');
    expect(html).toContain('content="&quot;><script>alert(1)</script> · nivel 18"');
    expect(html).toContain('<title>"&gt;&lt;script&gt;alert(1)&lt;/script&gt; · nivel 18');
  });

  it("404 si no existe, y noindex siempre", async () => {
    const r = await SELF.fetch(`${BASE}/f/NoExisteNada`);
    expect(r.status).toBe(404);
    expect(r.headers.get("x-robots-tag")).toBe("noindex");
  });
});

describe("/f/{id}/retrato.jpg", () => {
  it("sirve el JPEG de KV como inmutable", async () => {
    await env.KV.put("r:AbCdEfGhJkLm", new Uint8Array([0xff, 0xd8, 0xff]));
    const r = await SELF.fetch(`${BASE}/f/AbCdEfGhJkLm/retrato.jpg`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/jpeg");
    expect(r.headers.get("cache-control")).toContain("immutable");
    expect((await SELF.fetch(`${BASE}/f/NoExisteNada/retrato.jpg`)).status).toBe(404);
  });
});
