/* eslint-disable */
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

if (typeof window !== 'undefined') {
  window.THREE = THREE;
  window.gsap = gsap;
  window.ScrollTrigger = ScrollTrigger;
  window.Lenis = Lenis;
  gsap.registerPlugin(ScrollTrigger);
}

export function initLandingPage(onOpenAuth) {
  if (typeof window === 'undefined') return () => {};
  let isCleanedUp = false;


const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = s => document.querySelector(s);
const isMobile = () => innerWidth < 768;

/* =========================================================
   Sound: everything is synthesized with Web Audio, no files
   ========================================================= */
const sfx = (() => {
  let ac = null, master = null, amb = null, on = false, lastBlip = 0, nbuf = null;
  try{ on = localStorage.getItem('nv-sound') === 'on'; }catch(e){}
  function init(){
    if(ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return false;
    ac = new AC();
    const comp = ac.createDynamicsCompressor(); comp.connect(ac.destination);
    master = ac.createGain(); master.gain.value = .8; master.connect(comp);
    return true;
  }
  function env(g, t, a, d, v){ g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function tone(f, d, type, v, f2, delay){
    if(!on || !ac) return;
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    env(g, t, .008, d, v || .1); o.connect(g).connect(master); o.start(t); o.stop(t + d + .05);
  }
  function noise(d, type, f, f2, v, q){
    if(!on || !ac) return;
    if(!nbuf){ nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const ch = nbuf.getChannelData(0); for(let i = 0; i < ch.length; i++) ch[i] = Math.random()*2 - 1; }
    const t = ac.currentTime, src = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = nbuf; src.loop = true; fl.type = type; fl.Q.value = q || 1;
    fl.frequency.setValueAtTime(f, t); if(f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    env(g, t, Math.min(.05, d/3), d, v); src.connect(fl).connect(g).connect(master); src.start(t); src.stop(t + d + .05);
  }
  // soft ambient pad under the page
  function ambient(start){
    if(!ac) return;
    if(start && !amb){
      const g = ac.createGain(), lp = ac.createBiquadFilter(), lfo = ac.createOscillator(), lg = ac.createGain();
      g.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 650;
      lfo.frequency.value = .07; lg.gain.value = 260; lfo.connect(lg).connect(lp.frequency);
      const oscs = [110, 164.81, 220, 277.18].map((f, i) => { const o = ac.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5)*6; o.connect(lp); o.start(); return o; });
      lp.connect(g).connect(master); lfo.start();
      g.gain.linearRampToValueAtTime(.03, ac.currentTime + 2.5);
      amb = {g, oscs, lfo};
    } else if(!start && amb){
      const a = amb; amb = null;
      a.g.gain.cancelScheduledValues(ac.currentTime); a.g.gain.setTargetAtTime(0, ac.currentTime, .25);
      setTimeout(() => { a.oscs.forEach(o => o.stop()); a.lfo.stop(); }, 1500);
    }
  }
  return {
    get on(){ return on; },
    set(v){
      on = v; try{ localStorage.setItem('nv-sound', v ? 'on' : 'off'); }catch(e){}
      if(v){ if(!init()) return; ac.resume(); ambient(true); this.chime(); } else ambient(false);
    },
    unlock(){ if(on && init()){ ac.resume(); ambient(true); } },
    blip(){ const n = performance.now(); if(n - lastBlip < 45) return; lastBlip = n; tone(520 + Math.random()*380, .045, 'triangle', .035); },
    pop(){ tone(380, .09, 'sine', .09, 760); },
    tick(){ tone(1800, .025, 'square', .01); },
    click(){ tone(900, .06, 'square', .03, 450); },
    blink(){ tone(990, .08, 'sine', .08, 1480); },
    buzz(d){ noise(d || .7, 'bandpass', 180, 260, .14, 4); tone(90, d || .7, 'sawtooth', .025); },
    boing(){ tone(220, .35, 'sine', .12, 660); tone(330, .25, 'triangle', .04, 990, .05); },
    whoosh(){ noise(.55, 'bandpass', 300, 2400, .05, .8); },
    chime(){ [523.25, 659.25, 783.99].forEach((f, i) => tone(f, .5, 'sine', .07, null, i*.08)); },
    success(){ [659.25, 987.77].forEach((f, i) => tone(f, .35, 'triangle', .07, null, i*.1)); },
    alert(){ [880, 660, 880, 660].forEach((f, i) => tone(f, .18, 'square', .04, null, i*.2)); },
  };
})();

/* =========================================================
   Speech bubble
   ========================================================= */
const bubble = $('#bubble'), bText = $('#bubbleText'), bHi = $('#bubbleHi'), tail = $('#tail');
let typeTimer = 0, hideTimer = 0, lastSay = '';
const bubSize = {w:0, h:0};
new ResizeObserver(() => { bubSize.w = bubble.offsetWidth; bubSize.h = bubble.offsetHeight; }).observe(bubble);
function say(text, hi, hold){
  if(!text) return;
  clearInterval(typeTimer); clearTimeout(hideTimer);
  lastSay = text;
  if(!bubble.classList.contains('show')) sfx.pop();
  bubble.classList.add('show');
  bHi.textContent = hi || '';
  if(reduce){ bText.textContent = text; }
  else{
    let i = 0; bText.textContent = '';
    typeTimer = setInterval(() => { bText.textContent = text.slice(0, ++i); if(i % 2) sfx.blip(); if(i >= text.length) clearInterval(typeTimer); }, 22);
  }
  if(hold) hideTimer = setTimeout(() => bubble.classList.remove('show'), hold);
}

/* =========================================================
   Netra: the 3D mascot
   ========================================================= */
const canvas = $('#stage');
let mascot = null;
if(window.THREE){ try{ mascot = buildMascot(); }catch(e){ console.warn(e); } }

function buildMascot(){
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, 0, 12);

  scene.add(new THREE.AmbientLight(0xffffff, .55));
  const key = new THREE.DirectionalLight(0xffffff, .9); key.position.set(3, 5, 6); scene.add(key);

  // three-step toon ramp
  const ramp = new THREE.DataTexture(new Uint8Array([90,90,90,255, 180,180,180,255, 255,255,255,255]), 3, 1, THREE.RGBAFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  const toon = (c, extra) => new THREE.MeshToonMaterial(Object.assign({color:c, gradientMap:ramp}, extra||{}));
  const inkMat = new THREE.MeshBasicMaterial({color:0x0b0b0c, side:THREE.BackSide});
  const flat = c => new THREE.MeshBasicMaterial({color:c});

  // mesh with an inverted-hull ink outline
  function part(geo, mat, parent, outline = 1.06){
    const m = new THREE.Mesh(geo, mat);
    if(outline){ const o = new THREE.Mesh(geo, inkMat); o.scale.setScalar(outline); m.add(o); }
    parent.add(m); return m;
  }

  const root = new THREE.Group(); scene.add(root);
  const body = new THREE.Group(); root.add(body);
  const head = part(new THREE.SphereGeometry(1, 48, 32), toon(0xfbfbf8), body, 1.045);
  head.scale.set(1, 1.04, .96);

  // headband + forehead electrode (Fpz) + mastoid reference
  const band = part(new THREE.TorusGeometry(.955, .085, 14, 64), toon(0x2261e9), body, 0);
  band.rotation.x = Math.PI/2 - .12; band.position.y = .36;
  const bandO = new THREE.Mesh(new THREE.TorusGeometry(.955, .115, 14, 64), inkMat); band.add(bandO);
  const elecMat = toon(0xcfd3d6, {emissive:0x000000});
  const electrode = part(new THREE.CylinderGeometry(.14, .14, .07, 24), elecMat, body, 1.25);
  electrode.rotation.x = Math.PI/2 + .3; electrode.position.set(0, .45, .9);
  const mastoid = part(new THREE.SphereGeometry(.08, 16, 12), elecMat, body, 1.3);
  mastoid.position.set(.93, -.12, -.32);

  // face
  const face = new THREE.Group(); body.add(face);
  const eyeGeo = new THREE.SphereGeometry(1, 24, 16);
  const eyes = [-1, 1].map(s => {
    const g = new THREE.Group(); g.position.set(.31*s, .04, .9); face.add(g);
    const e = new THREE.Mesh(eyeGeo, flat(0x0b0b0c)); e.scale.set(.12, .19, .06); g.add(e);
    const hl = new THREE.Mesh(eyeGeo, flat(0xffffff)); hl.scale.setScalar(.045); hl.position.set(.035, .07, .05); g.add(hl);
    return g;
  });
  const cheekMat = new THREE.MeshBasicMaterial({color:0xff8a80, transparent:true, opacity:.55});
  [-1, 1].forEach(s => { const c = new THREE.Mesh(new THREE.CircleGeometry(.11, 24), cheekMat); c.position.set(.55*s, -.2, .79); c.rotation.y = .6*s; face.add(c); });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(.13, .028, 8, 24, Math.PI), flat(0x0b0b0c));
  smile.rotation.z = Math.PI; smile.position.set(0, -.2, .95); face.add(smile);
  const mouthO = new THREE.Mesh(eyeGeo, flat(0x0b0b0c)); mouthO.scale.set(.1, .12, .04); mouthO.position.set(0, -.27, .93); mouthO.visible = false; face.add(mouthO);

  // arms with orange EMG wristbands
  const armGeo = new THREE.SphereGeometry(1, 20, 16);
  const arms = [-1, 1].map(s => {
    const pivot = new THREE.Group(); pivot.position.set(.88*s, -.25, 0); body.add(pivot);
    const arm = part(armGeo, toon(0xfbfbf8), pivot, 1.12); arm.scale.set(.15, .38, .15); arm.position.set(.12*s, -.3, 0); arm.rotation.z = .35*s;
    const wb = part(new THREE.TorusGeometry(.13, .055, 10, 24), toon(0xff5a36, {emissive:0x000000}), pivot, 1.18);
    wb.rotation.x = Math.PI/2; wb.rotation.y = .35*s; wb.position.set(.22*s, -.52, 0);
    const hand = part(new THREE.SphereGeometry(.15, 20, 16), toon(0xfbfbf8), pivot, 1.15); hand.position.set(.27*s, -.66, 0);
    pivot.rotation.z = .1*s;
    return {pivot, wb, hand, side:s};
  });
  // feet
  [-1, 1].forEach(s => { const f = part(new THREE.SphereGeometry(1, 20, 14), toon(0x0b0b0c), body, 0); f.scale.set(.22, .12, .28); f.position.set(.36*s, -1.05, .12); });

  // signal ring that pops off the electrode
  const ring = new THREE.Mesh(new THREE.RingGeometry(.2, .26, 40), new THREE.MeshBasicMaterial({color:0xffd23f, transparent:true, opacity:0, side:THREE.DoubleSide}));
  scene.add(ring);

  /* ---------- state ---------- */
  const st = {x:3, y:-.3, s:1, tx:3, ty:-.3, ts:1, lookX:0, lookY:0, spin:0, dragV:0, blink:0, squeezeL:0, squeezeR:0, glowE:0, talk:0, hop:0, tilt:0, vel:0};
  let halfW = 3, halfH = 3, side = 'right', dragging = false, lastPX = 0;

  function resize(){
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    halfH = Math.tan(THREE.MathUtils.degToRad(15)) * 12; halfW = halfH * camera.aspect;
    place(side, true);
  }
  function place(s, instant){
    side = s;
    const m = isMobile();
    if(s === 'corner' || m){
      st.ts = m ? .36 : .44;
      st.tx = halfW - (m ? .55 : .95);
      st.ty = -halfH + (m ? .42 : .55);
      if(m && s === 'hidden') st.ty = -halfH - 3;
    } else {
      // stand at the bottom outer corner, beside the bedside scene rather than in front of it
      st.ts = Math.min(.72, halfH / 4.4);
      st.tx = (s === 'left' ? -1 : 1) * (halfW - 1.2);
      st.ty = -halfH + 1.25;
    }
    if(instant){ st.x = st.tx; st.y = st.ty; st.s = st.ts; }
  }
  addEventListener('resize', resize); resize();

  // pointer: look-at + grab to spin
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(e){ ndc.set(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight)*2+1); ray.setFromCamera(ndc, camera); return ray.intersectObject(head, false).length > 0; }
  addEventListener('pointermove', e => {
    st.lookX = (e.clientX / innerWidth - .5); st.lookY = (e.clientY / innerHeight - .5);
    if(dragging){ st.dragV = (e.clientX - lastPX) * .012; st.spin += st.dragV; lastPX = e.clientX; }
    else document.body.style.cursor = (!e.target.closest('a,button,input,label') && hit(e)) ? 'grab' : '';
  }, {passive:true});
  addEventListener('pointerdown', e => {
    if(e.target.closest('a,button,input,label,canvas#scope,.explode')) return;
    if(!hit(e)) return;
    dragging = true; lastPX = e.clientX; document.body.style.cursor = 'grabbing';
    poke();
  });
  addEventListener('pointerup', () => { if(dragging){ dragging = false; document.body.style.cursor = ''; } });

  const pokes = [
    ['Careful, that’s my electrode!'], ['Wheee!'], ['I can’t talk with my mouth, so I use my eyes.'],
    ['नमस्ते!', ''], ['Psst. You can spin me.'], ['Blink blink. That means “yes”.'], ['Squeeze! Squeeze!'],
  ];
  let pokeI = 0;
  function poke(){
    const p = pokes[pokeI++ % pokes.length]; say(p[0], p[1], 2600); act(['hop','blink2','both','spin'][pokeI % 4]);
  }

  /* ---------- actions ---------- */
  const tl = () => gsap.timeline({defaults:{ease:'power2.out'}});
  function blinkSeq(times, dur, gap){
    const t = tl();
    for(let i = 0; i < times; i++){
      t.to(st, {blink:1, glowE:1, duration:.07}, i*gap).to(st, {blink:0, duration:.1}, i*gap + dur);
      t.add(() => { pulseRing(); sfx.blink(); }, i*gap + .03);
    }
    t.to(st, {glowE:0, duration:.4});
    return t;
  }
  function squeeze(l, r, dur){
    const t = tl(); sfx.buzz(dur);
    if(l) t.to(st, {squeezeL:1, duration:.12}, 0).to(st, {squeezeL:0, duration:.3}, dur);
    if(r) t.to(st, {squeezeR:1, duration:.12}, .03).to(st, {squeezeR:0, duration:.3}, dur + .03);
    return t;
  }
  function act(name){
    if(!window.gsap) return;
    if(/^(hop|jump|spin)$/.test(name)) sfx.boing();
    if(name === 'wave') sfx.chime();
    switch(name){
      case 'blink2': return blinkSeq(2, .25, .38);
      case 'blink3': return blinkSeq(3, .24, .33);
      case 'blinkLong': return blinkSeq(1, 1.1, 0);
      case 'left': return squeeze(1, 0, .7);
      case 'right': return squeeze(0, 1, .7);
      case 'both': return squeeze(1, 1, .75);
      case 'hop': return tl().to(st, {hop:1, duration:.22, ease:'power2.out'}).to(st, {hop:0, duration:.5, ease:'bounce.out'});
      case 'jump': return tl().to(st, {hop:1.4, duration:.3}).to(st, {spin:'+=' + Math.PI*2, duration:.6, ease:'power2.inOut'}, 0).to(st, {hop:0, duration:.55, ease:'bounce.out'});
      case 'spin': return tl().to(st, {spin:'+=' + Math.PI*2, duration:.9, ease:'back.out(1.6)'});
      case 'sad': return tl().to(st, {tilt:.25, duration:.6}).to(st, {tilt:0, duration:.8}, 2.2);
      case 'think': return tl().to(st, {tilt:-.2, duration:.5}).add(() => pulseRing()).to(st, {tilt:0, duration:.6}, 1.8);
      case 'wave': return tl().to(st, {squeezeR:-1, duration:.25}).to(st, {squeezeR:-.6, duration:.18, repeat:3, yoyo:true}).to(st, {squeezeR:0, duration:.3});
    }
  }
  function talk(ms){ if(window.gsap) gsap.fromTo(st, {talk:1}, {talk:0, duration:ms/1000, ease:'steps(1)'}); }

  const ringPos = new THREE.Vector3();
  function pulseRing(){
    electrode.getWorldPosition(ringPos);
    ring.position.copy(ringPos); ring.position.z += .2; ring.scale.setScalar(.6 * st.s); ring.material.opacity = .95;
    if(window.gsap) gsap.to(ring.scale, {x:3*st.s, y:3*st.s, duration:.7, ease:'power2.out'}), gsap.to(ring.material, {opacity:0, duration:.7});
  }

  /* ---------- render loop ---------- */
  const v = new THREE.Vector3(), clock = new THREE.Clock();
  let nextBlink = 2;
  function frame(){
    const t = clock.getElapsedTime(), k = reduce ? 1 : .08;
    st.x += (st.tx - st.x) * k; st.y += (st.ty - st.y) * k; st.s += (st.ts - st.s) * k;
    if(!dragging){ st.spin *= .94; }

    st.vel *= .9;
    const sq = Math.min(.12, Math.abs(st.vel)*.006);
    root.position.set(st.x, st.y + (reduce ? 0 : Math.sin(t*1.6)*.06) + st.hop*.8 + st.vel*.012, 0);
    root.scale.set(st.s*(1 - sq*.6), st.s*(1 + sq), st.s);
    const towardCenter = -Math.sign(st.x) * .25;
    root.rotation.y = towardCenter + st.lookX * .7 + st.spin;
    root.rotation.x = st.lookY * .35 + st.vel*.012;
    root.rotation.z = st.tilt + (reduce ? 0 : Math.sin(t*1.1)*.03);

    // idle blinks
    if(t > nextBlink && st.blink === 0 && !reduce){ nextBlink = t + 2 + Math.random()*3.5; gsap && gsap.timeline().to(st, {blink:1, duration:.06}).to(st, {blink:0, duration:.1}, .12); }
    eyes.forEach(e => { e.scale.y = Math.max(.08, 1 - st.blink); e.position.x = Math.sign(e.position.x)*.31 + st.lookX*.04; });
    elecMat.emissive.setRGB(st.glowE, st.glowE*.82, st.glowE*.25);
    smile.visible = st.talk < .5; mouthO.visible = !smile.visible;
    if(st.talk > 0) mouthO.scale.y = .06 + Math.abs(Math.sin(t*18))*.08;

    arms.forEach(a => {
      const q = a.side < 0 ? st.squeezeL : st.squeezeR;
      if(q >= 0){
        a.pivot.rotation.z = a.side*(.1 + Math.sin(t*2 + a.side)*.04) - a.side*q*.9;
        a.hand.scale.setScalar(1 - q*.3 + (q > .5 ? Math.sin(t*50)*.05 : 0));
        a.wb.material.emissive.setRGB(q*.9, q*.6, q*.1);
      } else { // negative = wave
        a.pivot.rotation.z = a.side * (2.4 + q*.6);
        a.hand.scale.setScalar(1); a.wb.material.emissive.setRGB(0,0,0);
      }
    });

    renderer.render(scene, camera);

    // pin bubble to head
    if(bubble.classList.contains('show')){
      v.set(0, 1.15, 0).applyMatrix4(root.matrixWorld).project(camera);
      const sx = (v.x+1)/2*innerWidth, sy = (1-v.y)/2*innerHeight;
      const w = bubSize.w, h = bubSize.h;
      const goLeft = sx > innerWidth*.55;
      let bx = goLeft ? sx - w - 4 : sx + 4;
      bx = Math.max(12, Math.min(innerWidth - w - 12, bx));
      let by = Math.max(70, sy - h - 14);
      bubble.style.transform = `translate(${bx}px,${by}px)`;
      const tx = Math.max(16, Math.min(w - 34, sx - bx - 9));
      tail.style.left = tx + 'px';
      tail.style.transform = goLeft ? 'scaleX(1)' : 'scaleX(-1)';
      bubble.style.setProperty('--ox', (tx/w*100) + '%');
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {place, act, talk, say, vel(v){ v = Math.max(-40, Math.min(40, v)); if(Math.abs(v) > Math.abs(st.vel)) st.vel = v; }};
}

/* =========================================================
   Scroll chapters → mascot position, lines, poses
   ========================================================= */
const chapters = [...document.querySelectorAll('[data-side]')];
let current = null;
function enter(el){
  if(current === el) return; current = el;
  const s = el.dataset.side;
  mascot && mascot.place(s);
  sfx.whoosh();
  const line = isMobile() && el.dataset.sayMobile ? el.dataset.sayMobile : el.dataset.say;
  say(line, '', (isMobile() || el.dataset.side === 'corner') ? 4000 : 0);
  if(mascot){ mascot.talk(1200); if(el.dataset.pose) setTimeout(() => mascot.act(el.dataset.pose), 450); }
}
if('IntersectionObserver' in window){
  const io = new IntersectionObserver(es => { es.forEach(e => { if(e.isIntersecting) enter(e.target); }); }, {rootMargin:'-45% 0px -45% 0px'});
  chapters.forEach(c => io.observe(c));
}
setTimeout(() => enter(chapters[0]), 700);

/* =========================================================
   Text reveals (GSAP + ScrollTrigger)
   ========================================================= */
if(window.gsap && window.ScrollTrigger && !reduce){
  gsap.registerPlugin(ScrollTrigger);
  document.querySelectorAll('.split').forEach(el => {
    const nodes = [...el.childNodes]; el.textContent = '';
    nodes.forEach(n => {
      if(n.nodeType === 3){
        n.textContent.split(/(\s+)/).forEach(w => {
          if(!w) return;
          if(/^\s+$/.test(w)){ el.appendChild(document.createTextNode(' ')); return; }
          const o = document.createElement('span'); o.className = 'word';
          const i = document.createElement('span'); i.textContent = w; o.appendChild(i); el.appendChild(o);
        });
      } else { const o = document.createElement('span'); o.className = 'word'; const i = document.createElement('span'); i.appendChild(n); o.appendChild(i); el.appendChild(o); }
    });
    gsap.from(el.querySelectorAll('.word>span'), {yPercent:105, duration:.85, ease:'power3.out', stagger:.03, scrollTrigger:{trigger:el, start:'top 88%'}});
  });
  document.querySelectorAll('.reveal').forEach(el => {
    gsap.to(el, {opacity:1, translate:'0px 0px', duration:.8, ease:'power3.out', scrollTrigger:{trigger:el, start:'top 92%'}});
  });
  gsap.from('.wordmark', {y:30, opacity:0, duration:1.0, ease:'power3.out'});
  gsap.to('.hero .col-l', {opacity:.25, ease:'none', scrollTrigger:{trigger:'.hero', start:'top top', end:'bottom top', scrub:true}});
} else {
  document.documentElement.classList.add('noscript-stage');
}

/* =========================================================
   NPG Lite exploded assembly (three.js, modelled on the hardware photos)
   ========================================================= */
const LAYERS = [
  {name:'Enclosure base', layer:'Layer 05 · Housing', title:'Ergonomic 3D-printed enclosure', body:'Dual-shell matte black case printed in impact-resistant biocompatible polymer, with strap routing channels for wrist or arm fastening, recessed toggle protection and chamfered patient-friendly contours.', pills:['Snap-fit lid','Strap ready','Matte black']},
  {name:'LiPo 400 mAh', layer:'Layer 04 · Power', title:'3.7 V 400 mAh LiPo and isolation', body:'Tucked beneath the carrier, the lithium polymer cell connects through a keyed 2-pin JST connector. A side-mounted slide switch guarantees 0 µA standby drain and instant disconnect.', pills:['400 mAh','JST quick-release','Hardware switch']},
  {name:'ProtoPlaymate', layer:'Layer 03 · Carrier', title:'ProtoPlaymate carrier dock', body:'Custom carrier board with dual-row female receptor sockets. Hot-swappable installation for the NPG Lite, strain-relieved right-angle header breakout pins and mechanical isolation from battery heat.', pills:['Hot-swappable','Right-angle pins','Secure retention']},
  {name:'NPG Lite board', layer:'Layer 02 · Sensor & wireless core', title:'NPG Lite sensor board', body:'32-bit RISC-V compute at 160 MHz with native Wi-Fi 6 and Bluetooth 5.3 LE. Differential inputs (0P/0N, 1P/1N, 2P/2N) capture sub-microvolt biopotentials from gelled Ag/AgCl electrodes with CMRR above 100 dB.', pills:['ESP32-C6','250 Hz','< 1 µV noise']},
  {name:'Top lid', layer:'Layer 01 · Housing', title:'Snap-fit top lid', body:'The upper shell of the dual-shell enclosure. It snaps onto the base, protects the electronics and keeps the strap channels and power switch reachable.', pills:['Snap-fit','Strap channels','Matte black']},
];
const range = $('#hwRange'), hwBox = $('#explode'), hwLabels = $('#hwLabels');
let hw = null, selected = 3;
if(window.THREE){ try{ hw = buildHardware(); }catch(e){ console.warn(e); } }
if(!hw) hwBox.innerHTML = '<img src="/landing/hardware/enclosure.jpg" alt="Exploded view of the NPG Lite enclosure" style="margin:auto;max-height:100%;object-fit:contain">';

function buildHardware(){
  const cv = $('#hwCanvas');
  const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7d828c, .7));
  const key = new THREE.DirectionalLight(0xffffff, 1.05); key.position.set(5, 14, 9); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left:-9, right:9, top:9, bottom:-9, near:1, far:45}); key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe0ff, .45); rim.position.set(-9, 5, -7); scene.add(rim);

  // small studio scene baked into an environment map so the metal parts read as metal
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x8e939b);
  [[0, 10, 0, 14], [10, 4, 7, 7], [-10, 5, -5, 6], [0, 3, 12, 8]].forEach(([x, y, z, s]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({color:0xffffff, side:THREE.DoubleSide}));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
  });
  scene.environment = pmrem.fromScene(envScene, .04).texture;

  const std = o => new THREE.MeshStandardMaterial(o);
  const M = {
    shell: std({color:0x1c1c1f, roughness:.82}),
    recess: std({color:0x0d0d0f, roughness:.95}),
    groove: std({color:0x45464b, roughness:.6, metalness:.2}),
    plastic: std({color:0x141416, roughness:.5}),
    pcbEdge: std({color:0x17171a, roughness:.6}),
    silver: std({color:0xdcdfe4, roughness:.26, metalness:.92}),
    satin: std({color:0xc9ccd2, roughness:.42, metalness:.75}),
    gold: std({color:0xd8aa3c, roughness:.3, metalness:.9}),
    white: std({color:0xf1efe8, roughness:.55}),
    chip: std({color:0x1b1b1e, roughness:.35}),
    tan: std({color:0xc79f78, roughness:.6}),
    dark: std({color:0x262629, roughness:.5}),
    wireR: std({color:0xc4261d, roughness:.45}),
    wireB: std({color:0x18181a, roughness:.45}),
  };
  let seed = 11; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;

  function canvasTex(w, h, draw){
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }
  function box(w, h, d, mat, x, y, z, parent){
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0); (parent || null) && parent.add(m); return m;
  }
  // a board whose top face carries a drawn texture
  function board(L, W, T, tex, parent){
    const top = std({map:tex, roughness:.45, metalness:.1});
    return box(L, T, W, [M.pcbEdge, M.pcbEdge, top, M.pcbEdge, M.pcbEdge, M.pcbEdge], 0, 0, 0, parent);
  }
  // chamfered outline shared by the lid and the base
  function outline(L, W, c, PathType){
    const p = new (PathType || THREE.Shape)(), x = L/2, y = W/2;
    p.moveTo(-x + c, -y); p.lineTo(x - c, -y); p.lineTo(x, -y + c); p.lineTo(x, y - c); p.lineTo(x - c, y); p.lineTo(-x + c, y); p.lineTo(-x, y - c); p.lineTo(-x, -y + c); p.lineTo(-x + c, -y);
    return p;
  }
  function extrude(shape, depth, mat, bevel){
    const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled:!!bevel, bevelSize:bevel || 0, bevelThickness:bevel || 0, bevelSegments:3, curveSegments:4});
    g.rotateX(-Math.PI/2); return new THREE.Mesh(g, mat);
  }
  function pad(ctx, px, py, r, hole){
    ctx.fillStyle = '#d2a43c'; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b2a28'; ctx.beginPath(); ctx.arc(px, py, hole, 0, 7); ctx.fill();
  }

  const rig = new THREE.Group(); scene.add(rig);
  const groups = [];
  function layerGroup(i){ const g = new THREE.Group(); g.userData.layer = i; rig.add(g); groups[i] = g; return g; }

  /* ---- 05 enclosure base ---- */
  const BL = 6.1, BW = 2.8, BC = .45, BH = .95, BT = .12;
  const base = layerGroup(0);
  base.add(extrude(outline(BL, BW, BC), BT, M.shell));
  const wallShape = outline(BL, BW, BC); wallShape.holes.push(outline(BL - 2*BT, BW - 2*BT, BC*.8, THREE.Path));
  const walls = extrude(wallShape, BH - BT, M.shell); walls.position.y = BT; base.add(walls);
  // segmented side panel, as on the printed case
  for(let i = 0; i < 9; i++) box(.3, .42, .03, M.recess, -2.45 + i*.34, .42, BW/2 + .012, base);
  // side slide switch
  box(.7, .2, .03, M.recess, 1.7, .62, BW/2 + .012, base);
  const sw = box(.16, .1, .07, M.satin, 1.58, .62, BW/2 + .03, base); sw.userData.callout = 'switch';
  // port opening on the end wall where the right-angle pins leave the case
  box(.03, .4, 1.25, M.recess, BL/2 + .012, .69, 0, base);

  /* ---- 04 LiPo cell ---- */
  const bat = layerGroup(1);
  const labelTex = canvasTex(512, 200, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f0cf6a'); g.addColorStop(1, '#d9a93c');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, 0, 70, h);
    c.fillStyle = '#3a2a08'; c.font = 'bold 30px Space Grotesk, sans-serif'; c.fillText('Li-Polymer  3.7V', 96, 70);
    c.font = '26px Space Grotesk, sans-serif'; c.fillText('400mAh   1.48Wh', 96, 112);
    c.font = '20px ui-monospace, monospace'; c.fillText('602030   ⊕  ⊖', 96, 152);
    c.strokeStyle = '#3a2a08'; c.lineWidth = 3; c.strokeRect(430, 120, 50, 50); c.font = 'bold 26px sans-serif'; c.fillText('CE', 436, 156);
  });
  box(2.7, .26, 1.0, [M.satin, M.satin, std({map:labelTex, roughness:.5}), M.satin, M.satin, M.satin], 0, 0, 0, bat);
  box(.18, .27, 1.02, M.satin, -1.36, 0, 0, bat); // sealed pouch edge
  [[M.wireR, .1], [M.wireB, -.1]].forEach(([mat, dz]) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.45, .02, dz), new THREE.Vector3(-1.85, .05, dz), new THREE.Vector3(-2.15, .18, .1 + dz*.5), new THREE.Vector3(-2.05, .3, .55 + dz*.3)
    ]);
    bat.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .028, 8, false), mat));
  });
  box(.3, .14, .2, M.white, -2.0, .32, .65, bat);
  box(.22, .06, .12, M.recess, -2.0, .39, .65, bat);

  /* ---- 03 ProtoPlaymate carrier ---- */
  const CL = 5.3, CW = 2.3;
  const carrier = layerGroup(2);
  const carTex = canvasTex(1024, Math.round(1024*CW/CL), (c, w, h) => {
    const s = w/CL, X = x => (x + CL/2)*s, Z = z => (z + CW/2)*s;
    c.fillStyle = '#0f0f11'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 2;
    for(let i = 0; i < 26; i++){ c.beginPath(); const y = rnd()*h; c.moveTo(0, y); c.lineTo(w*rnd(), y); c.lineTo(w*rnd(), y + 30*(rnd() - .5)); c.stroke(); }
    for(let i = 0; i < 13; i++) for(let j = 0; j < 4; j++) pad(c, X(-1.8 + i*.3), Z(-.45 + j*.3), 9, 4.5);
    [[-2.35, -.85], [-2.35, .85], [2.35, -.85], [2.35, .85]].forEach(([x, z]) => pad(c, X(x), Z(z), 22, 14));
    c.fillStyle = '#e8e8e8'; c.font = 'bold 22px ui-monospace, monospace'; c.fillText('PROTOPLAYMATE', X(-1.1), Z(.66));
    c.font = '15px ui-monospace, monospace'; c.fillText('NPG-LITE CARRIER v1', X(-1.1), Z(.82));
  });
  board(CL, CW, .08, carTex, carrier);
  const holeTex = canvasTex(1024, 64, (c, w, h) => {
    c.fillStyle = '#161618'; c.fillRect(0, 0, w, h);
    for(let i = 0; i < 14; i++){ c.fillStyle = '#050505'; c.fillRect(i*w/14 + 22, 20, 28, 26); }
  });
  [-.85, .85].forEach(z => box(4.2, .42, .26, [M.plastic, M.plastic, std({map:holeTex, roughness:.5}), M.plastic, M.plastic, M.plastic], 0, .25, z, carrier));
  // right-angle breakout pins
  box(.14, .42, 1.2, M.plastic, 2.36, .25, 0, carrier);
  for(let r = 0; r < 2; r++) for(let k = 0; k < 4; k++){
    const z = -.42 + k*.28, y = .14 + r*.2;
    box(.8 + r*.12, .055, .055, M.silver, 2.75 + r*.06, y, z, carrier);
    box(.055, y, .055, M.silver, 2.28 - r*.12, y/2, z, carrier);
  }

  /* ---- 02 NPG Lite board ---- */
  const NL = 5.0, NW = 2.0;
  const npg = layerGroup(3);
  const top = ['BAT','EN','VBUS','D9','D8','A5','A4','A3','A2','A1','A0','SCL','SDA','LED'];
  const bot = ['RST','3V3','REF','GND','0N','0P','1N','1P','2N','2P','SCK','MO','MI','TX'];
  const npgTex = canvasTex(1024, Math.round(1024*NW/NL), (c, w, h) => {
    const s = w/NL, X = x => (x + NL/2)*s, Z = z => (z + NW/2)*s;
    c.fillStyle = '#0e0e10'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,.045)'; c.lineWidth = 2;
    for(let i = 0; i < 40; i++){ c.beginPath(); const x = rnd()*w*.75, y = rnd()*h; c.moveTo(x, y); c.lineTo(x + 60*rnd(), y); c.lineTo(x + 60*rnd(), y + 50*(rnd() - .5)); c.stroke(); }
    for(let i = 0; i < 14; i++){
      const x = X(-1.95 + i*.3);
      pad(c, x, Z(-.85), 15, 7); pad(c, x, Z(.85), 15, 7);
      c.fillStyle = '#ededed'; c.font = 'bold 14px ui-monospace, monospace'; c.textAlign = 'center';
      c.fillText(top[i], x, Z(-.62)); c.fillText(bot[i], x, Z(.7));
    }
    [[-2.3, -.72], [-2.3, .72], [2.3, -.72], [2.3, .72]].forEach(([x, z]) => pad(c, X(x), Z(z), 24, 15));
    // antenna meander
    c.strokeStyle = '#8f9196'; c.lineWidth = 5; c.beginPath();
    let ax = X(1.92); c.moveTo(ax, Z(.42));
    for(let k = 0; k < 4; k++){ c.lineTo(ax, Z(-.38)); ax += 12; c.lineTo(ax, Z(-.38)); c.lineTo(ax, Z(.3)); ax += 12; c.lineTo(ax, Z(.3)); }
    c.stroke();
    c.textAlign = 'left'; c.fillStyle = '#ededed';
    c.strokeStyle = '#ededed'; c.lineWidth = 2; c.strokeRect(X(-.15), Z(.4), 150, 28);
    c.font = 'bold 18px ui-monospace, monospace'; c.fillText('[NPG LITE]', X(-.15) + 12, Z(.4) + 20);
    c.font = 'bold 13px ui-monospace, monospace';
    c.fillText('BOOT', X(.25), Z(-.28)); c.fillText('RST', X(-1.95), Z(.12)); c.fillText('CHG', X(-2.45), Z(.5)); c.fillText('BAT', X(-1.75), Z(-.42));
  });
  board(NL, NW, .08, npgTex, npg);
  const yT = .04;
  // ESP32-C6 module shield
  const shieldTex = canvasTex(256, 220, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#e3e5e9'); g.addColorStop(1, '#b9bcc2');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(70,72,78,.75)'; c.font = 'bold 30px Space Grotesk, sans-serif'; c.fillText('ESP32-C6', 40, 125);
    c.beginPath(); c.arc(128, 70, 22, 0, 7); c.lineWidth = 4; c.strokeStyle = 'rgba(70,72,78,.6)'; c.stroke();
  });
  box(1.1, .14, .95, [M.satin, M.satin, std({map:shieldTex, roughness:.3, metalness:.7}), M.satin, M.satin, M.satin], 1.3, yT + .07, -.02, npg);
  // USB-C
  const usb = box(.5, .2, .62, M.silver, -2.33, yT + .1, -.05, npg);
  box(.02, .08, .44, M.recess, -2.585, yT + .1, -.05, npg);
  // battery JST socket (the "battery connector" callout)
  const jst = box(.38, .24, .42, M.white, -1.5, yT + .12, -.6, npg); jst.userData.callout = 'jst';
  box(.26, .03, .3, std({color:0xcfccc4, roughness:.6}), -1.5, yT + .25, -.6, npg);
  // tactile buttons
  [[-1.78, .3], [.45, -.42]].forEach(([x, z]) => {
    box(.32, .1, .32, M.satin, x, yT + .05, z, npg);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .08, 20), M.white); cap.position.set(x, yT + .14, z); npg.add(cap);
  });
  // ICs
  [[-.95, -.22, .34, .24], [-.9, .25, .3, .3], [-.35, -.45, .28, .2], [-.3, .12, .38, .24], [.15, -.05, .32, .32], [-1.3, .5, .22, .16], [.05, .45, .26, .18]]
    .forEach(([x, z, w, d]) => box(w, .07, d, M.chip, x, yT + .035, z, npg));
  // passives
  const dummy = new THREE.Object3D(), pg = new THREE.BoxGeometry(.09, .05, .05);
  const tanI = new THREE.InstancedMesh(pg, M.tan, 46), darkI = new THREE.InstancedMesh(pg, M.dark, 24);
  [tanI, darkI].forEach(im => {
    for(let i = 0; i < im.count; i++){
      dummy.position.set(-2.0 + rnd()*2.55, yT + .025, -.62 + rnd()*1.2);
      dummy.rotation.y = rnd() > .5 ? Math.PI/2 : 0; dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    }
    npg.add(im);
  });
  // rainbow status LEDs
  ['#c58bff', '#ff4f8a', '#ff8a5c', '#ffe066', '#7be37b', '#5aa8ff'].forEach((col, i) => {
    box(.13, .05, .13, std({color:col, emissive:col, emissiveIntensity:.55, roughness:.3}), .62 - i*.02, yT + .025, .38 - i*.15, npg);
  });
  // header pins + plastic spacers underneath, matching the carrier sockets
  const pinI = new THREE.InstancedMesh(new THREE.BoxGeometry(.06, .7, .06), M.gold, 28);
  for(let i = 0; i < 14; i++) [-.85, .85].forEach((z, r) => { dummy.position.set(-1.95 + i*.3, -.27, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); pinI.setMatrixAt(i*2 + r, dummy.matrix); });
  npg.add(pinI);
  [-.85, .85].forEach(z => box(4.2, .1, .12, M.plastic, 0, -.09, z, npg));

  /* ---- 01 top lid ---- */
  const lid = layerGroup(4);
  const lidM = extrude(outline(BL, BW, BC), .12, M.shell, .04); lidM.position.y = .04; lid.add(lidM);
  [-.55, .55].forEach(z => box(2.6, .02, .09, M.groove, -.2, .215, z, lid));
  box(.5, .02, .3, M.groove, 2.2, .215, 0, lid);

  rig.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({opacity:.16}));
  ground.rotation.x = -Math.PI/2; ground.position.y = -.01; ground.receiveShadow = true; scene.add(ground);


  /* ---- layout ---- */
  const REST = [0, .25, .55, 1.05, 1.36];   // assembled heights
  const LIFT = [0, 1.3, 2.8, 4.45, 6.2];  // extra lift when fully exploded
  const view = {e:0, yaw:-.5, pitch:.4, tYaw:-.5, tPitch:.4, dist:16, ty:1};
  let w = 1, h = 1;

  /* ---- callout tags ---- */
  const TAGS = [
    {i:4, text:'Top lid', short:'Lid', at:[-2.2, .2, .9], side:'l'},
    {i:3, text:'NPG Lite · ESP32-C6', short:'NPG Lite', at:[1.3, .2, .3], side:'r'},
    {i:2, text:'ProtoPlaymate carrier', short:'Carrier', at:[-2.2, .5, .85], side:'l'},
    {i:1, text:'LiPo 3.7 V 400 mAh', short:'LiPo', at:[1.0, .13, .3], side:'r'},
    {i:0, text:'3D-printed base', short:'Base', at:[-2.6, .6, 1.4], side:'l'},
    {i:0, text:'ON/OFF switch', short:'Switch', at:[1.58, .62, 1.45], side:'r', mini:1},
  ];
  TAGS.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'hw-tag' + (t.mini ? ' mini' : '');
    b.innerHTML = `<i></i><span class="ln"></span><b><span class="full">${t.text}</span><span class="short">${t.short}</span></b>`;
    b.addEventListener('click', e => { e.stopPropagation(); inspect(t.i); });
    hwLabels.appendChild(b); t.el = b;
  });
  const v3 = new THREE.Vector3();

  function resize(){
    w = hwBox.clientWidth; h = hwBox.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(hwBox); resize();

  /* ---- interaction ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  function pick(e){
    const r = cv.getBoundingClientRect();
    ndc.set((e.clientX - r.left)/r.width*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(rig, true)[0];
    let o = hit && hit.object; while(o && o.userData.layer === undefined) o = o.parent;
    return o ? o.userData.layer : -1;
  }
  cv.addEventListener('pointerdown', e => { down = {x:e.clientX, y:e.clientY, moved:false}; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if(down){
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if(Math.abs(dx) + Math.abs(dy) > 4) down.moved = true;
      view.tYaw += dx*.008; view.tPitch = Math.max(.12, Math.min(1.25, view.tPitch + dy*.005));
      down.x = e.clientX; down.y = e.clientY;
    } else cv.style.cursor = pick(e) >= 0 ? 'pointer' : 'grab';
  });
  cv.addEventListener('pointerup', e => { if(down && !down.moved){ const i = pick(e); if(i >= 0) inspect(i); } down = null; });

  /* ---- render ---- */
  let visible = false;
  new IntersectionObserver(es => visible = es[0].isIntersecting).observe(hwBox);
  const clock = new THREE.Clock();
  function frame(){
    requestAnimationFrame(frame);
    if(!visible) return;
    const t = clock.getElapsedTime(), e = view.e;
    view.yaw += (view.tYaw + (down || reduce ? 0 : Math.sin(t*.35)*.18) - view.yaw)*.08;
    view.pitch += (view.tPitch - view.pitch)*.08;
    groups.forEach((g, i) => {
      const lift = i === selected && e > .2 ? .12 : 0;
      g.position.y += (REST[i] + LIFT[i]*e + lift - g.position.y)*.25;
    });
    groups[4].rotation.z = e*.05; groups[4].rotation.x = -e*.04;
    rig.rotation.y = view.yaw;

    // frame the stack: height grows as it opens
    const H = 1.6 + LIFT[4]*e, ty = H*.45;
    const fitH = (H*.62 + 1.3) / Math.tan(THREE.MathUtils.degToRad(14));
    const fitW = 3.9 / (Math.tan(THREE.MathUtils.degToRad(14)) * camera.aspect);
    const dist = Math.max(fitH, fitW) * 1.05;
    view.dist += (dist - view.dist)*.1; view.ty += (ty - view.ty)*.1;
    camera.position.set(0, view.ty + Math.sin(view.pitch)*view.dist, Math.cos(view.pitch)*view.dist);
    camera.lookAt(0, view.ty, 0);
    renderer.render(scene, camera);

    // pin tags to their parts
    TAGS.forEach(tag => {
      v3.set(...tag.at); groups[tag.i].localToWorld(v3); v3.project(camera);
      const x = (v3.x + 1)/2*w, y = (1 - v3.y)/2*h;
      const show = tag.mini ? e < .2 : e > .3;
      const flip = tag.side === 'l';
      tag.el.classList.toggle('flip', flip);
      tag.el.style.transform = `translate(${x}px,${y}px) translate(${flip ? '-100%' : '0'},-50%)`;
      // keep the pill inside the box by shortening the leader line when it would overflow
      const tw = tag.el.offsetWidth, over = flip ? tw - x + 6 : x + tw - w + 6;
      tag.el.querySelector('.ln').style.width = Math.max(6, 30 - Math.max(0, over)) + 'px';
      tag.el.style.opacity = show && x > 0 && x < w ? 1 : 0;
      tag.el.style.pointerEvents = show ? 'auto' : 'none';
      tag.el.classList.toggle('on', tag.i === selected && !tag.mini);
    });
  }
  requestAnimationFrame(frame);

  return {
    setExplode(v){ view.e = v/100; },
    select(i){ selected = i; },
  };
}

