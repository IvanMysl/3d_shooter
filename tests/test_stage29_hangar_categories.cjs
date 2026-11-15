'use strict';
// Stage29: concise hangar research, complete classification and mobile layout.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=name=>fs.readFileSync(path.join(__dirname,'../',name),'utf8');
const ui=read('src/22-menus-and-upgrades.js');
const players=read('src/12-arsenal-and-game.js');
const css=read('styles/70-directors-cut.css');
let checks=0;
function check(ok,reason){assert.ok(ok,reason);checks++;}
const levels=[6,3,1,1,0,0,0,0,0,0,0,0];
const context={Math,Number,Array,PERM_MAX_LEVEL:40,PERM_COUNT:12,
 DASH_DISTANCE_BASE:2.52,DASH_UPGRADE_STEP:.3,
 save:{perms:levels},developerCanAfford:()=>true};
vm.createContext(context);
vm.runInContext(players.slice(players.indexOf('const PERM_COMPOUND='),players.indexOf('function newPlayer(')),context);
vm.runInContext(ui.slice(ui.indexOf('const hangarData='),ui.indexOf('function weaponShopHTML(')),context);
const get=s=>vm.runInContext(s,context);
check(get('hangarData.length')===12,'permanent branches disappeared');
check(get('permCategories.length')===5,'all general upgrades must be grouped into five categories');
const groups=Array.from(get('permCategories')).map(g=>({id:g.id,name:g.name,upgrades:Array.from(g.upgrades)}));
const flattened=groups.flatMap(g=>g.upgrades);
check(flattened.length===12&&new Set(flattened).size===12,
 'every permanent upgrade must be placed exactly once');
check(flattened.every(i=>i>=0&&i<12),'category references an invalid branch');
const expected={defense:[0,2],energy:[3,4],combat:[1,6,7],repair:[8,9,10],abilities:[5,11]};
for(const group of groups){
 check(JSON.stringify(group.upgrades)===JSON.stringify(expected[group.id]),
  `wrong research grouped in ${group.name}`);
}
const items=Array.from(get('hangarData'));
for(const [i,item] of items.entries()){
 check(item.desc.length<=95,`branch ${i} has unnecessarily long description: ${item.desc.length}`);
 check(item.desc.includes('за уровень')||i===5&&item.desc.includes('за уровень'),
  `branch ${i} does not explain the per-level effect`);
 check(!/Каждый уровень:|сложными процентами|предыдущему|×1,/.test(item.desc),
  `branch ${i} retained old cumbersome technical copy`);
}
const current=i=>get(`permCurrentStat(${i},{id:-1,maxDurability:0})`);
check(current(0)==='158,7 ед. прочности','hull text must match purchased rank 6');
check(current(1)==='+12,5% к урону оружия','damage text must show understandable bonus');
check(current(2)==='32,7 ед. барьера','barrier text must match rank 1');
check(current(3)==='16,64 энергии/с','energy regeneration text must match rank 1');
check(current(4)==='100,0 энергии','energy capacity text must match rank 0');
check(current(5)==='2,52 м','dash distance base must be displayed');
check(current(6)==='5,80 м','EMP radius must be displayed');
check(current(7)==='66,0 урона','EMP damage must be displayed');
check(current(8)==='49,0 ед. корпуса за F','F hull repair amount missing');
check(current(9)==='7,00% прочности костюма','F suit repair percent missing');
check(current(10)==='30,00% барьера (9,8 ед.)','F barrier amount must reflect purchased barrier rank');
check(current(11)==='3,50 с защиты','shield duration missing');
check(get('permCurrentStat(9,{id:0,maxDurability:200})')==='7,00% прочности костюма (14,0 ед.)',
 'equipped suit must display repair quantity in actual durability units');
check(get('permPrice(2)')===36&&get('permPrice(8)')===45,'shop prices accidentally changed');

const markup=get('permShopHTML({id:-1,maxDurability:0})');
check((markup.match(/<details class="permCategory"/g)||[]).length===5,
 'five native expandable categories must appear');
check((markup.match(/<summary>/g)||[]).length===5,
 'each category must be keyboard accessible via summary');
check((markup.match(/data-up="\d+"/g)||[]).length===12,
 'all twelve purchase buttons must be retained under categories');
check(!/<details class="permCategory"[^>]*\bopen\b/.test(markup),
 'all categories should start collapsed on first visit');
check(markup.includes('LVL 6/40')&&markup.includes('315 ◈')&&markup.includes('LVL 3/40'),
 'existing ranks and prices must be visible after expanding a category');
check(markup.includes('Сейчас: 158,7 ед. прочности')&&markup.includes('Сейчас: 32,7 ед. барьера'),
 'rank-based values must be included in category rows');
check(css.includes('.permCategory>summary:focus-visible'),
 'keyboard focus treatment missing');
check(css.includes('@media(max-width:540px)')&&css.includes('.permUpgrade'),
 'responsive layout for narrow screens missing');
check(css.includes('min-height:69px')&&css.includes('touch-action:manipulation'),
 'category header tap targets are too small or touch-inaccessible');

console.log(`STAGE29: ${checks} grouping, clarity, live values, purchase and responsive-UI checks passed`);
