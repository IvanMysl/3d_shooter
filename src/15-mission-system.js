
// Reactive arena devices: a small, capped collection; never blocks navigation.
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
 relay:{name:'ЗАПУСК РЕТРАНСЛЯТОРОВ',icon:'⌁',hint:'Включи два ретранслятора, затем уничтожь охрану'}
};
function missionType(level){if(level%5===0)return'boss';if(level>=11&&level%10===1)return'holdout';if(level>=14&&level%10===4)return'relay';return ['purge','sabotage','recovery','hunt'][(level-1)%5]||'purge'}
function missionInfo(level){const key=missionType(level);return MISSION_TYPES[key]}
function missionLocations(g,amount){
 const loc=[];const attempts=mapRooms.length?mapRooms:[{x:spawnX,z:spawnZ}];
 for(let i=0;i<attempts.length*2&&loc.length<amount;i++){
  const room=attempts[(i*7+g.sector)%attempts.length],cx=Math.floor(room.x)+.5,cz=Math.floor(room.z)+.5;
  if(collide(cx,cz,.7)||distance({x:cx,z:cz},g.p)<6||loc.some(c=>hypot(c.x-cx,c.z-cz)<8))continue;
  loc.push({id:loc.length,x:cx,z:cz,got:false});
 }
 if(loc.length<amount){
  for(let z=3;z<mapSize-3&&loc.length<amount;z+=3)for(let x=3;x<mapSize-3&&loc.length<amount;x+=3){
   if(mapCells[z][x]!==0)continue;
   const cx=x+.5,cz=z+.5;
   if(collide(cx,cz,.6)||hypot(cx-spawnX,cz-spawnZ)<6||loc.some(c=>hypot(c.x-cx,c.z-cz)<7))continue;
   loc.push({id:loc.length,x:cx,z:cz,got:false});
  }
 }
 return loc;
}
function startMission(g){
 const type=missionType(g.sector);g.mission={version:1,type,done:0,required:type==='sabotage'?Math.min(2,g.nodes.filter(n=>n.type!==2).length):type==='recovery'?3:type==='hunt'?1:type==='relay'?2:0,sentinelId:0,caches:[],surviveRemaining:type==='holdout'?Math.min(62,32+g.sector*.45):0,hazardsEvaded:0,hazardsHit:0};
 if(type==='recovery'){g.mission.caches=missionLocations(g,3);g.mission.required=g.mission.caches.length;}
 g.arenaEvent={phase:'quiet',countdown:Math.max(11,17-g.sector*.06),kind:(Math.floor((g.sector-1)/5)%2===0?'thermal':'emp'),x:0,z:0,r:3.35,warning:0,active:0};
}
function missionCounter(g){
 const m=g?.mission;if(!m)return'';
 if(m.type==='sabotage')return 'УЗЛЫ '+Math.min(m.done,m.required)+'/'+m.required;
 if(m.type==='recovery')return 'ДАННЫЕ '+m.done+'/'+m.required;
 if(m.type==='hunt')return m.done?'КОМАНДИР УСТРАНЁН':'КОМАНДИР НЕ УСТРАНЁН';
 if(m.type==='holdout')return 'ВЫСТОЯТЬ '+Math.ceil(m.surviveRemaining||0)+' с · ВРАГИ '+g.kills+'/'+g.target;
 if(m.type==='relay')return 'РЕТРАНСЛЯТОРЫ '+m.done+'/'+m.required;
 if(m.type==='boss')return 'БОСС · '+(g.boss&&!g.boss.dead?Math.ceil(100*g.boss.hp/g.boss.maxhp)+'%':'НАЧНИ БОЙ');
 return 'РОБОТЫ '+g.kills+'/'+g.target;
}
function missionFinished(g){
 if(!g||g.spawned<g.target||g.enemies.some(e=>!e.dead)||g.target<1)return false;
 const m=g.mission;
 return !m||(m.done>=m.required&&(m.type!=='holdout'||(m.surviveRemaining||0)<=0));
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
 if(m&&m.type==='recovery'){
  for(const cache of m.caches)if(!cache.got){
   if(hypot(cache.x-g.p.x,cache.z-g.p.z)<1.04 && Math.abs((g.p.feetY||0)-floorHeight(cache.x,cache.z))<1.65){
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
    const hit=hypot(g.p.x-a.x,g.p.z-a.z)<a.r && Math.abs((g.p.feetY||0)-floorHeight(a.x,a.z))<2.0;
    if(hit){m&&(m.hazardsHit++);if(a.kind==='thermal')damagePlayer(12+Math.min(35,g.sector*.7),a);else {g.p.energy=Math.max(0,g.p.energy-38);g.p.shield=0;toast('ϟ ЭМИ · ЭНЕРГИЯ -38',1.1)}}
    else if(m)m.hazardsEvaded++;
    burst(a.x,.15+floorHeight(a.x,a.z),a.z,a.kind==='thermal'?[1,.42,.18]:[.23,.86,1],25);
    sound(a.kind==='thermal'?86:260,.26,'sawtooth',.10);
    a.phase='quiet';a.countdown=16+Math.min(7,g.sector*.2);
   }
  }
 }
 if(!g.portalReady)maybeFinishMission(g);
}
function missionWaypoint(g){
 if(!g||!g.mission)return null;
 const m=g.mission;
 let pool=[];
 if(m.type==='recovery')pool=m.caches.filter(c=>!c.got);
 if(m.type==='sabotage'&&m.done<m.required)pool=g.nodes.filter(n=>!n.dead&&n.type!==2);
 if(m.type==='hunt'&&!m.done)pool=g.enemies.filter(e=>e.id===m.sentinelId&&!e.dead);
 if(m.type==='relay'&&m.done<m.required)pool=(g.devices||[]).filter(d=>d.kind==='relay'&&!d.used);
 if(!pool.length)return null;
 let best=pool[0],dist=distance(g.p,best);
 for(const v of pool){const d=distance(g.p,v);if(d<dist){best=v;dist=d}}
 return best;
}
function missionStars(g){const m=g.mission;if(!m)return 1;return 1+Number(g.p.hp/g.p.maxhp>=.70)+Number(m.hazardsHit===0&&g.sectorTime<(75+g.sector*9))}

