// scripts/vendor-pdfjs.mjs — copia pdf.js y la fuente Cinzel a public/ (sin CDN: CSP estricta)
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor/pdfjs", { recursive: true });
for (const f of ["pdf.min.mjs", "pdf.worker.min.mjs"]) copyFileSync(`node_modules/pdfjs-dist/build/${f}`, `public/vendor/pdfjs/${f}`);
console.log("pdf.js copiado a public/vendor/pdfjs/");

mkdirSync("public/fuentes", { recursive: true });
for (const peso of [400, 700]) {
  const f = `cinzel-latin-${peso}-normal.woff2`;
  copyFileSync(`node_modules/@fontsource/cinzel/files/${f}`, `public/fuentes/${f}`);
}
console.log("Cinzel copiada a public/fuentes/");
