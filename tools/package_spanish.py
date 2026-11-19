"""Package the corresponding Spanish sources and credits for static hosting."""
import html
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'site/bots/es'


def main():
    doc = (ROOT / 'docs/ESPANOL.md').read_text()
    (DEST / 'sources.md').write_text(doc)
    sources = json.loads((ROOT / 'vendor/spanish/manifest.json').read_text())
    links = ''.join(f'<li><a href="https://github.com/{html.escape(s["repository"])}/tree/{s["commit"]}">{html.escape(s["repository"])}</a></li>' for s in sources)
    page = '''<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ALICE en español · Fuentes y créditos</title>
<script src="/theme.js"></script><link rel="stylesheet" href="/style.css">
<style>body{font:17px/1.6 system-ui;max-width:850px;margin:3rem auto;padding:0 1rem;color:var(--text);background:var(--bg)}a{color:var(--link)}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}h1{line-height:1.2}</style>
<h1>ALICE en español: fuentes y créditos</h1>
<p>Esta adaptación combina Sara/ALICE y aportes de Sarabot, InMoov, Naochat,
AIML-Argento y Rosie/ChatBotPlayer, con reglas locales y correcciones.</p>
<p><a href="sources.zip">Descargar fuentes y licencias (ZIP)</a> ·
<a href="sources.md">Documento Markdown</a> · <a href="../../">Volver al chat</a></p>
<h2>Proyectos que aportan reglas</h2><ul>''' + links + '''</ul>
<h2>Autores y licencias</h2>
<p>ALICE fue creada por Richard S. Wallace. Sara fue creada por Adam Codony
(XGargoyle); AIML-Argento acredita la adaptación rioplatense de Patricio Gerpe.
Rosie acredita a Pandorabots y su adaptación española a Sofía.</p>
<p>Se conservan los avisos GPL de Sara/ALICE y LGPL de Rosie. Las copias originales,
las modificaciones de esta adaptación, los textos de licencia y las herramientas
para reconstruir el cerebro están en la descarga de fuentes.</p>
<p>La documentación Markdown detalla versiones, criterios de selección y límites
de este chatbot histórico basado en reglas.</p></html>\n'''
    (DEST / 'sources.html').write_text(page)
    paths = list((ROOT / 'vendor/spanish').rglob('*')) + list((ROOT / 'aiml/es').rglob('*'))
    paths += [ROOT / p for p in ('docs/ESPANOL.md', 'site/bots/es/config.json',
              'site/engine.js', 'tools/build_brain.py', 'tools/import_spanish.py',
              'tools/package_spanish.py')]
    with zipfile.ZipFile(DEST / 'sources.zip', 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        info = zipfile.ZipInfo('BUILD.md', date_time=(2026, 11, 19, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, '# Reconstruir el cerebro español\n\nCon Python 3, desde esta carpeta:\n\n'
                         '```sh\npython3 tools/import_spanish.py\npython3 tools/build_brain.py es\n```\n\n'
                         'No requiere red ni dependencias externas. La salida es '
                         '`site/bots/es/brain.json`. Este archivo incluye las fuentes del cerebro '
                         'español y su motor; no es una copia completa del sitio bilingüe. '
                         'Los comandos de pruebas de docs/ESPANOL.md corresponden al repositorio completo.\n')
        for path in sorted(p for p in paths if p.is_file()):
            info = zipfile.ZipInfo(path.relative_to(ROOT).as_posix(), date_time=(2026, 11, 19, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
    print(f"Spanish sources and credits: {DEST / 'sources.zip'}")


if __name__ == '__main__':
    main()