function inspect(i){
  const L = LAYERS[i]; sfx.click(); selected = i;
  hw && hw.select(i);
  $('#inspLayer').textContent = L.layer; $('#inspTitle').textContent = L.title; $('#inspBody').textContent = L.body;
  $('#inspPills').innerHTML = L.pills.map(p => `<span>${p}</span>`).join('');
}
function setExplode(v){
  hw && hw.setExplode(v);
  $('#hwClose').setAttribute('aria-pressed', v < 15); $('#hwOpen').setAttribute('aria-pressed', v > 60);
}
function tweenExplode(to, dur, ease){
  if(!window.gsap){ range.value = to; setExplode(to); return; }
  const o = {v:+range.value};
  return gsap.to(o, {v:to, duration:dur, ease, onUpdate:() => { range.value = o.v; setExplode(o.v); }});
}
range.addEventListener('input', () => setExplode(+range.value));
$('#hwClose').onclick = () => { sfx.whoosh(); tweenExplode(0, .8, 'power3.inOut'); };
$('#hwOpen').onclick = () => { sfx.whoosh(); tweenExplode(100, 1.2, 'power3.out'); };
$('#hwAnim').onclick = () => {
  if(!window.gsap) return;
  sfx.whoosh();
  gsap.timeline().add(tweenExplode(0, .7, 'power2.inOut')).add(tweenExplode(100, 1.6, 'elastic.out(1,.6)'));
};
inspect(3);
// open the unit the first time it scrolls into view
if(reduce || !window.ScrollTrigger){ range.value = 75; setExplode(75); }
else {
  range.value = 0; setExplode(0);
  ScrollTrigger.create({trigger:hwBox, start:'top 70%', once:true, onEnter:() => { sfx.whoosh(); gsap.delayedCall(.35, () => tweenExplode(80, 2.2, 'power3.inOut')); }});
}