// Grid-aware mission guidance: follow corridors instead of pointing through walls.
let missionGuideCache=null;
function missionField(goal){
 if(!goal)return null;
 const x=Math.floor(goal.x),z=Math.floor(goal.z),sz=mapSize;
 if(missionGuideCache?.map===mapCells&&missionGuideCache.x===x&&missionGuideCache.z===z)return missionGuideCache.field;
 const field=new Int16Array(sz*sz);field.fill(32767);
 if(!mapCells[z]||mapCells[z][x]!==0)return field;
 const queue=new Int16Array(sz*sz);let head=0,tail=0;
 field[z*sz+x]=0;queue[tail++]=z*sz+x;
 while(head<tail){const k=queue[head++],px=k%sz,pz=(k/sz)|0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=px+dx,nz=pz+dz,idx=nz*sz+nx;
   if(nx<1||nz<1||nx>=sz-1||nz>=sz-1||mapCells[nz][nx]!==0||field[idx]!==32767)continue;
   field[idx]=field[k]+1;queue[tail++]=idx;
  }
 }
 missionGuideCache={map:mapCells,x,z,field};return field;
}
function missionRouteTo(p,target,limit=220){
 if(!target)return[];
 const field=missionField(target),sz=mapSize;
 let x=Math.floor(p.x),z=Math.floor(p.z);
 if(x<0||z<0||x>=sz||z>=sz)return[];
 let d=field[z*sz+x],out=[{x:p.x,z:p.z}];
 for(let i=0;i<limit&&d>0&&d<32767;i++){
  let best=d,bx=x,bz=z;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const xx=x+dx,zz=z+dz;if(xx<0||zz<0||xx>=sz||zz>=sz)continue;
   const value=field[zz*sz+xx];if(value<best){best=value;bx=xx;bz=zz;}
  }
  if(best>=d)break;
  x=bx;z=bz;d=best;out.push({x:x+.5,z:z+.5});
 }
 return out;
}
