# Diseño: Ficha de Rol

**Fecha:** 2026-11-03 · **Autor:** Sergio (Ogires) con Claude
**App nº 6 de la factoría** · Dominio: `rol.webninja.fyi` · Coste objetivo: 0 €

---

## 1. Visión

**Ficha de Rol** convierte un CV en una ficha de personaje de juego de rol, con un retrato pintado por IA. Es la primera app de la factoría que genera imágenes.

Pegas tu CV o el "Acerca de" de LinkedIn (o eliges un PDF) y recibes una ficha con clase ("Paladín de .NET"), nivel, seis atributos, hechizos, objetos, trasfondo, defecto y retrato. La ficha se descarga como imagen vertical y tiene un enlace permanente con vista previa.

Usa un **enfoque híbrido**:
- **Las reglas** calculan todo lo que tiene números o va en la vista previa: nivel, atributos, clase, hechizos y objetos. Son explicables ("¿por qué tengo FUE 17?") y se pueden testear.
- **La IA de texto** solo escribe la parte narrativa: trasfondo, defecto y el efecto de cada hechizo y objeto.
- **La IA de imagen** pinta el retrato a partir de la clase, nunca a partir de una foto ni del texto del CV.

"D&D" es marca registrada de Wizards of the Coast: no aparece en el nombre ni en la marca. "Ficha de rol" es un término genérico.

## 2. Flujo del usuario

1. **Entrada.** Pegas el CV o el "Acerca de" (de 200 a 12.000 caracteres, lo que ocupa un CV de dos o tres páginas), o eliges un PDF.
   - pdf.js extrae el texto en el navegador: el PDF no sale del equipo.
   - La librería se sirve desde la propia app (sin CDN, para mantener una CSP estricta) y solo se descarga si eliges un PDF.
   - Si el PDF está escaneado y no tiene texto, la app te pide que lo pegues a mano.
2. **Retrato.** Eliges raza (humano, elfo, enano, orco, mediano o gnomo) y aspecto (femenino, masculino o "sorpresa": el dado elige el género y el personaje lleva yelmo o capucha). El retrato tiene siempre el género de la clase ("Maga" → una maga). La app nunca deduce el género a partir del CV ni del nombre.
3. **Nombre del personaje (opcional).** Solo se pinta en tu pantalla y en la imagen que descargas. No se manda al servidor.
4. **"Tirar iniciativa".** Un d20 animado mientras se genera la ficha, unos 5-8 s.
5. **Resultado:**
   - **Cabecera:** clase y nivel.
   - **Atributos:** FUE, DES, CON, INT, SAB y CAR, en un hexágono como los de las fichas de los videojuegos de fútbol (la forma deja ver la clase de un vistazo) y cada uno con un "¿por qué?" que lista los términos del CV que lo suben. El hexágono es un SVG que pinta el navegador con los valores de las reglas y también va en la imagen descargable.
   - **Contenido:** hechizos, objetos, trasfondo, defecto y retrato.
   - **Descargar imagen:** un PNG de 1080×1350 montado con canvas en el navegador, el formato vertical que mejor luce en el feed de LinkedIn.
   - **Copiar enlace:** `/f/{id}`, una ficha inmutable cuya vista previa muestra el retrato y "Paladín de .NET · nivel 18".

## 3. Arquitectura

Un único Cloudflare Worker con `assets` (web estática y API en un solo deploy) en `rol.webninja.fyi`, con `workers_dev: true` como respaldo. TypeScript estricto en el servidor y frontend vanilla sin build.

```
Navegador ── (PDF → pdf.js local → texto) ──► POST /api/ficha {texto, raza, aspecto}
                                                │
  1. Origin + validación (200-12.000 caracteres, enums)
  2. Reglas (perfil.ts, puras): términos, años, nivel, atributos, clase, hechizos, objetos
       └─ menos de 3 términos ─► 422, sin gastar IA
  3. Contador (Durable Object): topes por IP + reserva de neuronas del día ── sin cupo ─► ficha manual
  4. En paralelo:
     ├─ Texto (Workers AI) → JSON validado → filtro de palabras propias → Llama Guard
     │     └─ falla o marca ─► banco de frases
     └─ Flux, con un prompt hecho SOLO de enums (clase, raza, aspecto, objeto)
           └─ falla ─► galería de respaldo
  5. KV: f:{id} (JSON) + r:{id} (JPEG) → {id}
```