/* =========================================================
   Gestures the bedside scene acts out
   ========================================================= */
const G = {
  blink2:{label:'Two quick blinks', en:'Yes', hi:'हाँ', events:[{ch:0,type:'blink',at:0,dur:.3},{ch:0,type:'blink',at:.38,dur:.3}]},
  blinkLong:{label:'One long blink', en:'No', hi:'नहीं', events:[{ch:0,type:'hold',at:0,dur:1.1}]},
  left:{label:'Squeeze left hand', en:'I need water', hi:'मुझे पानी चाहिए', events:[{ch:1,type:'burst',at:0,dur:.75}]},
  right:{label:'Squeeze right hand', en:'I’m in pain', hi:'मुझे दर्द हो रहा है', events:[{ch:2,type:'burst',at:0,dur:.75}]},
  both:{label:'Squeeze both hands', en:'Please call the nurse', hi:'नर्स को बुलाइए', alert:true, events:[{ch:1,type:'burst',at:0,dur:.8},{ch:2,type:'burst',at:.04,dur:.8}]},
  blink3:{label:'Three quick blinks', en:'Emergency, help now', hi:'तुरंत मदद चाहिए', alert:true, events:[{ch:0,type:'blink',at:0,dur:.3},{ch:0,type:'blink',at:.33,dur:.3},{ch:0,type:'blink',at:.66,dur:.3}]},
  seizure:{label:'Sleep Distress & Seizure Discharges', en:'CRITICAL ALERT: Nocturnal Seizure Detected', hi:'आपातकाल: दौरा व संकट डिटेक्ट', alert:true, isSeizure:true, events:[{ch:0,type:'seizure',at:0,dur:3.5},{ch:1,type:'burst',at:.15,dur:3.1},{ch:2,type:'burst',at:.2,dur:3.1}]},
};
/* =========================================================
   Bedside scene: the patient, electrodes and bedside unit
   (ported from SAMPLE.html), drawn behind every section
   ========================================================= */
