// Stage 5: all dynamically rendered robot appendages must register hits.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/14-combat-raycast.js'),'utf8');
const geometry=source.slice(source.indexOf('function rayEllipsoid('));
const tiles=Array.from({length:24},()=>Array(24).fill(0));
const game={t:0,enemies:[]};
const context={console,Math,Number,Array,Set,Map,game,floorHeight:()=>0,v3:(x,y,z)=>({x,y,z})};
vm.createContext(context);vm.runInContext(geometry,context);
const v=(x,y,z)=>({x,y,z});
const robot=(kind,opts={})=>({id:3,type:kind,dead:false,x:8,z:8,feetY:0,radius:.51,boss:false,robotYaw:0,robotCycle:0,robotMotion:0,...opts});
const hit=(origin,dir,max=15,assist=0)=>context.rayEnemy(origin,dir,max,null,assist);
let checks=0;
function ok(condition,message){assert.ok(condition,message);checks++;}
function equal(a,b,message){assert.equal(a,b,message);checks++;}
const d=robot('drone');game.enemies=[d];
let h=hit(v(9.29,1.15,5),v(0,0,1));
ok(h,'Drone wing tip must register despite its x lying outside the old torso ellipsoid');
equal(h.part,'wing','Actual wing geometry proxy is hit');
// A rotating body must rotate the accessory hit volumes too.
d.robotYaw=Math.PI/2;
h=hit(v(4,1.15,6.75),v(1,0,0));
ok(h,'Turned drone wing can be shot along the X axis');
equal(h.part,'wing','Rotated collision must follow the visible wing');
d.robotYaw=0;
let miss=hit(v(9.90,1.15,5),v(0,0,1));
equal(miss,null,'Wide wing envelope must not extend into empty space');
// A ground-level bullet must strike a robot foot; old ellipsoid had a gap.
const brute=robot('brute');game.enemies=[brute];
h=hit(v(5,.075,8.1),v(1,0,0));
ok(h,'Infantry boot at near-floor level must be hittable');
equal(h.part,'leg','Floor-level contact is attributed to a leg');
// Animated stepping should move the collision volumes with the rig.
brute.robotMotion=1;brute.robotCycle=Math.PI/2;
h=hit(v(5,.13,8.1),v(1,0,0));
ok(h&&h.part==='leg','Stepping leg can be hit at its raised height');
// Scout low spider legs and charger horns are visible additional meshes.
const scout=robot('scout');game.enemies=[scout];
h=hit(v(5,.40,8.51),v(1,0,0));
ok(h&&h.part==='leg','Quadruped leg beyond the low carapace can be hit');
const charger=robot('charger');game.enemies=[charger];
h=hit(v(8.31,1.20,12),v(0,0,-1));
ok(h&&h.part==='horn','Charger horn extending in front of its muzzle can be hit');
// Boss decorative rocket racks rotate with the whole chassis.
const boss=robot('brute',{boss:true});
const volumes=context.robotAccessoryVolumes(boss);
ok(Array.from(volumes).filter(x=>x.part==='launcher').length===2,'Boss missile racks have their own hit volumes');
// Disabled/dead/ignored enemies should not block a shot, and assist expands bounds.
game.enemies=[d];d.dead=true;
equal(hit(v(9.29,1.15,5),v(0,0,1)),null,'Dead wing is not hittable');
d.dead=false;
equal(context.rayEnemy(v(9.29,1.15,5),v(0,0,1),15,new Set([d.id])),null,'Ignored enemy is skipped');
ok(hit(v(9.50,1.15,5),v(0,0,1),15,.15)!==null,'Aim assist applies to wing silhouette as to torso');
// Central torso and head remain hittable: do not break previous behavior.
game.enemies=[brute];brute.robotMotion=0;
ok(hit(v(5,1.45,8),v(1,0,0))!==null,'Original central torso ray preserved');
ok(hit(v(5,2.07,8),v(1,0,0))!==null,'Original head ray preserved');
console.log(`ROBOT HIT GEOMETRY: ${checks} assertions passed`);
