// LLM02: datos de contacto fuera antes de que el CV llegue al modelo
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu;
const URL_ = /(?:https?:\/\/|www\.)\S+/giu;
// Dominios sueltos solo en minúsculas y sin letra detrás: «ASP.NET», «Socket.io» o «trabajos.España» no son enlaces
const DOMINIO = /(?<![\p{L}\p{N}@])[\p{Ll}\p{N}-]+\.(?:com|es|net|org|io|dev|fyi|me|app|eu|cat)(?![\p{L}\p{N}])(?:\/\S*)?/gu;
// 9-12 dígitos con separadores sueltos; un rango «2016 - 2018» no casa (son 8 dígitos)
const TELEFONO = /(?:\+\d{1,3}[\s.-]?)?(?:\d[\s.-]?){8,11}\d/g;
const DELIMITADOR = /<\/?\s*cv-[^>]*>/gi;

export function sanear(texto: string): string {
  return texto
    .replace(DELIMITADOR, " ")
    .replace(EMAIL, "[contacto]")
    .replace(URL_, "[enlace]")
    .replace(DOMINIO, "[enlace]")
    .replace(TELEFONO, "[contacto]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
