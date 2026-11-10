"""Derive the public portfolio from the proposal page, excluding its simulator."""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'eventos-proposta'
TARGET = ROOT / 'eventos'


def portfolio_html(html):
    html, count = re.subn(r'<section id="investimento".*?</section>', '', html, flags=re.S)
    if count != 1:
        raise ValueError('Expected exactly one proposal simulator section')
    html = re.sub(r'<a href="#investimento">.*?</a>', '', html)
    html = re.sub(r'<script src="pricing\.js[^\"]*"></script>', '', html)
    html = html.replace('https://ritocafe.shop/eventos-proposta/', 'https://ritocafe.shop/eventos/')
    html = html.replace('Rito Café | Monte a proposta do seu evento', 'Rito Café | Café especial para o seu evento')
    html = html.replace('content="noindex, follow"', 'content="index, follow"')
    return html


def sync():
    TARGET.mkdir(exist_ok=True)
    html = portfolio_html((SOURCE / 'index.html').read_text())
    (TARGET / 'index.html').write_text(html)
    for name in ['style.css', 'experience.js', 'gallery-content.js', 'gallery-data.js', 'lab-gallery.js']:
        shutil.copyfile(SOURCE / name, TARGET / name)
    shutil.copytree(SOURCE / 'assets', TARGET / 'assets', dirs_exist_ok=True)
    print('eventos synchronized; simulator remains exclusive to eventos-proposta.')


if __name__ == '__main__':
    sync()
