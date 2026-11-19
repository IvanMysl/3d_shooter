'use strict';
// Geometry regressions for flight controls on rotated and narrow phones.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'src/26-input-handlers.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles/70-directors-cut.css'),'utf8');
const html=fs.readFileSync(path.join(root,'tools/index-template.html'),'utf8');
let checks=0;
function check(condition,message){assert.ok(condition,message);checks++;}

const begin=js.indexOf('function flightLayoutAboveArsenal(');
const end=js.indexOf("addEventListener('resize',positionMobileFlightControls);",begin);
check(begin>=0&&end>begin,'flight controls have reusable geometry logic');
const els={hud:{},mobileSwitch:{},flightControls:{style:{}}};
const state={$:id=>els[id]};
vm.createContext(state);
vm.runInContext(js.slice(begin,end),state);

function simulate(name,width,height,arsenalRight,arsenalBottom,arsenalWidth,arsenalHeight){
 const a={left:width-arsenalRight-arsenalWidth,right:width-arsenalRight,
   top:height-arsenalBottom-arsenalHeight,bottom:height-arsenalBottom,
   width:arsenalWidth,height:arsenalHeight};
 const h={left:0,top:0,right:width,bottom:height,width,height};
 els.hud.getBoundingClientRect=()=>h;
 els.mobileSwitch.getBoundingClientRect=()=>a;
 state.positionMobileFlightControls();
 const style=els.flightControls.style;
 const flightBottom=height-parseInt(style.bottom,10);
 const flightRight=width-parseInt(style.right,10);
 check(style.top==='auto',name+': top anchoring disabled');
 check(Math.abs((a.top-flightBottom)-7)<=.5,name+': exactly 7 CSS pixels above Arsenal');
 check(flightRight===a.right,name+': shared right edge');
 // Three controls (toggle, ascend, descend) expand LEFT, not past screen edge.
 const expandedRow=70+40+40+12;
 check(flightRight-expandedRow>=0,name+': expanded flight row fits horizontally');
 check(flightBottom-42>0,name+': flight row remains inside viewport');
 check(flightBottom<a.top,name+': flight row never obscures Arsenal');
}
simulate('portrait 337 × 768',337,768,11,145,82,28);
simulate('landscape 768 × 337',768,337,14,112,82,28);
simulate('portrait 320 × 570',320,570,11,145,82,28);
simulate('short landscape 640 × 280',640,280,14,112,82,28);
simulate('safe-area landscape 812 × 375',812,375,33,121,82,28);
simulate('wide landscape 960 × 420',960,420,14,112,82,28);

check(css.includes('Stage49: The flight row belongs ABOVE ARSENAL'),
 'Stage49 responsive fallback exists');
check(css.includes('flex-direction:row-reverse'),
 'expanded controls grow leftwards from Arsenal, not beyond phone right edge');
check(css.includes('right:11px;bottom:180px'),
 'portrait initial CSS above Arsenal');
check(css.includes('right:14px;bottom:147px'),
 'landscape initial CSS above Arsenal');
check(js.includes("addEventListener('orientationchange',()=>requestAnimationFrame(positionMobileFlightControls))"),
 'rotation recomputes flight placement after viewport settles');
check(js.includes("window.visualViewport.addEventListener('resize',positionMobileFlightControls)"),
 'browser visual viewport resize recomputes position');
check(js.includes('requestAnimationFrame(positionMobileFlightControls)'),
 'unlocking and toggling flight resyncs placement');
check(html.includes('id="flightControls"')&&html.includes('id="mobileSwitch"'),
 'flight and Arsenal exist in mobile controls');
const before=els.flightControls.style.bottom;
els.mobileSwitch.getBoundingClientRect=()=>({width:0,height:0});
state.positionMobileFlightControls();
check(els.flightControls.style.bottom===before,'hidden mobile controls retain last good position');
console.log('Stage49 mobile flight/Arsenal layout: '+checks+' checks passed');
