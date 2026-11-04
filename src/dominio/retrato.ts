import type { Aspecto, Clase, Raza } from "./tipos";

// Estilo fijo antepuesto a todos los retratos: coherencia visual y la cara centrada para el recorte
// 1,91:1 de la vista previa de LinkedIn
export const ESTILO =
  "Painted fantasy character portrait, head and shoulders, face centered, looking at the viewer, warm dramatic lighting, plain dark background, detailed digital painting, no text, no letters";

const RAZA_EN: Record<Raza, string> = { humano: "human", elfo: "elf", enano: "dwarf", orco: "orc", mediano: "halfling", gnomo: "gnome" };
const CLASE_EN: Record<Clase, string> = { guerrero: "warrior", picaro: "rogue", paladin: "paladin", mago: "wizard", explorador: "ranger", bardo: "bard" };

// El CV nunca llega aquí: solo enums y un icono del catálogo (texto nuestro)
export function promptRetrato(clase: Clase, raza: Raza, aspecto: Aspecto, icono: string): string {
  const quien = `${RAZA_EN[raza]} ${CLASE_EN[clase]}`;
  if (aspecto === "sorpresa") return `${ESTILO}. A ${quien} wearing a hood or helmet that hides most of the face, holding ${icono}.`;
  return `${ESTILO}. A ${aspecto === "femenino" ? "female" : "male"} ${quien} holding ${icono}.`;
}

export const rutaGaleria = (clase: Clase, raza: Raza) => `/galeria/${clase}-${raza}.jpg`;
