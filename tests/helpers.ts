import type { IA } from "../src/ia/workersai";

type Resp<T> = T | Error | (() => Promise<T>);
const resolver = async <T>(r: Resp<T>): Promise<T> => {
  if (r instanceof Error) throw r;
  return typeof r === "function" ? (r as () => Promise<T>)() : r;
};

export function iaFalsa(o: { texto?: Resp<unknown>; imagen?: Resp<Uint8Array>; guardia?: Resp<boolean> } = {}) {
  const llamadas = { texto: 0, imagen: 0, guardia: 0, prompts: [] as unknown[], imagenes: [] as string[] };
  const ia: IA = {
    async texto(mensajes) {
      llamadas.texto++;
      llamadas.prompts.push(mensajes);
      return resolver(o.texto ?? null);
    },
    async imagen(prompt) {
      llamadas.imagen++;
      llamadas.imagenes.push(prompt);
      return resolver(o.imagen ?? new Uint8Array([0xff, 0xd8, 0xff]));
    },
    async guardia() {
      llamadas.guardia++;
      return resolver(o.guardia ?? true);
    },
  };
  return { ia, llamadas };
}

// Respuesta válida para un perfil: un efecto por nombre
export const narrativaPara = (nombres: string[], extra: Record<string, unknown> = {}) => ({
  trasfondo: "Una leyenda que empezó en un sótano lleno de servidores.",
  defecto: "Pide perdón al compilador.",
  efectos: nombres.map((nombre) => ({ nombre, efecto: `${nombre} ilumina la mazmorra.` })),
  ...extra,
});
