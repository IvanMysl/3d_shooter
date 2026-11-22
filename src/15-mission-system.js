
// Reactive arena devices: their visible steel housings are PHYSICAL solids; only glow rings are non-solid.
const NODE_TYPES=[
 {name:'ТЕРМОРЕАКТОР',color:[1,.43,.18],radius:4.4},
 {name:'ЭМИ-ЯДРО',color:[.31,.8,1],radius:5.5},
 {name:'КОНТЕЙНЕР СНАБЖЕНИЯ',color:[.36,1,.57],radius:3.4}
];
// Mission engine: objectives are part of the level state, including autosaves.
const MISSION_TYPES={
 purge:{name:'ЗАЧИСТКА',icon:'⚔',hint:'Уничтожь всех роботов и доберись до портала'},
 sabotage:{name:'САБОТАЖ',icon:'ϟ',hint:'Выведи из строя энергоузлы и уничтожь охрану'},
 recovery:{name:'РАЗВЕДКА',icon:'◈',hint:'Собери три архивных ядра и отбейся от роботов'},
 hunt:{name:'ОХОТА',icon:'♜',hint:'Устрани командира и уничтожь охрану'},
 boss:{name:'ВЛАДЫКА РАЗЛОМА',icon:'♛',hint:'Победи босса и активируй портал'},
 holdout:{name:'ОБОРОНА КОМПЛЕКСА',icon:'◴',hint:'Выдержи осаду и уничтожь оставшиеся машины'},
 relay:{name:'ЗАПУСК РЕТРАНСЛЯТОРОВ',icon:'⌁',hint:'Включи два ретранслятора, затем уничтожь охрану'},
 containment:{name:'ИЗОЛЯЦИЯ КОМПЛЕКСА',icon:'◈',hint:'Отключи реальные реакторы, затем удерживай комплекс под осадой'},
 conduit:{name:'ПРОРЫВ КОНТУРА',icon:'ϟ',hint:'Обезвредь импульсные излучатели, затем выведи из строя энергоузел'},
 signal:{name:'РАДИОПЕРЕХВАТ',icon:'⌁',hint:'Запитай реальные станции связи, обнаружь и уничтожь командира'},
 surge:{name:'РЕЗОНАНСНАЯ ПЕРЕГРУЗКА',icon:'ϟ',hint:'Заряди физическую энергостанцию и отключи реакторы в активное окно'}
};
// Stage97: two genuine two-phase operations on 18 later sectors. Existing
// objective types on early tutorial stages, bosses and relay/holdout sectors
// remain unchanged; old checkpoint.mission.type is always preserved verbatim.
function missionType(level){if(level%5===0)return'boss';if(level>=11&&level%10===1)return'holdout';if(level>=14&&level%10===4)return'relay';if(level>=12&&level%10===2)return'containment';if(level>=16&&level%10===6)return'conduit';if(level>=13&&level%10===3)return'signal';if(level>=17&&level%10===7)return'surge';return ['purge','sabotage','recovery','hunt'][(level-1)%5]||'purge'}
function missionInfo(level){const key=missionType(level);return MISSION_TYPES[key]}
// Stage85: tactical operation protocols. A fraction of the recon/relay jobs
// require an actual multi-stop route; the rest deliberately stay free-form.
// No new solid objects, unreachable objective sites or teleport shortcuts.
function missionRouteMode(level,type){
 if(type==='recovery')return ['free','near-first','far-first'][Math.floor(level/5)%3];
 if(type==='relay')return Math.floor(level/10)%2?'far-first':'free';
 return 'free';
}
// STAGE93: interaction is not an XZ proximity cheat. A full-height wall, an
// equipment housing or a mesh-registered guard rail between the operator and
// the objective blocks activation. The test ray uses the actual bullet/world
// collision registry; the objective's OWN steel housing is the legitimate
// endpoint (the floating archive crystal and light rings are non-solid FX).
// In particular a player must not collect data or charge a relay through a
// thin solid separator just because the two XZ coordinates are close.
// STAGE94: environmental hazards are governed by the same *real solid*
// intersection as shots. A steel handrail, gantry, chassis, closed wall or
// intervening floor can block an energy pulse; height is part of the ray.
// For the player, sample three exposed body heights: low cover offers partial
// protection while a full wall or steel housing offers full protection.
// This is not a 2D mapCells/Euclidean shortcut and works in Canvas too.
function missionHazardRayClear(origin,target,contact=null){
 const dx=target.x-origin.x,dy=target.y-origin.y,dz=target.z-origin.z;
 const length=Math.hypot(dx,dy,dz);
 if(!(length>1e-5))return true;
 const hit=rayWall(origin,{x:dx/length,y:dy/length,z:dz/length},length);
 return !hit||hit.t>=length-.005||!!(contact&&hit.solid?.entity===contact);
}
function missionHazardPlayerExposure(origin,p){
 const feet=Number.isFinite(p?.feetY)?p.feetY:floorHeight(p.x,p.z);
 let visible=0;
 for(const off of [.36,.90,1.42])
  if(missionHazardRayClear(origin,{x:p.x,y:feet+off,z:p.z}))visible++;
 return visible/3;
}
function missionCoilPulseExposure(device,p){
 const dx=p.x-device.x,dz=p.z-device.z,length=Math.hypot(dx,dz)||1;
 // Emit from the metal emitter's *outside face*, not the inside of its own
 // solid casing. Otherwise every ray would collide with its own device at t=0.
 const source={x:device.x+dx/length*.43,
  y:floorHeight(device.x,device.z)+.70,
  z:device.z+dz/length*.43};
 return missionHazardPlayerExposure(source,p);
}
function missionInteractionKind(target){
 return game?.mission?.type==='recovery'&&game.mission.caches?.includes(target)?'archive':'device';
}
function missionInteractionClear(p,target,kind=missionInteractionKind(target)){
 if(!p||!target||!Number.isFinite(p.x)||!Number.isFinite(p.z)||
    !Number.isFinite(target.x)||!Number.isFinite(target.z))return false;
 const range=kind==='archive'?1.04:1.25;
 const dx=target.x-p.x,dz=target.z-p.z,flat=Math.hypot(dx,dz);
 if(!(flat<range))return false;
 const ground=floorHeight(target.x,target.z),feet=Number.isFinite(p.feetY)?p.feetY:floorHeight(p.x,p.z);
 if(Math.abs(feet-ground)>=(kind==='archive'?1.65:1.2))return false;
 if(flat<1e-5)return true; // legacy checkpoints/tests may already overlap a target
 const a={x:p.x,y:feet+.80,z:p.z},endY=ground+(kind==='archive'?.78:.80);
 const len=Math.hypot(dx,dz,endY-a.y);
 if(!(len>1e-5))return true;
 const hit=rayWall(a,{x:dx/len,y:(endY-a.y)/len,z:dz/len},len);
 // Contact with THIS device is the expected end of the ray. Any other
 // physical surface hit earlier means that a wall separates the operator.
 return !hit||hit.solid?.entity===target||hit.t>=len-.025;
}
function missionApproachOpen(x,z,site){
 if(!playerNavTile(x,z))return false;
 const p={x:x+.5,z:z+.5,feetY:navStandingFeet(x+.5,z+.5,playerNavProfile)};
 return missionInteractionClear(p,site);
}
// A steel mission terminal has a true solid body. Routes end at one of its
// four safely reachable *adjacent* cells, not inside that solid. Pick the
// least expensive real approach in the operator navigation component.
function missionApproachDistance(field,site){
 const x=Math.floor(site.x),z=Math.floor(site.z),n=mapSize;
 let best=32767;
 for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
  const X=x+dx,Z=z+dz;
  if(X<1||Z<1||X>=n-1||Z>=n-1||!missionApproachOpen(X,Z,site))continue;
  const d=field[Z*n+X];
  if(d>=0&&d<32767)best=Math.min(best,d+((dx||dz)?1:0));
 }
 return best===32767?-1:best;
}
function missionPlanOrder(g,items){
 const m=g?.mission;
 if(!m||m.routeMode==='free'||!items.length){if(m)m.routeOrder=[];return;}
 const field=missionGroundField(spawnX,spawnZ);
 const ordered=items.map(item=>({id:item.id,d:missionApproachDistance(field,item)}));
 // All mission sites passed the full edge-aware BFS in Stage84. If an old
 // imported map has any disconnected object, do NOT impose a soft-lock.
 if(ordered.some(q=>q.d<0||!Number.isFinite(q.d))){m.routeMode='free';m.routeOrder=[];return;}
 ordered.sort((a,b)=>(m.routeMode==='near-first'?a.d-b.d:b.d-a.d)||(a.id-b.id));
 m.routeOrder=ordered.map(q=>q.id);
}
function missionItemActive(g,item,type){
 const m=g?.mission;
 if(!m||m.type!==type||m.routeMode==='free'||!Array.isArray(m.routeOrder)||!m.routeOrder.length)return true;
 return m.routeOrder[Math.min(m.done,m.routeOrder.length-1)]===item.id;
}
function missionSequenceHint(g){
 const m=g?.mission;
 // New two-phase briefings are independent of the old Stage85 routeOrder:
 // both operations allow free-order physically accessible objective sites.
 if(m?.version>=3&&m.type==='containment')return m.done<m.required
  ?'Фаза 1/2 · отключи физические реакторы'
  :'Фаза 2/2 · удерживай комплекс до стабилизации';
 if(m?.version>=3&&m.type==='conduit')return (m.coilsDisabled||0)<(m.coilsRequired||0)
  ?'Фаза 1/2 · обезвредь реальные импульсные излучатели'
  :'Фаза 2/2 · отключи энергоузел и зачисти охрану';
 if(m?.version>=4&&m.type==='signal')return (m.signalDone||0)<(m.signalRequired||0)
  ?'Фаза 1/2 · подключи физические станции радиоперехвата'
  :'Фаза 2/2 · устранить обнаруженного командира';
 if(m?.version>=4&&m.type==='surge')return !m.surgeReady&&m.surgeRequired
  ?'Фаза 1/2 · включи энергостанцию для перегрузки реакторов'
  :'Фаза 2/2 · отключи реакторы в активное окно';
 if(!m||m.routeMode==='free'||!Array.isArray(m.routeOrder)||!m.routeOrder.length)return '';
 if(m.type!=='recovery'&&m.type!=='relay')return '';
 if(m.done>=m.required)return 'Все узлы маршрута активированы · уничтожь охрану';
 return m.type==='recovery'
  ?`Последовательно собери ядра: этап ${m.done+1}/${m.required}`
  :`Запусти ретрансляторы по цепи: этап ${m.done+1}/${m.required}`;
}
// Stage84: mission objects must live on actual *walkable*, obstacle-free
// routes. Decorative room centres are not sufficient: a room can contain a
// stair flight, a physical rail, or have a disconnected ground-level approach.
// Keep all objectives on the same grid and real operator navigation graph as the world.
let missionSitesCache=null;
function missionGroundField(startX,startZ){
 const n=mapSize,dist=new Int16Array(n*n);dist.fill(-1);
 const sx=Math.floor(startX),sz=Math.floor(startZ);
 if(sx<1||sz<1||sx>=n-1||sz>=n-1||mapCells[sz]?.[sx]!==0||!playerNavTile(sx,sz))return dist;
 const q=new Int32Array(n*n);let head=0,tail=0;
 dist[sz*n+sx]=0;q[tail++]=sz*n+sx;
 while(head<tail){const i=q[head++],x=i%n,z=(i/n)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz,k=Z*n+X;
   if(X<1||Z<1||X>=n-1||Z>=n-1||dist[k]>=0||mapCells[Z][X]!==0)continue;
   if(typeof playerNavEdge==='function'&&!playerNavEdge(x,z,X,Z))continue;
   dist[k]=dist[i]+1;q[tail++]=k;
  }
 }
 return dist;
}
function missionSiteInventory(){
 // Invalidate for new terrain *and* changed solid registry (quality settings).
 if(missionSitesCache?.map===mapCells&&missionSitesCache?.solids===worldSolidGrid&&missionSitesCache.count===worldSolidCount&&missionSitesCache.gl===glReady&&missionSitesCache.heights===heightCells&&missionSitesCache.decks===deckCells)
  return missionSitesCache;
 const n=mapSize,fromSpawn=missionGroundField(spawnX,spawnZ),candidates=[];
 for(let z=2;z<n-2;z++)for(let x=2;x<n-2;x++){
  const k=z*n+x;
  if(fromSpawn[k]<6||mapCells[z][x]!==0||floorHeightAtCell(x,z)>.06)continue;
  const px=x+.5,pz=z+.5;
  if(Math.hypot(px-portal.x,pz-portal.z)<3.5||collide(px,pz,.68))continue;
  // Mesh-derived collision is checked when available. The Canvas fallback
  // continues to use the exact same authored wall cells and ground heights.
  if(worldSolidBodyCollision(px,pz,.34,0,1.75))continue;
  // Stage86: a real 3D equipment chassis must not become an accidental
  // one-cell gate. Only use wide approaches with at least three walkable
  // robot connections BEFORE installing the new housing.
  let exits=0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])
   if(fromSpawn[(z+dz)*n+x+dx]>=0&&playerNavEdge(x,z,x+dx,z+dz))exits++;
  if(exits<3)continue;
  candidates.push({x:px,z:pz,ix:x,iz:z,fromSpawn:fromSpawn[k],exits});
 }
 missionSitesCache={map:mapCells,solids:worldSolidGrid,count:worldSolidCount,gl:glReady,heights:heightCells,decks:deckCells,fromSpawn,candidates};
 return missionSitesCache;
}
// Graph articulation points identify equipment positions that would sever a
// corridor. One linear scan of the *actual* operator edge graph is far cheaper
// than trying thousands of complete BFS flood-fills per chosen device.
function missionEquipmentCutVertices(g,planned){
 const forbidden=new Set(),n=mapSize;
 if(!g||g!==game)return forbidden;
 const beforeLength=g.nodes.length;
 try{
  for(const p of planned)g.nodes.push({x:p.x,z:p.z,dead:false,type:0});
  enemyNavMask=null;enemyNavEdges=null;playerNavGraph=null;
  const discover=new Int32Array(n*n),low=new Int32Array(n*n),parent=new Int32Array(n*n);
  parent.fill(-1);const children=new Int8Array(n*n),dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  const fromX=Math.floor(spawnX),fromZ=Math.floor(spawnZ),start=fromZ*n+fromX;
  if(!playerNavTile(fromX,fromZ))return forbidden;
  let timer=0;
  discover[start]=low[start]=++timer;
  const stack=[{i:start,x:fromX,z:fromZ,next:0}];
  while(stack.length){
   const top=stack[stack.length-1],i=top.i;
   if(top.next<4){
    const [dx,dz]=dirs[top.next++],X=top.x+dx,Z=top.z+dz;
    if(X<1||Z<1||X>=n-1||Z>=n-1||!playerNavEdge(top.x,top.z,X,Z))continue;
    const k=Z*n+X;
    if(!discover[k]){
     parent[k]=i;children[i]++;discover[k]=low[k]=++timer;
     stack.push({i:k,x:X,z:Z,next:0});
    }else if(k!==parent[i])low[i]=Math.min(low[i],discover[k]);
   }else{
    stack.pop();const par=parent[i];
    if(par>=0){
     low[par]=Math.min(low[par],low[i]);
     if(parent[par]>=0&&low[i]>=discover[par])forbidden.add(par);
    }else if(children[i]>1)forbidden.add(i);
   }
  }
  // Every unreachable tile is also disallowed, not only the articulation points.
  for(let k=0;k<discover.length;k++)if(!discover[k])forbidden.add(k);
  return forbidden;
 }finally{
  g.nodes.length=beforeLength;
  enemyNavMask=null;enemyNavEdges=null;playerNavGraph=null;
 }
}
function missionLocations(g,amount,purpose='recovery',avoid=[]){
 const n=Math.max(0,Math.floor(amount)),result=[];
 if(!n)return result;
 const inventory=missionSiteInventory(),candidates=inventory.candidates;
 // Planned tactical landmarks are real locations, not new decorative objects.
 // Each mission travels through a different selection of existing courtyards.
 const landmarks=[
  typeof relayFortPlan==='object'&&relayFortPlan,
  typeof secondaryYard==='object'&&secondaryYard,
  typeof tacticalZone==='object'&&tacticalZone,
  typeof ordinaryCourtPlan==='object'&&ordinaryCourtPlan,
  typeof bossCourtPlan==='object'&&bossCourtPlan,
  {cx:Math.floor(portal.x),cz:Math.floor(portal.z)}
 ].filter(q=>q&&Number.isFinite(q.cx)&&Number.isFinite(q.cz));
 const bases=[...avoid,...(g?.nodes||[]),...(g?.devices||[]),...(g?.mission?.caches||[])];
 const occupied=p=>bases.some(v=>Math.hypot(v.x-p.x,v.z-p.z)<3.6);
 const fields=[];
 const variant=(g?.sector||1)*3+(purpose==='relay'?5:purpose==='power'?11:0);
 const minSep=purpose==='power'?6.7:purpose==='relay'?10:8;
 for(let j=0;j<n;j++){
  // Data archives now stand on real steel plinths, so they too must avoid
  // articulation cells. Test the larger reactor envelope conservatively.
  const forbidden=missionEquipmentCutVertices(g,result);
  let best=null,bestScore=-Infinity;
  const focus=landmarks.length?landmarks[(j+variant)%landmarks.length]:null;
  for(const p of candidates){
   if(forbidden?.has(p.iz*mapSize+p.ix))continue;
   if(occupied(p)||result.some(o=>Math.hypot(o.x-p.x,o.z-p.z)<minSep))continue;
   const k=p.iz*mapSize+p.ix;
   let routeGap=p.fromSpawn;
   if(fields.length){routeGap=Infinity;for(const f of fields)routeGap=Math.min(routeGap,f[k]);}
   if(routeGap<0||routeGap<(result.length?minSep:6))continue;
   // The far side of the battlefield is desirable, but a point behind a
   // forbidden shortcut is never selected. Distances are graph distances.
   const landmarkBonus=focus?Math.max(0,23-Math.hypot(p.x-focus.cx,p.z-focus.cz))*.85:0;
   const score=(purpose==='recovery'?0:(p.exits===4?70:0))+Math.min(routeGap,60)*1.18+Math.min(p.fromSpawn,84)*.26+
    landmarkBonus+(purpose==='relay'?Math.min(routeGap,38)*.22:0)+
    // Deterministic tie-breaking across otherwise equivalent tiles.
    ((p.ix*17+p.iz*31+variant*13)%23)*.002;
   if(score>bestScore){bestScore=score;best=p;}
  }
  // Tiny early sectors may not contain enough widely separated candidates.
  // Reduce *only spacing*, not collision, path or platform requirements.
  if(!best)for(const p of candidates){
   if(forbidden?.has(p.iz*mapSize+p.ix))continue;
   if(occupied(p)||result.some(o=>Math.hypot(o.x-p.x,o.z-p.z)<4.0))continue;
   const k=p.iz*mapSize+p.ix;
   if(fields.some(f=>f[k]<0))continue;
   let nearest=70;for(const f of fields)nearest=Math.min(nearest,f[k]);
   const score=(purpose==='recovery'?0:(p.exits===4?70:0))+p.fromSpawn+nearest;
   if(score>bestScore){bestScore=score;best=p;}
  }
  // A cut vertex would close a physical passage; never accept it.
  if(!best)break;
  result.push({id:j,x:best.x,z:best.z,got:false});
  // A single connected navigation component is already guaranteed by
  // fromSpawn. Additional BFS fields are needed only for actual multi-stop
  // mission goals; support objects use inexpensive physical spacing.
  if(purpose==='recovery'||purpose==='relay')fields.push(missionGroundField(best.x,best.z));
 }
 return result;
}
function startMission(g){
 const type=missionType(g.sector),reactors=g.nodes.filter(n=>n.type!==2).length;
 // Reactor sites and coil devices already have real world AABBs, projectile
 // collision and reachable exterior contact faces. Stage97 reuses those
 // objects; NO fake/visual-only world blockers are introduced.
 const nodesRequired=type==='conduit'?Math.min(1,reactors):Math.min(2,reactors);
 g.mission={version:['signal','surge'].includes(type)?4:3,routeMode:missionRouteMode(g.sector,type),routeOrder:[],type,done:0,
  required:type==='sabotage'||type==='containment'||type==='surge'?nodesRequired:
   type==='conduit'?nodesRequired:type==='recovery'?3:type==='hunt'||type==='signal'?1:type==='relay'?2:0,
  sentinelId:0,caches:[],surviveRemaining:type==='holdout'?Math.min(62,32+g.sector*.45):
   type==='containment'?Math.min(34,20+g.sector*.12):0,
  nodesRequired:['containment','conduit','surge'].includes(type)?nodesRequired:0,
  nodesDisabled:0,coilIds:[],coilsRequired:0,coilsDisabled:0,
  signalIds:[],signalRequired:0,signalDone:0,commanderKilled:false,
  surgeIds:[],surgeRequired:0,surgeReady:false,surgeRemaining:0,surgeActivations:0,
  containmentStarted:false,hazardsEvaded:0,hazardsHit:0};
 if(type==='recovery'){g.mission.caches=missionLocations(g,3,'recovery');g.mission.required=g.mission.caches.length;missionPlanOrder(g,g.mission.caches);}
 g.arenaEvent={phase:'quiet',countdown:Math.max(11,17-g.sector*.06),kind:(Math.floor((g.sector-1)/5)%2===0?'thermal':'emp'),x:0,z:0,r:3.35,warning:0,active:0};
}
function missionCounter(g){
 const m=g?.mission;if(!m)return'';
 if(m.type==='sabotage')return 'УЗЛЫ '+Math.min(m.done,m.required)+'/'+m.required;
 if(m.type==='containment')return 'РЕАКТОРЫ '+Math.min(m.done,m.required)+'/'+m.required+
  ' · ОСАДА '+(m.done>=m.required?Math.ceil(m.surviveRemaining||0)+' с':'ПОСЛЕ ОТКЛЮЧЕНИЯ');
 if(m.type==='conduit')return 'ИЗЛУЧАТЕЛИ '+(m.coilsDisabled||0)+'/'+(m.coilsRequired||0)+
  ' · ЭНЕРГОУЗЕЛ '+Math.min(m.nodesDisabled||0,m.nodesRequired||0)+'/'+(m.nodesRequired||0);
 if(m.type==='signal')return 'СТАНЦИИ '+(m.signalDone||0)+'/'+(m.signalRequired||0)+
  ' · КОМАНДИР '+(m.commanderKilled?'УСТРАНЁН':'В ПОИСКЕ');
 if(m.type==='surge')return 'РЕАКТОРЫ '+(m.nodesDisabled||0)+'/'+(m.nodesRequired||0)+
  ' · ОКНО '+(m.surgeReady?Math.ceil(m.surgeRemaining||0)+' с':'НЕ ЗАРЯЖЕНО');
 if(m.type==='recovery')return 'ДАННЫЕ '+m.done+'/'+m.required+(Array.isArray(m.routeOrder)&&m.routeOrder.length?' · МАРШРУТ':'');
 if(m.type==='hunt')return m.done?'КОМАНДИР УСТРАНЁН':'КОМАНДИР НЕ УСТРАНЁН';
 if(m.type==='holdout')return 'ВЫСТОЯТЬ '+Math.ceil(m.surviveRemaining||0)+' с · ВРАГИ '+g.kills+'/'+g.target;
 if(m.type==='relay')return 'РЕТРАНСЛЯТОРЫ '+m.done+'/'+m.required+(Array.isArray(m.routeOrder)&&m.routeOrder.length?' · ЦЕПЬ':'');
 if(m.type==='boss')return 'БОСС · '+(g.boss&&!g.boss.dead?Math.ceil(100*g.boss.hp/g.boss.maxhp)+'%':'НАЧНИ БОЙ');
 return 'РОБОТЫ '+g.kills+'/'+g.target;
}
// The two new operations retain real checkpoint progress even when their
// stages are completed out of order (commander/cores destroyed early).
function missionRefreshCombinedProgress(m){
 if(!m)return;
 if(m.type==='signal')m.done=(m.signalDone||0)+
  Number(!!m.commanderKilled&&(m.signalDone||0)>=(m.signalRequired||0));
 if(m.type==='surge')m.done=(m.nodesDisabled||0)+
  Number(!!m.surgeReady&&!!m.surgeRequired);
}
function missionFinished(g){
 if(!g||g.spawned<g.target||g.enemies.some(e=>!e.dead)||g.target<1)return false;
 const m=g.mission;
 return !m||(m.done>=m.required&&
  ((m.type!=='holdout'&&m.type!=='containment')||(m.surviveRemaining||0)<=0));
}
function maybeFinishMission(g){
 if(!g||g.state!=='playing'||g.portalReady||!missionFinished(g))return false;
 g.portalReady=true;
 toast('✓ ЗАДАНИЕ ВЫПОЛНЕНО · ПОРТАЛ ОТКРЫТ',3);
 sound(540,.36,'triangle',.16);saveRun();return true;
}
function updateMission(dt){
 const g=game;if(!g||g.state!=='playing')return;
 const m=g.mission;
 if(m?.type==='holdout')m.surviveRemaining=Math.max(0,(m.surviveRemaining||0)-dt);
 // Stage98: resonance is a repeatable PHYSICAL terminal activation window.
 // Expiration never restores a destroyed solid reactor or consumes the only
 // usable station forever: it re-arms that same visible metal device.
 if(m?.type==='surge'&&m.surgeReady&&m.surgeRequired>0&&
    (m.nodesDisabled||0)<(m.nodesRequired||0)){
  m.surgeRemaining=Math.max(0,(m.surgeRemaining||0)-dt);
  if(m.surgeRemaining<=0){
   m.surgeReady=false;
   for(const d of g.devices||[])if((m.surgeIds||[]).includes(d.id)){d.used=false;d.charge=0;}
   missionRefreshCombinedProgress(m);
   toast('⚠ РЕЗОНАНС ПОТЕРЯН · ПОВТОРНО ЗАРЯДИ СТАНЦИЮ',2);saveRun();
  }
 }
 // The second phase starts ONLY after disabling the actual reactor housings.
 // Holding out before the sabotage phase may not silently count as success.
 if(m?.type==='containment'&&m.done>=m.required){
  if(!m.containmentStarted){m.containmentStarted=true;
   toast('◈ РЕАКТОРЫ ОТКЛЮЧЕНЫ · УДЕРЖИВАЙ КОМПЛЕКС',2);
   // An imminent arena pulse distinguishes the pressure phase from a
   // passive timer, but uses the pre-existing REAL cover-aware hazard.
   if(g.arenaEvent?.phase==='quiet')g.arenaEvent.countdown=Math.min(g.arenaEvent.countdown,5);
   saveRun();
  }
  m.surviveRemaining=Math.max(0,(m.surviveRemaining||0)-dt);
 }
 if(m&&m.type==='recovery'){
  for(const cache of m.caches)if(!cache.got&&missionItemActive(g,cache,'recovery')){
   if(missionInteractionClear(g.p,cache,'archive')){
    cache.got=true;m.done++;g.score+=140;
    save.credits+=4;burst(cache.x,.75+floorHeight(cache.x,cache.z),cache.z,[.32,.98,1],16);
    toast('◈ ДАННЫЕ ПОЛУЧЕНЫ · '+m.done+'/'+m.required,1.55);sound(720,.15,'sine',.12);saveRun();
   }
  }
 }
 const a=g.arenaEvent;
 if(a&&g.sector>=3&&!g.portalReady){
  if(a.phase==='quiet'){
   a.countdown-=dt;
   if(a.countdown<=0){a.phase='warning';a.warning=2.65;a.x=g.p.x;a.z=g.p.z;a.r=3.4;
    toast(a.kind==='thermal'?'⚠ ТЕРМОУДАР · УЙДИ ИЗ КРУГА':'⚠ ЭМИ-УДАР · УЙДИ ИЗ КРУГА',1.7);
   }
  }else if(a.phase==='warning'){
   a.warning-=dt;
   if(a.warning<=0){
    const origin={x:a.x,y:floorHeight(a.x,a.z)+.85,z:a.z};
    const feet=Number.isFinite(g.p.feetY)?g.p.feetY:floorHeight(g.p.x,g.p.z);
    const inRadius=Math.hypot(g.p.x-a.x,g.p.z-a.z,feet+1.0-origin.y)<a.r&&
     Math.abs(feet-floorHeight(a.x,a.z))<2.0;
    const exposure=inRadius?missionHazardPlayerExposure(origin,g.p):0;
    if(exposure>0){
     m&&(m.hazardsHit++);
     if(a.kind==='thermal')damagePlayer((12+Math.min(35,g.sector*.7))*exposure,a);
     else{const drain=38*exposure;g.p.energy=Math.max(0,g.p.energy-drain);
      g.p.shield=0;toast('ϟ ЭМИ · ЭНЕРГИЯ -'+Math.round(drain),1.1);}
    }else if(m)m.hazardsEvaded++;
    burst(a.x,.15+floorHeight(a.x,a.z),a.z,a.kind==='thermal'?[1,.42,.18]:[.23,.86,1],25);
    sound(a.kind==='thermal'?86:260,.26,'sawtooth',.10);
    a.phase='quiet';a.countdown=16+Math.min(7,g.sector*.2);
   }
  }
 }
 if(!g.portalReady)maybeFinishMission(g);
}
// A single player-centred field is cheaper than recomputing a full BFS for
// each remaining target every HUD frame. A genuine topology change (reactor
// destroyed, equipment replaced, new world) invalidates the field immediately.
let missionWaypointGroundCache=null;
function missionWaypointGroundField(p){
 const x=Math.floor(p.x),z=Math.floor(p.z),equipment=worldEquipmentGrid(),
  destroyed=Number(game?.nodesDestroyed)||0,c=missionWaypointGroundCache;
 if(c?.game===game&&c.map===mapCells&&c.solids===worldSolidGrid&&
    c.heights===heightCells&&c.decks===deckCells&&c.gl===glReady&&c.count===worldSolidCount&&
    c.equipment===equipment&&c.destroyed===destroyed&&
    c.x===x&&c.z===z)return c.field;
 const field=missionGroundField(p.x,p.z);
 missionWaypointGroundCache={game,map:mapCells,solids:worldSolidGrid,heights:heightCells,decks:deckCells,gl:glReady,count:worldSolidCount,
  equipment,destroyed,x,z,field};
 return field;
}
function missionWaypoint(g){
 if(!g||!g.mission)return null;
 const m=g.mission;
 let pool=[];
 if(m.type==='recovery')pool=m.caches.filter(c=>!c.got&&missionItemActive(g,c,'recovery'));
 if(m.type==='sabotage'&&m.done<m.required)pool=g.nodes.filter(n=>!n.dead&&n.type!==2);
 if(m.type==='containment'&&m.done<m.required)pool=g.nodes.filter(n=>!n.dead&&n.type!==2);
 if(m.type==='signal'){
  if((m.signalDone||0)<(m.signalRequired||0))
   pool=(g.devices||[]).filter(d=>!d.used&&(m.signalIds||[]).includes(d.id));
  else if(!m.commanderKilled)pool=g.enemies.filter(e=>e.id===m.sentinelId&&!e.dead);
 }
 if(m.type==='surge'){
  if(!m.surgeReady&&m.surgeRequired)
   pool=(g.devices||[]).filter(d=>!d.used&&(m.surgeIds||[]).includes(d.id));
  else if((m.nodesDisabled||0)<(m.nodesRequired||0))
   pool=g.nodes.filter(n=>!n.dead&&n.type!==2);
 }
 if(m.type==='conduit'){
  if((m.coilsDisabled||0)<(m.coilsRequired||0))
   pool=(g.devices||[]).filter(d=>d.kind==='coil'&&!d.used&&(m.coilIds||[]).includes(d.id));
  else if((m.nodesDisabled||0)<(m.nodesRequired||0))
   pool=g.nodes.filter(n=>!n.dead&&n.type!==2);
 }
 if(m.type==='hunt'&&!m.done)pool=g.enemies.filter(e=>e.id===m.sentinelId&&!e.dead);
 if(m.type==='relay'&&m.done<m.required)pool=(g.devices||[]).filter(d=>d.kind==='relay'&&!d.used&&missionItemActive(g,d,'relay'));
 if(!pool.length)return null;
 // The nearest target through a steel barrier is often the farthest
 // reachable one. Select by the TRUE ground-route distance when the player
 // is walking, using one cached BFS for the entire candidate pool.
 if(pool.length===1)return pool[0];
 const p=g.p,ground=floorHeight(p.x,p.z);
 if(Number.isFinite(p.feetY)&&Math.abs(p.feetY-ground)>.26){
  return pool.reduce((a,b)=>distance(p,b)<distance(p,a)?b:a);
 }
 const field=missionWaypointGroundField(p);
 let best=null,bestCost=Infinity,bestEuclid=Infinity;
 for(const v of pool){
  const route=missionApproachDistance(field,v),straight=distance(p,v);
  if(route<0)continue;
  if(route<bestCost||(route===bestCost&&straight<bestEuclid)){
   best=v;bestCost=route;bestEuclid=straight;
  }
 }
 return best||pool.reduce((a,b)=>distance(p,b)<distance(p,a)?b:a);
}
function missionStars(g){const m=g.mission;if(!m)return 1;return 1+Number(g.p.hp/g.p.maxhp>=.70)+Number(m.hazardsHit===0&&g.sectorTime<(75+g.sector*9))}

