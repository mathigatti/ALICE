# ALICE en español: fuentes, integración y mantenimiento

Revisión e integración: 19 de noviembre de 2026.

Esta adaptación conserva el motor AIML del proyecto y funciona íntegramente en
el navegador. No traduce cada mensaje mediante un servicio externo ni incorpora
un modelo generativo. Ofrece español con respuestas locales rioplatenses y
reconocimiento de numerosas variantes con tuteo y voseo. Las respuestas heredadas
mantienen parte de la diversidad lingüística de sus autores.

La portada `/` está en español; `/en/` ofrece inglés y `/es/` es un alias de la
portada. Las páginas contienen metadatos estáticos traducidos, Open Graph,
Twitter Cards, datos estructurados y enlaces `hreflang`. El idioma de la URL
prevalece sobre las preferencias guardadas. El selector navega entre las páginas
y conserva el historial independiente de cada idioma.

## Fuentes investigadas

| Fuente | Qué aporta | Selección integrada |
| --- | --- | --- |
| [Sarabot](https://github.com/AlexR1712/Sarabot/tree/6917cb779614bab11d9c97f08535f8065b4ec93f/standard) | Sara más conocimiento general, geografía, deportes, inventos, conversación y prueba de Turing. Aplicación original para Telegram; reutilizamos sus datos AIML. | 4.032 categorías |
| [InMoov, español](https://github.com/MyRobotLab/InMoov2/tree/e5c05b9272cd25edada136db1d2e3cb908ad0d2a/peers/ProgramAB/es-ES/aiml) | Otra distribución de Sara, con algunas variantes conversacionales. | 4 categorías adicionales |
| [Naochat](https://github.com/iekumdario/naochat/tree/16a02d4a3ff7f8f391921bfa211ad582c8535e51/aiml-set) | Sara y parte del conjunto standard de PyAIML traducido al español, originalmente para NAO. | 384 categorías adicionales |
| [AIML-Argento](https://github.com/IAARhub/AIML-Argento/tree/49137bac7fbdfe0ed2a9513fea23cb5e0ab6e2a9) | Adaptación de Sara al español rioplatense por Patricio Gerpe. | 162 redirecciones adicionales; no se importa su personalidad ni su respuesta por defecto |
| [ChatBotPlayer / Rosie en español](https://github.com/SofiaPiar/chatbotplayer/tree/529ac5d83b077bdbb90eedf68dffb7cbe52304e3/ChatBotPlayer/app/src/main/assets/Player/aiml) | Adaptación por Sofía de Rosie, derivado de ALICE2. Diálogo, personalidad, conocimientos y otras reglas compatibles. | 1.305 categorías adicionales |

La combinación produce **5.887 categorías comunitarias únicas**. La capa local
contiene **345 categorías**, algunas reemplazan reglas heredadas: el cerebro
compilado contiene **6.146 categorías**, aproximadamente 594 KiB. Los números
describen reglas, no respuestas distintas ni garantías de cobertura.

Las fuentes tienen abundante contenido compartido. No se sumaron sus tamaños sin
deduplicar. Los conteos detallados de selección y descarte, y la procedencia de
cada regla importada, están en `vendor/spanish/import-report.json`.

### Referencias históricas y alternativas

- [Sara original, referencia histórica](https://alicebot.wikidot.com/aiml:es-es:xgargoyle:sara:sara-aiml).
  Sara (Sistema Artificial de Respuestas Automáticas) fue creada por Adam Codony,
  alias XGargoyle, para su proyecto de graduación en la UPC. Los archivos
  distribuidos identifican la revisión 0.02 de marzo de 2006. El enlace histórico
  no se pudo recuperar con la herramienta de consulta; usamos copias versionadas
  y verificables de GitHub.
- [README de AIML-Argento](https://github.com/IAARhub/AIML-Argento/blob/49137bac7fbdfe0ed2a9513fea23cb5e0ab6e2a9/readme.md):
  historia, créditos y adaptación rioplatense de julio de 2017.
- [README de Naochat](https://github.com/iekumdario/naochat/blob/16a02d4a3ff7f8f391921bfa211ad582c8535e51/README.md):
  explica su origen en Sara y PyAIML, y el cambio de género del personaje para NAO.
- [Referencia de Gael Langevin a InMoov en español](https://groups.google.com/g/inmoov/c/SwI27kTasiQ).
  El directorio antiguo `resource/InMoov2/chatbot/bots/es-ES/aiml` cambió de
  ubicación; actualmente se consulta `peers/ProgramAB/es-ES/aiml`.
- [vicorious/AIML](https://github.com/vicorious/AIML): revisado como alternativa.
  Contiene ejemplos didácticos pequeños y reglas de un dominio particular; no se
  incorporó como corpus conversacional general.
- [ALICE original en inglés](https://github.com/drwallace/aiml-en-us-foundation-alice):
  sigue siendo la fuente del idioma inglés de este proyecto.

## Criterios de fusión

1. Cada copia está fijada a un commit. `vendor/spanish/manifest.json` registra el
   repositorio, commit, ruta original y SHA del blob. Los archivos se almacenan
   como texto UTF-8 obtenido de GitHub, con saltos de línea normalizados a LF.
2. `tools/import_spanish.py` procesa primero Sarabot, luego InMoov, Naochat,
   Argento y Player. Ante una colisión de patrón/contexto/tema se conserva la
   primera definición compatible. Las reglas locales se compilan al final.
3. Se normalizan mayúsculas, espacios, signos y tildes, preservando la **ñ**.
   Se eliminan redirecciones hacia el mismo patrón normalizado y ciclos literales
   entre varias reglas. Así `QUE TAL → QUÉ TAL` no reemplaza la respuesta real.
4. Los comodines `_` de los patrones importados pasan a `*`: ambos capturan una o
   más palabras, pero el segundo deja prioridad a coincidencias literales. Esto
   evita que reglas como `_ 28 *` capturen «Tengo 28 años». El motor inglés
   conserva su prioridad AIML original.
5. Se reemplaza el reconocimiento heredado que redirigía nombres a `ME LLAMO`
   sin guardar el nombre. La capa local captura nombres, edad, procedencia y gustos.
6. Se omiten conjuntos en patrones, comodines AIML2 `#` y `^`, prioridad `$`,
   mapas, aprendizaje dinámico, servicios externos, órdenes de robot y otras
   construcciones no implementadas. No se convierten silenciosamente en texto.
   En Player también se excluyen archivos completos de acciones, entrenamiento
   y reglas de dominio ajenas a esta conversación.
7. Se adaptan dos etiquetas antiguas de propiedades (`favoritesong`, `for_fun`)
   y condiciones con el valor `unknown`. Argento aporta solamente redirecciones.
8. El español tiene protección contra ciclos recursivos que no cambian el estado
   y una respuesta de reserva localizada si una regla no genera texto.

## Archivos y reconstrucción

- `vendor/spanish/`: copias de las fuentes, manifiesto, licencias e informe.
- `aiml/es/10_imported.aiml`: resultado generado de la fusión; no editar a mano.
- `aiml/es/90_local.aiml`: reglas propias, editables; tienen prioridad al compilar.
- `site/bots/es/config.json`: personaje, sustituciones y textos de interfaz.
- `site/bots/es/brain.json`: cerebro generado, servido al navegador.
- `site/bots/es/sources.html`: créditos públicos y descarga de las fuentes.
- `tools/package_spanish.py`: genera documentación pública y un ZIP reproducible
  con fuentes, licencias, configuración y herramientas de compilación.

Desde la raíz, con Python 3 y Node.js 20 o posterior para las pruebas:

```sh
python3 tools/import_spanish.py
python3 tools/build_brain.py es
node --test tests/chatbot.test.js
python3 -m unittest discover -s tests -v
python3 tools/package_spanish.py
python3 -m http.server 8000 --directory site
```

No se necesita red para reconstruir. Para actualizar fuentes se deben revisar los
commits y avisos de licencia, actualizar las copias y el manifiesto, regenerar,
probar y actualizar los conteos de este documento. El despliegue estático publica
`site/`, por lo que deben regenerarse tanto `brain.json` como `sources.zip`.

## Créditos y avisos de licencia

Las fuentes Sara/ALICE incluidas contienen avisos de copyright de ALICE A.I.
Foundation y distribución bajo GNU GPL. Sara acredita a Adam Codony/XGargoyle;
Argento acredita la adaptación de Patricio Gerpe. Se conservan los avisos
originales y la licencia GPL v2 incluida en Naochat.

Los archivos de Rosie incluidos por ChatBotPlayer conservan avisos de copyright
de Pandorabots (2014), GNU LGPL y modificación por Sofía en julio de 2017. Se
incluye el texto LGPL 2.1. La licencia y los créditos de cada fuente siguen siendo
los de sus avisos originales; esto no atribuye a una única persona todo el corpus.
Las nuevas reglas de `90_local.aiml` se distribuyen como GPL-2.0-or-later.

Las modificaciones de integración de 2026 están descritas arriba. El ZIP público
incluye las fuentes originales conservadas, las reglas derivadas, este documento,
las licencias y las herramientas necesarias para reconstruir el cerebro español.

## Validación y límites

Las pruebas verifican tildes, Unicode descompuesto, distinción año/ano, tuteo y
voseo, conversación inicial, memoria del nombre, persistencia/restablecimiento,
edad, ubicación, gustos, fechas, conocimiento básico y compatibilidad inglesa.
También recorren todas las entradas literales sin contexto en tres selecciones
de ramas aleatorias para detectar salidas vacías o recursión excesiva. Esa prueba
no certifica la exactitud factual o naturalidad de cada respuesta.

La validación de esta integración pasó 7 grupos de pruebas del motor, incluidas
8.076 respuestas de la auditoría de entradas literales (profundidad máxima de
redirección: 3), y 3 pruebas Python (incluidos los metadatos estáticos por idioma). La reconstrucción inglesa sigue siendo
idéntica byte a byte. En Firefox se verificaron selector, memoria independiente
por idioma, recarga, reinicio, cambios rápidos, diseño compacto y descarga de
fuentes. `tests/browser_smoke.py` usa WebDriver por HTTP, sin paquetes Python
adicionales; requiere un servidor estático y geckodriver ya iniciados.

Este sigue siendo un chatbot histórico basado en reglas. El corpus incluye
errores, conocimientos antiguos, opiniones del personaje, temas adultos y
respuestas de calidad desigual. La capa local mejora situaciones frecuentes y
algunas respuestas obsoletas, pero no equivale a una revisión editorial exhaustiva
de todas las fuentes ni a una traducción completa del cerebro inglés. No tiene
acceso a noticias, clima, correo o información actualizada en tiempo real.

Para ampliar cobertura conviene registrar ejemplos reproducibles de preguntas y
respuestas deficientes, corregirlos en la capa local y agregar pruebas de las
conversaciones afectadas. No alcanza con aumentar el número de categorías.
