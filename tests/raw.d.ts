// Vite importa ficheros como texto con ?raw (fichero sin import: declaración ambiental)
declare module "*?raw" {
  const contenido: string;
  export default contenido;
}