const bed = (function buildBedScene(){
  const canvas = $('#bedScene');
  if(!window.THREE || !canvas) return null;
  let renderer;
  try{ renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true}); }catch(e){ canvas.remove(); return null; }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const sm = u => u <= 0 ? 0 : u >= 1 ? 1 : u*u*(3 - 2*u);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if ('outputColorSpace' in renderer) { renderer.outputColorSpace = THREE.SRGBColorSpace || 'srgb'; } else { renderer.outputEncoding = 3001; }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, innerWidth/innerHeight, .05, 60);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x7f97a6, .9); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.05); key.position.set(2.6, 4.2, 2.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left:-2.4, right:2.4, top:2.4, bottom:-2.4, near:.5, far:12}); key.shadow.bias = -.0008; key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd4ff, .45); rim.position.set(-3, 2.2, -2.5); scene.add(rim);

  const std = (c, r = .7, m = 0) => new THREE.MeshStandardMaterial({color:c, roughness:r, metalness:m});
  const M = {skin:std(0xc98f6c, .55), hair:std(0x241914, .85), gown:std(0x8fc0cf, .85), blanket:std(0xdfe8ee, .92), sheet:std(0xf6f7f4, .9),
    mattress:std(0xeef2f4, .8), frame:std(0xc6cfd6, .35, .55), dark:std(0x24282e, .6, .3), cable:std(0x1f252b, .55, .1),
    silver:std(0xcfd5da, .28, .75), headband:std(0x06b6d4, .7), wristband:std(0xff5a36, .7), eye:std(0x1b2228, .3), lip:std(0x9c5f52, .6)};

  function rbox(w, h, d, r){
    const b = Math.max(.001, Math.min(r, d/2 - .001, w/2 - .001, h/2 - .001));
    const sw = w - 2*b, sh = h - 2*b, rr = Math.max(.0005, Math.min(b, sw/2, sh/2)*.9), x = -sw/2, y = -sh/2;
    const s = new THREE.Shape();
    s.moveTo(x + rr, y); s.lineTo(x + sw - rr, y); s.quadraticCurveTo(x + sw, y, x + sw, y + rr); s.lineTo(x + sw, y + sh - rr);
    s.quadraticCurveTo(x + sw, y + sh, x + sw - rr, y + sh); s.lineTo(x + rr, y + sh); s.quadraticCurveTo(x, y + sh, x, y + sh - rr); s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
    const g = new THREE.ExtrudeGeometry(s, {depth:Math.max(d - 2*b, .0005), bevelEnabled:true, bevelSize:b, bevelThickness:b, bevelSegments:4, curveSegments:8});
    g.center(); return g;
  }
  function mesh(g, m, pos, cast = true){ const o = new THREE.Mesh(g, m); if(pos) o.position.copy(pos); o.castShadow = cast; o.receiveShadow = true; scene.add(o); return o; }
  function limb(a, b, r1, r2, m){
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 18), m); o.position.copy(a).add(b).multiplyScalar(.5);
    o.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); o.castShadow = true; o.receiveShadow = true; scene.add(o); return o;
  }
  const sph = (r, m, p, s) => { const o = mesh(new THREE.SphereGeometry(r, 28, 20), m, p); if(s) o.scale.set(s[0], s[1], s[2]); return o; };

  const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gx = gc.getContext('2d');
  const grd = gx.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.25, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  gx.fillStyle = grd; gx.fillRect(0, 0, 128, 128); const glowTex = new THREE.CanvasTexture(gc);
  const glowSprite = (color, s) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, color, blending:THREE.AdditiveBlending, transparent:true, depthWrite:false})); sp.scale.setScalar(s); return sp; };

  const shadowFloor = mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({opacity:.2}), V(0, 0, 0), false); shadowFloor.rotation.x = -Math.PI/2;
  const grid = new THREE.GridHelper(14, 56, 0xffffff, 0xffffff); grid.material.transparent = true; grid.material.opacity = .1; grid.position.y = .001; scene.add(grid);
  const rings = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(new THREE.RingGeometry(1.38, 1.40, 128), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.4, side:THREE.DoubleSide, depthWrite:false}));
    r.rotation.x = -Math.PI/2; r.position.y = .003; scene.add(r); return r;
  });

  /* bed */
  for(const sx of [-.93, .93]) for(const sz of [-.4, .4]){
    mesh(new THREE.CylinderGeometry(.025, .025, .36, 14), M.frame, V(sx, .23, sz));
    const w = mesh(new THREE.TorusGeometry(.04, .015, 10, 22), M.dark, V(sx, .055, sz)); w.rotation.y = Math.PI/2;
  }
  mesh(rbox(2.06, .1, .98, .03), M.frame, V(0, .43, 0));
  mesh(rbox(2.0, .16, .92, .06), M.mattress, V(0, .56, 0));
  mesh(rbox(.06, .6, 1.02, .028), M.frame, V(-1.06, .72, 0));
  mesh(rbox(.06, .4, 1.02, .028), M.frame, V(1.06, .62, 0));
  const railFar = new THREE.CatmullRomCurve3([V(-.62, .66, -.5), V(-.6, .8, -.5), V(.35, .8, -.5), V(.37, .66, -.5)]);
  mesh(new THREE.TubeGeometry(railFar, 60, .016, 10), M.frame);
  mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V(-.6, .72, -.5), V(.35, .72, -.5)), 4, .011, 8), M.frame);
  mesh(new THREE.TubeGeometry(new THREE.LineCurve3(V(-.6, .5, .5), V(.35, .5, .5)), 4, .016, 10), M.frame);
  const pillow = mesh(rbox(.36, .1, .62, .05), M.sheet, V(-.82, .685, 0)); pillow.rotation.z = .08;

  /* patient */
  const R = .105, H = V(-.80, .83, 0), HS = V(1.15, 1, .88);
  const hp = (dx, dy, dz, k = 1) => { const v = V(dx, dy, dz).normalize(); return V(H.x + v.x*HS.x*R*k, H.y + v.y*HS.y*R*k, H.z + v.z*HS.z*R*k); };
  const hn = (dx, dy, dz) => { const v = V(dx, dy, dz).normalize(); return V(v.x/HS.x, v.y/HS.y, v.z/HS.z).normalize(); };
  sph(R, M.skin, H, [HS.x, HS.y, HS.z]);
  const hairG = new THREE.Group(); hairG.position.copy(H); hairG.scale.copy(HS).multiplyScalar(1.035); scene.add(hairG);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20, 0, Math.PI*2, 0, 1.72), M.hair); hair.quaternion.setFromUnitVectors(V(0, 1, 0), V(-.78, -.62, 0).normalize()); hair.castShadow = true; hairG.add(hair);
  const eyes = [-1, 1].map(s => sph(.016, M.eye, hp(-.14, .92, .36*s, .96)));
  mesh(new THREE.ConeGeometry(.017, .04, 14), M.skin, hp(.1, 1, 0, 1.0));
  sph(.012, M.lip, hp(.48, .86, 0, .98), [.45, .35, 1.7]);
  for(const s of [-1, 1]) sph(.026, M.skin, hp(.12, -.05, s, .97), [1.25, .85, .45]);
  const bandH = new THREE.Mesh(new THREE.TorusGeometry(.866*R + .007, .012, 10, 80), M.headband);
  bandH.position.set(H.x - .5*HS.x*R, H.y, H.z); bandH.rotation.y = Math.PI/2; bandH.scale.set(HS.z/HS.y, 1, 1); bandH.castShadow = true; scene.add(bandH);
  limb(hp(.95, -.05, 0, .8), V(-.6, .74, 0), .048, .05, M.skin);
  const chest = mesh(rbox(.62, .2, .5, .08), M.gown, V(-.34, .735, 0));
  const blanketChest = mesh(rbox(.5, .205, .58, .085), M.blanket, V(-.19, .745, 0));
  const fold = mesh(new THREE.CylinderGeometry(.032, .032, .6, 18), M.sheet, V(-.44, .81, 0)); fold.rotation.x = Math.PI/2;
  mesh(rbox(1.26, .15, .64, .07), M.blanket, V(.36, .7, 0));
  for(const s of [-1, 1]) sph(.06, M.blanket, V(.9, .78, .1*s), [1, 1.1, 1]);
  const arms = {};
  for(const s of [-1, 1]){
    const S = V(-.56, .775, .27*s), E = V(-.25, .8, .33*s), W = V(.08, .815, .25*s), HD = V(.175, .81, .225*s);
    sph(.056, M.gown, S); const mid = S.clone().lerp(E, .5);
    limb(S, mid, .052, .049, M.gown); limb(mid, E, .04, .038, M.skin); sph(.038, M.skin, E); limb(E, W, .038, .03, M.skin);
    const d = new THREE.Vector3().subVectors(W, E).normalize();
    const hand = new THREE.Group(); hand.position.copy(HD); scene.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(.045, 24, 16), M.skin); palm.castShadow = true; hand.add(palm);
    hand.rotation.y = Math.atan2(-d.z, d.x);
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(.016, 12, 10), M.skin); thumb.position.set(-.01, .006, -.04*s); hand.add(thumb);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.038, .013, 10, 40), M.wristband); const bp = W.clone().addScaledVector(d, -.018); band.position.copy(bp);
    band.quaternion.setFromUnitVectors(V(0, 0, 1), d); band.castShadow = true; scene.add(band);
    arms[s] = {hand, palm, base:HD.clone(), pad:bp.clone().add(V(0, .051, 0))};
  }

  /* electrodes (channel colours match the demo scope) */
  const COL = {eeg:new THREE.Color(0xffd23f), emgL:new THREE.Color(0x2fd39a), emgR:new THREE.Color(0xff5a36)};
  function electrode(pos, normal, color){
    const g = new THREE.Group(); g.position.copy(pos); g.quaternion.setFromUnitVectors(V(0, 1, 0), normal.clone().normalize()); scene.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.022, .025, .009, 28), M.silver); base.castShadow = true; g.add(base);
    const capM = new THREE.MeshStandardMaterial({color, emissive:color, emissiveIntensity:.6, roughness:.3});
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.011, .012, .01, 20), capM); cap.position.y = .008; g.add(cap);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.032, .0022, 8, 48), new THREE.MeshBasicMaterial({color, transparent:true, opacity:.75}));
    ring.rotation.x = Math.PI/2; ring.position.y = .004; g.add(ring);
    const glow = glowSprite(color, .12); glow.position.y = .014; g.add(glow);
    return {g, capM, ring, glow};
  }
  const Fp = hp(-.5, .866, 0, 1.075), Mp = hp(.38, -.3, .87, 1.03);
  const E = {
    eeg:electrode(Fp, hn(-.5, .866, 0), COL.eeg),
    ref:electrode(Mp, hn(.38, -.3, .87), COL.eeg),
    emgL:electrode(arms[-1].pad, V(0, 1, 0), COL.emgL),
    emgR:electrode(arms[1].pad, V(0, 1, 0), COL.emgR)
  };

  /* signal simulation that drives the patient, electrodes and bedside screen */
  const FS = 250, N = 1000, CH = ['eeg', 'emgL', 'emgR'];
  const bufs = {eeg:new Float32Array(N), emgL:new Float32Array(N), emgR:new Float32Array(N)};
  let head = 0, simT = 0, acc = 0, active = [], pending = [], busy = false, clock = 0, alertUntil = 0, userPlayed = false;
  function evVal(ch, t){
    let v = 0;
    for(const e of active){
      if(e.ch !== ch) continue; const x = t - e.start; if(x < -.2 || x > e.dur + .4) continue;
      if(e.type === 'blink') v += Math.exp(-Math.pow((x - .12)/.065, 2));
      else if(e.type === 'hold') v += .9*sm(x/.12)*sm((e.dur - x)/.12);
      else if(e.type === 'burst') v += sm(x/.08)*sm((e.dur - x)/.12);
      else if(e.type === 'seizure'){
        const env = sm(Math.min(1, Math.max(0, x / .25))) * sm(Math.min(1, Math.max(0, (e.dur - x) / .3)));
        const phase = x * 2 * Math.PI * 4.5;
        const primarySpike = Math.pow(Math.max(0, Math.sin(phase)), 9) * 2.8;
        const polySpike = Math.sin(x * 2 * Math.PI * 13.5) * 0.7 * Math.max(0, Math.sin(phase));
        const slowWave = -Math.pow(Math.max(0, -Math.sin(phase + .35)), 2) * 1.1;
        v += env * (primarySpike + polySpike + slowWave);
      }
    }
    return Math.min(Math.max(v, -1.5), 3.2);
  }
  function sample(ch, t){
    const g = evVal(ch, t);
    if(ch === 'eeg') return .07*Math.sin(2*Math.PI*10.2*t) + .05*Math.sin(2*Math.PI*5.7*t + 1.3) + .035*(Math.random()*2 - 1) + g;
    return (Math.random()*2 - 1)*(.05 + .92*g);
  }
  function stepSim(dt){
    acc += dt*FS;
    while(acc >= 1){ acc -= 1; simT += 1/FS; for(const c of CH) bufs[c][head] = sample(c, simT); head = (head + 1) % N; }
    active = active.filter(e => simT < e.start + e.dur + 1);
    for(let i = pending.length - 1; i >= 0; i--){ if(simT >= pending[i].at){ const p = pending.splice(i, 1)[0]; p.fn(); } }
  }
  const level = ch => evVal(ch, simT);
  const SCH = {0:'eeg', 1:'emgL', 2:'emgR'};

  /* bedside unit */
  const HUB = V(-1.02, 1.22, -.78);
  mesh(new THREE.CylinderGeometry(.16, .18, .03, 32), M.dark, V(HUB.x, .015, HUB.z));
  mesh(new THREE.CylinderGeometry(.016, .016, 1.12, 14), M.frame, V(HUB.x, .57, HUB.z));
  const hubBox = mesh(rbox(.32, .21, .075, .026), M.dark, HUB); const hubYaw = Math.atan2(1.32, .78); hubBox.rotation.y = hubYaw;
  const hubC = document.createElement('canvas'); hubC.width = 320; hubC.height = 200; const hubX = hubC.getContext('2d');
  const hubTex = new THREE.CanvasTexture(hubC); if ('colorSpace' in hubTex) { hubTex.colorSpace = THREE.SRGBColorSpace || 'srgb'; } else { hubTex.encoding = 3001; }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.27, .165), new THREE.MeshBasicMaterial({map:hubTex, toneMapped:false}));
  screen.position.copy(HUB).add(V(Math.sin(hubYaw)*.04, 0, Math.cos(hubYaw)*.04)); screen.rotation.y = hubYaw; scene.add(screen);
  const led = new THREE.Mesh(new THREE.SphereGeometry(.009, 12, 10), new THREE.MeshBasicMaterial({color:0xffd23f})); led.position.copy(HUB).add(V(0, .115, 0)); scene.add(led);
  const ledGlow = glowSprite(0xffd23f, .07); ledGlow.position.copy(led.position); scene.add(ledGlow);
  const hubCols = {eeg:'#ffd23f', emgL:'#2fd39a', emgR:'#ff5a36'};
  function drawHub(){
    const isSeizure = active.some(e => e.type === 'seizure');
    const w = 320, h = 200;
    hubX.fillStyle = isSeizure && Math.sin(clock*14) > 0 ? '#300806' : '#0b0b0c';
    hubX.fillRect(0, 0, w, h);
    if(isSeizure){
      hubX.fillStyle = '#ff3b30'; hubX.font = '700 13px "Space Grotesk", sans-serif'; hubX.fillText('⚡ SEIZURE SPIKES DETECTED', 14, 26);
      hubX.fillStyle = '#ff5a36'; hubX.font = '12px "Space Grotesk", sans-serif'; hubX.fillText('CRITICAL', w - 75, 26);
    } else {
      hubX.fillStyle = '#ffd23f'; hubX.font = '600 18px "Space Grotesk", sans-serif'; hubX.fillText('Netravaani', 14, 26);
      hubX.fillStyle = 'rgba(255,255,255,.55)'; hubX.font = '14px "Space Grotesk", sans-serif'; hubX.fillText('3 ch, 250 Hz', w - 100, 26);
    }
    CH.forEach((c, ci) => {
      const y0 = 70 + ci*48;
      let col = hubCols[c];
      if(isSeizure && c === 'eeg'){
        col = Math.sin(clock*18) > 0 ? '#ff3b30' : '#ffffff';
      }
      hubX.strokeStyle = col; hubX.lineWidth = isSeizure && c === 'eeg' ? 2.5 : 2; hubX.beginPath();
      for(let i = 0; i < 200; i++){ const v = bufs[c][(head + N - 200 + i) % N]; const y = c === 'eeg' ? y0 + 10 - v*30 : y0 - v*18; const x = 12 + i*1.48; if (i) { hubX.lineTo(x, y); } else { hubX.moveTo(x, y); } }
      hubX.stroke();
    });
    hubTex.needsUpdate = true;
  }

  /* cables */
  const port = dx => V(HUB.x + dx*.03, HUB.y - .1, HUB.z + .02);
  const curves = {
    eeg:new THREE.CatmullRomCurve3([Fp, V(-.95, 1.02, -.06), V(-1.06, 1.1, -.42), port(-1.5)]),
    ref:new THREE.CatmullRomCurve3([Mp, V(-.78, .75, .2), V(-.99, .86, .25), V(-1.13, 1.0, -.2), port(-.5)]),
    emgL:new THREE.CatmullRomCurve3([arms[-1].pad, V(0, .9, -.42), V(-.45, 1.0, -.62), port(.5)]),
    emgR:new THREE.CatmullRomCurve3([arms[1].pad, V(.03, .9, .12), V(-.3, .94, -.1), V(-.7, 1.03, -.5), port(1.5)])
  };
  for(const k in curves) mesh(new THREE.TubeGeometry(curves[k], 120, .0048, 8), M.cable);
  const HOLO = V(-.32, 1.56, .04);
  const toHolo = new THREE.CatmullRomCurve3([V(HUB.x, HUB.y + .12, HUB.z), V(-.88, 1.62, -.48), V(-.56, 1.64, -.12), HOLO]);
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints(toHolo.getPoints(80)), new THREE.LineDashedMaterial({color:0xffffff, dashSize:.02, gapSize:.018, transparent:true, opacity:.45}));
  beam.computeLineDistances(); scene.add(beam);

  /* signal pulses travelling along the cables */
  const pool = [];
  for(let i = 0; i < 48; i++){
    const m = new THREE.Mesh(new THREE.SphereGeometry(.011, 10, 8), new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false}));
    const sp = glowSprite(0xffffff, .07); m.add(sp); m.visible = false; scene.add(m); pool.push({m, sp, t:0, on:false, curve:null, speed:1});
  }
  function spawn(curve, color, delay = 0, speed = 1.1){ const p = pool.find(q => !q.on); if(!p) return; p.on = true; p.t = -delay*speed; p.curve = curve; p.speed = speed; p.m.material.color.copy(color); p.sp.material.color.copy(color); }
  const firePulses = ch => { const c = curves[ch]; for(let i = 0; i < 3; i++) spawn(c, COL[ch], i*.13); if(ch === 'eeg') spawn(curves.ref, COL.eeg, .05, 1.0); };
  const hubPulses = alert => { const c = alert ? COL.emgR : COL.eeg; for(let i = 0; i < 4; i++) spawn(toHolo, c, i*.09, 1.4); };

  /* floating request panel above the bed */
  const hc = document.createElement('canvas'); hc.width = 1024; hc.height = 440; const hx = hc.getContext('2d');
  const holoTex = new THREE.CanvasTexture(hc); if ('colorSpace' in holoTex) { holoTex.colorSpace = THREE.SRGBColorSpace || 'srgb'; } else { holoTex.encoding = 3001; } holoTex.anisotropy = 4;
  const holo = new THREE.Mesh(new THREE.PlaneGeometry(.96, .4125), new THREE.MeshBasicMaterial({map:holoTex, transparent:true, depthWrite:false, side:THREE.DoubleSide, toneMapped:false}));
  holo.position.copy(HOLO); scene.add(holo);
  let holoState = {state:'idle'}, holoFlash = 0;
  function rr(x, y, w, h, r){ hx.beginPath(); hx.moveTo(x + r, y); hx.arcTo(x + w, y, x + w, y + h, r); hx.arcTo(x + w, y + h, x, y + h, r); hx.arcTo(x, y + h, x, y, r); hx.arcTo(x, y, x + w, y, r); hx.closePath(); }
  function fitText(t, max, size, weight, fam){ let s = size; do{ hx.font = `${weight} ${s}px ${fam}`; s -= 2; } while(hx.measureText(t).width > max && s > 20); }
  const DISP = '"Funnel Display", sans-serif', SANS = '"Space Grotesk", sans-serif', HI = '"Tiro Devanagari Hindi", serif';
  function drawHolo(){
    const st = holoState, W = 1024, Hh = 440;
    hx.clearRect(0, 0, W, Hh);
    const accent = st.alert ? '#ff5a36' : '#06b6d4';
    rr(20, 20, W - 28, Hh - 28, 44); hx.fillStyle = 'rgba(0, 0, 0, 0.7)'; hx.fill();
    rr(8, 8, W - 28, Hh - 28, 44); hx.fillStyle = st.alert ? '#3a0808' : '#08080a'; hx.fill();
    hx.lineWidth = 6; hx.strokeStyle = accent; hx.stroke();
    const ink = '#ffffff', mute = '#94a3b8';
    hx.fillStyle = st.alert ? '#ff5a36' : '#2fd39a'; hx.beginPath(); hx.arc(66, 72, 12, 0, Math.PI*2); hx.fill();
    hx.font = `600 34px ${SANS}`; hx.fillStyle = mute;
    if(st.state === 'idle'){
      hx.fillText('Netravaani is listening', 96, 84);
      hx.fillStyle = ink; fitText('Waiting for a gesture', W - 140, 84, '800', DISP); hx.fillText('Waiting for a gesture', 56, 220);
      hx.fillStyle = mute; hx.font = `52px ${HI}`; hx.fillText('इशारे का इंतज़ार', 56, 318);
    } else if(st.state === 'reading'){
      hx.fillText('Reading signal', 96, 84);
      hx.fillStyle = ink; hx.font = `800 96px ${DISP}`; hx.fillText('…', 56, 226);
    } else {
      const topLabel = st.isSeizure ? '⚡ CRITICAL MEDICAL EMERGENCY' : (st.alert ? 'Urgent request, nurse alerted' : 'Patient says');
      hx.fillText(topLabel, 96, 84);
      hx.fillStyle = ink; fitText(st.en, W - 140, 96, '800', DISP); hx.fillText(st.en, 56, 226);
      hx.fillStyle = mute; hx.font = `54px ${HI}`; hx.fillText(st.hi, 56, 322);
      hx.font = `500 28px ${SANS}`; hx.fillText('From: ' + st.from.toLowerCase(), 56, 392);
    }
    holoTex.needsUpdate = true;
  }
  const setHolo = s => { holoState = s; holoFlash = 1; drawHolo(); };
  drawHolo(); drawHub();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawHolo(); drawHub(); });

  /* rising particles */
  const PN = reduce ? 60 : 170, pg = new THREE.BufferGeometry(), pp = new Float32Array(PN*3);
  for(let i = 0; i < PN; i++){ pp[i*3] = (Math.random() - .5)*4.4; pp[i*3 + 1] = Math.random()*2.6; pp[i*3 + 2] = (Math.random() - .5)*3.4; }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pmat = new THREE.PointsMaterial({color:0xffffff, size:.014, transparent:true, opacity:.55, depthWrite:false});
  scene.add(new THREE.Points(pg, pmat));

  /* play a gesture through the scene */
  function play(id, fromUser){
    if(busy) return; const g = G[id]; if(!g) return;
    if(fromUser) userPlayed = true;
    busy = true;
    if(g.alert || g.isSeizure) sfx.alert();
    const base = simT + .05; let end = 0;
    for(const e of g.events){
      const ch = SCH[e.ch];
      active.push({ch, type:e.type, start:base + e.at, dur:e.dur});
      end = Math.max(end, e.at + e.dur);
      pending.push({at:base + e.at, fn:() => firePulses(ch)});
    }
    pending.push({at:base + end + .35, fn:() => {
      setHolo({state:'phrase', en:g.en, hi:g.hi, from:g.label, alert:!!g.alert, isSeizure:!!g.isSeizure});
      hubPulses(!!g.alert);
      if(g.alert || g.isSeizure) alertUntil = clock + 3.5;
      const le = $('#liveEn'), lh = $('#liveHi');
      if(le && lh){ le.textContent = g.en; lh.textContent = g.hi; }
    }});
    pending.push({at:base + end + 1.2, fn:() => busy = false});
    setHolo({state:'reading'});
  }

  /* scene tint follows the section on screen: light sections get brand cyan accents, dark ones white */
  const ACCENT_LIGHT = new THREE.Color(0x06b6d4), ACCENT_DARK = new THREE.Color(0xffffff), accent = new THREE.Color(0xffffff);
  let accentTarget = ACCENT_DARK, lightBg = false, dimmed = false;

  /* camera choreography: one key per section, blended by scroll */
  const CAMS = {
    hero:{p:[2.3, 1.62, 2.55], t:[-.2, .86, 0], sx:.19},
    who:{p:[-.5, 3.2, 2.35], t:[-.1, .97, 0], sx:-.2},
    eeg:{p:[-.27, 1.17, .7], t:[-.83, .88, .03], sx:.22},
    emg:{p:[.66, 1.27, .98], t:[.04, .82, 0], sx:-.22},
    flow:{p:[2.88, 2.78, -5.66], t:[-.75, 1.0, -.48], sx:.3},
    hardware:{p:[-.75, 1.45, -.9], t:[-1.02, 1.22, -.78], sx:-.2},
    cta:{p:[3.4, 3.4, -3.4], t:[-.1, .7, 0], sx:-.3}
  };
  const secs = [...document.querySelectorAll('[data-cam]')];
  let mobile = innerWidth < 760;
  function keyFor(sec){
    const name = sec.dataset.cam, k = CAMS[name], t = V(...k.t), p = V(...k.p);
    let sx = k.sx, sy = 0;
    if(mobile){ p.sub(t).multiplyScalar(name === 'eeg' || name === 'emg' || name === 'hardware' ? 1.6 : 1.5).add(t); sx = 0; sy = name === 'hero' ? -.19 : .19; }
    return {p, t, sx, sy};
  }
  let keys = secs.map(keyFor), centers = [];
  function measure(){ centers = secs.map(s => { const r = s.getBoundingClientRect(); return r.top + scrollY + r.height/2; }); }
  function targetCam(){
    const mid = scrollY + innerHeight/2; let i = 0, f = 0;
    if(mid <= centers[0]){ i = 0; f = 0; } else if(mid >= centers[centers.length - 1]){ i = centers.length - 1; f = 0; }
    else { for(let j = 0; j < centers.length - 1; j++){ if(mid < centers[j + 1]){ i = j; f = (mid - centers[j])/(centers[j + 1] - centers[j]); break; } } }
    const near = secs[f < .5 ? i : Math.min(i + 1, secs.length - 1)];
    lightBg = false;
    const dense = near.id === 'hardware'; if(dense !== dimmed){ dimmed = dense; canvas.classList.toggle('dim', dense); }
    accentTarget = ACCENT_LIGHT;

    // Smooth hermite curve without arbitrary deadzones so camera glides gracefully with scroll
    const clampedF = Math.max(0, Math.min(1, f));
    const smoothF = sm(clampedF);
    const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];

    // 3D transition depth arc: pulls the 3D model slightly back into depth while crossing center,
    // ensuring the bed never collides with or overlaps incoming text/card components
    const arc = Math.sin(clampedF * Math.PI);
    const targetP = a.p.clone().lerp(b.p, smoothF);
    const targetT = a.t.clone().lerp(b.t, smoothF);
    if(arc > 0.001){
      const viewDir = targetP.clone().sub(targetT).normalize();
      targetP.addScaledVector(viewDir, arc * 0.45);
    }
    const targetSx = a.sx + (b.sx - a.sx) * smoothF;
    const targetSy = a.sy + (b.sy - a.sy) * smoothF;

    return {p:targetP, t:targetT, sx:targetSx, sy:targetSy, arc, near};
  }
  function resize(){
    mobile = innerWidth < 760; renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth/innerHeight; keys = secs.map(keyFor); measure();
  }
  addEventListener('resize', resize); resize();
  addEventListener('load', measure);
  if(window.ScrollTrigger) ScrollTrigger.addEventListener('refresh', measure);
  const cur = targetCam();

  // light pointer parallax
  let px = 0, py = 0;
  addEventListener('pointermove', e => { if(e.pointerType === 'touch') return; px = e.clientX/innerWidth - .5; py = e.clientY/innerHeight - .5; }, {passive:true});

  let heroVisible = true;
  new IntersectionObserver(es => { heroVisible = es[0].isIntersecting; }, {threshold:.35}).observe(secs[0]);
  const demo = ['blink2', 'left', 'right', 'seizure', 'blinkLong', 'both']; let di = 0, nextDemo = 2.5;

  const sp3 = new THREE.Spherical(), tmp = new THREE.Vector3();
  let last = performance.now(), hubTimer = 0, running = true;
  document.addEventListener('visibilitychange', () => { const r = !document.hidden; if(r && !running){ running = true; last = performance.now(); requestAnimationFrame(loop); } else running = r; });
  function loop(now){
    if(!running) return;
    // the first frame's timestamp can predate the end of the build, so never step backwards
    const dt = Math.max(0, Math.min(.05, (now - last)/1000)); last = now; clock += dt;
    stepSim(dt);

    const isSeizureActive = active.some(e => e.type === 'seizure');
    if(isSeizureActive) alertUntil = Math.max(alertUntil, clock + 1.2);

    if(!reduce && !userPlayed && heroVisible && !busy && clock > nextDemo){ play(demo[di++ % demo.length]); nextDemo = clock + 6; }

    const tc = targetCam(), k = reduce ? 1 : 1 - Math.exp(-dt * 8.5);
    cur.p.lerp(tc.p, k); cur.t.lerp(tc.t, k); cur.sx += (tc.sx - cur.sx)*k; cur.sy += (tc.sy - cur.sy)*k;
    tmp.copy(cur.p).sub(cur.t); sp3.setFromVector3(tmp);
    const idle = reduce ? 0 : Math.sin(clock*.12)*.05;
    sp3.theta += -px*.08 + idle; sp3.phi = Math.max(.18, Math.min(1.5, sp3.phi + py*.04));
    tmp.setFromSpherical(sp3); camera.position.copy(cur.t).add(tmp); camera.lookAt(cur.t);
    const w = innerWidth, h = innerHeight; camera.setViewOffset(w, h, -cur.sx*w, -cur.sy*h, w, h); camera.updateProjectionMatrix();

    // Distance-based smooth dimming for #hardware section
    const hwSec = document.getElementById('hardware');
    if(hwSec){
      const hwRect = hwSec.getBoundingClientRect();
      const hwDist = Math.abs(hwRect.top + hwRect.height/2 - innerHeight/2);
      const hwRange = hwRect.height * 0.85;
      if(hwDist < hwRange){
        const dimAmt = 0.15 + 0.85 * Math.pow(hwDist / hwRange, 1.4);
        canvas.style.opacity = String(Math.max(0.12, Math.min(1, dimAmt)));
      } else {
        canvas.style.opacity = mobile ? '0.26' : '1';
      }
    }

    accent.lerp(accentTarget, 1 - Math.exp(-dt*4));
    grid.material.color.copy(accent); grid.material.opacity = lightBg ? .14 : .1;
    pmat.color.copy(accent); pmat.opacity = lightBg ? .4 : .55;
    beam.material.color.copy(accent);
    shadowFloor.material.opacity = lightBg ? .16 : .28;

    const breath = Math.sin(clock*1.7);
    chest.scale.y = 1 + breath*.035; blanketChest.scale.y = 1 + breath*.04; blanketChest.position.y = .745 + breath*.003;
    const lv = {eeg:level('eeg'), emgL:level('emgL'), emgR:level('emgR')};
    const closed = Math.min(1, lv.eeg*1.25); eyes.forEach(e => e.scale.set(Math.max(.12, 1 - closed), .75, 1));
    for(const [s, ch] of [[-1, 'emgL'], [1, 'emgR']]){ const a = arms[s], c = Math.min(1, lv[ch]); a.palm.scale.set(1.35 - .4*c, .5 + .32*c, .95); a.hand.position.y = a.base.y + .008*c; }

    const pulse = .5 + .5*Math.sin(clock*3);
    const elv = {eeg:lv.eeg, ref:lv.eeg*.5, emgL:lv.emgL, emgR:lv.emgR};
    for(const k2 in E){ const e = E[k2], l = Math.min(1, elv[k2]);
      e.capM.emissiveIntensity = .5 + l*3; e.glow.scale.setScalar(.09 + .03*pulse + l*.26); e.ring.scale.setScalar(1 + l*.9 + .08*pulse); e.ring.material.opacity = .45 + .5*l; }

    for(const p of pool){
      if(!p.on) continue; p.t += dt*p.speed;
      if(p.t >= 1){ p.on = false; p.m.visible = false; continue; }
      if(p.t < 0){ p.m.visible = false; continue; }
      p.m.visible = true; p.curve.getPointAt(p.t, p.m.position);
    }

    const alerting = clock < alertUntil;
    rings.forEach((r, i) => {
      const ph = ((clock*(alerting ? .9 : .25)) + i/3) % 1; r.scale.setScalar(.65 + ph*1.25); r.material.opacity = (1 - ph)*(alerting ? .7 : .32);
      r.material.color.copy(alerting ? COL.emgR : accent);
    });
    const ledCol = alerting && Math.sin(clock*12) > 0 ? COL.emgR : COL.eeg; led.material.color.copy(ledCol); ledGlow.material.color.copy(ledCol);

    holoFlash = Math.max(0, holoFlash - dt*1.6);
    holo.quaternion.copy(camera.quaternion);
    holo.position.y = HOLO.y + (reduce ? 0 : Math.sin(clock*1.1)*.012);
    // Smooth holographic billboard fade and size scaling during camera transition between sections
    const transFactor = tc.arc || 0;
    holo.material.opacity = Math.max(0.18, 1 - transFactor * 0.75);
    holo.scale.setScalar((1 + holoFlash*.06) * (1 - transFactor * 0.15) * Math.min(1, camera.position.distanceTo(holo.position)/3.6));
    beam.material.opacity = (.3 + .4*holoFlash) * (1 - transFactor * 0.5);

    if(!reduce){ const a = pg.attributes.position.array; for(let i = 0; i < PN; i++){ a[i*3 + 1] += dt*.04; if(a[i*3 + 1] > 2.6) a[i*3 + 1] = 0; } pg.attributes.position.needsUpdate = true; }

    hubTimer += dt; if(hubTimer > .07){ hubTimer = 0; drawHub(); }
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {play:id => play(id, true)};
})();

