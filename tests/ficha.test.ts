import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { crearFicha, depsDesdeEnv, type DepsFicha } from "../src/handlers/ficha";
import { calcularPerfil } from "../src/dominio/perfil";
import { iaFalsa, narrativaPara } from "./helpers";
import javaSenior from "./fixtures/java-senior.txt?raw";

afterEach(() => vi.restoreAllMocks());

const p = calcularPerfil(javaSenior, "sorpresa")!;
const nombres = [...p.hechizos, ...p.objetos];
let n = 0;
const nuevaIp = () => `10.2.${Math.floor(++n / 250)}.${n % 250}`;
const peticion = (ip = nuevaIp(), cuerpo: unknown = { texto: javaSenior, raza: "elfo", aspecto: "sorpresa" }) =>
  new Request("https://rol.webninja.fyi/api/ficha", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip, origin: "https://rol.webninja.fyi" },
    body: JSON.stringify(cuerpo),
  });
const deps = (extra: Partial<DepsFicha> = {}): DepsFicha => ({ ...depsDesdeEnv(env), ...extra });

describe("crearFicha con IA", () => {
  it("camino feliz: guarda ficha y retrato en KV y devuelve el id", async () => {
    const { ia } = iaFalsa({ texto: narrativaPara(nombres) });
    const r = await crearFicha(peticion(), deps({ ia }));
    expect(r.status).toBe(200);
    const { id, ficha } = (await r.json()) as any;
    expect(id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(ficha).toMatchObject({ origen: "ia", retrato: { tipo: "propio" }, clase: p.clase, nivel: { valor: 14 } });
    expect(ficha.hechizos.map((h: any) => h.nombre)).toEqual(p.hechizos);
    expect(await env.KV.get(`f:${id}`, "json")).toMatchObject({ id, clase: p.clase });
    expect(await env.KV.get(`r:${id}`, "arrayBuffer")).not.toBeNull();
  });

  it("la 6.ª ficha de una IP sale manual y la 21.ª da 429 (contador exacto)", async () => {
    const { ia, llamadas } = iaFalsa({ texto: narrativaPara(nombres) });
    const ip = nuevaIp();
    const origenes: string[] = [];
    for (let i = 0; i < 20; i++) origenes.push(((await (await crearFicha(peticion(ip), deps({ ia }))).json()) as any).ficha.origen);
    expect(origenes.filter((o) => o === "ia")).toHaveLength(5);
    expect(llamadas.texto).toBe(5);
    expect((await crearFicha(peticion(ip), deps({ ia }))).status).toBe(429);
  });

  it("sin neuronas: ficha manual y retrato de galería, sin llamar a la IA", async () => {
    const { ia, llamadas } = iaFalsa();
    const r = await crearFicha(peticion(), deps({ ia, reservarNeuronas: async () => false }));
    expect(((await r.json()) as any).ficha).toMatchObject({ origen: "manual", retrato: { tipo: "galeria", ruta: `/galeria/guerrero-elfo-${p.genero}.jpg` } });
    expect(llamadas.texto + llamadas.imagen).toBe(0);
  });

  it("con el almacenamiento lleno: texto con IA y retrato de galería", async () => {
    const { ia, llamadas } = iaFalsa({ texto: narrativaPara(nombres) });
    const r = await crearFicha(peticion(), deps({ ia, bytesGuardados: async () => 900_000_000 }));
    expect(((await r.json()) as any).ficha).toMatchObject({ origen: "ia", retrato: { tipo: "galeria" } });
    expect(llamadas.imagen).toBe(0);
  });

  it("si KV falla: enseña la ficha sin enlace y con retrato de galería", async () => {
    const { ia } = iaFalsa({ texto: narrativaPara(nombres) });
    const kvRoto = { ...env.KV, put: async () => { throw new Error("kv"); } } as unknown as KVNamespace;
    const r = await crearFicha(peticion(), deps({ ia, kv: kvRoto }));
    expect(await r.json()).toMatchObject({ id: null, ficha: { retrato: { tipo: "galeria" } } });
  });

  it("el CV no aparece en ningún log", async () => {
    const espias = [vi.spyOn(console, "log"), vi.spyOn(console, "error"), vi.spyOn(console, "warn")];
    const { ia } = iaFalsa({ texto: new Error("caído") });
    await crearFicha(peticion(), deps({ ia }));
    const todo = espias.flatMap((s) => s.mock.calls.flat()).map(String).join("\n");
    expect(todo).toContain('"evento":"ficha"');
    expect(todo).not.toMatch(/Zarandaja|Ferrándiz|Spring Boot/);
  });
});

describe("crearFicha: validación", () => {
  it("400 con texto corto, largo o enums inválidos; 422 con menos de 3 términos", async () => {
    const d = deps({ ia: null });
    expect((await crearFicha(peticion(nuevaIp(), { texto: "corto", raza: "elfo", aspecto: "sorpresa" }), d)).status).toBe(400);
    expect((await crearFicha(peticion(nuevaIp(), { texto: "Java ".repeat(2500), raza: "elfo", aspecto: "sorpresa" }), d)).status).toBe(400);
    expect((await crearFicha(peticion(nuevaIp(), { texto: javaSenior, raza: "dragón", aspecto: "sorpresa" }), d)).status).toBe(400);
    const sinTecnologias = "Me gusta pasear por el campo y leer novelas de aventuras. ".repeat(5);
    expect((await crearFicha(peticion(nuevaIp(), { texto: sinTecnologias, raza: "elfo", aspecto: "sorpresa" }), d)).status).toBe(422);
  });
});