| Ruta | Respuesta |
|---|---|
| `POST /api/ficha` | `200 {id, ficha}` · `400` entrada no válida · `403` sin `Origin` permitido · `422` menos de 3 términos · `429` tope diario de la IP |
| `GET /api/ficha/{id}` | JSON de la ficha |
| `GET /f/{id}` | `f.html` con HTMLRewriter: `og:title` "Paladín de .NET · nivel 18", `og:image` = retrato, `noindex` |
| `GET /f/{id}/retrato.jpg` | JPEG desde KV, `Cache-Control: immutable` |
| `/galeria/{clase}-{raza}.jpg` | Asset estático (galería de respaldo) |

**Decisiones clave:**
- **El retrato no depende del texto de la IA.** Su prompt sale de las reglas: un estilo fijo, la clase y su género, la raza con sus rasgos, el aspecto y un objeto icónico. Por eso Flux y el modelo de texto corren en paralelo (unos 4 s en total), y el CV nunca llega al modelo de imagen.
- **Las reglas leen el CV entero; la IA, solo los primeros 4.000 caracteres.** Las habilidades suelen ir al final de un CV, así que las reglas necesitan el texto completo, pero el coste en neuronas no crece con la longitud.
- **La vista previa no contiene texto libre de la IA.** Clase y nivel salen de las reglas, así que el `og:title` es predecible.
- **Retrato con la cara centrada.** LinkedIn recorta las imágenes de la vista previa a 1,91:1; el estilo fijo pide un busto centrado para que el recorte no corte la cara.
- **KV para lo inmutable, Durable Object para lo exacto.** KV no es atómico ni sirve como contador. Cada ficha hace 2 escrituras en KV, así que el límite de 1.000 escrituras diarias no aprieta.
- **Ids de modelo en `vars`**, nunca en el código, porque los modelos caducan: `MODELO_TEXTO`, `MODELO_TEXTO_RESPALDO`, `MODELO_IMAGEN` y `MODELO_GUARDIA`. Si el modelo de texto principal da error, se prueba una vez el de respaldo.

## 4. Modelo de datos

La ficha guardada no contiene el CV, el nombre del personaje ni la IP.

```ts
type Atributo = "FUE" | "DES" | "CON" | "INT" | "SAB" | "CAR";
type Clase = "guerrero" | "picaro" | "paladin" | "mago" | "explorador" | "bardo";
type Raza = "humano" | "elfo" | "enano" | "orco" | "mediano" | "gnomo";
type Aspecto = "femenino" | "masculino" | "sorpresa";

interface Ficha {
  v: 1; id: string; creada: string;
  clase: string;                                   // texto final: "Maga de Kubernetes" (reglas)
  claseBase: Clase;
  nivel: { valor: number; motivo: string };        // reglas
  atributos: Record<Atributo, { valor: number; motivos: string[] }>;
  hechizos: { nombre: string; efecto: string }[];  // nombres elegidos por las reglas
  objetos:  { nombre: string; efecto: string }[];
  trasfondo: string; defecto: string;
  raza: Raza; aspecto: Aspecto;
  retrato: { tipo: "propio" } | { tipo: "galeria"; ruta: string };
  origen: "ia" | "manual";                         // la ficha manual lo indica con un sello
}
```

## 5. Reglas: nivel, atributos y clase

Todo sale de un catálogo público, sin IA.

### 5.1 Catálogo (`data/catalogo.json`)

Unas 150 tecnologías y unas 40 señales, con alias en español e inglés, revisado a mano. Cada entrada tiene:
- Sus alias y el atributo al que suma.
- Un tipo: **hechizo** (lenguaje o framework), **objeto** (herramienta) o **señal** (suma, pero no se muestra como hechizo ni objeto: "migré", "mentoría", "guardias").
- Su epíteto ("de .NET", "de la Mentoría").
- Opcionalmente, un objeto icónico para el retrato (Python → un bastón con una serpiente).

El motor busca con regex con lookarounds Unicode (`(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` y flag `u`), porque `\b` toma las letras con tilde por separadores. En un solape gana el término más largo, para que "ASP.NET" no cuente también como ".NET". Los términos ambiguos (C, Go) solo casan escritos con esas mayúsculas. R se queda fuera del catálogo: "R&D" o "Plan R" darían falsos positivos.

