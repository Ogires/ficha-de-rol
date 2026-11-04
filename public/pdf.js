// Extrae el texto de un PDF en el navegador: el archivo nunca sale del equipo
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PAGINAS = 6;

export async function textoDePdf(archivo) {
  if (archivo.size > MAX_BYTES) throw new Error("El PDF pesa más de 5 MB");
  const pdfjs = await import("/vendor/pdfjs/pdf.min.mjs"); // se descarga solo si eliges un PDF
  pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await archivo.arrayBuffer(), isEvalSupported: false }).promise; // sin eval: CSP
  let texto = "";
  for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGINAS); i++) {
    const contenido = await (await doc.getPage(i)).getTextContent();
    for (const item of contenido.items) texto += (item.str ?? "") + (item.hasEOL ? "\n" : " ");
    texto += "\n";
  }
  return texto.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
