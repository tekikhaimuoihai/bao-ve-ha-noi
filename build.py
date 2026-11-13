#!/usr/bin/env python3
"""Assemble the single-file game: index.html = shell + css + three.js + game sources."""
import base64, glob, json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
src = lambda *p: os.path.join(here, 'src', *p)
shell = open(src('shell.html'), encoding='utf-8').read()
css = open(src('style.css'), encoding='utf-8').read()
logo = open(src('logo.svg'), encoding='utf-8').read().strip()
three = open(os.path.join(here, 'assets', 'three.min.js'), encoding='utf-8').read()
three = ('void 0,' + three[three.index('\n') + 1:]) if three.startswith('console.warn') else three
tea = base64.b64encode(open(os.path.join(here, 'assets', 'trasua.jpg'), 'rb').read()).decode()
sys.path.insert(0, os.path.join(here, 'tools')); import glb2json
models = {os.path.basename(f)[:-4]: glb2json.convert(f) for f in sorted(glob.glob(os.path.join(here, 'assets', 'models', '*.glb')))}
game = 'const GUN_MODELS = ' + json.dumps(models, separators=(',', ':')) + ';\n'
game += "const TEA_SIGN_SRC = 'data:image/jpeg;base64," + tea + "';\n"
game += '\n'.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(src('[0-9]*.js'))))
game = "(function(){\n" + game + "\n})();"
out = shell.replace('/*CSS*/', css).replace('%LOGO%', logo)
out = out.replace('/*THREE*/', three, 1).replace('/*GAME*/', game, 1)
open(os.path.join(here, 'index.html'), 'w', encoding='utf-8').write(out)
print('index.html', len(out) // 1024, 'KB')