Si el texto tiene **menos de 3 términos detectados**, no se genera ficha ni se gasta IA: la app pide un CV de verdad.

### 5.2 Nivel

Nivel = años de experiencia, de 1 a 20:
1. Se suman los rangos de fechas (`04/2019 – actualidad`, `2016 - 2018`, `Jan 2020 – Present`) que están fuera de la sección de formación, fusionando los solapes para no contar dos veces el mismo periodo.
2. Se busca la frase "N años de experiencia" o "N years of experience".
3. Si hay rangos y frase, gana la cifra mayor. Si no hay ninguna de las dos, sale nivel 1 y el "¿por qué?" pide añadir las fechas.

### 5.3 Atributos (de 6 a 20)

| Atributo | Suben con |
|---|---|
| FUE | lenguajes y frameworks de servidor, bases de datos |
| DES | frontend, móvil, escritorio |
| CON | tecnologías antiguas que se siguen manteniendo, migraciones, soporte, guardias |
| INT | patrones, diseño de APIs, cloud, sistemas distribuidos |
| SAB | testing, observabilidad, CI/CD, seguridad |
| CAR | liderazgo, mentoría, charlas, idiomas, trato con clientes |

- **Puntos** de un atributo: la suma de las menciones de sus términos, con un máximo de 3 por término. Repetir un término diez veces no sube más.
- **Techo:** `10 + ⌊nivel / 2⌋`. Un nivel 20 llega a 20 y un nivel 4, a 12.
- **Valor:** `6 + (techo − 6) × puntos ÷ puntos del atributo más fuerte`, redondeado. El atributo más fuerte llega al techo. Uno sin términos se queda en 6, y su "¿por qué?" lo explica ("CAR 6: tu CV no menciona a ninguna persona").

### 5.4 Clase

La clase sale del atributo más alto y lleva el epíteto del término con más menciones de ese atributo. En un empate gana el atributo con más menciones y, si siguen empatados, el que va antes en la tabla.

| Atributo | Clase | Ejemplo | Objeto de la clase |
|---|---|---|---|
| FUE | Guerrero / Guerrera | Guerrero de Java | espada |
| DES | Pícaro / Pícara | Pícara de React | dagas |
| CON | Paladín / Paladina | Paladín de COBOL | escudo |
| INT | Mago / Maga | Maga de Kubernetes | bastón |
| SAB | Explorador / Exploradora | Explorador de Playwright | arco |
| CAR | Bardo / Barda | Barda de la Mentoría | laúd |

La clase concuerda con el aspecto elegido; con "sorpresa", la forma la decide el dado.

### 5.5 Hechizos, objetos y retrato

- **Hechizos:** los 5 lenguajes o frameworks con más menciones. **Objetos:** las 3 herramientas con más menciones. La IA solo escribe el efecto de cada uno.
- **Objeto del retrato:** el del término que da el epíteto. Si ese término no tiene, el de la clase.

## 6. Coste y topes

Precios de Workers AI comprobados el 2026-10-29 y consumo medido con el prompt real el 2026-11-04. El plan gratuito da 10.000 neuronas al día por cuenta, compartidas con el resto de apps de la factoría.

| Paso | Neuronas |
|---|---|
| Texto con `qwen3-30b-a3b-fp8` (~1.200 tokens de entrada y ~250 de salida, sin pensamiento) | ~13 |
| Respaldo, solo si falla el anterior: `gpt-oss-20b` con razonamiento bajo | ~30 |
| Llama Guard 3 | ~18 |
| Flux-1-schnell, 1024² con 4 pasos | ~58 |
| **Reserva por ficha** | **130** |