/* =========================================================
   Footer trick + copy email
   ========================================================= */
const tricks = [['jump','Ta-da!'],['spin','Round and round.'],['blink3','Three blinks. Don’t worry, it’s only a demo.'],['wave','Hello again!']];
let tI = 0;
const trickBtn = $('#trick');
if(trickBtn) trickBtn.onclick = () => { const [a, l] = tricks[tI++ % tricks.length]; mascot && mascot.act(a); say(l, '', 2500); };
const copyMail = $('#copyMail');
if(copyMail) copyMail.onclick = async e => {
  const el = e.currentTarget, mail = el.textContent;
  try{ await navigator.clipboard.writeText(mail); el.textContent = 'Copied! Talk soon.'; sfx.success(); say('Copied! Talk soon.', '', 2200); mascot && mascot.act('hop'); }
  catch(_){ location.href = 'mailto:' + mail; }
  setTimeout(() => el.textContent = mail, 1800);
};

/* =========================================================
   Lenis smooth scroll, synced to GSAP's ticker
   ========================================================= */
let lenis = null;
if(window.Lenis && !reduce){
  lenis = new Lenis({lerp:.085, smoothWheel:true, wheelMultiplier:1});
  if(window.gsap && window.ScrollTrigger){
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = time => { lenis.raf(time); requestAnimationFrame(raf); }; requestAnimationFrame(raf);
  }
  lenis.on('scroll', e => mascot && mascot.vel(e.velocity));
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if(!a) return;
    const id = a.getAttribute('href'), target = id === '#top' ? 0 : document.querySelector(id);
    if(target === null) return;
    e.preventDefault(); lenis.scrollTo(target, {duration:1.5});
  });
}

