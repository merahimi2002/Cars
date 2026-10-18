// Numerical regression test using real Three.js math and a deterministic DOM/renderer stub.
// Checks camera/projection/body/wheel paths through forward, reverse, fast jumps and idle.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import * as THREE from '../js/vendor/three.module.js';
import {driveData} from '../js/drive-data.js';
function simulate(source, mobile=false, reducedMotion=false) {
 let y=0, queue=[], observer, records=[], reads=0, lastCasters=null;
 const listeners={}; const nodes=new Map();
 const style=()=>({setProperty(k,v){this[k]=v;}});
 class Node {
  constructor(key=''){this.key=key;this.style=style();this.dataset={};this.userData={};this.parentElement=null;this.classList={add(){},remove(){},toggle(){}};}
  querySelector(s){const k=this.key+' '+s;if(!nodes.has(k))nodes.set(k,new Node(k));return nodes.get(k);}
  querySelectorAll(s){if(s==='.drive-step')return steps;if(s==='[data-drive-jump]')return jumps;if(s==='[data-drive-stat]')return stats;if(s==='.drive-stats > div')return stats;return [];}
  setAttribute(){} removeAttribute(k){if(k==='style')this.style=style();} prepend(){} addEventListener(){} after(...ns){ns.forEach(n=>n.parentElement=this.parentElement);} scrollIntoView(){} before(...ns){ns.forEach(n=>n.parentElement=this.parentElement);}
  get clientWidth(){return parseFloat(this.style.width)|| (this.key==='heroCanvas'?1280:720);}
  get clientHeight(){return parseFloat(this.style.height)|| (this.key==='heroCanvas'?900:650);}
  getBoundingClientRect(){reads++;const base={left:0,width:720,height:650,top:0}; const vtop=Math.min(Math.max(92,900-y),5400-y-800);
   if(this.key==='hero'||this.key==='heroCanvas') Object.assign(base,{top:-y,width:1280,height:900});
   else if(this.key==='section'||this.key.includes('.drive-layout')) Object.assign(base,{top:900-y,width:1280,height:4500});
   else if(this.key==='footer'||this.key.includes('.footer-car-slot')) Object.assign(base,{top:5400-y,width:1280,height:900});
   else if(this.key.includes('.drive-visual')&&!this.key.includes('heading')) Object.assign(base,{top:vtop,height:800});
   else if(this.key.startsWith('step')) Object.assign(base,{top:1100+Number(this.key.slice(4))*850-y,height:800});
   else if(this.key.includes('.drive-stats')) base.top=1300-y;
   else base.top=vtop+65;
   return {...base,right:base.left+base.width,bottom:base.top+base.height};
  }
  getContext(){return {createRadialGradient(){return {addColorStop(){}};},fillRect(){}};}
 }
 const steps=Array.from({length:5},(_,i)=>new Node('step'+i)),jumps=steps.map(()=>new Node()),stats=steps.slice(0,3).map(()=>new Node());
 const section=new Node('section'), footer=new Node('footer'), hero=new Node('hero'), body=new Node('body'),heroCanvas=new Node('heroCanvas');
 const canvas=section.querySelector('canvas');canvas.parentElement=section.querySelector('.drive-visual');
 const doc={hidden:false,body,documentElement:new Node(),getElementById:()=>section,querySelector:()=>footer,createElement:()=>new Node(),addEventListener(){}};
 body.append=(...ns)=>ns.forEach(n=>n.parentElement=body);
 class Renderer {constructor(){this.shadowMap={};}setPixelRatio(){}setSize(){}dispose(){}render(scene,camera){camera.updateMatrixWorld(true);const model=scene.children.at(-1);const casters=JSON.stringify([model.position.toArray(),model.children.map(n=>n.rotation.x)]); if(lastCasters!==null && casters!==lastCasters) assert(this.shadowMap.autoUpdate || this.shadowMap.needsUpdate,'Moving body/wheels require fresh shadows');lastCasters=casters;records.push({eye:camera.position.toArray(),projection:[...camera.projectionMatrix.elements],pose:model.position.toArray(),angles:model.children.map(n=>n.rotation.x)});this.shadowMap.needsUpdate=false;}}
 const Three={...THREE,WebGLRenderer:Renderer,PMREMGenerator:class{fromScene(){return {texture:null};}dispose(){}}};
 const text=source.replace(/^import[^\n]+\n/,'').replace('export function createDriveStory','return function createDriveStory');
 // scrollY is read from a per-simulation scope, avoiding global mutation.
 const wrapped='const devicePixelRatio=1;'+text.replace(/\bscrollY\b/g,'readY()');
 const create=new Function('driveData','document','matchMedia','addEventListener','ResizeObserver','IntersectionObserver','requestAnimationFrame','cancelAnimationFrame','getComputedStyle','window','readY','innerHeight',wrapped)(driveData,doc,q=>({matches:q.includes('max-width')?mobile:reducedMotion,addEventListener(){}}),(type,fn)=>listeners[type]=fn,class{observe(){}},class{constructor(cb){observer=cb;}observe(){}},fn=>{queue.push(fn);return queue.length;},()=>{},()=>({top:'92px'}),{},()=>y,900);
 const sourceModel=new THREE.Group();sourceModel.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
 sourceModel.userData.wheels=[];
 for(let i=0;i<4;i++){const pivot=new THREE.Group();sourceModel.add(pivot);sourceModel.userData.wheels.push({pivot,radius:.4,center:new THREE.Vector3(i<2?-1:1,.4,i%2?-1.5:1.5)});}
 const api=create(Three,class{dispose(){}},{hero,canvas:heroCanvas,capture:()=>({eye:new THREE.Vector3(6,2,6),aim:new THREE.Vector3(0,.65,0),translation:new THREE.Vector3(),anchorY:.5}),setTransitioning(){}});
 api.setModel('nissan',sourceModel);observer([{target:section,isIntersecting:true}]);
 const timeline=[];
 for(let frame=0;frame<1100;frame++){
  // Forward, reverse, quick jumps, and long idle stretches.
  const next=frame<360?frame/359*5400:frame<480?5400:frame<840?(839-frame)/359*5400:frame<900?2600:0;
  if(next!==y){y=next;listeners.scroll();}
  const work=queue;queue=[];work.forEach(fn=>fn(frame*1000/60));
  timeline.push(records.at(-1));
 }
 return {timeline,reads,renders:records.length};
}
const ref=process.argv[2];
if(!ref) throw new Error('Usage: node scripts/check-render-motion.mjs <baseline-git-ref>');
const before=execFileSync('git',['show',ref+':js/drive-story.js'],{encoding:'utf8'}),after=fs.readFileSync('js/drive-story.js','utf8');
for(const mobile of [false,true]) for(const reducedMotion of [false,true]){
 const a=simulate(before,mobile,reducedMotion),b=simulate(after,mobile,reducedMotion);
 let maxError=0;
 for(let i=0;i<a.timeline.length;i++)for(const key of ['eye','projection','pose','angles']){
  assert.equal(a.timeline[i][key].length,b.timeline[i][key].length);
  a.timeline[i][key].forEach((v,j)=>maxError=Math.max(maxError,Math.abs(v-b.timeline[i][key][j])));
 }
 assert(maxError<1e-10,'Visual trajectory changed: '+maxError);
 console.log(JSON.stringify({mobile,reducedMotion,frames:a.timeline.length,maxError,beforeReads:a.reads,afterReads:b.reads,beforeRenders:a.renders,afterRenders:b.renders}));
}
