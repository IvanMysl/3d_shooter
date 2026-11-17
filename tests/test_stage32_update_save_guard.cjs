'use strict';
// Stage32: online cache-busting URL, visible build label, legacy-save migration,
// old-client isolation, previous-generation rollback, multi-tab protection,
// full export/import and explicit destructive-import confirmation.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const core=read('src/00-core-save.js');
const loadout=read('src/12a-loadout-economy.js');
const norm=loadout.slice(loadout.indexOf('function normalizeLoadoutSave('),loadout.indexOf('function gunPathLevel('));
const OLD='neonrift3d-save',NEW='neonrift3d-save-protected-v1';
const OLD_BACKUP=OLD+'-backup',NEW_BACKUP='neonrift3d-save-protected-backup-v1';
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const storage=()=>{const data=new Map();return{data,getItem:k=>data.get(k)||null,
 setItem:(k,v)=>{data.set(k,String(v))},removeItem:k=>data.delete(k)}};
const deep=v=>JSON.parse(JSON.stringify(v));
const fixture={best:4,credits:15432,kills:112,runs:5,_savedAt:1700000000000,
 perms:[6,3,1,1,2,2,4,5,1,2,3,4],
 weaponMods:{0:{power:14,penetration:4,cooling:2},6:{power:9,penetration:5,precision:4},9:{power:6,penetration:8,freeze:12}},
 bodyArmor:{owned:{2:4,9:10,15:20},equipped:15,flightMods:{9:{horizontal:5,vertical:3},15:{horizontal:12,vertical:8}}},
 campaign:{schema:1,completedThrough:3,highestUnlocked:4,totalVictories:3,latestCompleted:3,records:{1:{wins:1},2:{wins:1},3:{wins:1}}},
 settings:{quality:2,cameraMode:'second',flightHorizontal:.45,flightVertical:.75,audio:false},
 checkpoint:{version:4,state:'upgrade',sector:3,score:500,kills:9,upgrades:{cool:2},pendingUpgrade:['damage','cool','armor'],player:{hp:86,maxhp:160,bodyArmor:200,damage:2.4},live:{mission:{version:1,type:'purge',done:8,required:8}}}};
