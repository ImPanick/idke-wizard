/* Focused UI state regressions; no browser or external dependencies required. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'..','ascii-idle-wizard.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\ninit\(\);\s*$/,'\n');

function ui(){
  const nodes=new Map();
  const document={activeElement:null,addEventListener(){},querySelectorAll(){return [];}};
  function createNode(){
    return {
      children:[],style:{},dataset:{},innerHTML:'',textContent:'',isConnected:true,
      classList:{add(){},remove(){},toggle(){},contains(){return false;}},
      setAttribute(){},addEventListener(){},querySelectorAll(){return [];},querySelector(){return null;},
      appendChild(child){child.parent=this;this.children.push(child);return child;},
      remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.isConnected=false;},
      focus(){document.activeElement=this;},
    };
  }
  document.body=createNode();
  document.createElement=createNode;
  document.getElementById=id=>{if(!nodes.has(id))nodes.set(id,createNode());return nodes.get(id);};
  const context={console,document,window:{addEventListener(){}},TextEncoder,TextDecoder,URL,
    setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},navigator:{}};
  vm.createContext(context);vm.runInContext(script,context,{timeout:5000});
  return {document,node:document.getElementById,run:code=>vm.runInContext(code,context,{timeout:5000})};
}

test('repeated background rewards share one stable dialog and add up until dismissed',()=>{
  const page=ui();
  page.run(`showOfflineGains({seconds:120,gold:15,xp:20,kills:2,materials:{dust:1.5},estimateNote:'Single-target estimate.'});`);
  const wrapper=page.document.body.children[0];
  const continueButton=wrapper.children[0].children[2].children[0];
  page.run(`showOfflineGains({seconds:180,gold:25,xp:40,kills:3,materials:{dust:2,crystal:1},estimateNote:'Single-target estimate.'});`);
  assert.equal(page.document.body.children.length,1);
  assert.equal(page.document.body.children[0],wrapper);
  assert.equal(wrapper.children[0].children[2].children[0],continueButton);
  assert.deepEqual(JSON.parse(page.run('JSON.stringify(_offlineGainsDialog.summary)')),
    {seconds:300,gold:40,xp:60,kills:5,materials:{dust:3.5,crystal:1},estimateNote:'Single-target estimate.'});
  assert.match(wrapper.children[0].children[1].innerHTML,/Single-target estimate\./);
  continueButton.onclick();
  assert.equal(page.document.body.children.length,0);
  assert.equal(page.run('_offlineGainsDialog'),null);
  page.run(`showOfflineGains({seconds:60,gold:3,xp:4,kills:1,materials:{}});`);
  assert.equal(page.document.body.children.length,1);
  assert.equal(page.run('_offlineGainsDialog.summary.gold'),3);
});

test('reaction guide uses shared recipes and reports the suggested loadout state',()=>{
  const page=ui();
  page.run(`G.knownSpells=['spark','gust'];G.equippedSpells=['spark','gust',null];renderReactionGuide();`);
  const output=page.node('reaction-guide').innerHTML;
  assert.match(output,/\[CONDUCT\]/);
  assert.match(output,/\[WILDFIRE\]/);
  assert.match(output,/\[SHATTER\]/);
  assert.match(output,/Spark -&gt; Gust/);
  assert.match(output,/Equipped in the suggested priority\./);
  assert.match(output,/Learn Tidal Wave \+ Lightning Bolt in Elements\./);
  page.run(`G.equippedSpells=[null,null,null,'spark','gust'];renderReactionGuide();`);
  assert.doesNotMatch(page.node('reaction-guide').innerHTML,/Equipped in the suggested priority\./);
});

test('encounter text exposes conditions, effective stats, and one-hit guard readiness',()=>{
  const page=ui();
  page.run(`recomputeStats();G.enemy={hp:50,maxHp:100,ref:{name:'Test enemy',glyph:'t',hp:100,atk:10,def:100,spd:2,el:'fire',gold:1,xp:1},statuses:{chilled:4,soaked:6,fractured:6},dotTimers:[{spellId:'spark',element:'fire',dps:1,remaining:3}]};G.buffs=[{_spellId:'earthward',_guardReady:true,dur:10}];renderTargetIntel();`);
  const output=page.node('target-intel').innerHTML;
  for(const name of ['Burning','Chilled','Soaked','Fractured'])assert.match(output,new RegExp(name));
  assert.match(output,/def 70/);
  assert.match(output,/spd 1\.20/);
  assert.match(output,/guard ready/);
  assert.match(page.run('mobTooltip(G.enemy)'),/Chilled: 4\.0s/);
  page.run('G.buffs[0]._guardReady=false;renderTargetIntel();');
  assert.match(page.node('target-intel').innerHTML,/guard spent/);
});
