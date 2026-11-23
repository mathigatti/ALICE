const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Bot } = require('../site/engine.js');
const brain = require('../site/bots/es/brain.json');
const cfg = require('../site/bots/es/config.json');
const fresh = () => new Bot(brain, cfg);

test('Spanish, missing accents, decomposed Unicode and voseo', () => {
  const b = fresh();
  for (const q of ['¿Cómo estás?', 'como estas', '¿Cómo andás?', '¿Cómo estás?'])
    assert.match(b.respond(q), /Bien, gracias/);
  for (const q of ['¿Quién sos?', '¿Quién eres?']) assert.match(b.respond(q), /Soy ALICE/);
  for (const q of ['buenas tardes', 'buenas noches', 'holi']) assert.match(b.respond(q), /Hola/);
  assert.notEqual(b.fold('año'), b.fold('ano'));
  assert.equal(b.fold('an\u0303o'), 'AÑO');
  assert.match(b.respond('¿Qué es un año?'), /365/);
  assert.match(b.respond('¿Qué es un ano?'), /digestivo/);
});

test('contextual greeting, explicit names, persistence and reset', () => {
  const b = fresh();
  b.greet();
  assert.match(b.respond('José'), /José/);
  assert.match(b.respond('¿Cómo me llamo?'), /Te llamás José/);
  assert.match(b.respond('Me llamo María José'), /María José/);
  const restored = new Bot(brain, cfg, JSON.parse(JSON.stringify(b.state())));
  assert.match(restored.respond('¿Cómo me llamo?'), /María José/);
  restored.reset();
  assert.match(restored.respond('¿Cómo me llamo?'), /Todavía no/);
  const greeting = fresh(); greeting.greet();
  greeting.respond('Hola');
  assert.equal(greeting.getPred('name'), cfg.defaultPredicate);
});

test('legacy number and underscore rules do not swallow personal facts', () => {
  const b = fresh();
  b.respond('Tengo 28 años');
  assert.match(b.respond('¿Cuántos años tengo?'), /tenés 28 años/);
  assert.match(b.respond('¿Cuántos años tenés?'), /1995/);
  b.respond('Vivo en Córdoba');
  assert.match(b.respond('¿Dónde vivo?'), /Córdoba/);
  b.respond('Me gusta tocar la guitarra');
  assert.match(b.respond('¿Qué me gusta?'), /tocar la guitarra/);
});

test('knowledge, dates and localized fallback', () => {
  const b = fresh();
  assert.match(b.respond('¿Cuál es la capital de Argentina?'), /Buenos Aires/);
  assert.match(b.respond('¿Qué es la fotosíntesis?'), /energía de la luz/);
  assert.match(b.respond('contame un chiste'), /Zum-ba/);
  assert.match(b.respond('¿Qué día es hoy?'), new RegExp(String(new Date().getFullYear())));
  assert.match(b.respond('¿Qué hora es?'), /\d\d:\d\d/);
  assert.match(b.respond('🦊'), /No entendí/);
  assert.match(b.respond('zqxv asdfgh'), /No entendí/);
});

test('cycle guard breaks unchanged recursion but allows predicate changes', () => {
  const cyclic = new Bot({ c: [['A', '*', '*', [['srai', 0, ['B']]]],
    ['B', '*', '*', [['srai', 0, ['A']]]]] }, cfg);
  assert.equal(cyclic.respond('A'), cfg.fallback);
  const changing = new Bot({ c: [['A', '*', '*', [['condition', { name: 'done' }, [
    ['li', { value: 'yes' }, ['Terminé.']],
    ['li', 0, [['think', 0, [['set', { name: 'done' }, ['yes']]]], ['srai', 0, ['A']]]],
  ]]]]] }, cfg);
  assert.equal(changing.respond('A'), 'Terminé.');
});

test('all literal unconditioned entries terminate with usable text (three random branches)', () => {
  const b = fresh(), originalRandom = Math.random;
  let maxDepth = 0, checked = 0;
  const srai = b.srai;
  b.srai = function (text, depth) { maxDepth = Math.max(maxDepth, depth); return srai.call(this, text, depth); };
  try {
    for (const value of [0, 0.5, 0.999999]) {
      Math.random = () => value;
      for (const [p, that, topic] of brain.c) {
        if (/[*_]/.test(p) || that !== '*' || topic !== '*') continue;
        b.reset();
        const answer = b.respond(p);
        assert.ok(answer.trim(), p);
        assert.ok(!answer.includes('\uFFFD'), p);
        assert.ok(!answer.includes('<oob>'), p);
        assert.ok(answer.length < 12000, p);
        checked++;
      }
    }
    assert.ok(maxDepth < 40, `Reached recursion limit: ${maxDepth}`);
    console.log(`Audited ${checked} literal responses; maximum redirect depth ${maxDepth}.`);
  } finally { Math.random = originalRandom; }
});

test('English still responds and its memory is independent', () => {
  const en = new Bot(require('../site/bots/en/brain.json'), require('../site/bots/en/config.json'));
  en.greet(); en.respond('My name is Martin');
  assert.match(en.respond('What is my name?'), /Martin/i);
  assert.equal(fresh().getPred('name'), cfg.defaultPredicate);
  assert.ok(en.respond('Hello').length);
});

test('English: greeting answer, wildcard rules without templates, UK spelling, punctuation', () => {
  const b = new Bot(require('../site/bots/en/brain.json'), require('../site/bots/en/config.json'));
  b.greet();
  const hi = b.respond("hi, i'm mathi");
  assert.match(hi, /Mathi/);
  assert.doesNotMatch(hi, /[!?]\./);
  assert.match(b.respond("what's my name?"), /Mathi/);
  assert.match(b.respond("what's your favourite song?"), /Kraftwerk/);
  assert.match(b.respond('what is your toaster?'), /toaster/);
});
