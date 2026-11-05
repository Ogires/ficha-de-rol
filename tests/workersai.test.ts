import { describe, expect, it } from "vitest";
import { crearIADesde, esSeguro, extraerJson, TIEMPOS } from "../src/ia/workersai";

const MODELOS = { texto: "m-texto", respaldo: "m-respaldo", imagen: "m-imagen", guardia: "m-guardia" };

describe("extraerJson", () => {
  it("entiende response como objeto o string, choices y output_text, con o sin ```json", () => {
    expect(extraerJson({ response: { a: 1 } })).toEqual({ a: 1 });
    expect(extraerJson({ response: '{"a":1}' })).toEqual({ a: 1 });
    expect(extraerJson({ choices: [{ message: { content: '```json\n{"a":1}\n```' } }] })).toEqual({ a: 1 });
    expect(extraerJson({ output: [{ content: [{ type: "output_text", text: '{"a":1}' }] }] })).toEqual({ a: 1 });
    expect(extraerJson({ response: "no es json" })).toBeNull();
  });
  it("formas reales de la Tarea 0A: gpt-oss sin response y qwen con saltos de línea delante", () => {
    expect(extraerJson({ choices: [{ message: { content: '{"a":1}', reasoning_content: "pienso" } }] })).toEqual({ a: 1 });
    expect(extraerJson({ response: null, choices: [{ message: { content: '\n\n{"a":1}' } }] })).toEqual({ a: 1 });
  });
});

describe("esSeguro", () => {
  it("acepta safe y rechaza unsafe, formas raras y errores (falla cerrado)", () => {
    expect(esSeguro({ response: "safe" })).toBe(true);
    expect(esSeguro({ response: { safe: true, categories: [] } })).toBe(true);
    expect(esSeguro({ response: "unsafe\nS10" })).toBe(false);
    expect(esSeguro({ response: { safe: false } })).toBe(false);
    expect(esSeguro({})).toBe(false);
  });
  it("forma real de Llama Guard 3: con saltos de línea delante", () => {
    expect(esSeguro({ response: "\n\nsafe" })).toBe(true);
    expect(esSeguro({ response: "\n\nunsafe\nS1" })).toBe(false);
  });
});

