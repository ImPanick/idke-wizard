/* Focused offline regression checks; no browser or third-party dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const html = fs.readFileSync(path.join(__dirname, '..', 'ascii-idle-wizard.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function game() {
  let seed = 97531;
  const math = Object.create(Math);
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const nodes = new Map();
  function node(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', textContent: '', innerHTML: '', style: {}, dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {},
      querySelectorAll() { return []; }, querySelector() { return node('child'); },
      focus() {}, select() {},
    });
    return nodes.get(id);
  }
  const sandbox = {
    Math: math, Date, console, TextEncoder, TextDecoder, URL, performance: { now: () => 0 },
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    confirm: () => true, alert() {}, navigator: {},
    window: { addEventListener() {}, innerWidth: 1440, innerHeight: 900 },
    document: {
      body: node('body'), getElementById: node, createElement: () => node('created'),
      addEventListener() {}, querySelectorAll() { return []; },
    },
  };
  vm.createContext(sandbox);
  const source = script.replace(/\ninit\(\);\s*$/, '\n');
  assert.notEqual(source, script);
  vm.runInContext(source, sandbox, { timeout: 5000 });
  const run = source => vm.runInContext(source, sandbox, { timeout: 10000 });
  run('renderHot=()=>{};renderCold=()=>{};renderAll=()=>{};recomputeStats();');
  return { run };
}

test('offline ritual and combat spend a single mana pool', () => {
  const { run } = game();
  run(`G.hero.lvl=9;G.hero.mana=0;G.gold=10000;G.ritual.active=true;
    recomputeStats();const idle=applyIdle(120);`);
  assert.equal(run('idle.ritualSeconds'), 120);
  assert.equal(run('idle.ritualMana'), 120);
  assert.equal(run('idle.combatMana'), 0);
  assert.equal(run('G.hero.mana'), 0);
  assert.ok(run('idle.ritualMana+idle.combatMana<=idle.regeneratedMana+0.000001'));
});

test('recurring Wellspring supplies useful mana without granting a live permanent buff', () => {
  const { run } = game();
  run(`G.hero.lvl=9;G.hero.mana=0;G.gold=10000;G.ritual.active=true;
    G.equippedSpells=['wellspring','spark'];recomputeStats();const startingRegen=G.baseStats.manaRegen;const idle=applyIdle(120);`);
  assert.ok(run('idle.regeneratedMana') > 400);
  assert.ok(run('idle.combatMana') > 0);
  assert.ok(run('idle.ritualMana+idle.combatMana<=idle.regeneratedMana+0.000001'));
  assert.equal(run('G.buffs.length'), 0);
  assert.equal(run('G.baseStats.manaRegen'), run('startingRegen'));
});

test('a temporary passive potion contributes only for its remaining duration', () => {
  const { run } = game();
  run(`G.autoExplore=false;G.buildings.vault=1;
    G.buffs=[{stat:'goldPerSec',amt:5,dur:30,_potionId:'p_boost_idle',_q:1}];
    recomputeStats();const idle=applyIdle(120);`);
  assert.equal(run('idle.gold'), 270);
  assert.equal(run('G.gold'), 270);
  assert.equal(run('G.buffs.length'), 0);
  assert.equal(run('G.baseStats.goldPerSec'), 1);
});

test('sustainable damage support improves estimated combat rewards', () => {
  function rewards(withSupport) {
    const { run } = game();
    run(`G.hero.lvl=16;G.buildings.garden=50;G.elements.fire=20;
      G.equippedSpells=${withSupport ? "['flamewall','spark']" : "['spark']"};
      recomputeStats();const idle=applyIdle(600);`);
    return run('idle.xp');
  }
  assert.ok(rewards(true) > rewards(false));
});

function prepareBrewer(run, familiars = 1, rarity = 'common') {
  run(`G.hero.lvl=36;G.alchemy.lvl=100;G.alchemy.autoBrew='p_boost_xp';
    G.familiars=Array.from({length:${familiars}},()=>({type:'imp',rarity:'${rarity}',name:'Tim'}));
    G.gold=1e15;G.materials={dust:1e15,crystal:1e15,gem:1e15,herb:1e15};
    RESEARCH_PROJECTS.forEach(r=>G.researchCompleted[r.id]=true);recomputeStats();`);
}

test('twelve-hour brewing retains every batch and pays for the next queued batch', () => {
  const { run } = game();
  prepareBrewer(run);
  run('const startingGold=G.gold;advanceIdleProjects(43200);');
  const expected = Math.floor(43200 * 1.3 / 30) * 5;
  assert.equal(run("G.alchemy.potions.p_boost_xp['1.00']"), expected);
  assert.equal(run('G.alchemy.brewSlots.length'), 5);
  assert.equal(run('startingGold-G.gold'), (expected + 5) * 400);
  assert.ok(run('G.alchemy.brewSlots.every(s=>s.timeLeft>29.999999&&s.timeLeft<=30)'));
});

test('maximum supported familiar speed completes millions of brews without per-brew work', () => {
  const { run } = game();
  prepareBrewer(run, 2000, 'legendary');
  run('const speed=brewSpeedMul();advanceIdleProjects(43200);');
  const expected = Math.floor(43200 * (1 + 2000 * 7 * 0.3) / 30) * 5;
  assert.ok(expected > 1000000);
  assert.equal(run("G.alchemy.potions.p_boost_xp['1.00']"), expected);
  assert.equal(run('G.alchemy.brewSlots.length'), 5);
});

test('staggered brews finish correctly when remaining resources fund only three restarts', () => {
  const { run } = game();
  prepareBrewer(run, 0);
  run(`G.gold=1200;G.alchemy.brewSlots=[5,10,15,20,25].map(timeLeft=>({id:'p_boost_xp',timeLeft}));
    advanceIdleProjects(60);`);
  assert.equal(run("G.alchemy.potions.p_boost_xp['1.00']"), 8);
  assert.equal(run('G.alchemy.brewSlots.length'), 0);
  assert.equal(run('G.gold'), 0);
});

test('ordinary brew completions can reach perfect quality and then continue through the whole absence', () => {
  const { run } = game();
  prepareBrewer(run);
  run('G.alchemy.lvl=99;G.alchemy.xp=xpForAlchemyLevel(100)-5;advanceIdleProjects(43200);');
  const expected = Math.floor(43200 * 1.3 / 30) * 5;
  const produced = run('Object.values(G.alchemy.potions.p_boost_xp).reduce((sum,count)=>sum+count,0)');
  // Four original cauldrons complete the first cycle; the fifth opens on level-up.
  assert.equal(produced, expected - 1);
  assert.equal(run('G.alchemy.lvl'), 100);
  assert.equal(run('G.alchemy.brewSlots.length'), 5);
});
