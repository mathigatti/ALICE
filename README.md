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

## Deployment

Netlify project `alice-aiml-chat` is connected to `mathigatti/ALICE`, branch `main`,
and publishes the committed `site/` directory without a build command. Pushes to
`main` trigger deployment through a GitHub push webhook; Netlify reads the private
repository with a read-only deploy key. Credentials are managed by GitHub/Netlify,
not stored in this repository.

Production: [Español](https://alice.labsensacional.com/) ·
[English](https://alice.labsensacional.com/en/).
Regenerate compiled brains and the Spanish source archive before pushing changes
to AIML sources; Netlify serves those committed artifacts as-is.

## Spanish

The language selector includes Spanish: a merged community corpus (Sara,
Sarabot, InMoov, Naochat, AIML-Argento and compatible Rosie rules), plus local
conversation and memory improvements. It runs locally just like English.

See [Spanish sources, credits and integration notes](docs/ESPANOL.md) for pinned
references, selection criteria, licenses, known limitations and maintenance.
The Spanish footer also links to downloadable sources and credits.

Rebuild after editing Spanish rules or configuration:

```sh
python3 tools/import_spanish.py
python3 tools/build_brain.py es
node --test tests/chatbot.test.js  # Node.js 20+
python3 tools/package_spanish.py
```

Edit `aiml/es/90_local.aiml` for curated overrides; `10_imported.aiml` is generated.
The importer uses the vendored source snapshots and requires no network access.

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
     (input and patterns are then both folded: `QUÉ` → `QUE`, preserving `Ñ`).
3. `python3 tools/build_brain.py es`
4. Add `{ "code": "es", "label": "Español" }` to `site/bots/index.json`.

The selector appears automatically once there are 2+ languages. `/` and `/es/`
open Spanish; `/en/` opens English, regardless of a previously saved preference.
Each entry point has static translated SEO/social metadata, canonical and hreflang
links. `/es/` is an alias with `/` as its canonical URL. Keep their HTML metadata
and the matching bot configuration in sync when editing descriptions.
Each language keeps its own chat history/predicates in localStorage.
