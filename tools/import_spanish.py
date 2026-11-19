"""Merge vendored Spanish AIML without network access.

Run before build_brain.py es. First compatible definition wins; local AIML
overrides the result at build time. Original files and notices stay in vendor/.
"""
import collections
import copy
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

from build_brain import norm_pattern, pattern_text

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / 'vendor/spanish'
ORDER = ['sarabot', 'inmoov', 'naochat', 'argento', 'player']
TAGS = set('template random li srai sr think set get bot star thatstar topicstar '
           'condition person person2 gender formal sentence uppercase lowercase '
           'that input request response date id size version br p a em strong '
           'b i ul ol gossip'.split())


def normalize(text):
    text = norm_pattern(text, True)
    return ' '.join(re.sub(r'[^\w\s*]', ' ', text).split()) or '*'


def redirect(tpl):
    """Only an unconditional, literal redirection (no side effects)."""
    if len(tpl) == 1 and not (tpl.text or '').strip():
        child = tpl[0]
        if child.tag == 'srai' and not len(child) and not (child.tail or '').strip():
            return normalize(child.text or '')
    return None


def merge():
    cfg = json.loads((ROOT / 'site/bots/es/config.json').read_text())
    selected = {}
    stats = {}
    for source in ORDER:
        counts = collections.Counter()
        for path in sorted((VENDOR / source).glob('*.aiml')):
            root = ET.parse(path).getroot()
            groups = [('*', root.findall('category'))]
            groups += [(t.get('name', '*'), t.findall('category')) for t in root.findall('topic')]
            for topic, categories in groups:
                for original in categories:
                    counts['read'] += 1
                    cat = copy.deepcopy(original)
                    tpl = cat.find('template')
                    pat = cat.find('pattern')
                    if pat is None or tpl is None:
                        counts['invalid'] += 1
                        continue
                    # Keep ordinary AIML 1.x; don't silently reinterpret AIML2
                    # sets, zero-width wildcards, priorities or robot commands.
                    contexts = [pat] + cat.findall('that')
                    if any(any(ch.tag != 'bot' for ch in el) for el in contexts):
                        counts['unsupported_pattern'] += 1
                        continue
                    texts = [pattern_text(el, cfg['bot']) for el in contexts] + [topic]
                    if any(re.search(r'[#^$|]', text) for text in texts):
                        counts['unsupported_pattern'] += 1
                        continue
                    # Two legacy shortcuts are bot properties, not AIML tags.
                    for el in tpl.iter():
                        if el.tag in ('favoritesong', 'for_fun'):
                            el.set('name', 'favoritesong' if el.tag == 'favoritesong' else 'forfun')
                            el.tag = 'bot'
                        if el.tag in ('condition', 'li') and el.get('value') == 'unknown':
                            el.set('value', cfg['defaultPredicate'])
                    if any(el.tag not in TAGS for el in tpl.iter()):
                        counts['unsupported_template'] += 1
                        continue
                    # Reject translated AIML attributes / dynamic AIML2 names.
                    if any(el.tag in ('set', 'get', 'bot') and not el.get('name') for el in tpl.iter()):
                        counts['unsupported_attributes'] += 1
                        continue
                    if any(el.tag == 'bot' and el.get('name') not in cfg['bot'] for el in tpl.iter()):
                        counts['unknown_property'] += 1
                        continue
                    p = normalize(texts[0])
                    that = normalize(pattern_text(cat.find('that'), cfg['bot']))
                    tp = normalize(topic)
                    # Legacy _ rules (e.g. '_ 28 *') outrank even exact
                    # questions, swallowing ages, dates and names. Keep the
                    # one-or-more capture semantics but give literals priority.
                    if '_' in p.split():
                        counts['lowered_wildcard_priority'] += 1
                        p = ' '.join('*' if w == '_' else w for w in p.split())
                    target = redirect(tpl)
                    if target == 'ME LLAMO':
                        # Old name recognizers discarded the captured name and
                        # also matched unrelated mentions of common names.
                        # The local contextual/name-capture rules replace them.
                        counts['replaced_name_recognition'] += 1
                        continue
                    if source == 'argento' and not target:
                        # Reuse regional input vocabulary without importing a
                        # different persona or coarse randomized fallbacks.
                        counts['regional_aliases_only'] += 1
                        continue
                    if target == p:
                        counts['self_redirect'] += 1
                        continue
                    key = (p, that, tp)
                    if key in selected:
                        counts['duplicate'] += 1
                        continue
                    pat.clear()
                    pat.text = p
                    for el in cat.findall('that'):
                        el.clear()
                        el.text = that
                    selected[key] = (cat, source, path.name, target)
                    counts['selected'] += 1
        stats[source] = dict(counts)

    # Literal multi-hop cycles are also unusable. Inspect only unconditioned
    # rules: a context-dependent redirect can legitimately change the match.
    cyclic = set()
    for start in selected:
        if start[1:] != ('*', '*'):
            continue
        seen = []
        key = start
        while key in selected and selected[key][3] is not None:
            if key in seen:
                cyclic.update(seen[seen.index(key):])
                break
            seen.append(key)
            key = (selected[key][3], '*', '*')
    for key in cyclic:
        _, source, _, _ = selected.pop(key)
        stats[source]['cycle_removed'] = stats[source].get('cycle_removed', 0) + 1

    root = ET.Element('aiml', {'version': '1.0.1'})
    root.append(ET.Comment(' Generated by tools/import_spanish.py. Modified Spanish corpus, 2026. '
                           'ALICE AI Foundation / Adam Codony (Sara), contributors to Sarabot, '
                           'InMoov, Naochat, Patricio Gerpe (Argento), Pandorabots and Sofia (Rosie). '
                           'GPL notices and Rosie LGPL notices, original source files and pinned '
                           'revisions: vendor/spanish and docs/ESPANOL.md. '))
    provenance = {}
    for (p, that, topic), (cat, source, filename, _) in selected.items():
        parent = root if topic == '*' else ET.SubElement(root, 'topic', {'name': topic})
        parent.append(ET.Comment(f' {source}/{filename} '))
        parent.append(cat)
        provenance[' | '.join((p, that, topic))] = f'{source}/{filename}'
    ET.indent(root, space='  ')
    dest = ROOT / 'aiml/es/10_imported.aiml'
    dest.parent.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(root).write(dest, encoding='utf-8', xml_declaration=True)
    report = {'sources': stats, 'merged_categories': len(selected), 'provenance': provenance}
    (VENDOR / 'import-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'sources': stats, 'merged_categories': len(selected)}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    merge()
