#!/usr/bin/env python3
"""Собирает весь сайт в один файл design-boost.html для просмотра на телефоне.

Запуск из корня проекта:  python3 scripts/build-single.py
Файл попадает в .gitignore: он нужен только для показа, а не для публикации.
"""
import base64
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(name):
    with open(os.path.join(ROOT, name), encoding="utf-8") as f:
        return f.read()


def embed(match):
    with open(os.path.join(ROOT, match.group(1)), "rb") as f:
        return '"data:image/jpeg;base64,' + base64.b64encode(f.read()).decode() + '"'


IMAGE = r'"(images/[^"]+\.jpg)"'
arrow = "data:image/svg+xml;base64," + base64.b64encode(read("icons/arrow.svg").encode()).decode()

html = read("index.html").replace("icons/arrow.svg", arrow)
css = read("styles.css")
data = re.sub(IMAGE, embed, read("data.js"))
app = re.sub(IMAGE, embed, read("app.js")).replace("icons/arrow.svg", arrow)

html = html.replace('<link rel="stylesheet" href="styles.css">', "<style>\n" + css + "</style>")
html = html.replace('<script src="data.js"></script>', "<script>\n" + data + "</script>")
html = html.replace('<script src="app.js"></script>', "<script>\n" + app + "</script>")

# community.js есть только в ветке с мини-приложением
if os.path.exists(os.path.join(ROOT, "community.js")):
    html = html.replace('<script src="community.js"></script>', "<script>\n" + read("community.js") + "</script>")

out = os.path.join(ROOT, "design-boost.html")
with open(out, "w", encoding="utf-8") as f:
    f.write(html)
print(f"{out}: {os.path.getsize(out) // 1024} КБ")
