/* Focused spell identity and elemental reaction regressions. No dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const html = fs.readFileSync(path.join(__dirname, '..', 'ascii-idle-wizard.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function game() {
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
  const math = Object.create(Math);
  math.random = () => 0.5;
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
  assert.notEqual(source, script, 'browser boot must be disabled for the fixture');
  vm.runInContext(source, sandbox, { timeout: 5000 });
  const run = source => vm.runInContext(source, sandbox, { timeout: 10000 });
  run(`renderHot=()=>{};renderCold=()=>{};renderAll=()=>{};recomputeStats();
    G.autoExplore=false;G.map=emptyGrid(ZONES[0].palette);G.hero.pos={x:1,y:1};
    G.hero.mana=10000;G.mobs=[];G.chests=[];G.enemy=null;
    function mob(x,y,hp=3000,def=0){
      const e=makeEnemy({name:'Target',hp,atk:20,def,spd:1,gold:0,xp:0,el:null},x,y,false);
      e.hp=e.maxHp=e.ref.hp=hp;G.mobs.push(e);return e;
    }
    function cast(id,target){
      castSpell(SPELLS.find(s=>s.id===id),target);
      settleDefeatedEnemies([...G.mobs]);
    }
  `);
  return { run };
}

test('Spark creates one short burn and its refresh does not stack copies', () => {
  const { run } = game();
  run(`const target=mob(5,5);const before=target.hp;cast('spark',target);
    const direct=before-target.hp;const firstDot=target.dotTimers.find(d=>d.spellId==='spark');`);
  assert.ok(run('firstDot'), 'Spark should leave a damage-over-time effect');
  assert.ok(Math.abs(run('firstDot.dps*firstDot.remaining') - run('direct*0.25')) < 0.000001);
  assert.equal(run('firstDot.remaining'), 3);
  run(`cast('spark',target);`);
  assert.equal(run("target.dotTimers.filter(d=>d.spellId==='spark').length"), 1);
});

test('Ice Shard delays incoming attacks and its chill expires', () => {
  const { run } = game();
  run(`const target=mob(5,5);cast('iceshard',target);
    G.enemy=target;G.heroAtkCd=999;G.enemyAtkCd=1;
    const before=G.hero.hp;for(let i=0;i<4;i++)combatTick();`);
  assert.equal(run('G.hero.hp'), run('before'), 'chill should delay the hit beyond the normal one-second interval');
  run(`G.enemy=null;for(let i=0;i<16;i++)tickEnemyEffects();
    G.enemy=target;G.heroAtkCd=999;G.enemyAtkCd=1;for(let i=0;i<4;i++)combatTick();`);
  assert.ok(run('G.hero.hp') < run('before'), 'the normal attack interval should return after four seconds');
});

test('Tidal Wave splashes only two nearby visible enemies', () => {
  const { run } = game();
  run(`const target=mob(5,5),near=mob(6,5),other=mob(5,7),third=mob(7,6),far=mob(12,5);
    cast('tidalwave',target);`);
  const direct = run('target.maxHp-target.hp');
  assert.ok(direct > 0);
  assert.ok(Math.abs(run('near.maxHp-near.hp') - direct * 0.4) <= 1);
  assert.ok(Math.abs(run('other.maxHp-other.hp') - direct * 0.4) <= 1);
  assert.equal(run('third.hp'), 3000);
  assert.equal(run('far.hp'), 3000);
});

test('area effects cannot jump across a solid wall', () => {
  const { run } = game();
  run(`const target=mob(5,5),blocked=mob(7,5);
    G.map[5][6]=ZONES[0].palette.wall;cast('tidalwave',target);`);
  assert.equal(run('blocked.hp'), 3000);
});

test('Chain Lightning hops outward with falloff and never hits a target twice', () => {
  const { run } = game();
  run(`const target=mob(5,5),hop1=mob(8,5),hop2=mob(11,5),beyond=mob(14,5);
    cast('chainlightning',target);`);
  const direct = run('target.maxHp-target.hp');
  assert.ok(Math.abs(run('hop1.maxHp-hop1.hp') - direct * 0.55) <= 1);
  assert.ok(Math.abs(run('hop2.maxHp-hop2.hp') - direct * 0.30) <= 1);
  assert.equal(run('beyond.hp'), 3000);
  assert.ok(Math.abs(run('G.rates.dmgDealt60.reduce((sum,e)=>sum+e.amt,0)') - direct * 1.85) <= 2);
});

test('Quake fractures every victim and restores armor after six seconds', () => {
  const { run } = game();
  run(`const target=mob(5,5,3000,100),near=mob(6,5,3000,100),other=mob(5,6,3000,100),third=mob(4,5,3000,100),outside=mob(9,5,3000,100);
    cast('quake',target);`);
  for (const name of ['target', 'near', 'other', 'third']) {
    assert.equal(run(`enemyDefense(${name})`), 70);
  }
  assert.equal(run('enemyDefense(outside)'), 100);
  run('for(let i=0;i<24;i++)tickEnemyEffects();');
  assert.equal(run('enemyDefense(target)'), 100);
});

test('Earthward consumes its guard on one hit while its defense buff remains', () => {
  const { run } = game();
  run(`const target=mob(5,5);cast('earthward',target);
    G.enemy=target;G.heroAtkCd=999;G.enemyAtkCd=0;
    const before=G.hero.hp;combatTick();const firstLoss=before-G.hero.hp;
    G.heroAtkCd=999;G.enemyAtkCd=0;const afterFirst=G.hero.hp;combatTick();const secondLoss=afterFirst-G.hero.hp;`);
  assert.ok(Math.abs(run('firstLoss/secondLoss') - 0.6) < 0.000001);
  assert.ok(run('G.baseStats.def') >= 13);
});

test('Holy Smite executes only targets at or below thirty percent health', () => {
  const { run } = game();
  run(`const normal=mob(5,5),wounded=mob(7,5);wounded.hp=wounded.maxHp*0.3;
    const normalBefore=normal.hp,woundedBefore=wounded.hp;
    cast('holysmite',normal);cast('holysmite',wounded);`);
  assert.ok(Math.abs(run('(woundedBefore-wounded.hp)/(normalBefore-normal.hp)') - 1.5) < 0.02);
});

test('Soul Drain harvests at most two seconds from each DoT and leeches actual total damage', () => {
  const { run } = game();
  run(`const target=mob(5,5);cast('spark',target);cast('curse',target);
    const dotTimes=target.dotTimers.map(d=>({id:d.spellId,time:d.remaining}));
    G.hero.maxHp=1000;G.hero.hp=1;const before=target.hp;
    cast('souldrain',target);const drained=before-target.hp;`);
  assert.ok(run('drained') > 115, 'harvesting should add damage beyond the direct hit');
  assert.equal(run('G.hero.hp'), run('1+Math.floor(drained*0.6)'));
  assert.equal(run(`dotTimes.every(old=>{
    const current=target.dotTimers.find(d=>d.spellId===old.id);
    return old.time<=2?!current:Math.abs(current.remaining-(old.time-2))<0.000001;
  })`), true);
});

test('Soul Drain cannot leech the unspent damage of a dying target', () => {
  const { run } = game();
  run(`const target=mob(5,5);cast('curse',target);target.hp=2;
    G.hero.hp=1;const beforeRates=G.rates.dmgDealt60.length;cast('souldrain',target);`);
  assert.equal(run('G.hero.hp'), 2);
  assert.equal(run('G.rates.dmgDealt60.slice(beforeRates).reduce((sum,e)=>sum+e.amt,0)'), 2);
});

test('Conduct consumes only the primary Soaked condition and cannot recurse through neighbors', () => {
  const { run } = game();
  run(`const target=mob(5,5),near=mob(6,5),other=mob(5,7),third=mob(7,6);
    cast('tidalwave',target);const before=[target,near,other,third].map(e=>e.hp);
    cast('lightningbolt',target);const losses=[target,near,other,third].map((e,i)=>before[i]-e.hp);`);
  assert.ok(run('losses[0]') > 63, 'Conduct should add damage to the direct hit');
  assert.ok(run('losses[1]') > 0);
  assert.ok(run('losses[2]') > 0);
  assert.equal(run('losses[3]'), 0, 'a secondary hit must not start another Conduct');
  assert.equal(run("enemyConditions(target).some(c=>c.id==='soaked')"), false);
  assert.equal(run("enemyConditions(near).some(c=>c.id==='soaked')"), true);
  run(`const beforeAgain=near.hp;cast('lightningbolt',target);`);
  assert.equal(run('near.hp'), run('beforeAgain'), 'the consumed primary condition cannot react again');
});

test('Wildfire transfers a weaker burn to two neighbors with its remaining lifetime', () => {
  const { run } = game();
  run(`const target=mob(5,5),near=mob(6,5),other=mob(5,7),third=mob(7,6);
    cast('spark',target);tickEnemyEffects();
    const source=target.dotTimers.find(d=>d.spellId==='spark');
    const dps=source.dps,time=source.remaining;cast('gust',target);`);
  assert.equal(run("target.dotTimers.some(d=>d.spellId==='spark')"), false);
  for (const name of ['near', 'other']) {
    assert.ok(Math.abs(run(`${name}.dotTimers.reduce((sum,d)=>sum+d.dps,0)`) - run('dps*0.6')) < 0.000001);
    assert.equal(run(`${name}.dotTimers[0].remaining`), run('time'));
  }
  assert.equal(run('third.dotTimers.length'), 0);
});

test('Wildfire preserves the original burn when there is no reachable neighbor', () => {
  const { run } = game();
  run(`const target=mob(5,5);cast('spark',target);cast('gust',target);`);
  assert.equal(run("target.dotTimers.some(d=>d.spellId==='spark')"), true);
});

test('Shatter consumes chill and adds a single burst to the earth hit', () => {
  const { run } = game();
  run(`const target=mob(5,5),normal=mob(9,5);cast('iceshard',target);
    const before=target.hp,normalBefore=normal.hp;cast('stone',target);cast('stone',normal);`);
  assert.ok(Math.abs(run('(before-target.hp)/(normalBefore-normal.hp)') - 1.5) < 0.04);
  assert.equal(run("enemyConditions(target).some(c=>c.id==='chilled')"), false);
});

test('DoTs damage side enemies once per simulation step while leaving the engaged target active', () => {
  const { run } = game();
  run(`const primary=mob(5,5),side=mob(6,5);cast('spark',side);
    G.enemy=primary;G.heroAtkCd=999;G.enemyAtkCd=999;
    const before=side.hp,dps=side.dotTimers[0].dps;simulationTick();`);
  assert.ok(Math.abs(run('before-side.hp') - run('dps*TICK_S')) < 0.000001);
  assert.equal(run('G.enemy===primary'), true);
});

test('secondary deaths reward once without clearing the active primary encounter', () => {
  const { run } = game();
  run(`const primary=mob(5,5),side=mob(6,5,1);side.ref.gold=10;
    G.enemy=primary;cast('tidalwave',primary);
    const after=G.gold;settleDefeatedEnemies([side,side]);`);
  assert.equal(run('G.enemy===primary'), true);
  assert.equal(run('G.mobs.includes(side)'), false);
  assert.equal(run('after'), 10);
  assert.equal(run('G.gold'), 10);
  assert.equal(run('G.rates.killTimes60.length'), 1);
});

test('a lethal area cast resolves every victim before a boss replaces the map mobs', () => {
  const { run } = game();
  run(`G.kills=ZONES[0].killsToBoss-1;
    const primary=mob(5,5,1),side=mob(6,5,1);primary.ref.gold=10;side.ref.gold=20;
    G.enemy=primary;cast('tidalwave',primary);`);
  assert.equal(run('G.gold'), 30);
  assert.equal(run('G.rates.killTimes60.length'), 2);
  assert.equal(run('G.mobs.filter(e=>e.isBoss).length'), 1);
  assert.equal(run('G.mobs.includes(primary)||G.mobs.includes(side)'), false);
  assert.equal(run('G.enemy'), null);
});
