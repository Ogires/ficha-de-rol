import type { Env } from "../env";
import { ASPECTOS, RAZAS, type Aspecto, type Ficha, type Raza } from "../dominio/tipos";
import { calcularPerfil } from "../dominio/perfil";
import { rutaGaleria } from "../dominio/retrato";
import { generar } from "../generar";
import { crearIA, type IA } from "../ia/workersai";
import { bytesGuardados, claveDiaria, consumirIp, reservarNeuronas, sumarBytes } from "../contadores/uso";
import { claveCliente, idPublico, json, leerJson, nonce, rechazoCsrf } from "../http/util";

export const MIN_CV = 200;
export const MAX_CV = 12_000;
export const ES_ID = /^[A-Za-z0-9]{12}$/;

export interface DepsFicha {
  kv: KVNamespace;
  ia: IA | null;
  limites: { iaPorIp: number; fichasPorIp: number; cuotaNeuronas: number; reserva: number; topeBytes: number };
  claveDiaria: (ip: string) => Promise<string>;
  consumirIp: (clave: string, tipo: "total" | "ia", limite: number) => Promise<boolean>;
  reservarNeuronas: (n: number, cupo: number) => Promise<boolean>;
  bytesGuardados: () => Promise<number>;
  sumarBytes: (n: number) => Promise<unknown>;
  ahora: () => Date;
  id: () => string;
  nonce: () => string;
  log: (datos: Record<string, unknown>) => void;
}

export function depsDesdeEnv(env: Env): DepsFicha {
  return {
    kv: env.KV,
    ia: crearIA(env),
    limites: {
      iaPorIp: Number(env.TOPE_IA_IP_DIA),
      fichasPorIp: Number(env.TOPE_FICHAS_IP_DIA),
      cuotaNeuronas: Number(env.CUOTA_NEURONAS_DIA),
      reserva: Number(env.RESERVA_NEURONAS),
      topeBytes: Number(env.TOPE_BYTES_KV),
    },
    claveDiaria: (ip) => claveDiaria(env, ip),
    consumirIp: (clave, tipo, limite) => consumirIp(env, clave, tipo, limite),
    reservarNeuronas: (n, cupo) => reservarNeuronas(env, n, cupo),
    bytesGuardados: () => bytesGuardados(env),
    sumarBytes: (n) => sumarBytes(env, n),
    ahora: () => new Date(),
    id: idPublico,
    nonce,
    log: (datos) => console.log(JSON.stringify(datos)),
  };
}

export async function crearFicha(request: Request, d: DepsFicha): Promise<Response> {
  const csrf = rechazoCsrf(request);
  if (csrf) return csrf;

  const b = await leerJson(request);
  const texto = typeof b?.texto === "string" ? b.texto.trim() : "";
  const raza = b?.raza as Raza;
  const aspecto = b?.aspecto as Aspecto;
  if (texto.length < MIN_CV || texto.length > MAX_CV || !RAZAS.includes(raza) || !ASPECTOS.includes(aspecto)) {
    return json({ error: "entrada", mensaje: "Pega entre 200 y 12.000 caracteres y elige raza y aspecto" }, 400);
  }

  // Las reglas van antes que los contadores: un texto que no es un CV no gasta cupo ni IA
  const perfil = calcularPerfil(texto, aspecto, d.ahora());
  if (!perfil) return json({ error: "pocos_terminos", mensaje: "No encuentro tecnologías en el texto. ¿Seguro que es un CV?" }, 422);

  const clave = await d.claveDiaria(claveCliente(request));
  if (!(await d.consumirIp(clave, "total", d.limites.fichasPorIp))) {
    return json({ error: "tope", mensaje: "Has tirado demasiados dados por hoy. Vuelve mañana" }, 429, { "retry-after": "3600" });
  }
  const iaIp = d.ia !== null && (await d.consumirIp(clave, "ia", d.limites.iaPorIp));
  const neuronas = iaIp && (await d.reservarNeuronas(d.limites.reserva, d.limites.cuotaNeuronas));
  const hueco = neuronas && (await d.bytesGuardados()) < d.limites.topeBytes;

  const g = await generar(texto, perfil, raza, aspecto, { ia: d.ia, iaTexto: neuronas, iaImagen: hueco, nonce: d.nonce() });
  if (d.ia && !iaIp) g.fallos.push("tope_ia_ip");

  const id = d.id();
  const galeria = { tipo: "galeria" as const, ruta: rutaGaleria(perfil.claseBase, raza, perfil.genero) };
  let ficha: Ficha = {
    v: 1, id, creada: d.ahora().toISOString(),
    clase: perfil.clase, claseBase: perfil.claseBase, nivel: perfil.nivel, atributos: perfil.atributos,
    hechizos: g.narrativa.efectos.filter((e) => perfil.hechizos.includes(e.nombre)),
    objetos: g.narrativa.efectos.filter((e) => perfil.objetos.includes(e.nombre)),
    trasfondo: g.narrativa.trasfondo, defecto: g.narrativa.defecto,
    raza, aspecto, origen: g.origen,
    retrato: g.retrato ? { tipo: "propio" } : galeria,
  };

  let guardada = true;
  try {
    if (g.retrato) await d.kv.put(`r:${id}`, g.retrato);
    await d.kv.put(`f:${id}`, JSON.stringify(ficha));
  } catch {
    guardada = false;
    g.fallos.push("kv");
    ficha = { ...ficha, retrato: galeria }; // el retrato propio no se pudo guardar: no hay URL que servir
  }
  if (guardada) await d.sumarBytes(JSON.stringify(ficha).length + (g.retrato?.byteLength ?? 0)).catch(() => {});

  // Ni el CV ni la IP: solo longitud y resultado
  d.log({ evento: "ficha", longitud: texto.length, origen: g.origen, retrato: ficha.retrato.tipo, fallos: g.fallos, guardada });
  return json({ id: guardada ? id : null, ficha });
}

export async function leerFicha(kv: KVNamespace, id: string): Promise<Ficha | null> {
  return ES_ID.test(id) ? kv.get<Ficha>(`f:${id}`, "json") : null;
}

export async function fichaPublica(id: string, env: Env): Promise<Response> {
  const f = await leerFicha(env.KV, id);
  if (!f) return json({ error: "no_existe", mensaje: "Esta ficha no consta en el gremio" }, 404, { "x-robots-tag": "noindex" });
  return json(f, 200, { "cache-control": "public, max-age=3600", "x-robots-tag": "noindex" }); // inmutable
}