- **Modelo de texto:** `qwen3-30b-a3b-fp8` dio 63 JSON válidos de 63 en la comparativa, con una mediana de 2,2 s. `gpt-oss-20b` escribe con más imaginación, pero se pasaba de largo, a veces devolvía la respuesta vacía y tardaba más de 6 s una de cada ocho veces, así que queda de respaldo.
- **Cupo diario:** `CUOTA_NEURONAS_DIA` = 6.000, unas 46 fichas con IA al día. La reserva cubre el peor caso medido (respaldo incluido, ~141 contra las ~89 de una ficha normal) con margen hasta el límite de la cuenta.
- **Por IP y día:** 5 fichas con IA (`TOPE_IA_IP_DIA`); a partir de ahí, la ficha sale manual, con un tope de 20 (`TOPE_FICHAS_IP_DIA`) para proteger las escrituras de KV.
- **Almacenamiento:** el Durable Object lleva la cuenta de los bytes guardados en KV (1 GB gratis). Al llegar a 800 MB (`TOPE_BYTES_KV`), unos 1.460 retratos de ~550 KB, las fichas nuevas usan la galería.
- **Galería de respaldo:** 6 clases × 6 razas × femenino/masculino = 72 retratos, generados una sola vez (~4.150 neuronas, repartibles en dos días) y servidos como assets, que son gratuitos e ilimitados.

El contador (Durable Object con SQLite) reserva las neuronas **antes** de llamar a la IA, con el mismo patrón que el `Contador` de Interview Fight Club.

## 7. Seguridad (OWASP Top 10 2025 + OWASP LLM Top 10 2025)

El CV se trata como entrada hostil (LLM01, inyección de prompt):
- Antes de llegar al modelo, el texto pierde emails, teléfonos y URL, se corta a 4.000 caracteres y va dentro de un delimitador con un nonce aleatorio. Las instrucciones van en el mensaje de sistema.
- La IA devuelve un JSON (JSON mode de Workers AI) con tres campos: trasfondo (≤400 caracteres), defecto (≤140) y un efecto de ≤100 por cada hechizo y objeto, para los nombres exactos que le pasan las reglas. Un texto que se pasa del límite sin llegar al doble se recorta en una palabra; cualquier otra desviación (nombres inventados, enlaces, HTML, campos que faltan) invalida la respuesta.
- **Filtro de palabras propias** (LLM02, fuga de datos personales): se rechaza el campo que contenga una palabra que en el CV aparece siempre con mayúscula, salvo que sea un término del catálogo. La mayúscula de inicio de línea, viñeta o frase no cuenta ("Experiencia", "Construyo"), salvo en un nombre y apellido seguidos, y los enlaces y emails se quitan antes de mirar. Así no pasan el nombre de la persona, el de su empresa ni el de su ciudad. Un campo rechazado sale del banco de frases; algún falso positivo es aceptable.
- **Sin copias del CV:** un campo que repite 6 palabras seguidas del CV sale también del banco de frases. Además de pedir texto propio, evita que se cuelen frases enteras con datos de la persona.
- **Llama Guard** revisa el texto antes de guardarlo.
- **Tono:** el defecto y el trasfondo se ríen del personaje, nunca de prácticas reales de ingeniería ni de la edad, el género o el origen de nadie.
- **La IA no decide lo visible en la vista previa** (clase y nivel) ni elige qué hechizos aparecen.
- **Flux solo recibe enums**: no hay texto del usuario en su prompt.
- **Web:** comprobación de `Origin` (CSRF), enums validados, límite de tamaño del cuerpo, CSP estricta (pdf.js y su worker servidos desde la propia app, sin scripts en línea) y todo se pinta con `textContent`, nunca con `innerHTML`. HTMLRewriter escapa los valores de las etiquetas og.

## 8. Privacidad

- El CV no se guarda ni sale en los logs: solo se registran su longitud y el resultado (IA o manual, y el motivo del fallo).
- El PDF y el nombre del personaje nunca salen del navegador.
- El rate limit usa un hash de la IP con una sal aleatoria del día. La sal y los contadores viven en el Durable Object y una alarma los borra al acabar el día, así que después nadie puede relacionar un hash con una IP.
- Las fichas tienen un id aleatorio de 12 caracteres y `noindex`, y no se listan en ninguna parte.
- Antes de implementar se comprueba en la documentación de Cloudflare qué hace Workers AI con las entradas (retención y entrenamiento).

## 9. Modo sin IA

El texto y el retrato fallan por separado. La demo nunca se queda en blanco.

