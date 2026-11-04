// src/http/util.ts — utilidades HTTP compartidas
export function json(datos: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(datos, { status, headers: { "cache-control": "no-store", ...extra } });
}

// 12.000 caracteres en UTF-8 (hasta 3 bytes) + escapes JSON + raza y aspecto
const MAX_CUERPO = 48_000;

// A05: JSON con tamaño máximo y forma (objeto plano) validada a mano
export async function leerJson(request: Request): Promise<Record<string, unknown> | null> {
  const declarado = Number(request.headers.get("content-length") ?? "0");
  if (declarado > MAX_CUERPO) return null;
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) return null;
  try {
    const v = JSON.parse(texto);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// CSRF: application/json obliga al preflight de CORS, que nadie aprueba, y Origin y Sec-Fetch-Site
// delatan a las demás webs (también a los otros subdominios de webninja.fyi)
export function rechazoCsrf(request: Request): Response | null {
  const tipo = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (tipo !== "application/json") return json({ error: "tipo" }, 415);
  const origen = request.headers.get("origin");
  const sitio = request.headers.get("sec-fetch-site");
  if ((origen && origen !== new URL(request.url).origin) || (sitio && sitio !== "same-origin" && sitio !== "none")) {
    return json({ error: "origen" }, 403);
  }
  return null;
}

// IPv6: un cliente suele tener un /64 entero; contar por dirección permitiría saltarse los límites
export function claveIp(ip: string): string {
  const mapeada = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapeada) return mapeada[1];
  if (!ip.includes(":")) return ip;
  const [cabeza, cola] = ip.toLowerCase().split("::");
  const a = cabeza ? cabeza.split(":") : [];
  const b = cola ? cola.split(":") : [];
  const grupos = [...a, ...Array<string>(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b];
  return `${grupos.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(":")}::/64`;
}

export const claveCliente = (request: Request) => claveIp(request.headers.get("cf-connecting-ip") ?? "0.0.0.0");

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

// 12 caracteres de 57 símbolos ≈ 70 bits: no se adivina y es corto para LinkedIn
export function idPublico(): string {
  return [...crypto.getRandomValues(new Uint8Array(12))].map((b) => ALFABETO[b % ALFABETO.length]).join("");
}

export function nonce(): string {
  return [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(texto: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
