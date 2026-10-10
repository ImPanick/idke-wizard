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

function prepareCombatEstimate(run) {
  run(`const estimateStats={...G.baseStats,crit:0,atk:10,dmgMul:1};
    const estimateEnemy={hp:100,atk:30,def:0,spd:1,gold:0,xp:0};
    const estimateDifficulty={enemyHp:1,enemyAtk:1,enemyDef:1};
    const estimateSpell={id:'spark',element:'fire',type:'damage',dmg:10};
    const estimate=(spell,rate=0.5)=>estimateIdleCombat([{sp:spell,rate}],0,estimateStats,estimateEnemy,estimateDifficulty);`);
}

test('offline overkill seeds no burn and yields no extra execution credit or leech', () => {
  const { run } = game();
  prepareCombatEstimate(run);
  run(`const lethal={...estimateSpell,dmg:1e9,leech:0.6};
    const baseline=estimate(lethal);
    const enhanced=estimate({...lethal,burn:{ratio:0.25,dur:3},execute:{threshold:0.3,mul:1.5}});`);
  assert.equal(run('enhanced.dps'), run('baseline.dps'));
  assert.equal(run('enhanced.dotDps'), 0);
  assert.equal(run('enhanced.healing'), run('enhanced.enemyHp*0.5*0.6'));
});

test('offline burn refreshes share one damage-over-time slot', () => {
  const { run } = game();
  prepareCombatEstimate(run);
  run(`const burning=estimate({...estimateSpell,burn:{ratio:0.25,dur:3}});
    const direct=estimate(estimateSpell);`);
  assert.ok(run('burning.dotDps') > 0);
  // Two-second casts refresh a three-second burn; they cannot stack full burns.
  assert.ok(run('burning.dotDps<=10*1.05*0.25/3+1e-9'));
  assert.equal(run('burning.dps-burning.dotDps'), run('direct.dps'));
});

test('offline execution helps only the finishing fraction of a surviving target', () => {
  const { run } = game();
  prepareCombatEstimate(run);
  run(`const direct=estimate(estimateSpell);
    const executed=estimate({...estimateSpell,execute:{threshold:0.3,mul:1.5}});`);
  assert.ok(run('executed.dps') > run('direct.dps'));
  assert.ok(run('executed.dps') < run('direct.dps*1.2'));
});

test('offline chill and fracture use feasible uptime and cannot affect an already dead target', () => {
  const { run } = game();
  prepareCombatEstimate(run);
  run(`const chilled=estimate({...estimateSpell,condition:{id:'chilled',dur:4}});
    const lethalChill=estimate({...estimateSpell,dmg:1e9,condition:{id:'chilled',dur:4}});
    estimateEnemy.def=20;
    const direct=estimate(estimateSpell);
    const fractured=estimate({...estimateSpell,condition:{id:'fractured',dur:6}});`);
  assert.ok(run('chilled.incoming') < run('lethalChill.incoming'));
  assert.equal(run('lethalChill.chillUptime'), 0);
  assert.ok(run('fractured.fractureUptime') > 0);
  assert.ok(run('fractured.fractureUptime') <= 1);
  assert.ok(run('fractured.dps') > run('direct.dps'));
});

test('offline estimates never fabricate nearby targets, reactions or extra harvested damage', () => {
  const { run } = game();
  prepareCombatEstimate(run);
  run(`const direct=estimate(estimateSpell);
    const crowded=estimate({...estimateSpell,splash:{ratio:0.45,limit:3,radius:3},
      chain:[0.55,0.30],lightning:true,harvest:2,condition:{id:'soaked',dur:6}});`);
  assert.equal(run('crowded.dps'), run('direct.dps'));
  assert.equal(run('crowded.healing'), run('direct.healing'));
  run('const summary=applyIdle(120);');
  assert.equal(run('summary.combatEstimate'), 'single-target');
  assert.match(run('summary.estimateNote'), /reactions.*excluded/);
});