function app(local,options={}){
 const session=storage(),events={},input={style:{},files:null,click(){},
  addEventListener(type,fn){events[type]=fn}},
  ui={append(){},querySelector(){return{onclick:null}},remove(){}},
  elements=new Map(),downloaded=[];
 let exported=null;
 const document={body:{append(node){if(node.id)elements.set(node.id,node)}},getElementById:id=>elements.get(id)||null,
  createElement:type=>type==='input'?input:type==='a'?{click(){downloaded.push(this.href)},remove(){}}:
   {id:'',setAttribute(){},querySelector:()=>({}),remove(){elements.delete(this.id)}}};
 const ctx={Math,Array,Number,Object,Date,JSON,console,Blob,Map,Set,
  document,localStorage:local,sessionStorage:session,performance:{now:()=>0},
  URL:{createObjectURL:b=>(exported=b,'blob:backup'),revokeObjectURL(){}},
  setTimeout(){},alert:message=>{throw Error('Unexpected import error: '+message)},
  confirm:()=>options.confirm!==false,
  addEventListener:(name,fn)=>{events[name]=fn},
  refreshCameraInterface(){},showCampaignMap(){},
  window:{location:{reload(){ctx.reloads=(ctx.reloads||0)+1}}}};
 vm.createContext(ctx);vm.runInContext(core,ctx);
 // Use the REAL armor and weapon save normalization on imported backups.
 ctx.weapons=Array(10).fill({});
 ctx.GUN_PATHS=[['power','penetration','cooling'],['power','penetration','precision'],
  ['power','penetration','rate'],['power','penetration','cooling'],
  ['power','penetration','blast'],['power','penetration','rate'],
  ['power','penetration','precision'],['power','penetration','blast'],
  ['power','penetration','blast'],['power','penetration','freeze']];
 ctx.WEAPON_MAX_LEVEL=20;ctx.BODY_ARMOR_CATALOG=Array(16).fill({});ctx.FLIGHT_MOD_MAX_LEVEL=20;
 vm.runInContext(norm,ctx);
 const run=code=>vm.runInContext(code,ctx);
 return{ctx,run,events,input,downloaded,elements,session,
  get exported(){return exported},get banner(){return elements.get('saveConflictBanner')}};
}
function assertPurchases(snapshot,credits=fixture.credits){
 check(JSON.stringify(snapshot.perms)===JSON.stringify(fixture.perms),'one of 12 permanent upgrades was lost');
 check(JSON.stringify(snapshot.bodyArmor)===JSON.stringify(fixture.bodyArmor),
  'armor ownership, levels or flight mods were lost');
 for(const key of Object.keys(fixture.weaponMods))check(
  JSON.stringify(snapshot.weaponMods[key])===JSON.stringify(fixture.weaponMods[key]),
  'purchased weapon ranks disappeared for gun '+key);
 check(snapshot.credits===credits&&snapshot.campaign.highestUnlocked===4,
  'credits or campaign progress were dropped');
 check(JSON.stringify(snapshot.checkpoint)===JSON.stringify(fixture.checkpoint),
  'unclaimed reward or live run checkpoint were dropped');
}
(async()=>{
 const local=storage();local.setItem(OLD,JSON.stringify(fixture));
 local.setItem(OLD_BACKUP,JSON.stringify(fixture));
 const first=app(local);
 check(Number(first.run('GAME_BUILD'))>=32,'build must not regress below Stage32');
 check(first.run('SAVE_KEY')!==first.run('LEGACY_SAVE_KEY'),'old versions can overwrite the new save key');
 check(!!local.getItem(NEW),'existing Stage31 progress was not migrated on first visit');
 assertPurchases(JSON.parse(local.getItem(NEW)));
 check(local.getItem(OLD)!==null,'legacy save was deleted during migration');
 const beforeUpgrade=JSON.parse(local.getItem(NEW));
 first.run('save.credits+=100;persist()');
 const afterUpgrade=JSON.parse(local.getItem(NEW));
 check(afterUpgrade.credits===beforeUpgrade.credits+100,'Stage32 purchase did not persist');
 check(JSON.parse(local.getItem(NEW_BACKUP)).credits===beforeUpgrade.credits,
  'previous-generation recovery snapshot is not retained');
 check(JSON.parse(local.getItem(NEW_BACKUP))._savedAt<afterUpgrade._savedAt,
  'backup is identical to main, not a real earlier generation');
 const damaged=storage();damaged.setItem(NEW,'{invalid json');
 damaged.setItem(NEW_BACKUP,JSON.stringify(fixture));
 const recovered=app(damaged);
 check(recovered.run('save.credits')===fixture.credits&&
   JSON.parse(damaged.getItem(NEW)).credits===fixture.credits,
  'previous-generation recovery failed after corrupt protected primary');

 // A pre-Stage32 tab writing legacy keys cannot overwrite the protected save.
 const older={...fixture,credits:5,_savedAt:afterUpgrade._savedAt+200};
 local.setItem(OLD,JSON.stringify(older));
 const reopened=app(local);
 check(reopened.run('save.credits')===afterUpgrade.credits,
  'old HTML overwrote protected Stage32 purchases through legacy storage');
 check(reopened.run('legacyDiverged')===true,'legacy divergence was not reported to player');
 reopened.run('persist()');
 check(JSON.parse(local.getItem(OLD)).credits===5,
  'new version destroyed separately changed legacy save before JSON export');
 assertPurchases(reopened.run('save'),afterUpgrade.credits);

 // Separate new tabs share a canonical journal; a stale writer must STOP.
 const other=app(local),oldStamp=other.run('lastSavedAt');
 reopened.run('save.credits+=75;persist()');
 const expectedNew=JSON.parse(local.getItem(NEW));
 check(expectedNew.credits===afterUpgrade.credits+75,'newer tab could not save its own purchases');
 other.run('save.credits+=999');
 const secondWrite=other.run('persist()');
 check(secondWrite===false,'stale tab was allowed to overwrite the new progress');
 check(!!other.banner,'conflicting tab did not show a visible recovery banner');
 check(JSON.parse(local.getItem(NEW)).credits===expectedNew.credits,
  'stale tab actually erased newer purchases');
 check(other.run('saveConflict')===true&&oldStamp<expectedNew._savedAt,
  'conflict not recognized or watermark not advanced');

 // Even when blocked, export is still possible from the local in-memory run.
 other.ctx.backupFile();
 const backup=JSON.parse(await other.exported.text());
 check(backup.format==='NEON_RIFT_BACKUP_V3'&&backup.saved.credits===afterUpgrade.credits+999,
  'conflicting tab could not export its unsaved state as JSON');
 check(other.downloaded.length===1,'conflict backup download did not start');

 // A second tab receives a storage notification without waiting to save.
 const observer=app(local);
 reopened.run('save.credits+=12;persist()');
 observer.events.storage({key:NEW,newValue:local.getItem(NEW)});
 check(observer.run('saveConflict')===true&&observer.run('persist()')===false,
  'browser storage event did not block competing writes');

 const combatTab=app(local);
 combatTab.ctx.pause=()=>{combatTab.run('game.state="paused"');combatTab.ctx.pausedForConflict=true};
 combatTab.run('game={state:"playing"}');
 reopened.run('save.credits+=7;persist()');
 combatTab.events.storage({key:NEW,newValue:local.getItem(NEW)});
 check(combatTab.ctx.pausedForConflict===true&&combatTab.run('game.state')==='paused',
  'combat kept running when autosaves became unsafe');
 combatTab.run('game=null');

 // Confirming JSON import is an explicit intentional replacement of progress.
 const importer=app(local);
 importer.input.files=[{text:async()=>JSON.stringify({format:'NEON_RIFT_BACKUP_V3',saved:fixture})}];
 await importer.events.change();
 assertPurchases(JSON.parse(local.getItem(NEW)));
 check(importer.run('saveConflict')===false,'confirmed import did not leave protection unlocked');
 const denied=app(local,{confirm:false});
 denied.input.files=[{text:async()=>JSON.stringify({format:'NEON_RIFT_BACKUP_V3',saved:{...fixture,credits:1}})}];
 const untouched=local.getItem(NEW);await denied.events.change();
 check(local.getItem(NEW)===untouched,'declined import replaced the existing game');

 // Runtime UI must reveal the actual version, and never offer a reload in a
 // running / paused match. Different URLs remain within the same origin.
 const panelSource=read('src/20-minimap-and-checkpoint.js');
 let markup='',top=500;
 const panel={get innerHTML(){return markup},set innerHTML(v){markup=v},
  get scrollTop(){return top},set scrollTop(v){top=v}};
 const ui={GAME_BUILD:'32',GAME_RELEASE:'2026-11-16',game:null,legacyDiverged:false,
  location:{protocol:'https:'},$:id=>id==='panel'?panel:{classList:{remove(){}}},
  updateFullscreenButtons(){}};
 vm.createContext(ui);vm.runInContext(panelSource.slice(panelSource.indexOf('function panel(html){')),ui);
 ui.panel('<h1>МЕНЮ</h1>');
 check(markup.includes('NEON RIFT 3D · V32')&&markup.includes('href="?v=32"'),
  'menu lacks visible version or safe cache-busting URL');
 check(top===0,'page did not scroll to its heading');
 ui.game={state:'paused'};ui.panel('<h1>ПАУЗА</h1>');
 check(!markup.includes('href="?v=32"'),'gameplay pause exposes a potentially destructive reload shortcut');
 ui.game=null;ui.location.protocol='file:';ui.panel('<h1>МЕНЮ</h1>');
 check(!markup.includes('href="?v=32"'),'offline HTML suggests a misleading network-update link');
 ui.legacyDiverged=true;ui.location.protocol='https:';ui.panel('<h1>МЕНЮ</h1>');
 check(markup.includes('Старая версия игры создала более позднее отдельное сохранение'),
  'legacy divergence has no player-facing explanation');

 console.log(`STAGE32 UPDATE/SAVE SAFETY: ${checks} assertions passed`);
})().catch(err=>{console.error(err);process.exitCode=1});