/* =========================================================
   Parallax layers
   ========================================================= */
if(window.gsap && window.ScrollTrigger && !reduce){
  const SHAPES = ['ring','dot','plus','eye','dither','squiggle'];
  const SPOTS = [[4,14],[90,8],[86,62],[8,78],[48,92],[94,36],[2,46]];
  const squiggle = '<svg viewBox="0 0 120 40"><path d="M2 20 q15 -18 29 0 t29 0 t29 0 t29 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/></svg>';
  document.querySelectorAll('.chapter').forEach((ch, ci) => {
    const box = document.createElement('div'); box.className = 'decos'; box.setAttribute('aria-hidden', 'true');
    SPOTS.forEach(([x, y], k) => {
      if((k + ci) % 3 === 2) return;
      const type = SHAPES[(k + ci*2) % SHAPES.length], size = 30 + ((k*37 + ci*53) % 90);
      const d = document.createElement('div'); d.className = 'deco ' + type;
      d.style.cssText = `left:${x}%;top:${y}%;width:${type === 'squiggle' ? size*1.8 : size}px;height:${type === 'squiggle' ? size*.6 : type === 'eye' ? size*.62 : size}px`;
      if(type === 'squiggle') d.innerHTML = squiggle;
      box.appendChild(d);
      const speed = .4 + ((k*7 + ci) % 5) * .3;
      gsap.fromTo(d, {y:speed*140, rotate:-speed*20}, {y:-speed*140, rotate:speed*20, ease:'none', scrollTrigger:{trigger:ch, start:'top bottom', end:'bottom top', scrub:true}});
    });
    ch.prepend(box);
  });
  // hero wordmark lifts away faster than its text
  gsap.to('.wordmark', {y:-140, ease:'none', scrollTrigger:{trigger:'.hero', start:'top top', end:'bottom top', scrub:true}});
  // photos slide inside their frames
  document.querySelectorAll('.shot .pic img').forEach(img => {
    gsap.fromTo(img, {yPercent:-7}, {yPercent:7, ease:'none', scrollTrigger:{trigger:img.closest('.shot'), start:'top bottom', end:'bottom top', scrub:true}});
  });
  // marquee bands run with the scroll
  document.querySelectorAll('.track').forEach(tr => {
    const dir = +tr.dataset.dir || 1;
    gsap.fromTo(tr, {xPercent:dir > 0 ? -25 : 0}, {xPercent:dir > 0 ? 0 : -25, ease:'none', scrollTrigger:{trigger:tr.parentElement, start:'top bottom', end:'bottom top', scrub:true}});
  });
  addEventListener('load', () => ScrollTrigger.refresh());
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/* =========================================================
   Sound toggle + hover ticks
   ========================================================= */
const sBtn = $('#sound');
function syncSound(){ sBtn.setAttribute('aria-pressed', sfx.on); sBtn.querySelector('.lbl').textContent = sfx.on ? 'Sound on' : 'Sound off'; }
sBtn.addEventListener('click', () => { sfx.set(!sfx.on); syncSound(); });
syncSound();
// browsers only start audio after a gesture: resume a saved "on" preference on the first one
['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => sfx.unlock(), {once:true}));
document.addEventListener('pointerover', e => {
  const el = e.target.closest('.btn,.pad,.chip,.nav a,.layer,.tags li,.brand');
  if(el && !el.contains(e.relatedTarget)) sfx.tick();
});



  const navSignIn = $('#navSignIn');
  if (navSignIn && onOpenAuth) {
    navSignIn.addEventListener('click', (e) => {
      e.preventDefault();
      onOpenAuth('login');
    });
  }

  const demoSeizureBtn = $('#demoSeizureBtn');
  if (demoSeizureBtn) {
    demoSeizureBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sfx.unlock();
      if(bed) bed.play('seizure');
    });
  }

  const eegSeizureCard = $('#eegSeizureCard');
  if (eegSeizureCard) {
    eegSeizureCard.addEventListener('click', (e) => {
      e.preventDefault();
      sfx.unlock();
      if(bed) bed.play('seizure');
    });
    eegSeizureCard.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        sfx.unlock();
        if(bed) bed.play('seizure');
      }
    });
  }


  return () => {
    isCleanedUp = true;
    try {
      if (typeof lenis !== 'undefined' && lenis && typeof lenis.destroy === 'function') {
        lenis.destroy();
      }
      if (typeof sfx !== 'undefined' && sfx && typeof sfx.set === 'function') {
        sfx.set(false);
      }
    } catch (e) {
      // ignore cleanup errors
    }
  };
}
