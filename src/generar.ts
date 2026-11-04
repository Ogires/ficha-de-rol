import { campoManual, efectoManual, textoManual } from "./dominio/banco";
import { construirPrompt, EJEMPLO_TONO, ESQUEMA } from "./dominio/prompt";
import { promptRetrato } from "./dominio/retrato";
import { ngramas, palabrasPropias, primeraCopia, primeraPropia, validarSalida } from "./dominio/validacion";
import type { Aspecto, Narrativa, Perfil, Raza } from "./dominio/tipos";
import type { IA } from "./ia/workersai";

export interface DepsGenerar { ia: IA | null; iaTexto: boolean; iaImagen: boolean; nonce: string }
export interface Generado { narrativa: Narrativa; origen: "ia" | "manual"; retrato: Uint8Array | null; fallos: string[] }

export async function generar(cv: string, p: Perfil, raza: Raza, aspecto: Aspecto, d: DepsGenerar): Promise<Generado> {
  const fallos: string[] = [];
  const nombres = [...p.hechizos, ...p.objetos];
  const manual = () => ({ narrativa: textoManual(p), origen: "manual" as const });

  async function narrativa(): Promise<{ narrativa: Narrativa; origen: "ia" | "manual" }> {
    if (!d.ia) return fallos.push("sin_ia"), manual();
    if (!d.iaTexto) return fallos.push("texto_sin_cupo"), manual();
    try {
      const v = validarSalida(await d.ia.texto(construirPrompt(p, cv, d.nonce), ESQUEMA), nombres);
      if (!v) return fallos.push("texto_invalido"), manual();
      // LLM02: un campo con una palabra propia del CV, o que copia 6 palabras seguidas del CV o del
      // ejemplo de tono, sale del banco; el resto se queda
      const propias = palabrasPropias(cv);
      const copiables = new Set([...ngramas(cv), ...ngramas(JSON.stringify(EJEMPLO_TONO))]);
      const limpio = (texto: string, campo: string, sustituto: () => string) => {
        if (primeraPropia(texto, propias)) return fallos.push(`propia_${campo}`), sustituto();
        if (primeraCopia(texto, copiables)) return fallos.push(`copia_${campo}`), sustituto();
        return texto;
      };
      const n: Narrativa = {
        trasfondo: limpio(v.trasfondo, "trasfondo", () => campoManual(p, "trasfondo")),
        defecto: limpio(v.defecto, "defecto", () => campoManual(p, "defecto")),
        efectos: v.efectos.map((e, i) => ({ nombre: e.nombre, efecto: limpio(e.efecto, "efecto", () => efectoManual(p, e.nombre, i)) })),
      };
      const seguro = await d.ia.guardia([n.trasfondo, n.defecto, ...n.efectos.map((e) => e.efecto)].join("\n"));
      if (!seguro) return fallos.push("guardia"), manual();
      return { narrativa: n, origen: "ia" };
    } catch (e) {
      fallos.push(String(e).includes("timeout") ? "texto_timeout" : "texto_error");
      return manual();
    }
  }

  async function retrato(): Promise<Uint8Array | null> {
    if (!d.ia) return null; // "sin_ia" ya lo apunta la narrativa
    if (!d.iaImagen) return fallos.push("imagen_sin_cupo"), null;
    try {
      return await d.ia.imagen(promptRetrato(p.claseBase, raza, aspecto, p.genero, p.icono));
    } catch {
      fallos.push("imagen_error");
      return null;
    }
  }

  const [t, r] = await Promise.all([narrativa(), retrato()]);
  return { ...t, retrato: r, fallos };
}
