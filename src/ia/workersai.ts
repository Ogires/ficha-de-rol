import type { Env } from "../env";
import type { Mensaje } from "../dominio/prompt";

export interface IA {
  texto(mensajes: Mensaje[], esquema: object): Promise<unknown>;
  imagen(prompt: string): Promise<Uint8Array>;
  guardia(texto: string): Promise<boolean>; // true = seguro
}

type Ejecutar = (modelo: string, entrada: Record<string, unknown>) => Promise<unknown>;
interface Modelos { texto: string; respaldo: string; imagen: string; guardia: string }
interface Tiempos { texto: number; respaldo: number; imagen: number; guardia: number; cobertura: number }
// El principal tiene su plazo y el respaldo el suyo, para que un principal colgado no deje la ficha sin
// probar el respaldo. La guardia tardó hasta 6,5 s en la 0B y 0,2 s, 10,2 s y 5,1 s seguidas en producción
// el 2026-11-05: si a los 4 s (cobertura) no ha contestado, se lanza otra llamada igual
export const TIEMPOS: Tiempos = { texto: 6_000, respaldo: 4_000, imagen: 15_000, guardia: 12_000, cobertura: 4_000 };

// Ajustes propios de cada modelo, medidos en la Tarea 0A. Un modelo sin entrada funciona sin ajustes
interface ConfigModelo { params?: Record<string, unknown>; sufijoSistema?: string }
export const CONFIG_TEXTO: Record<string, ConfigModelo> = {
  // `reasoning: { effort }` se ignora; `reasoning_effort` sí baja el razonamiento
  "@cf/openai/gpt-oss-20b": { params: { reasoning_effort: "low" } },
  // `chat_template_kwargs.enable_thinking: false` deja la salida vacía; `/no_think` en el sistema funciona
  "@cf/qwen/qwen3-30b-a3b-fp8": { sufijoSistema: " /no_think" },
};

export function entradaTexto(modelo: string, mensajes: Mensaje[], esquema: object): Record<string, unknown> {
  const { params = {}, sufijoSistema = "" } = CONFIG_TEXTO[modelo] ?? {};
  const messages = mensajes.map((m) => (m.role === "system" && sufijoSistema ? { ...m, content: m.content + sufijoSistema } : m));
  return { messages, response_format: { type: "json_schema", json_schema: esquema }, max_tokens: 900, ...params };
}

export function conTimeout<T>(p: Promise<T>, ms: number, etiqueta: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  const limite = new Promise<never>((_, rechazar) => {
    t = setTimeout(() => rechazar(new Error(`timeout:${etiqueta}`)), ms);
  });
  return Promise.race([p, limite]).finally(() => clearTimeout(t));
}

export function extraerJson(salida: unknown): unknown {
  const o = salida as any;
  const v =
    o?.response ??
    o?.choices?.[0]?.message?.content ??
    (Array.isArray(o?.output) ? o.output.flatMap((x: any) => x?.content ?? []).find((c: any) => c?.type === "output_text")?.text : undefined);
  if (typeof v === "string") {
    const limpio = v.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").replace(/^<think>[\s\S]*?<\/think>\s*/, "");
    try {
      return JSON.parse(limpio);
    } catch {
      return null;
    }
  }
  return v && typeof v === "object" ? v : null;
}

// Falla cerrado: cualquier forma desconocida cuenta como no segura
export function esSeguro(salida: unknown): boolean {
  const r = (salida as any)?.response ?? salida;
  if (r && typeof r === "object" && typeof r.safe === "boolean") return r.safe;
  if (typeof r === "string") {
    const s = r.trim().toLowerCase();
    if (s.startsWith("{")) {
      try {
        return esSeguro(JSON.parse(s));
      } catch {
        return false;
      }
    }
    return s === "safe" || s.startsWith("safe\n") || s.startsWith("safe ");
  }
  return false;
}

function base64ABytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function crearIADesde(ejecutar: Ejecutar, modelos: Modelos, tiempos: Tiempos = TIEMPOS): IA {
  return {
    texto(mensajes, esquema) {
      const llamar = (modelo: string) => ejecutar(modelo, entradaTexto(modelo, mensajes, esquema)).then(extraerJson);
      // si el principal falla o tarda más de su plazo, el respaldo tiene el suyo: como mucho 10 s en total
      return conTimeout(llamar(modelos.texto), tiempos.texto, "texto").catch(() =>
        conTimeout(llamar(modelos.respaldo), tiempos.respaldo, "texto"));
    },
    async imagen(prompt) {
      const r = (await conTimeout(ejecutar(modelos.imagen, { prompt, steps: 4 }), tiempos.imagen, "imagen")) as { image?: unknown };
      if (typeof r?.image !== "string") throw new Error("imagen sin datos");
      return base64ABytes(r.image);
    },
    async guardia(texto) {
      const mensajes = [
        { role: "user", content: "Escribe la ficha de rol de mi personaje." },
        { role: "assistant", content: texto },
      ];
      const llamar = () => ejecutar(modelos.guardia, { messages: mensajes });
      // Cobertura: vale la primera respuesta de las dos llamadas, dentro del mismo plazo total.
      // Si la primera da error, falla enseguida (falla cerrado) y no se lanza la segunda
      let espera: ReturnType<typeof setTimeout> | null = null;
      const primera = llamar();
      const segunda = new Promise<unknown>((resolver, rechazar) => {
        espera = setTimeout(() => llamar().then(resolver, rechazar), tiempos.cobertura);
        primera.catch(rechazar);
      });
      try {
        return esSeguro(await conTimeout(Promise.race([primera, segunda]), tiempos.guardia, "guardia"));
      } finally {
        if (espera) clearTimeout(espera);
      }
    },
  };
}

export function crearIA(env: Env): IA | null {
  const ai = env.AI;
  if (!ai) return null;
  return crearIADesde((modelo, entrada) => ai.run(modelo as Parameters<Ai["run"]>[0], entrada as never) as Promise<unknown>, {
    texto: env.MODELO_TEXTO,
    respaldo: env.MODELO_TEXTO_RESPALDO,
    imagen: env.MODELO_IMAGEN,
    guardia: env.MODELO_GUARDIA,
  });
}