test('v28 saves preserve both available and spent Earthward guard readiness', () => {
  for (const ready of [true, false]) {
    const { run } = game();
    run(`const earthward=SPELLS.find(sp=>sp.id==='earthward');
      G.buffs=[{...earthward.buff,_spellId:earthward.id,_guardReady:${ready}}];
      const code=exportSave();const savedVersion=JSON.parse(b64ToUtf8(code)).v;
      const restored=importSave(code);`);
    assert.equal(run('savedVersion'), 28);
    assert.equal(run('restored'), true, run('lastSaveError'));
    assert.equal(run('G.buffs[0]._guardReady'), ready);
  }
});

test('older or incomplete ward saves never receive a fresh guard or a second XP migration', () => {
  const { run } = game();
  run(`const earthward=SPELLS.find(sp=>sp.id==='earthward');
    const code=JSON.parse(b64ToUtf8(exportSave()));code.hero.lvl=50;code.hero.xp=1234;
    code.buffs=[{...earthward.buff,_spellId:earthward.id,_guardReady:true}];
    code.v=27;const previous=buildImportedState(code).state;
    code.v=28;delete code.buffs[0]._guardReady;const missing=buildImportedState(code).state;`);
  assert.equal(run('previous.buffs[0]._guardReady'), false);
  assert.equal(run('missing.buffs[0]._guardReady'), false);
  assert.equal(run('previous.hero.xp'), 1234);
  assert.equal(run('missing.hero.xp'), 1234);
});

test('a long absence expires all enemy effects and Earthward without replaying damage', () => {
  const { run } = game();
  run(`G.autoExplore=false;
    const primary=makeEnemy(ZONES[0].enemies[0],3,3,false);
    const side=makeEnemy(ZONES[0].enemies[1],4,3,false);
    G.mobs=[primary,side];G.enemy=primary;
    for(const enemy of G.mobs){
      enemy.dotTimers=[{spellId:'spark',element:'fire',dps:100,remaining:3}];
      enemy.statuses={chilled:4,soaked:6,fractured:6};enemy.slowed=2;
    }
    const earthward=SPELLS.find(sp=>sp.id==='earthward');
    G.buffs=[{...earthward.buff,_spellId:'earthward',_guardReady:true}];
    const health=G.mobs.map(enemy=>enemy.hp);
    const gold=G.gold,xp=G.hero.xp;applyIdle(120);tickEnemyEffects();`);
  assert.equal(run('G.mobs.every((enemy,i)=>enemy.hp===health[i])'), true);
  assert.equal(run('G.mobs.every(enemy=>enemy.dotTimers.length===0&&Object.keys(enemy.statuses).length===0&&enemy.slowed===0)'), true);
  assert.equal(run('G.buffs.length'), 0);
  assert.equal(run('G.rates.dmgDealt60.length'), 0);
  assert.equal(run('G.gold'), run('gold'));
  assert.equal(run('G.hero.xp'), run('xp'));
  assert.equal(run('G.enemy===primary'), true);
});

test('short idle periods age the shared active enemy once and retain only unexpired effects', () => {
  const { run } = game();
  run(`G.autoExplore=false;
    const enemy=makeEnemy(ZONES[0].enemies[0],3,3,false);G.mobs=[enemy];G.enemy=enemy;
    enemy.dotTimers=[{spellId:'spark',element:'fire',dps:2,remaining:5}];
    enemy.statuses={chilled:4,soaked:1};enemy.slowed=3;
    const earthward=SPELLS.find(sp=>sp.id==='earthward');
    G.buffs=[{...earthward.buff,_spellId:'earthward',_guardReady:false}];
    const health=enemy.hp;applyIdle(2);`);
  assert.equal(run('enemy.dotTimers[0].remaining'), 3);
  assert.equal(run('enemy.statuses.chilled'), 2);
  assert.equal(run('enemy.statuses.soaked'), undefined);
  assert.equal(run('enemy.slowed'), 1);
  assert.equal(run('enemy.hp'), run('health'));
  assert.equal(run('G.buffs[0]._guardReady'), false);
  assert.equal(run('G.buffs[0].dur'), 8);
  run('tickEnemyEffects();');
  assert.equal(run('health-enemy.hp'), 0.5);
});
