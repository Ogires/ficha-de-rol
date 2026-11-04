import type { Aspecto, Clase, Raza } from "./tipos";

// Estilo fijo antepuesto a todos los retratos: coherencia visual y la cara centrada para el recorte
// 1,91:1 de la vista previa de LinkedIn. Flux pintaba firmas falsas con solo «no text»
export const ESTILO =
  "Painted fantasy character portrait, head and shoulders, face centered, looking at the viewer, warm dramatic lighting, plain dark background, detailed digital painting, no text, no letters, no signature, no watermark";

const RAZA_EN: Record<Raza, string> = { humano: "human", elfo: "elf", enano: "dwarf", orco: "orc", mediano: "halfling", gnomo: "gnome" };
const CLASE_EN: Record<Clase, string> = { guerrero: "warrior", picaro: "rogue", paladin: "paladin", mago: "wizard", explorador: "ranger", bardo: "bard" };

// El CV nunca llega aquí: solo enums y un icono del catálogo (texto nuestro).
// El género es siempre el de la clase («Maga» → retrato femenino); con «sorpresa» lo decide el dado
// y el personaje lleva yelmo o capucha
export function promptRetrato(clase: Clase, raza: Raza, aspecto: Aspecto, genero: "f" | "m", icono: string): string {
  const quien = `${genero === "f" ? "female" : "male"} ${RAZA_EN[raza]} ${CLASE_EN[clase]}`;
  const capucha = aspecto === "sorpresa" ? " wearing a hood or helmet" : "";
  return `${ESTILO}. A ${quien}${capucha} holding ${icono}.`;
}

// Galería de respaldo: una versión femenina y otra masculina por clase y raza (72 retratos)
export const rutaGaleria = (clase: Clase, raza: Raza, genero: "f" | "m") => `/galeria/${clase}-${raza}-${genero}.jpg`;
