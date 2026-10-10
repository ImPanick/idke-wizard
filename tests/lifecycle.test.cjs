/* Background lifecycle regressions using a deterministic clock and observed DOM. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const html = fs.readFileSync(path.join(__dirname, '..', 'ascii-idle-wizard.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function game(hidden = false) {
  let now = Date.UTC(2026, 9, 10), seed = 731, timerId = 0;
  class GameDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const stats = { writes: 0, focuses: 0, hot: 0, cold: 0 };
  const intervals = new Map(), timeouts = new Map(), nodes = new Map();
  const documentEvents = new Map(), windowEvents = new Map();
  const listen = (events, name, fn) => {
    if (!events.has(name)) events.set(name, []);
    events.get(name).push(fn);
  };
  let document;
  function node() {
    const n = {
      children: [], parent: null, style: {}, dataset: {}, value: '', tabIndex: 0,
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      before() {}, setAttribute() {}, addEventListener(name, fn) { this['on' + name] = fn; },
      append(...children) { children.forEach(child => this.appendChild(child)); },
      appendChild(child) { stats.writes++; child.parent = this; this.children.push(child); return child; },
      remove() { stats.writes++; if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; },
      focus() { stats.focuses++; document.activeElement = this; }, select() {},
      querySelector(selector) {
        if (!this.queries) this.queries = new Map();
        if (!this.queries.has(selector)) this.queries.set(selector, node());
        return this.queries.get(selector);
      },
      querySelectorAll() { return []; },
      get isConnected() { return this === document.body || !!this.parent?.isConnected; },
    };
    for (const property of ['innerHTML', 'textContent']) {
      let value = '';
      Object.defineProperty(n, property, { get: () => value, set: v => { value = v; stats.writes++; } });
    }
    return n;
  }
  document = {
    hidden, activeElement: null, body: node(),
    createElement: node,
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); },
    addEventListener: (name, fn) => listen(documentEvents, name, fn),
    querySelectorAll() { return []; },
  };
  const math = Object.create(Math);
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const sandbox = {
    Date: GameDate, Math: math, console, TextEncoder, TextDecoder, URL,
    performance: { now: () => now },
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    setInterval(fn) { const id = timerId++; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    setTimeout(fn) { const id = timerId++; timeouts.set(id, fn); return id; },
    clearTimeout: id => timeouts.delete(id),
    confirm: () => true, alert() {}, navigator: {}, document,
    window: { innerWidth: 1440, innerHeight: 900, addEventListener: (name, fn) => listen(windowEvents, name, fn) },
    countHot: () => stats.hot++, countCold: () => stats.cold++,
  };
  vm.createContext(sandbox);
  const source = script.replace(/\ninit\(\);\s*$/, '\n');
  assert.notEqual(source, script);
  vm.runInContext(source, sandbox, { timeout: 5000 });
  const run = code => vm.runInContext(code, sandbox, { timeout: 5000 });
  run('renderHot=countHot;renderCold=countCold;renderAll=()=>{};recomputeStats();');
  const emit = (events, name) => { for (const fn of events.get(name) || []) fn({}); };
  return {
    run, stats, intervals, timeouts, document, nodes,
    advance: ms => { now += ms; },
    visibility(value) { document.hidden = value; emit(documentEvents, 'visibilitychange'); },
    event: name => emit(windowEvents, name),
    modals: () => document.body.children.filter(n => n.className === 'modal-bg'),
  };
}
function passive(g) {
  g.run('G.autoExplore=false;G.buildings.vault=1;G.golems.dust=1;recomputeStats();resetGameClock();initGameLifecycle();');
}
test('nine hidden hours do no work and pay passive income exactly once on return', () => {
  const g = game(); passive(g);
  assert.equal(g.intervals.size, 1);
  const queued = [...g.intervals.values()][0];
  g.visibility(true);
  const before = { ...g.stats };
  for (let n = 0; n < 540; n++) { g.advance(60000); queued(); g.run('gameTick();'); }
  assert.equal(g.intervals.size, 0);
  assert.equal(g.run('G.gold'), 0);
  assert.equal(g.run('G.tick'), 0);
  assert.deepEqual(g.stats, before);
  assert.equal(g.modals().length, 0);
  g.visibility(false);
  assert.equal(g.run('G.gold'), 32400);
  assert.equal(g.run('G.materials.dust'), 16200);
  assert.equal(g.run('_pendingOfflineGains.seconds'), 32400);
  assert.equal(g.modals().length, 1);
  assert.equal(g.intervals.size, 1);
  g.event('pageshow'); g.event('focus'); g.visibility(false); queued();
  assert.equal(g.run('G.gold'), 32400);
  assert.equal(g.modals().length, 1);
  assert.equal(g.intervals.size, 1);
});
test('hundreds of throttled 61-second wakes never build a hidden modal backlog', () => {
  const g = game(); passive(g); g.visibility(true);
  const before = { ...g.stats };
  for (let n = 0; n < 450; n++) { g.advance(61000); g.run('gameTick();'); }
  assert.deepEqual(g.stats, before);
  assert.equal(g.modals().length, 0);
  g.visibility(false);
  assert.equal(g.run('G.gold'), 27450);
  assert.equal(g.modals().length, 1);
});
test('pagehide remains suspended until pageshow even if visibility changes first', () => {
  const g = game(); passive(g);
  g.event('pagehide'); g.advance(120000); g.visibility(false);
  assert.equal(g.intervals.size, 0); assert.equal(g.run('G.gold'), 0);
  g.event('pageshow');
  assert.equal(g.run('G.gold'), 120); assert.equal(g.intervals.size, 1);
  g.event('pageshow'); g.visibility(false);
  assert.equal(g.run('G.gold'), 120);
});
test('initially hidden pages and pageshow while still hidden do not start timers', () => {
  const g = game(true); passive(g);
  g.run('initGameLifecycle();'); g.event('pageshow'); g.advance(120000);
  assert.equal(g.intervals.size, 0); assert.equal(g.modals().length, 0);
  g.visibility(false);
  assert.equal(g.run('G.gold'), 120); assert.equal(g.intervals.size, 1);
});
test('callbacks from an old interval cannot consume a new visible tick', () => {
  const g = game(); passive(g);
  const stale = [...g.intervals.values()][0];
  g.visibility(true); g.advance(120000); g.visibility(false);
  g.advance(250); stale();
  assert.equal(g.run('G.gold'), 120);
  [...g.intervals.values()][0]();
  assert.equal(g.run('G.gold'), 120.25);
});
test('59-second stalls keep normal simulation and bound work per callback', () => {
  const g = game();
  g.run('let calls=0;simulationTick=()=>{calls++;G.tick++;};G.inDungeon=true;G.trial.inTrial=true;initGameLifecycle();');
  g.advance(59000); g.run('gameTick();');
  assert.equal(g.run('calls'), 20);
  assert.equal(g.run('G.inDungeon&&G.trial.inTrial'), true);
  for (let i = 0; i < 11; i++) g.run('gameTick();');
  assert.equal(g.run('calls'), 236);
  assert.equal(g.run('_tickAccumulator'), 0);
  assert.equal(g.modals().length, 0);
});
test('rapid focus changes preserve fractional elapsed time and one timer', () => {
  const g = game(); passive(g);
  for (let i = 0; i < 10; i++) { g.advance(100); g.visibility(true); g.advance(100); g.visibility(false); }
  assert.equal(g.run('G.tick'), 8); assert.equal(g.run('G.gold'), 2);
  assert.equal(g.intervals.size, 1);
});
test('a computer sleep with no visibility events catches up once on its next callback', () => {
  const g = game(); passive(g);
  g.advance(9 * 3600000); g.run('gameTick();gameTick();');
  assert.equal(g.run('G.gold'), 32400); assert.equal(g.modals().length, 1);
  assert.equal(g.run('G.rates._lastSnapGold'), 32400);
  g.run('recordRates();');
  assert.equal(g.run('G.rates.goldDelta60.reduce((n,e)=>n+e.amt,0)'), 0);
});
test('repeated absences update one recap without replacing Continue or stealing focus', () => {
  const g = game(); passive(g);
  g.visibility(true); g.advance(120000); g.visibility(false);
  const modal = g.modals()[0], button = g.document.activeElement, focuses = g.stats.focuses;
  g.visibility(true); g.advance(180000); g.visibility(false);
  assert.equal(g.modals()[0], modal); assert.equal(g.document.activeElement, button);
  assert.equal(g.stats.focuses, focuses);
  assert.equal(g.run('_pendingOfflineGains.gold'), 300);
  button.onclick();
  assert.equal(g.modals().length, 0); assert.equal(g.run('_pendingOfflineGains'), null);
});
test('hidden summaries retain data without touching the existing recap DOM', () => {
  const g = game(); passive(g);
  g.run('showOfflineGains({seconds:60,gold:5});'); g.visibility(true);
  const before = { ...g.stats };
  g.run('showOfflineGains({seconds:60,gold:7});renderOfflineGains();');
  assert.deepEqual(g.stats, before);
  g.visibility(false);
  assert.equal(g.modals().length, 1);
  assert.equal(g.run('_pendingOfflineGains.gold'), 12);
});
test('successful import replaces a prior report; failed import preserves it', () => {
  const g = game(); passive(g);
  g.run('showOfflineGains({seconds:120,gold:123});const code=exportSave();');
  assert.equal(g.run("importSave('invalid')"), false);
  assert.equal(g.run('_pendingOfflineGains.gold'), 123);
  assert.equal(g.modals().length, 1);
  assert.equal(g.run('importSave(code)'), true);
  assert.equal(g.run('_pendingOfflineGains'), null);
  assert.equal(g.modals().length, 0);
});
test('hidden import reanchors elapsed time to the imported character', () => {
  const g = game(); passive(g);
  g.run('const imported=exportSave();');
  g.visibility(true); g.advance(3600000);
  assert.equal(g.run('importSave(imported)'), true);
  assert.equal(g.run('G.gold'), 3600); assert.equal(g.modals().length, 0);
  g.advance(120000); g.visibility(false);
  assert.equal(g.run('G.gold'), 3720);
  assert.equal(g.run('_pendingOfflineGains.gold'), 3720);
  assert.equal(g.modals().length, 1);
});
test('save dialogs defer the recap until close instead of covering the controls', () => {
  const g = game(); passive(g); g.run("openSaveDialog('import');");
  const saveDialog = g.modals()[0];
  g.visibility(true); g.advance(120000); g.visibility(false);
  assert.equal(g.modals().length, 1); assert.equal(g.modals()[0], saveDialog);
  g.run('_saveDialogClose();');
  assert.equal(g.modals().length, 1); assert.notEqual(g.modals()[0], saveDialog);
  assert.equal(g.run('_pendingOfflineGains.gold'), 120);
});
test('16-hour absence caps rewards at 12 hours but fully ages temporary effects', () => {
  const g = game(); passive(g);
  g.run("G.buffs=[{stat:'atk',amt:1,dur:50000}];G.spellCd.spark=50000;G.hero.ailments=[{id:'burn',remaining:50000}];const target={hp:100,dotTimers:[{remaining:50000,dps:1}],slowed:50000};G.mobs=[target];G.enemy=target;");
  g.visibility(true); g.advance(16 * 3600000); g.visibility(false);
  assert.equal(g.run('G.gold'), 43200); assert.equal(g.run('G.materials.dust'), 21600);
  assert.equal(g.run('_pendingOfflineGains.seconds'), 43200);
  assert.equal(g.run('G.buffs.length+G.hero.ailments.length+G.spellCd.spark+target.dotTimers.length+target.slowed'), 0);
  assert.equal(g.run('target.hp'), 100);
});
test('resize callbacks are harmless while hidden and art refreshes once on return', () => {
  const g = game(); passive(g);
  g.event('resize'); const callback = [...g.timeouts.values()][0];
  g.visibility(true); const before = { ...g.stats }; callback();
  for (let i = 0; i < 10; i++) g.event('resize');
  assert.deepEqual(g.stats, before);
  g.visibility(false);
  assert.equal(g.run('_bgArtNeedsRender'), false);
  assert.ok(g.nodes.get('bg-art').textContent.length > 0);
  const writes = g.stats.writes; g.visibility(false); g.event('pageshow');
  assert.equal(g.stats.writes, writes);
});
test('Awakening clears an old recap and discards pre-reset time debt', () => {
  const g = game(); passive(g);
  g.run('G.hero.lvl=24;G.unlocked=3;showOfflineGains({seconds:120,gold:123});');
  g.advance(30000); g.run('awaken();');
  assert.equal(g.run('G.awakenCount'), 1);
  assert.equal(g.run('_pendingOfflineGains'), null); assert.equal(g.modals().length, 0);
  g.run('gameTick();');
  assert.equal(g.run('G.tick'), 0); assert.equal(g.run('_tickAccumulator'), 0);
});
test('recap overlay does not allocate a full-screen backdrop blur', () => {
  assert.doesNotMatch(html.match(/\.modal-bg\s*\{[^}]*\}/)[0], /backdrop-filter/);
});

function pendingTrial(g) {
  g.run('G.hero.lvl=16;recomputeStats();genMap();enterTrial();onEnemyDead(G.mobs[0]);initGameLifecycle();');
  return [...g.timeouts.values()][0];
}
test('a hidden Trial transition defers without losing the next floor', () => {
  const g = game(), callback = pendingTrial(g);
  g.visibility(true); g.advance(10000); const before = g.run('JSON.stringify(G)');
  callback();
  assert.equal(g.run('JSON.stringify(G)'), before);
  assert.equal(g.run('G.mobs.length'), 0);
  g.visibility(false);
  assert.equal(g.run('G.mobs.length'), 1);
  assert.match(g.run('G.mobs[0].ref.name'), /F2$/);
  const boss = g.run('G.mobs[0]');
  g.event('pageshow'); g.visibility(false); callback();
  assert.equal(g.run('G.mobs[0]'), boss);
});
test('a deferred Trial transition cannot overwrite the world after long absence', () => {
  const g = game(), callback = pendingTrial(g);
  g.visibility(true); callback(); g.advance(120000); g.visibility(false);
  assert.equal(g.run('G.trial.inTrial'), false);
  assert.equal(g.run('_pendingTrialTransition'), null);
  const mobs = g.run('G.mobs'); callback();
  assert.equal(g.run('G.mobs'), mobs);
});
test('an older deferred Trial callback cannot replace a newly entered run', () => {
  const g = game(), callback = pendingTrial(g);
  g.visibility(true); callback();
  g.run('exitTrial();enterTrial();const newBoss=G.mobs[0];');
  g.visibility(false); callback();
  assert.equal(g.run('G.mobs[0]===newBoss'), true);
});
