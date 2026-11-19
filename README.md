# A.L.I.C.E. web

Chat with the original A.L.I.C.E. (Richard Wallace, 1995) running fully in the browser:
the free ALICE AIML set + a small AIML 1.x interpreter in JS (Graphmaster matching as in
*The Anatomy of A.L.I.C.E.*). Static site, deployed on Netlify (`publish = "site"`).

```
aiml/<lang>/*.aiml        AIML source (en = github.com/drwallace/aiml-en-us-foundation-alice, GPL)
tools/build_brain.py      compiles aiml/<lang> -> site/bots/<lang>/brain.json
site/engine.js            AIML interpreter (Web Worker; also require()-able from Node)
site/app.js               chat UI
site/bots/index.json      list of languages shown in the selector
site/bots/<lang>/config.json   bot properties, substitutions, UI strings
```

Local: `cd site && python3 -m http.server` → http://localhost:8000

## Adding a language (e.g. Spanish)

1. Put the AIML files in `aiml/es/` (e.g. a Spanish AIML set, or a translation of ALICE).
2. Copy `site/bots/en/config.json` to `site/bots/es/config.json` and translate:
   - `ui` strings and `greeting` (the greeting is stored as the bot's first `<that>`),
   - `bot` properties (`<bot name="..."/>`),
   - `substitutions`: `normal` (input expansions, e.g. `["pa", "para"]`), `person`
     (yo↔vos/tú swaps used by `<person/>`), `person2`, `gender` (él↔ella),
   - `locale` (`es-AR`, used by `<date>`), `connect` (init input, or `""`),
     `defaultPredicate` (value of unset predicates; ALICE uses `OM`).
   - Set `"stripAccents": true` if the AIML patterns are written without accents
     (input and patterns are then both folded: `QUÉ` → `QUE`).
3. `python3 tools/build_brain.py es`
4. Add `{ "code": "es", "label": "Español" }` to `site/bots/index.json`.

The selector appears automatically once there are 2+ languages; the initial language follows the
browser's language. Each language keeps its own chat history/predicates in localStorage.
