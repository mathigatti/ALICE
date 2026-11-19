"""Compile a folder of AIML 1.x files into site/bots/<lang>/brain.json.

Usage: python3 tools/build_brain.py <lang>
Reads aiml/<lang>/*.aiml and site/bots/<lang>/config.json (for <bot> tags inside patterns).
Output: {"c": [[pattern, that, topic, template_ast], ...]}
template_ast node = "text" | [tag, {attrs} | 0, [children]]
"""
import glob
import json
import os
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def norm_pattern(s, strip_accents):
    s = re.sub(r"\s+", " ", s).strip().upper()
    if strip_accents:
        s = "".join(ch for ch in unicodedata.normalize("NFD", s) if unicodedata.category(ch) != "Mn")
    return s or "*"


def pattern_text(el, bot):
    if el is None:
        return "*"
    parts = [el.text or ""]
    for ch in el:
        if ch.tag == "bot":
            parts.append(bot.get(ch.get("name", ""), ""))
        else:
            parts.append("".join(ch.itertext()))
        parts.append(ch.tail or "")
    return "".join(parts)


def ast(el):
    out = []
    if el.text:
        out.append(re.sub(r"\s+", " ", el.text))
    for ch in el:
        if not isinstance(ch.tag, str):  # comments
            pass
        else:
            out.append([ch.tag, dict(ch.attrib) or 0, ast(ch)])
        if ch.tail:
            out.append(re.sub(r"\s+", " ", ch.tail))
    merged = []
    for n in out:
        if isinstance(n, str) and merged and isinstance(merged[-1], str):
            merged[-1] += n
        else:
            merged.append(n)
    return merged


def main(lang):
    cfg = json.load(open(os.path.join(ROOT, "site/bots", lang, "config.json")))
    strip = cfg.get("stripAccents", False)
    bot = cfg.get("bot", {})
    cats = {}
    files = sorted(glob.glob(os.path.join(ROOT, "aiml", lang, "*.aiml")))
    for f in files:
        root = ET.parse(f).getroot()

        def add(cat, topic):
            p = norm_pattern(pattern_text(cat.find("pattern"), bot), strip)
            t = norm_pattern(pattern_text(cat.find("that"), bot), strip)
            tpl = cat.find("template")
            cats[(p, t, topic)] = ast(tpl) if tpl is not None else []

        for node in root:
            if node.tag == "category":
                add(node, "*")
            elif node.tag == "topic":
                topic = norm_pattern(node.get("name", "*"), strip)
                for cat in node.findall("category"):
                    add(cat, topic)
    out = {"c": [[p, t, tp, tpl] for (p, t, tp), tpl in cats.items()]}
    dest = os.path.join(ROOT, "site/bots", lang, "brain.json")
    with open(dest, "w") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    print(f"{lang}: {len(files)} files, {len(cats)} categories -> {dest} ({os.path.getsize(dest) // 1024} KB)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "en")
