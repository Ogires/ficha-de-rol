export const ATRIBUTOS = ["FUE", "DES", "CON", "INT", "SAB", "CAR"] as const;
export type Atributo = (typeof ATRIBUTOS)[number];
// Mismo orden que ATRIBUTOS: desempata la clase cuando todo lo demás empata
export const CLASES = ["guerrero", "picaro", "paladin", "mago", "explorador", "bardo"] as const;
export type Clase = (typeof CLASES)[number];
export const RAZAS = ["humano", "elfo", "enano", "orco", "mediano", "gnomo"] as const;
export type Raza = (typeof RAZAS)[number];
export const ASPECTOS = ["femenino", "masculino", "sorpresa"] as const;
export type Aspecto = (typeof ASPECTOS)[number];
export type TipoTermino = "hechizo" | "objeto" | "senal";

export const CLASE_DE: Record<Atributo, Clase> = { FUE: "guerrero", DES: "picaro", CON: "paladin", INT: "mago", SAB: "explorador", CAR: "bardo" };

export const NOMBRE_CLASE: Record<Clase, { m: string; f: string }> = {
  guerrero: { m: "Guerrero", f: "Guerrera" },
  picaro: { m: "Pícaro", f: "Pícara" },
  paladin: { m: "Paladín", f: "Paladina" },
  mago: { m: "Mago", f: "Maga" },
  explorador: { m: "Explorador", f: "Exploradora" },
  bardo: { m: "Bardo", f: "Barda" },
};

// En inglés: van al prompt de Flux
export const OBJETO_CLASE: Record<Clase, string> = {
  guerrero: "a longsword", picaro: "twin daggers", paladin: "a tower shield",
  mago: "a wooden staff", explorador: "a longbow", bardo: "a lute",
};

export interface Termino {
  id: string;            // kebab-case único
  nombre: string;        // como se muestra: "ASP.NET", "mentoría"
  patron: string;        // fuente de la regex; un espacio literal = uno o más espacios
  exacto?: boolean;      // true → distingue mayúsculas (C, Go)
  atributo: Atributo;
  tipo: TipoTermino;
  epiteto: string;       // "de .NET", "de la Mentoría"
  icono?: string;        // en inglés, para el retrato: "a staff with a coiled snake"
  ejemplos: string[];    // frases que deben casar SOLO con este término
}

export interface Detectado { termino: Termino; menciones: number }

export interface Perfil {
  detectados: Detectado[];                 // menciones desc; a igualdad, orden del catálogo
  anios: number;
  nivel: { valor: number; motivo: string };
  atributos: Record<Atributo, { valor: number; motivos: string[] }>;
  claseBase: Clase;
  clase: string;                           // "Paladín de .NET"
  genero: "f" | "m";
  principal: Termino;                      // el que da el epíteto
  hechizos: string[];                      // ≤5 nombres
  objetos: string[];                       // ≤3 nombres
  icono: string;
  hash: number;                            // del texto normalizado: elige frases del banco y el dado
}

export interface Efecto { nombre: string; efecto: string }
export interface Narrativa { trasfondo: string; defecto: string; efectos: Efecto[] }

export interface Ficha {
  v: 1; id: string; creada: string;
  clase: string; claseBase: Clase;
  nivel: { valor: number; motivo: string };
  atributos: Record<Atributo, { valor: number; motivos: string[] }>;
  hechizos: Efecto[]; objetos: Efecto[];
  trasfondo: string; defecto: string;
  raza: Raza; aspecto: Aspecto;
  retrato: { tipo: "propio" } | { tipo: "galeria"; ruta: string };
  origen: "ia" | "manual";
}