// Grid-aware mission guidance: follow corridors instead of pointing through walls.
let missionGuideCache=null;
// Stage92: the objective and extraction guides share the SAME ground-edge
// graph as physical operator movement. Cache by the actual topology, not only
// map identity and goal coordinates: a destroyed reactor changes walkability
// without replacing mapCells or the equipment array.
function missionField(goal){
 if(!goal)return null;
 const x=Math.floor(goal.x),z=Math.floor(goal.z),sz=mapSize;
 const equipment=worldEquipmentGrid(),destroyed=Number(game?.nodesDestroyed)||0;
 const cache=missionGuideCache;
 if(cache?.map===mapCells&&cache.game===game&&cache.solids===worldSolidGrid&&
    cache.heights===heightCells&&cache.decks===deckCells&&cache.gl===glReady&&cache.count===worldSolidCount&&cache.equipment===equipment&&
    cache.destroyed===destroyed&&cache.size===sz&&cache.x===x&&cache.z===z)
  return cache.field;
 const field=new Int16Array(sz*sz);field.fill(32767);
 // The goal may contain a REAL steel housing. In that case only its
 // walkable neighbouring cells can be approached; never seed the collider.
 const queue=new Int32Array(sz*sz);let head=0,tail=0;
 if(x>=1&&z>=1&&x<sz-1&&z<sz-1&&mapCells[z]?.[x]===0){
  const occupied=!playerNavTile(x,z);
  const seeds=occupied?[[x+1,z],[x-1,z],[x,z+1],[x,z-1]]:[[x,z]];
  for(const [sx,sz0] of seeds){
   if(sx<1||sz0<1||sx>=sz-1||sz0>=sz-1||!playerNavTile(sx,sz0))continue;
   // Merely sharing an adjacent CELL does not imply the objective is
   // reachable: a real rail or partition can separate its metal face.
   if(occupied&&!missionApproachOpen(sx,sz0,goal))continue;
   const k=sz0*sz+sx;
   if(field[k]!==32767)continue;
   field[k]=0;queue[tail++]=k;
  }
 }
 while(head<tail){const k=queue[head++],px=k%sz,pz=(k/sz)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=px+dx,nz=pz+dz,idx=nz*sz+nx;
   if(nx<1||nz<1||nx>=sz-1||nz>=sz-1||field[idx]!==32767)continue;
   // A rail, gantry, chassis or tall stair riser is impassable even when
   // both endpoint cells have mapCells=0. The identical edge predicate is
   // used to extract the next direction from the generated field.
   if(!playerNavEdge(px,pz,nx,nz))continue;
   field[idx]=field[k]+1;queue[tail++]=idx;
  }
 }
 missionGuideCache={map:mapCells,game,solids:worldSolidGrid,heights:heightCells,decks:deckCells,gl:glReady,count:worldSolidCount,
  equipment,destroyed,size:sz,x,z,field};
 return field;
}
// Stage113: join the real off-centre standing position to the physical
// graph. An upstairs player must find a real stair/deck exit before using
// the ground field. No implied transition between coincident XZ cells.
function missionRouteLink(a,b){
 const r=playerNavProfile.radius,h=playerNavProfile.height;
 if(!Number.isFinite(a.feetY)||!Number.isFinite(b.feetY))return false;
 if(collide(a.x,a.z,r)||worldSolidBodyCollision(a.x,a.z,r,a.feetY,h))return false;
 const q=worldActorSweepPlan(a.x,a.z,b.x,b.z,r,a.feetY,true,true,h);
 return !!q&&q.grounded&&Math.abs(q.feet-b.feetY)<.005;
}
function missionGroundPoint(x,z){
 if(!playerNavTile(x,z))return null;
 const feetY=navStandingFeet(x+.5,z+.5,playerNavProfile);
 return feetY===null?null:{x:x+.5,z:z+.5,feetY};
}
function missionUpperPoint(x,z){
 const y=deckAtCell(x,z);
 if(!(y>0)||mapCells[z]?.[x]!==0)return null;
 const feetY=navStandingFeet(x+.5,z+.5,playerNavProfile,y);
 return feetY===null?null:{x:x+.5,z:z+.5,feetY};
}
let missionUpperExitCache=null;
function missionUpperExit(seed,field){
 const n=mapSize,key=a=>Math.floor(a.z)*n+Math.floor(a.x),start=key(seed);
 // Cache paths by the actual field identity, which already tracks geometry.
 if(missionUpperExitCache?.field!==field)missionUpperExitCache={field,paths:new Map()};
 const cache=missionUpperExitCache.paths;
 if(cache.has(start))return cache.get(start);
 const queue=[seed],parent=new Map([[start,-1]]),points=new Map([[start,seed]]);
 let exit=null,last=-1;
 for(let i=0;i<queue.length&&i<4096&&!exit;i++){
  const a=queue[i],k=key(a),x=k%n,z=(k/n)|0;
  for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz;if(X<1||Z<1||X>=n-1||Z>=n-1)continue;
   const g=missionGroundPoint(X,Z);
   if(g&&field[key(g)]<32767&&missionRouteLink(a,g)){last=k;exit=g;break;}
   if(!dx&&!dz)continue;
   const b=missionUpperPoint(X,Z),j=Z*n+X;
   if(!b||parent.has(j)||!missionRouteLink(a,b))continue;
   parent.set(j,k);points.set(j,b);queue.push(b);
  }
 }
 if(!exit){if(cache.size<256)cache.set(start,null);return null;}
 const path=[exit];for(let k=last;k!==-1;k=parent.get(k))path.push(points.get(k));path.reverse();
 if(cache.size>=256)cache.clear();cache.set(start,path);
 return path;
}
function missionRouteTo(p,target,limit=220){
 if(!target)return[];
 const field=missionField(target),sz=mapSize;
 let x=Math.floor(p.x),z=Math.floor(p.z);
 if(x<0||z<0||x>=sz||z>=sz)return[];
 const origin={x:p.x,z:p.z,feetY:Number.isFinite(p.feetY)?p.feetY:worldTerrainFootprint(p.x,p.z,playerNavProfile.radius)};
 const out=[origin];
 // While airborne, do not advertise a walking trajectory starting in air.
 if(p.flying||p.grounded===false)return out;
 let seed=null,best=Infinity;
 for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
  const X=x+dx,Z=z+dz,g=missionGroundPoint(X,Z);if(!g)continue;
  const d=field[Z*sz+X];if(d>=32767||!missionRouteLink(origin,g))continue;
  const cost=d+Math.hypot(g.x-p.x,g.z-p.z);
  if(cost<best-1e-8){seed=g;best=cost;}
 }
 const append=q=>{const a=out[out.length-1];if(Math.hypot(q.x-a.x,q.z-a.z)>1e-7||Math.abs(q.feetY-a.feetY)>.005)out.push(q);};
 if(!seed){
  // Reach a true deck centre before searching for its physical stair exit.
  // Never seed a deck above the player's actual head from the ground.
  let bestPath=null;
  for(const [dx,dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){
   const X=x+dx,Z=z+dz;if(X<1||Z<1||X>=sz-1||Z>=sz-1)continue;
   const upper=missionUpperPoint(X,Z);
   if(!upper||Math.abs(upper.feetY-origin.feetY)>.24501||!missionRouteLink(origin,upper))continue;
   const path=missionUpperExit(upper,field);if(!path)continue;
   const g=path[path.length-1],cost=path.length-1+field[Math.floor(g.z)*sz+Math.floor(g.x)]+Math.hypot(upper.x-origin.x,upper.z-origin.z);
   if(cost<best){best=cost;bestPath=path;}
  }
  if(!bestPath)return out;
  for(const q of bestPath)append(q);
  seed=bestPath[bestPath.length-1];
 }else append(seed);
 x=Math.floor(seed.x);z=Math.floor(seed.z);let d=field[z*sz+x];
 for(let i=out.length-1;i<limit&&d>0&&d<32767;i++){
  let best=d,bx=x,bz=z;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=sz||zz>=sz)continue;
   if(!playerNavEdge(x,z,xx,zz))continue;
   const value=field[zz*sz+xx];if(value<best){best=value;bx=xx;bz=zz;}
  }
  if(best>=d)break;
  x=bx;z=bz;d=best;append(missionGroundPoint(x,z));
 }
 return out.slice(0,Math.max(1,limit+1));
}
