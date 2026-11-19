"""Browser smoke test using an existing WebDriver, no third-party Python deps.

Start a static server and geckodriver, then run with --base-url / --webdriver.
An optional --session reuses a running WebDriver session; otherwise Firefox is
started headless with Spanish as its preferred language. The session is closed.
"""
import argparse
import base64
import json
import time
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:8766/')
parser.add_argument('--webdriver', default='http://127.0.0.1:4447')
parser.add_argument('--session')
args = parser.parse_args()


def request(method, path, data=None):
    req = urllib.request.Request(args.webdriver + path, method=method,
                                 data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=45))['value']


sid = args.session or request('POST', '/session', {'capabilities': {'alwaysMatch': {
    'browserName': 'firefox', 'moz:firefoxOptions': {'args': ['-headless'],
        'prefs': {'intl.accept_languages': 'es-AR,es,en'}}}}})['sessionId']
prefix = '/session/' + sid


def js(script, *values):
    return request('POST', prefix + '/execute/sync', {'script': script, 'args': list(values)})


def wait(script):
    until = time.monotonic() + 20
    while time.monotonic() < until:
        if js(script):
            return
        time.sleep(0.1)
    raise AssertionError('Timed out: ' + script)


def ready(lang):
    wait(f"return document.documentElement.lang === '{lang}' && document.getElementById('input')?.disabled === false")


def switch(lang):
    js("const el=document.getElementById('lang'); el.value=arguments[0]; el.dispatchEvent(new Event('change'));", lang)
    ready(lang)


def say(message):
    js("document.getElementById('input').value=arguments[0]; document.getElementById('form').requestSubmit();", message)
    wait("return !document.getElementById('input').disabled")
    return js("return [...document.querySelectorAll('.msg.bot')].at(-1).textContent")


try:
    request('POST', prefix + '/url', {'url': args.base_url})
    wait("return document.getElementById('lang').options.length === 2 && !document.getElementById('input').disabled")
    if not args.session:
        assert js('return document.documentElement.lang') == 'es', 'Spanish landing page'
    js("localStorage.clear(); localStorage.setItem('alice:lang',JSON.stringify('es'));")
    request('POST', prefix + '/refresh', {})
    ready('es')
    js("const el=document.getElementById('theme'); el.value='dark'; el.dispatchEvent(new Event('change'));")
    assert js("return document.documentElement.dataset.theme") == 'dark'
    assert js("return getComputedStyle(document.body).backgroundColor") == 'rgb(32, 36, 41)'
    assert js("return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()") == '#b6d9f2'
    request('POST', prefix + '/refresh', {})
    ready('es')
    assert js("return document.getElementById('theme').value") == 'dark'
    switch('en')
    assert js("return document.documentElement.dataset.theme") == 'dark'
    assert js("return document.getElementById('theme').getAttribute('aria-label')") == 'Theme'
    switch('es')
    js("const el=document.getElementById('theme'); el.value='light'; el.dispatchEvent(new Event('change'));")
    assert js("return getComputedStyle(document.body).backgroundColor") == 'rgb(231, 240, 238)'
    assert js("return document.getElementById('send').textContent") == 'Enviar'
    assert not js("return document.getElementById('lang').hidden")
    assert js("return document.getElementById('lang').getAttribute('aria-label')") == 'Idioma'
    assert 'categorías' in js("return document.getElementById('about').textContent")
    assert 'José' in say('José')
    assert 'Te llamás José' in say('¿Cómo me llamo?')
    switch('en')
    assert js("return document.getElementById('send').textContent") == 'Send'
    assert js("return document.getElementById('lang').getAttribute('aria-label')") == 'Language'
    say('My name is Martin')
    assert 'Martin' in say('What is my name?')
    switch('es')
    assert 'Te llamás José' in say('¿Cómo me llamo?')
    request('POST', prefix + '/refresh', {})
    ready('es')
    assert 'Te llamás José' in say('¿Cómo me llamo?')
    js("document.getElementById('reset').click()")
    ready('es')
    assert js("return document.querySelectorAll('.msg.bot').length") == 1
    assert 'Todavía no' in say('¿Cómo me llamo?')
    switch('en')
    assert 'Martin' in say('What is my name?'), 'Spanish reset must not clear English'
    js("for(const code of ['es','en','es']){const el=document.getElementById('lang');el.value=code;el.dispatchEvent(new Event('change'));}")
    ready('es')
    assert js("return document.getElementById('send').textContent") == 'Enviar'
    assert 'Bien, gracias' in say('¿Cómo andás?')
    request('POST', prefix + '/url', {'url': args.base_url + 'en/'})
    ready('en')
    assert 'English' in js('return document.title')
    assert js("return document.querySelector('meta[property=\"og:locale\"]').content") == 'en_US'
    assert js("return document.querySelector('link[rel=\"canonical\"]').href").endswith('/en/')
    request('POST', prefix + '/url', {'url': args.base_url + 'es/'})
    ready('es')
    assert 'español' in js('return document.title')
    assert js("return document.querySelector('meta[property=\"og:locale\"]').content") == 'es_AR'
    request('POST', prefix + '/window/rect', {'width': 390, 'height': 844})
    assert js('return document.documentElement.scrollWidth <= window.innerWidth'), 'Mobile overflow'
    shot = request('GET', prefix + '/screenshot')
    with open('/tmp/alice-es-browser.png', 'wb') as file:
        file.write(base64.b64decode(shot))
    js("const el=document.getElementById('theme'); el.value='dark'; el.dispatchEvent(new Event('change'));")
    shot = request('GET', prefix + '/screenshot')
    with open('/tmp/alice-es-dark.png', 'wb') as file:
        file.write(base64.b64decode(shot))
    js("const el=document.getElementById('theme'); el.value='system'; el.dispatchEvent(new Event('change'));")
    assert js("return document.documentElement.dataset.theme === (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')")
    for path in ('bots/es/sources.html', 'bots/es/sources.md', 'bots/es/sources.zip'):
        with urllib.request.urlopen(args.base_url + path, timeout=10) as response:
            assert response.status == 200
    print('PASS: themes and persistence, language UI, name memory, independent histories, reload, reset, rapid switching, mobile layout, source downloads.')
finally:
    request('DELETE', prefix)