| Falla | Qué se usa |
|---|---|
| Texto: sin cupo, tope de IA de la IP, timeout (6 s el modelo principal y 4 s el de respaldo), JSON inválido o Llama Guard | Banco de frases escrito a mano: 5 trasfondos y 8 defectos por clase, con huecos que rellenan las reglas ({tecnología principal}, {clase}, {nivel}; nunca los años, para que un CV sin fechas no diga "0 años"). Los efectos salen de plantillas por atributo. La elección depende del hash del CV, así que el mismo CV da la misma ficha |
| Texto: el filtro de palabras propias o el de copias salta en un campo | Solo ese campo sale del banco; el resto se queda con el texto de la IA |
| Retrato: sin cupo, error de Flux o tope de almacenamiento | Galería de 72 retratos (clase × raza × género). Se usa la versión del género de la clase, también con "sorpresa" |
| Escritura en KV | Se enseña la ficha con el retrato de la galería (el propio no se puede servir sin guardarlo) y se puede descargar el PNG. "Copiar enlace" queda desactivado y explica por qué |

Las reglas no dependen de la IA, así que una ficha manual sigue siendo de quien pegó el CV. La ficha manual lleva un sello: "Tirada a mano: el oráculo descansa".

## 10. Estrategia de tests (TDD, Vitest + `@cloudflare/vitest-plugin`)

- **Reglas** (`perfil.ts`, funciones puras): años con rangos, solapes, formación excluida y frase; nivel; atributos (máximo de 3 menciones por término, techo, 6 sin términos); clase con empates, concordancia y epíteto; los 5 hechizos y 3 objetos; el mínimo de 3 términos.
- **Catálogo:** cada entrada es válida, cada ejemplo casa solo con su término, "ASP.NET" no cuenta como ".NET" y C y Go solo casan con esas mayúsculas.
- **Validador:** esquema del JSON, longitudes, nombres exactos y filtro de palabras propias, probado con un CV con nombre, empresa y ciudad inventados.
- **Banco de frases:** el mismo hash da la misma ficha y no queda ningún hueco sin rellenar.
- **Worker**, con Workers AI simulado:
  - El camino feliz y cada fallo de la tabla de la sección 9.
  - `403` sin `Origin`, `400` con entrada no válida y `422` con menos de 3 términos.
  - Rate limit exacto: la 6.ª ficha de una IP sale manual y la 21.ª da `429`.
  - Etiquetas og escapadas en `/f/{id}`.
  - El CV no aparece en ningún log (espía sobre `console`).
- **Fixtures:** seis CV inventados: junior de frontend, Java sénior, veterano de COBOL, líder de equipo, un "Acerca de" sin fechas y un CV en inglés. Un script local (`npm run probar -- <ruta>`) saca la ficha de cualquier CV sin desplegar.

## 11. Verificaciones

**Antes de implementar**, con el prompt real:
- `gpt-oss-20b` frente a `qwen3-30b-a3b-fp8`: proporción de JSON válidos, calidad del texto, neuronas reales en el panel y latencia.
- Flux-1-schnell: tamaño real de cada JPEG (para ajustar el tope de almacenamiento) y cómo pinta las 6 clases.
- Id y formato de respuesta de Llama Guard en Workers AI.
- Política de datos de Workers AI.
- Límites gratuitos de Workers AI y KV, que cambian sin avisar.

**En producción**, tras el deploy:
- Las neuronas del panel cuadran con la reserva.
- Un CV con "ignora las instrucciones anteriores" no cambia la ficha.
- Un nombre inventado en el CV no aparece en `/f/{id}`.
- El rate limit es exacto.
- Con la cuota a 0 sale la ficha manual.
- La CSP y el `noindex` están puestos.
- La vista previa sale bien en el Post Inspector de LinkedIn.
- Al terminar se borran los datos de prueba de KV.

## 12. Despliegue

- Repo público con README (GIF y diagrama desde el primer día).
- GitHub Actions: job de tests (`npm ci` + `npm test`) y job de deploy solo desde `main` con `npx wrangler deploy`.
- `rol.webninja.fyi` como `custom_domain`, con `workers_dev: true`, y `og:image` de 1200×627 en la portada.
- La galería de respaldo se genera una vez con un script local antes del lanzamiento.

## 13. Fuera de la primera versión (visión)

- Galería pública de fichas (pediría moderación).
- Retar a otro personaje.
- Multiclase, cuando los dos atributos más altos casi empatan.
- Años por tecnología.
- Regenerar solo el retrato.
- Interfaz en otros idiomas y CV en idiomas que no sean español o inglés.
