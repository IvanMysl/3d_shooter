
// Interactive mechanisms are native game-state data (saved with the encounter).
//  - repair/battery = one-off support; relay = mission objective;
//  - coil = pulsing area-denial emitter which can be disarmed by standing near it.
function initDevices(g){
 g.devices=[];
 const relay=g.mission?.type==='relay';
 const wanted=relay?7:g.sector>=3?6:3;
 const loc=missionLocations(g,wanted);
 let madeRelays=0;
 for(let i=0;i<loc.length;i++){
  const p=loc[i];
  let kind;
  if(relay&&madeRelays<2){kind='relay';madeRelays++;}
  else if(g.sector>=3&&i%3===0)kind='coil';
  else kind=i%2===0?'repair':'battery';
  g.devices.push({id:i+1,x:p.x,z:p.z,kind,used:false,charge:0,phase:i*2.31,
    cooldown:0,cycles:0});
 }
 if(relay)g.mission.required=madeRelays;
}
function deviceColor(d){return d.kind==='relay'?[.99,.76,.34]:d.kind==='repair'?[.34,1,.64]:d.kind==='coil'?[1,.35,.21]:[.3,.84,1];}
function completeDevice(g,d){
 if(d.used)return;
 d.used=true;d.charge=0;d.cooldown=0;
 const p=g.p,quality=(p.devicePower||1);
 if(d.kind==='relay'){
  g.mission.done=Math.min(g.mission.required,g.mission.done+1);g.score+=260;
  toast('⌁ РЕТРАНСЛЯТОР АКТИВИРОВАН · '+g.mission.done+'/'+g.mission.required,2);
 }else if(d.kind==='repair'){
  p.hp=Math.min(p.maxhp,p.hp+35*quality);
  p.armor=Math.min(p.maxArmor,p.armor+22*quality);
  // Repair the *physical* suit as well as the renewable energy barrier.
  // This is the player's deliberate, map-limited way to rescue a worn suit.
  p.bodyArmor=Math.min(p.bodyArmorMax||0,(p.bodyArmor||0)+(p.bodyArmorMax||0)*.18*quality);
  g.score+=85;
  toast('✚ РЕМОНТ · КОРПУС, ЭНЕРГОБАРЬЕР И КОСТЮМ',1.6);
 }else if(d.kind==='battery'){
  p.energy=Math.min(p.maxEnergy,p.energy+55*quality);p.heat=0;p.heatLock=0;
  g.score+=85;toast('ϟ ЭНЕРГОСТАНЦИЯ · ЗАРЯД И ОХЛАЖДЕНИЕ',1.5);
 }else if(d.kind==='coil'){
  g.score+=160;save.credits+=3;
  toast('✓ ИМПУЛЬСНЫЙ ИЗЛУЧАТЕЛЬ ОТКЛЮЧЁН',1.5);
 }
 burst(d.x,.55+floorHeight(d.x,d.z),d.z,deviceColor(d),19);
 sound(d.kind==='coil'?210:650,.17,'triangle',.11);
 saveRun();
 maybeFinishMission(g);
}
function updateDevices(dt){
 const g=game;if(!g||g.state!=='playing')return;
 const p=g.p;
 for(const d of (g.devices||[])){
  if(d.used)continue;
  const dist=distance(p,d);
  const y=floorHeight(d.x,d.z);
  const sameFloor=Math.abs((p.feetY||0)-y)<1.2;
  if(d.kind==='coil'){
   // 1.7 s warning, 2.3 s danger, 2.7 s cooldown. Jumping clears the ground pulse.
   const cycle=(g.t+d.phase)%6.7;
   const active=cycle>=1.7&&cycle<4.0;
   d.active=active;
   d.cooldown=Math.max(0,(d.cooldown||0)-dt);
   if(active && d.cooldown<=0 && dist<2.15 && sameFloor && p.grounded && p.shield<=0){
    damagePlayer(7+Math.min(14,g.sector*.28),d);d.cooldown=1.35;
   }
   // Safely disarm at the emitter by remaining next to it briefly.
   d.charge=dist<1.12&&sameFloor?Math.min(1.2,d.charge+dt):Math.max(0,d.charge-dt*.75);
   if(d.charge>=1.1){completeDevice(g,d);continue;}
  }else{
   d.charge=dist<1.25&&sameFloor?Math.min(1.1,d.charge+dt):Math.max(0,d.charge-dt*.70);
   if(d.charge>=(d.kind==='relay'?.82:.48))completeDevice(g,d);
  }
 }
}
function drawDevices(g){
 if(!glReady||!g?.devices)return;
 const low=save.settings.quality===0;
 for(const d of g.devices){
  if(distance(g.p,d)>24)continue;
  const ground=floorHeight(d.x,d.z),c=deviceColor(d),off=d.used;
  const shell=[.13,.18,.22],steel=[.33,.38,.41],dark=[.045,.067,.084];
  draw(geom.bevel,d.x,ground+.24,d.z,.72,.40,.72,0,shell,0);
  draw(geom.cylinder,d.x,ground+.58,d.z,.39,.45,.39,0,steel,.01);
  draw(geom.pylon,d.x,ground+.96,d.z,.24,.54,.24,0,shell,0);
  draw(geom.cube,d.x,ground+1.23,d.z,.47,.13,.47,0,dark,.01);
  if(!off){
   draw(geom.octa,d.x,ground+1.14+Math.sin(g.t*2+d.phase)*.05,d.z,.22,.31,.22,g.t*.55,c,1.7);
   draw(geom.ring,d.x,ground+.13,d.z,.68,.045,.68,g.t*.55,c,.48);
   if(!low&&d.charge>0)draw(geom.ring,d.x,ground+1.08,d.z,.55,.55,.55,g.t*1.1,c,1.05);
   if(d.kind==='coil'){
    const r=2.15;
    const isActive=d.active;
    draw(geom.ring,d.x,ground+.055,d.z,r*2,.045,r*2,g.t*.27,isActive?[1,.30,.18]:[1,.61,.18],isActive?1.1:.31);
    if(!low&&isActive)draw(geom.ring,d.x,ground+.11,d.z,r*1.2,.025,r*1.2,-g.t*.32,c,.42);
   }
  }else{
   draw(geom.cube,d.x,ground+1.20,d.z,.22,.03,.22,0,[.13,.29,.24],.05);
  }
 }
}
function spawnPowerNodes(level){
 if(!game)return;
 const selected=[];let seed=(Math.imul(level,1442695041)^0x6eeac1a5)>>>0;
 const rng=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const n=Math.min(6,3+Math.floor(level/5));
 const rooms=mapRooms.slice(1).sort((a,b)=>hypot(b.x-spawnX,b.z-spawnZ)-hypot(a.x-spawnX,a.z-spawnZ));
 for(let i=0;i<rooms.length&&selected.length<n;i++){
  const room=rooms[(i*7+level*3)%rooms.length];
  let pos=null;
  for(let j=0;j<13;j++){
   const x=room.x+(j? (rng()-.5)*Math.min(4,room.w-2):0),z=room.z+(j? (rng()-.5)*Math.min(4,room.h-2):0);
   if(collide(x,z,.76)||hypot(x-spawnX,z-spawnZ)<8||hypot(x-portal.x,z-portal.z)<3||selected.some(a=>hypot(a.x-x,a.z-z)<7))continue;
   pos={x,z};break;
  }
  if(pos){const type=selected.length%3;selected.push({...pos,type,hp:39+level*6,maxhp:39+level*6,dead:false,flash:0,phase:rng()*TAU,radius:.61});}
 }
 game.nodes=selected;
}
function rayNode(o,d,maxDist,assist=0){
 if(!game)return null;let result=null,best=maxDist;
 for(const node of game.nodes){
  if(node.dead)continue;
  const ox=o.x-node.x,oy=o.y-(1.3+floorHeight(node.x,node.z)),oz=o.z-node.z;
  const radius=node.radius+Math.max(0,assist);
  const b=ox*d.x+oy*d.y+oz*d.z,c=ox*ox+oy*oy+oz*oz-radius*radius,disc=b*b-c;
  if(disc<0)continue;
  const t=c<=0?.001:-b-Math.sqrt(disc);
  if(t<0||t>=best)continue;best=t;
  result={kind:'node',node,t,x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t,nx:(o.x+d.x*t-node.x)/radius,ny:(o.y+d.y*t-1.3-floorHeight(node.x,node.z))/radius,nz:(o.z+d.z*t-node.z)/radius};
 }
 return result;
}
function damagePowerNode(node,amount,depth=0){
 if(!node||node.dead||!game)return false;
 node.hp-=amount;node.flash=.19;
 if(node.hp>0){sound(400,.045,'triangle',.033);return false;}
 node.dead=true;const g=game,kind=NODE_TYPES[node.type];g.nodesDestroyed++;if(g.mission?.type==='sabotage'&&node.type!==2&&g.mission.done<g.mission.required){g.mission.done++;toast('ϟ ЭНЕРГОУЗЕЛ ОТКЛЮЧЁН · '+g.mission.done+'/'+g.mission.required,1.5)}g.score+=125+g.sector*12;
 const center={x:node.x,y:1.3,z:node.z};
 g.impactFx.push({...center,life:.66,maxLife:.66,r:kind.radius*.9,col:kind.color,explosion:true});
 burst(node.x,1.2,node.z,kind.color,save.settings.quality===0?22:42);
 g.scorch.push({x:node.x,z:node.z,life:30,r:kind.radius*.57});if(g.scorch.length>32)g.scorch.shift();
 if(node.type===2){
  g.loot.push({x:node.x+.3,z:node.z,type:'heal',life:25},{x:node.x-.3,z:node.z,type:'energy',life:25},{x:node.x+.7,z:node.z-.3,type:'credits',life:25},{x:node.x-.55,z:node.z+.35,type:'plates',life:25});
  toast('✚ КОНТЕЙНЕР ОТКРЫТ · СОБЕРИ РЕСУРСЫ',1.35);
 }else{
  const r=kind.radius;
  for(const e of [...g.enemies])if(!e.dead){const dist=hypot(e.x-node.x,e.z-node.z);if(dist<=r+e.radius){hurtEnemy(e,(node.type===0?115:56)*(1-.45*Math.min(1,dist/r)));if(node.type===1)e.stun=Math.max(e.stun,2.7)}}
  const pd=distance(g.p,node);
  if(node.type===0&&pd<r*.55)damagePlayer(12*(1-pd/(r*.75)));
  if(depth<3)for(const other of g.nodes)if(!other.dead&&distance(node,other)<r*1.15)damagePowerNode(other,other.hp+1,depth+1);
  toast(node.type===0?'✹ ТЕРМОРЕАКТОР ВЗОРВАН':'ϟ ЭМИ-ИМПУЛЬС · ВРАГИ ОГЛУШЕНЫ',1.3);
 }
 sound(node.type===0?85:node.type===1?160:550,.31,'sawtooth',.12);
 maybeFinishMission(g);saveRun();return true;
}