describe("crearIADesde", () => {
  it("texto: si el modelo principal da error, prueba el de respaldo", async () => {
    const llamados: string[] = [];
    const ia = crearIADesde(async (modelo) => {
      llamados.push(modelo);
      if (modelo === "m-texto") throw new Error("caído");
      return { response: { ok: true } };
    }, MODELOS);
    expect(await ia.texto([{ role: "user", content: "hola" }], {})).toEqual({ ok: true });
    expect(llamados).toEqual(["m-texto", "m-respaldo"]);
  });
  it("texto: razonamiento bajo en gpt-oss y /no_think al final del sistema en qwen", async () => {
    const entradas: Record<string, any> = {};
    const GPT = "@cf/openai/gpt-oss-20b", QWEN = "@cf/qwen/qwen3-30b-a3b-fp8";
    const ia = crearIADesde(async (modelo, entrada) => {
      entradas[modelo] = entrada;
      if (modelo === GPT) throw new Error("caído");
      return { response: { ok: true } };
    }, { ...MODELOS, texto: GPT, respaldo: QWEN });
    const mensajes = [{ role: "system" as const, content: "Reglas" }, { role: "user" as const, content: "hola" }];
    await ia.texto(mensajes, {});
    expect(entradas[GPT]).toMatchObject({ reasoning_effort: "low", messages: mensajes });
    expect(entradas[QWEN].messages).toEqual([{ role: "system", content: "Reglas /no_think" }, { role: "user", content: "hola" }]);
    expect(entradas[QWEN]).not.toHaveProperty("reasoning_effort");
    expect(mensajes[0].content).toBe("Reglas"); // no muta los mensajes originales
  });
  it("plazos medidos: principal 6 s, respaldo 4 s, guardia 12 s con una llamada de cobertura a los 4 s", () => {
    expect(TIEMPOS).toEqual({ texto: 6_000, respaldo: 4_000, imagen: 15_000, guardia: 12_000, cobertura: 4_000 });
  });
  it("texto: si el principal se cuelga, prueba el respaldo con su propio plazo", async () => {
    const llamados: string[] = [];
    const ia = crearIADesde((modelo) => {
      llamados.push(modelo);
      return modelo === "m-texto" ? new Promise(() => {}) : Promise.resolve({ response: { ok: true } });
    }, MODELOS, { texto: 20, respaldo: 200, imagen: 20, guardia: 20, cobertura: 10 });
    expect(await ia.texto([], {})).toEqual({ ok: true });
    expect(llamados).toEqual(["m-texto", "m-respaldo"]);
  });
  it("texto: corta si ninguno de los dos responde a tiempo", async () => {
    const ia = crearIADesde(() => new Promise(() => {}), MODELOS, { texto: 20, respaldo: 20, imagen: 20, guardia: 20, cobertura: 10 });
    await expect(ia.texto([], {})).rejects.toThrow(/timeout:texto/);
  });
  it("guardia: si no responde a tiempo, falla", async () => {
    const ia = crearIADesde(() => new Promise(() => {}), MODELOS, { texto: 20, respaldo: 20, imagen: 20, guardia: 20, cobertura: 10 });
    await expect(ia.guardia("x")).rejects.toThrow(/timeout:guardia/);
  });
  it("guardia: si la primera llamada tarda, lanza otra igual y vale la primera que conteste", async () => {
    // Latencia de Llama Guard en producción el 2026-11-05: 0,2 s, 10,2 s y 5,1 s seguidas
    let llamadas = 0;
    const ia = crearIADesde(() => (++llamadas === 1 ? new Promise(() => {}) : Promise.resolve({ response: "\n\nsafe" })), MODELOS,
      { texto: 20, respaldo: 20, imagen: 20, guardia: 200, cobertura: 20 });
    expect(await ia.guardia("x")).toBe(true);
    expect(llamadas).toBe(2);
  });
  it("guardia: si la primera contesta antes de la cobertura, no hay segunda llamada", async () => {
    let llamadas = 0;
    const ia = crearIADesde(async () => (llamadas++, { response: "\n\nsafe" }), MODELOS,
      { texto: 20, respaldo: 20, imagen: 20, guardia: 200, cobertura: 20 });
    expect(await ia.guardia("x")).toBe(true);
    await new Promise((r) => setTimeout(r, 60));
    expect(llamadas).toBe(1);
  });
  it("guardia: si la primera da error, falla enseguida y sin segunda llamada (falla cerrado)", async () => {
    let llamadas = 0;
    const ia = crearIADesde(() => (llamadas++, Promise.reject(new Error("4006"))), MODELOS,
      { texto: 20, respaldo: 20, imagen: 20, guardia: 5_000, cobertura: 2_000 });
    const t0 = Date.now();
    await expect(ia.guardia("x")).rejects.toThrow();
    expect(Date.now() - t0).toBeLessThan(500);
    expect(llamadas).toBe(1);
  });
  it("guardia: un «unsafe» que llega primero gana, aunque la otra llamada fuera a decir «safe»", async () => {
    let llamadas = 0;
    const ia = crearIADesde(() => (++llamadas === 1 ? new Promise(() => {}) : Promise.resolve({ response: "\n\nunsafe\nS1" })), MODELOS,
      { texto: 20, respaldo: 20, imagen: 20, guardia: 200, cobertura: 20 });
    expect(await ia.guardia("x")).toBe(false);
  });
  it("imagen: decodifica el base64 a bytes", async () => {
    const ia = crearIADesde(async () => ({ image: btoa("JPEG") }), MODELOS);
    expect(new TextDecoder().decode(await ia.imagen("p"))).toBe("JPEG");
  });
  it("guardia: manda el texto como respuesta del asistente", async () => {
    let entrada: any;
    const ia = crearIADesde(async (_m, e) => ((entrada = e), { response: "safe" }), MODELOS);
    expect(await ia.guardia("texto a revisar")).toBe(true);
    expect(entrada.messages.at(-1)).toEqual({ role: "assistant", content: "texto a revisar" });
  });
});
