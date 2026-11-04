import type { Env } from "./env";
import { conCabeceras } from "./http/cabeceras";
import { json } from "./http/util";
import { crearFicha, depsDesdeEnv, fichaPublica, paginaFicha, retratoPropio } from "./handlers/ficha";
export { Contador } from "./contadores/contador";

type Ruta = (request: Request, env: Env, param: string) => Promise<Response> | Response;

const RUTAS: { patron: RegExp; metodos: Record<string, Ruta> }[] = [
  { patron: /^\/api\/ficha$/, metodos: { POST: (r, e) => crearFicha(r, depsDesdeEnv(e)) } },
  { patron: /^\/api\/ficha\/([^/]+)$/, metodos: { GET: (_r, e, id) => fichaPublica(id, e) } },
  { patron: /^\/f\/([^/]+)\/retrato\.jpg$/, metodos: { GET: (_r, e, id) => retratoPropio(id, e) } },
  { patron: /^\/f\/([^/]+)$/, metodos: { GET: (r, e, id) => paginaFicha(r, id, e) } },
];

function decodificar(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return ""; // percent-encoding roto: no casa con ningún id → 404
  }
}

async function enrutar(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  for (const { patron, metodos } of RUTAS) {
    const m = patron.exec(url.pathname);
    if (!m) continue;
    const manejador = metodos[request.method];
    if (!manejador) return json({ error: "metodo" }, 405, { allow: Object.keys(metodos).join(", ") });
    return manejador(request, env, decodificar(m[1] ?? ""));
  }
  return env.ASSETS.fetch(request); // estáticos (run_worker_first)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return conCabeceras(await enrutar(request, env));
    } catch (err) {
      // A10: KV o DO caídos → mensaje con gracia, nunca un stack (ni el cuerpo de la petición)
      console.error(JSON.stringify({ evento: "error_no_controlado", mensaje: String(err).slice(0, 200) }));
      return conCabeceras(json({ error: "mantenimiento", mensaje: "El oráculo está afilando los dados. Vuelve en un rato" }, 503));
    }
  },
} satisfies ExportedHandler<Env>;
