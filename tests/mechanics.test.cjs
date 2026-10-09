/* Dependency-free regression checks. Run: node --test tests/mechanics.test.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'ascii-idle-wizard.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function game(seed = 12345) {
  let now = Date.UTC(2026, 9, 9, 12);
  class GameDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const math = Object.create(Math);
  math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
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
    Math: math, Date: GameDate, console, TextEncoder, TextDecoder, URL, performance: { now: () => now },
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
  // Boot is the sole automatic invocation; all systems remain available to exercise.
  const source = script.replace(/\ninit\(\);\s*$/, '\n');
  assert.notEqual(source, script, 'expected a single removable browser boot call');
  vm.runInContext(source, sandbox, { timeout: 5000 });
  const run = source => vm.runInContext(source, sandbox, { timeout: 10000 });
  run('renderHot=()=>{}; renderCold=()=>{}; renderAll=()=>{}; recomputeStats();');
  return { run, node, advanceTime: milliseconds => { now += milliseconds; } };
}

test('the game remains one self-contained document with explicit save control', () => {
  assert.doesNotMatch(html, /<(?:script|link)\b[^>]*(?:src|href)\s*=\s*["']https?:/i);
  assert.doesNotMatch(script, /\b(?:localStorage|sessionStorage|indexedDB)\s*[.(]/);
  assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
});

test('authored text and HTML entities stay within the portable ASCII character set', () => {
  assert.doesNotMatch(html, /[^\x09\x0a\x0d\x20-\x7e]/u);
  for (const match of html.matchAll(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi)) {
    const entity = match[1];
    if (entity.startsWith('#')) {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      assert.ok(code >= 32 && code <= 126, `Non-ASCII entity: ${match[0]}`);
    } else assert.ok(['amp', 'lt', 'gt', 'quot', 'apos'].includes(entity), `Non-ASCII entity: ${match[0]}`);
  }
});

test('all map and content glyphs occupy one printable ASCII cell', () => {
  const { run } = game();
  assert.equal(run(`(() => {
    const palettes=[...ZONES.map(z=>z.palette),DUNGEON_PALETTE,TRIAL_PALETTE];
    const glyphs=[...palettes.flatMap(p=>Object.values(p)),
      ...ZONES.flatMap(z=>[...z.enemies,z.boss].map(e=>e.glyph)),
      ...Object.values(CHEST_TIERS).map(c=>c.glyph),
      ...Object.values(EL_INFO).map(e=>e.glyph),
      ...Object.values(AILMENT_TYPES).map(a=>a.glyph),
      ...FAMILIAR_TYPES.map(f=>f.glyph),...POTION_RECIPES.map(p=>p.glyph),
      ...BG_SIGILS,trialBossRef(100).glyph];
    return glyphs.every(g=>g.length===1&&g.charCodeAt(0)>=33&&g.charCodeAt(0)<=126)
      &&palettes.every(p=>new Set(Object.values(p)).size===3)
      &&new Set(Object.values(EL_INFO).map(e=>e.glyph)).size===ELEMENTS.length;
  })()`), true);
});

test('all content IDs and progression unlock references are coherent', () => {
  const { run } = game();
  assert.equal(run(`(() => {
    for(const list of [SPELLS,ZONES,BUILDINGS,GOLEM_TYPES,FAMILIAR_TYPES,RESEARCH_PROJECTS,AWAKENING_NODES,TRIAL_UPGRADES]) {
      if(new Set(list.map(x=>x.id)).size!==list.length)return false;
    }
    return SPELLS.every(s=>ELEMENTS.includes(s.element)) && ZONES.every(z=>z.killsToBoss>0&&z.enemies.length&&z.boss);
  })()`), true);
});

test('level requirements stay increasing, finite and in range of zone rewards', () => {
  const { run } = game();
  assert.equal(run(`(() => {
    let previous=0;
    for(let lvl=1;lvl<=10000;lvl++) {
      const cost=xpForLevel(lvl);
      if(!Number.isFinite(cost)||cost<=previous)return false;
      previous=cost;
    }
    return ZONES.every(z=>{
      const average=z.enemies.reduce((sum,e)=>sum+e.xp,0)/z.enemies.length;
      const kills=xpForLevel(z.lvl)/(average*ENEMY_REWARD_SCALE);
      return kills>=1&&kills<=25;
    });
  })()`), true);
  assert.equal(run('xpForLevel(95)'), 380000);
  assert.equal(run('xpForLevel(160)'), 3000000);
});

test('trial milestones retain increasing finite difficulty within the equipment scale', () => {
  const { run } = game();
  assert.equal(run(`(() => {
    let previous=trialBossRef(1);
    for(const floor of [5,10,25,50,100,200,500,1000,10000]){
      const boss=trialBossRef(floor);
      for(const key of ['hp','atk','def','gold','xp']){
        if(!Number.isFinite(boss[key])||boss[key]<=previous[key])return false;
      }
      if(boss.xp/boss.hp>previous.xp/previous.hp)return false;
      previous=boss;
    }
    return true;
  })()`), true);
  assert.ok(run('trialBossRef(100).hp') > 1000000);
  assert.ok(run('trialBossRef(100).hp') < 100000000);
  assert.ok(run('trialBossRef(100).atk') < 3000);
});

test('awakening requires progress each run and uses deepest unlocked zone', () => {
  const { run } = game();
  run('awaken();');
  assert.equal(run('G.awakenCount'), 0);
  assert.equal(run('G.spark'), 0);
  run('G.hero.lvl=24;G.unlocked=3;G.zoneIdx=0;');
  assert.equal(run('canAwaken()'), true);
  const reward = run('previewSpark()');
  run('G.zoneIdx=3;');
  assert.equal(run('previewSpark()'), reward);
  run('G.awakening.a_mythic_start=true;awaken();');
  assert.equal(run('G.spark'), reward);
  assert.equal(run('G.awakenCount'), 1);
  assert.equal(run('canAwaken()'), false);
  run('awaken();');
  assert.equal(run('G.spark'), reward);
  assert.equal(run('G.awakenCount'), 1);
});

test('trial boss XP immediately levels the hero and pays essence once', () => {
  const { run } = game();
  run(`G.trial.inTrial=true;G.map=emptyGrid(TRIAL_PALETTE);
    const boss=makeEnemy({...ZONES[0].boss,xp:100},3,3,true);
    G.mobs=[boss];G.enemy=boss;onEnemyDead(boss);`);
  assert.ok(run('G.hero.lvl') > 1);
  assert.equal(run('G.trial.floor'), 2);
  assert.equal(run('G.trial.essence'), 1);
});

test('a delayed trial respawn cannot replace the boss in a resumed run', () => {
  const { run } = game();
  run(`const callbacks=[];setTimeout=fn=>callbacks.push(fn);
    G.hero.lvl=16;recomputeStats();genMap();enterTrial();
    onEnemyDead(G.mobs[0]);
    exitTrial();enterTrial();
    const resumedBoss=G.mobs[0];resumedBoss.hp-=7;engage(resumedBoss);
    const remaining=resumedBoss.hp;callbacks[0]();`);
  assert.equal(run('G.enemy===resumedBoss'), true);
  assert.equal(run('G.mobs[0].hp'), run('remaining'));
});

test('a pending trial transition spawns the next floor in its original run', () => {
  const { run } = game();
  run(`const callbacks=[];setTimeout=fn=>callbacks.push(fn);
    G.hero.lvl=16;recomputeStats();genMap();enterTrial();
    onEnemyDead(G.mobs[0]);callbacks[0]();`);
  assert.equal(run('G.trial.floor'), 2);
  assert.equal(run('G.mobs.length'), 1);
  assert.match(run('G.mobs[0].ref.name'), /F2$/);
});

test('retained spells in locked slots neither cast nor grant passive effects', () => {
  const { run } = game();
  run(`G.equippedSpells=[null,null,null,'meteor'];G.hero.mana=1000;
    const target={hp:10000,ref:{def:0,el:'water'},dotTimers:[]};
    castOrSwing(target);`);
  assert.equal(run('G.spellCd.meteor'), undefined);
  run(`G.equippedSpells=['spark',null,null,'mend'];`);
  assert.equal(run("activeCombos().some(c=>c.id==='steam')"), false);
  assert.equal(run("ritualEquippedElements().includes('water')"), false);
});

test('a defensive spell protects against a hit on the same simulation step', () => {
  const { run } = game();
  run(`Math.random=()=>0.5;G.equippedSpells=['earthward'];
    G.enemy={hp:1000,ref:{atk:10,def:0,spd:1,name:'Training target'},dotTimers:[],slowed:0};
    G.heroAtkCd=0;G.enemyAtkCd=0;combatTick();`);
  assert.ok(run('G.baseStats.def') >= 13);
  assert.ok(run('G.hero.hp') >= 45, 'the incoming hit should use the newly cast ward');
});

test('a character killed by an overkill hit can still export and import during respawn', () => {
  const { run } = game();
  run(`G.autoExplore=false;genMap();G.hero.hp=1;G.equippedSpells=[];
    G.enemy={hp:1000,ref:{name:'Lethal target',atk:20,def:0,spd:1},dotTimers:[],slowed:0};
    G.heroAtkCd=10;G.enemyAtkCd=0;combatTick();
    const saved=exportSave();`);
  assert.equal(run('G.hero.alive'), false);
  assert.equal(run('importSave(saved)'), true, run('lastSaveError'));
  assert.equal(run('G.hero.hp'), 0);
  assert.equal(run('G.hero.alive'), false);
  run('G.hero.respawnIn=0.1;simulationTick();');
  assert.equal(run('G.hero.alive'), true);
  assert.equal(run('G.hero.respawnIn'), 0);
  assert.equal(run('importSave(exportSave())'), true, run('lastSaveError'));
});

test('refreshing a percentage ailment preserves its strength and refreshes its timer', () => {
  const { run } = game();
  run(`applyAilment('arcane',1);const reducedRegen=G.baseStats.manaRegen;
    G.hero.ailments[0].remaining=1;
    for(let i=0;i<10;i++)applyAilment('arcane',1);`);
  assert.equal(run('G.baseStats.manaRegen'), run('reducedRegen'));
  assert.equal(run('G.hero.ailments.length'), 1);
  assert.equal(run('G.hero.ailments[0].remaining'), run('AILMENT_TYPES.void.baseDur'));
});

test('map repair joins a tiny remote island to its emergency corridor', () => {
  const { run } = game();
  assert.equal(run(`(() => {
    const p=ZONES[3].palette,m=fillWalls(p);
    m[2][30]=p.ground;m[2][31]=p.ground;
    ensureConnected(m,p);
    const queue=[[30,2]],seen=new Set(['30,2']);
    for(let i=0;i<queue.length;i++){
      const [x,y]=queue[i];
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,ny=y+dy,key=nx+','+ny;
        if(nx<1||ny<1||nx>=MAP_W-1||ny>=MAP_H-1||m[ny][nx]===p.wall||seen.has(key))continue;
        seen.add(key);queue.push([nx,ny]);
      }
    }
    return m.every((row,y)=>row.every((cell,x)=>cell===p.wall||seen.has(x+','+y)));
  })()`), true);
});

test('all generated zones keep the hero, mobs and chests in one connected region', () => {
  const { run } = game(789);
  assert.equal(run(`(() => {
    for(let zone=0;zone<ZONES.length;zone++)for(let sample=0;sample<20;sample++){
      G.zoneIdx=zone;genMap();
      const queue=[[G.hero.pos.x,G.hero.pos.y]],seen=new Set([queue[0].join(',')]);
      for(let i=0;i<queue.length;i++){
        const [x,y]=queue[i];
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=x+dx,ny=y+dy,key=nx+','+ny;
          if(!isWalkable(nx,ny)||seen.has(key))continue;
          seen.add(key);queue.push([nx,ny]);
        }
      }
      if([...G.mobs,...G.chests].some(t=>!seen.has(t.x+','+t.y)))return false;
    }
    return true;
  })()`), true);
});

test('overkill cannot inflate damage rates, life leech or affinity XP', () => {
  const { run } = game();
  run(`G.hero.hp=1;G.hero.mana=1000;G.baseStats.dmgMul=1e9;
    const target={hp:5,ref:{def:0,el:'fire'},dotTimers:[]};
    castSpell(SPELLS.find(s=>s.id==='souldrain'),target);`);
  assert.equal(run('G.rates.dmgDealt60.reduce((n,e)=>n+e.amt,0)'), 5);
  assert.equal(run('G.hero.hp'), 4);
  assert.equal(run('G.elementXp.shadow'), 1);
  assert.equal(run('G.elements.shadow'), 0);
});

test('Tempest grants its speed buff and repeated DoTs refresh without multiplying', () => {
  const { run } = game();
  run(`G.hero.mana=10000;
    const target={hp:100000,ref:{def:0,el:'fire'},dotTimers:[]};
    castSpell(SPELLS.find(s=>s.id==='tempest'),target);`);
  assert.ok(run('G.baseStats.spd') > 1);
  run(`castSpell(SPELLS.find(s=>s.id==='curse'),target);
    castSpell(SPELLS.find(s=>s.id==='curse'),target);`);
  assert.equal(run('target.dotTimers.length'), 1);
  run(`castSpell(SPELLS.find(s=>s.id==='hemorrhage'),target);`);
  assert.equal(run('target.dotTimers.length'), 2);
});

test('familiars grant useful diminishing gains and potion repeats cannot compound', () => {
  const { run } = game();
  run(`G.familiars=Array.from({length:100},()=>({type:'phoenix',rarity:'legendary',name:'Pip'}));recomputeStats();`);
  const first = run('G.baseStats.dmgMul');
  assert.ok(first > 1 && first < 10);
  run(`G.familiars.push(...G.familiars.map(f=>({...f})));recomputeStats();`);
  assert.ok(run('G.baseStats.dmgMul') > first);
  assert.ok(run('G.baseStats.dmgMul') < first * 2);
  run(`G.alchemy.potions.p_boost_war={'1.00':20};
    for(let i=0;i<20;i++)consumePotion('p_boost_war');`);
  assert.equal(run("G.buffs.filter(b=>b.stat==='dmgMul').length"), 1);
});

test('travel and paused exploration still recover spell cooldowns', () => {
  const { run } = game();
  run(`G.autoExplore=false;G.spellCd.spark=1;
    for(let i=0;i<4;i++)simulationTick();`);
  assert.equal(run('G.spellCd.spark'), 0);
  assert.equal(run('G.enemy'), null);
});

test('a delayed timer processes elapsed time once, and no time means no extra progress', () => {
  const { run, advanceTime } = game();
  run('G.autoExplore=false;G.buildings.vault=1;G.spellCd.spark=3;recomputeStats();resetGameClock();');
  advanceTime(2000);
  run('gameTick();');
  assert.equal(run('G.tick'), 8);
  assert.equal(run('G.gold'), 2);
  assert.equal(run('G.spellCd.spark'), 1);
  run('gameTick();');
  assert.equal(run('G.tick'), 8);
  assert.equal(run('G.gold'), 2);
});

test('healing remains useful for a developed wizard', () => {
  const { run } = game();
  run('G.hero.maxHp=20000;');
  assert.ok(run("spellHealAmount(SPELLS.find(s=>s.id==='mend'))") >= 1600);
  assert.ok(run("spellHealAmount(SPELLS.find(s=>s.id==='greaterheal'))") >= 4000);
});

test('manual export/import retains paid research, brews, Unicode names and preferences', () => {
  const { run } = game();
  run(`G.hero.lvl=16;G.gold=10000;recomputeStats();
    startResearch('r_atk1');G.researchActive.timeLeft=37;
    G.materials={dust:1000,crystal:1000,gem:100,herb:1000};
    startBrew('p_boost_xp');G.alchemy.brewSlots[0].timeLeft=19;
    G.familiars=[{type:'sprite',rarity:'rare',name:'Mýrë 龙'}];
    G.uiCollapsed={'spellbook:fire':true};G.ui.density='compact';
    G.hero.alive=false;G.hero.respawnIn=3;G.hero.hp=0;
    const code=exportSave();
    G.researchActive=null;G.familiars=[];G.alchemy.brewSlots=[];`);
  assert.equal(run('importSave(code)'), true, run('lastSaveError'));
  assert.equal(run('G.researchActive.id'), 'r_atk1');
  assert.equal(run('G.researchActive.timeLeft'), 37);
  assert.equal(run('G.alchemy.brewSlots[0].id'), 'p_boost_xp');
  assert.equal(run('G.alchemy.brewSlots[0].timeLeft'), 19);
  assert.equal(run('G.familiars[0].name'), 'Mýrë 龙');
  assert.equal(run("G.uiCollapsed['spellbook:fire']"), true);
  assert.equal(run('G.ui.density'), 'compact');
  assert.equal(run('G.hero.alive'), false);
  assert.equal(run('G.hero.respawnIn'), 3);
});

test('legacy saves preserve level and fraction of next-level progress on the new curve', () => {
  const { run } = game();
  run(`const legacy=JSON.parse(b64ToUtf8(exportSave()));
    legacy.v=26;legacy.hero.lvl=95;
    legacy.hero.xp=Math.floor(10*Math.pow(1.32,94))*0.6;
    const migrated=buildImportedState(legacy);`);
  assert.equal(run('migrated.state.hero.lvl'), 95);
  assert.ok(Math.abs(run('migrated.state.hero.xp/xpForLevel(95)') - 0.6) < 0.00001);
});

test('malformed saves cannot partially overwrite a running character', () => {
  const { run } = game();
  run(`G.gold=54321;G.hero.lvl=12;recomputeStats();genMap();
    const good=JSON.parse(b64ToUtf8(exportSave()));const before=JSON.stringify(G);`);
  for (const mutation of [
    "d.gold='123'",
    'd.zoneIdx=999',
    "d.familiars=[{type:'sprite',rarity:'imaginary',name:'Bad'}]",
    "Object.defineProperty(d,'__proto__',{value:{polluted:true},enumerable:true})",
    'd.hero.lvl=-1',
  ]) {
    assert.equal(run(`(()=>{const d=JSON.parse(JSON.stringify(good));${mutation};return importSave(utf8ToB64(JSON.stringify(d)));})()`), false);
    assert.equal(run('JSON.stringify(G)'), run('before'));
  }
});

test('imported display text cannot carry HTML markup', () => {
  const { run } = game();
  run(`const d=JSON.parse(b64ToUtf8(exportSave()));
    d.familiars=[{type:'sprite',rarity:'common',name:'<img src=x onerror=alert(1)>'}];
    const sanitized=buildImportedState(d);`);
  assert.doesNotMatch(run('sanitized.state.familiars[0].name'), /[<>"'&]/);
});

test('idle time progresses already-paid projects and respects exploration being disabled', () => {
  const { run } = game();
  run(`G.hero.lvl=16;G.autoExplore=false;G.gold=10000;
    G.materials={dust:1000,crystal:1000,gem:100,herb:1000};recomputeStats();
    startResearch('r_atk1');startBrew('p_boost_xp');
    const beforeXp=G.hero.xp;const idle=applyIdle(120);`);
  assert.equal(run('G.researchCompleted.r_atk1'), true);
  assert.equal(run('G.researchActive'), null);
  assert.equal(run('G.alchemy.brewSlots.length'), 0);
  assert.equal(run("Object.values(G.alchemy.potions.p_boost_xp).reduce((a,b)=>a+b,0)"), 1);
  assert.equal(run('G.hero.xp'), run('beforeXp'));
  assert.equal(run('idle.kills'), 0);
});

test('an ordinary starter build can clear the first boss within a short session', () => {
  const { run } = game(101);
  run(`genMap();let deaths=0;const die=onHeroDead;
    onHeroDead=()=>{deaths++;die();};
    const gearScore=item=>Object.entries(item?.stats||{}).reduce((sum,[k,v])=>
      sum+v*({dmgMul:400,crit:100,spd:100,maxHp:0.4,maxMana:0.5,manaRegen:40,atk:4,def:4,xpMul:20,goldFind:20}[k]||1),0);
    // A deterministic player policy: equip upgrades, buy inexpensive spells and
    // five Garden levels, then keep exploring. No currency or gear is gifted.
    for(let tick=0;tick<3600&&!G.unlocked;tick++){
      simulationTick();
      if(tick%4)continue;
      for(const item of G.gearInventory)if(gearScore(item)>gearScore(G.gear[item.slot]))G.gear[item.slot]=item;
      recomputeStats();
      for(const id of ['mend','cinder','bloodbolt','hemorrhage','wellspring'])if(!G.knownSpells.includes(id))learnSpell(id);
      G.equippedSpells=['mend','wellspring','hemorrhage','bloodbolt','cinder','spark']
        .filter(id=>G.knownSpells.includes(id)).slice(0,maxSpellSlots());
      if(isManorUnlocked()&&G.buildings.garden<5)buyBuilding('garden');
    }`);
  assert.ok(run('G.unlocked') >= 1, 'starter build should clear Meadow within 15 simulated minutes');
  assert.ok(run('deaths') <= 3, 'starter progression should not require a death grind');
});

test('imported lifetime XP never appears as newly earned live XP', () => {
  const { run } = game();
  run(`G.hero.lvl=130;G.autoExplore=false;recomputeStats();
    const code=exportSave();G.hero.lvl=1;importSave(code);recordRates();`);
  assert.equal(run('G.rates.xpDelta60.reduce((sum,event)=>sum+event.amt,0)'), 0);
});

test('legitimately generated gear of every tier and rarity survives save validation', () => {
  const { run } = game(147);
  run(`G.hero.lvl=50;G.unlocked=9;G.gold=1e12;
    G.materials={dust:1e12,crystal:1e12,gem:1e12,herb:1e12};
    for(const slot of GEAR_SLOTS)for(let tier=0;tier<=5;tier++)for(const rarity of RARITY_ORDER){
      for(let sample=0;sample<3;sample++){
        const item=genGear(slot,tier,rarity);
        item.sockets=item.sockets.map((_,i)=>({type:GEM_TYPES[(tier+i)%GEM_TYPES.length].id,level:1+(tier+i)%5}));
        G.gearInventory.push(item);
      }
    }
    for(const recipe of LEGENDARY_RECIPES)craftLegendary(recipe.id);
    recomputeStats();
    const gearSignature=()=>JSON.stringify(G.gearInventory.map(item=>({
      slot:item.slot,tier:item.tier,rarity:item.rarity,
      stats:Object.entries(item.stats).sort(([a],[b])=>a.localeCompare(b)),sockets:item.sockets,
    })));
    const beforeGear=gearSignature();const code=exportSave();`);
  assert.equal(run('G.gearInventory.length'), 458);
  assert.equal(run('importSave(code)'), true, run('lastSaveError'));
  assert.equal(run('gearSignature()'), run('beforeGear'));
});

test('portable label formatting handles accents, symbols and invisible controls', () => {
  const { run } = game();
  assert.equal(run("asciiText('M\\u00FDr\\u00EB \\u9F99 \\u{1F409} \\u202E')"), 'Myre [U+9F99] [U+1F409] [U+202E]');
  assert.equal(run("asciiHTML('<M\\u00FDr\\u00EB & \\u9F99>')"), '&lt;Myre &amp; [U+9F99]&gt;');
});

test('Unicode save labels survive while gear, familiars, buffs and logs render in ASCII', () => {
  const { run, node } = game();
  run(`G.hero.lvl=16;G.autoExplore=false;recomputeStats();
    const label='M\\u00FDr\\u00EB \\u9F99';
    const gear=genGear('staff',0,'legendary');
    gear.name=label;gear.legendary=true;gear.legendaryEffect='Flame \\u{1F525}';
    G.gear.staff=gear;G.gearInventory=[{...gear,id:'g999'}];
    G.familiars=[{type:'sprite',rarity:'rare',name:label}];
    const potion=POTION_RECIPES.find(p=>p.id==='p_boost_xp');
    G.buffs=[{...potion.effect,name:label,_potionId:potion.id,_q:1}];
    G.uiCollapsed={'fam:rare':false,'inv:staff':false};
    const code=exportSave();`);
  assert.equal(run('importSave(code)'), true, run('lastSaveError'));
  assert.equal(run('G.gear.staff.name'), 'M\u00FDr\u00EB \u9F99');
  assert.equal(run('G.gear.staff.legendaryEffect'), 'Flame \u{1F525}');
  assert.equal(run('G.familiars[0].name'), 'M\u00FDr\u00EB \u9F99');
  assert.equal(run('G.buffs[0].name'), 'M\u00FDr\u00EB \u9F99');
  run('renderGear();renderFamiliars();renderHero();logLine(G.gear.staff.name);renderLog();');
  for (const id of ['gear-grid','inventory-list','familiar-list','buff-strip','log']) {
    assert.doesNotMatch(node(id).innerHTML, /[^\x09\x0a\x0d\x20-\x7e]/, id);
    assert.match(node(id).innerHTML, /Myre \[U\+9F99\]/, id);
  }
  assert.doesNotMatch(run('gearCompareText(G.gear.staff)'), /[^\x09\x0a\x0d\x20-\x7e]/);
  assert.equal(run('JSON.parse(b64ToUtf8(exportSave())).gear.staff.name'), 'M\u00FDr\u00EB \u9F99');
});

test('ASCII map punctuation is escaped without changing the cell count', () => {
  const { run, node } = game();
  run('G.chests=[];G.mobs=[];G.loot=[];G.hero.alive=false;');
  for (const [glyph, escaped] of [['<','&lt;'],['>','&gt;'],['&','&amp;'],['"','&quot;']]) {
    run(`G.map=Array.from({length:MAP_H},()=>Array(MAP_W).fill(${JSON.stringify(glyph)}));renderMap();`);
    const map=node('map').innerHTML;
    assert.equal((map.match(/<span /g)||[]).length, run('MAP_W*MAP_H'));
    assert.ok(map.includes('>'+escaped+'</span>'));
  }
});

module.exports = { game };
