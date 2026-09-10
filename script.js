/* ===== A LITTLE SOMETHING — engine ===== */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const rand = (a,b) => a + Math.random()*(b-a);

const FAST = new URLSearchParams(location.search).has('fast');
const USE_GSAP = !!window.gsap;
if(USE_GSAP){ gsap.registerPlugin(ScrollTrigger, ScrollToPlugin); }
else { document.body.classList.add('no-gsap'); }

const state = { name:'', moonlit:false };

/* ============ SKY — dust, stars, bloom, streaks ============ */
const Sky = (() => {
  const cv = $('#sky'), c = cv.getContext('2d');
  let W=0, H=0, pts=[], fx=[], mode=0, speed=1, dimT=1, dim=1;
  const PALETTES = [
    [[236,238,255],[236,238,255],[167,139,250],[125,168,254]],
    [[240,242,255],[190,170,255],[167,139,250],[125,178,255],[96,165,250]]
  ];
  function mk(){
    const P = PALETTES[mode];
    const col = P[Math.floor(Math.random()*P.length)];
    return { x:Math.random()*W, y:Math.random()*H,
      r:.6+Math.random()*(mode?1.7:1.1),
      vx:(Math.random()-.5)*.12, vy:-(.04+Math.random()*.15),
      p:Math.random()*Math.PI*2, s:.4+Math.random()*.9, col,
      base:.22+Math.random()*.42 };
  }
  function resize(){
    const dpr = Math.min(devicePixelRatio||1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W*dpr; cv.height = H*dpr;
    cv.style.width = W+'px'; cv.style.height = H+'px';
    c.setTransform(dpr,0,0,dpr,0,0);
    const n = Math.round(Math.min(110, Math.max(42, W*H/16000)));
    pts = Array.from({length:n}, mk);
  }
  addEventListener('resize', resize); resize();

  function bloom(){
    for(let i=0;i<64;i++){
      const a = rand(0, Math.PI*2), v = rand(.15, 2.1);
      fx.push({ x:W/2, y:H*.44, vx:Math.cos(a)*v, vy:Math.sin(a)*v,
        life:1, decay:rand(.004,.011), r:rand(1,2.6),
        col:[[236,238,255],[190,170,255],[125,178,255]][Math.floor(rand(0,3))] });
    }
  }
  function loop(){
    c.clearRect(0,0,W,H);
    dim += (dimT - dim)*.022;
    const aMul = dim * (mode?1:.82);
    for(const p of pts){
      p.x += p.vx*speed; p.y += p.vy*speed; p.p += .016*p.s;
      if(p.y < -4) p.y = H+4;
      if(p.x < -4) p.x = W+4; else if(p.x > W+4) p.x = -4;
      const tw = .5 + .5*Math.sin(p.p);
      c.beginPath(); c.arc(p.x,p.y,p.r,0,6.2832);
      c.fillStyle = `rgba(${p.col[0]},${p.col[1]},${p.col[2]},${(p.base*tw*aMul).toFixed(3)})`;
      c.fill();
    }
    if(mode && Math.random() < .0035)
      fx.push({ x:rand(W*.15,W*.85), y:rand(10,H*.3), vx:rand(5,8.5), vy:rand(1.6,2.8), life:1, decay:.016, r:1.7, streak:true, col:[235,238,255] });
    for(let i=fx.length-1;i>=0;i--){
      const q = fx[i];
      q.x += q.vx*speed; q.y += q.vy*speed; q.life -= q.decay;
      if(q.life <= 0){ fx.splice(i,1); continue; }
      const a = q.life;
      if(q.streak){
        c.strokeStyle = `rgba(${q.col[0]},${q.col[1]},${q.col[2]},${(a*.7).toFixed(3)})`;
        c.lineWidth = 1.4; c.beginPath();
        c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx*7, q.y - q.vy*7); c.stroke();
      }
      c.beginPath(); c.arc(q.x,q.y,q.r*a,0,6.2832);
      c.fillStyle = `rgba(${q.col[0]},${q.col[1]},${q.col[2]},${a.toFixed(3)})`;
      c.fill();
    }
    requestAnimationFrame(loop);
  }
  loop();
  return {
    bloom,
    setMode(m){ mode = m; pts.forEach((p,i)=>{ if(i%1===0){ const n = mk(); p.col=n.col; p.base=Math.max(p.base,.3); } }); },
    setSpeed(s){ speed = s; },
    setDim(v){ dimT = v; }
  };
})();

/* ============ MUSIC — ambient generative (Web Audio) ============ */
const Music = (() => {
  let ctx=null, master=null, lp=null, delay=null, on=false, started=false, timers=[], chordIdx=0;
  const CHORDS = [
    [220.00, 261.63, 329.63, 493.88],
    [174.61, 261.63, 349.23, 523.25],
    [196.00, 293.66, 392.00, 587.33],
    [130.81, 261.63, 329.63, 523.25]
  ];
  function unlock(){
    if(started) return; started = true;
    try{
      ctx = new (window.AudioContext||window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0;
      lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 2100;
      delay = ctx.createDelay(1); delay.delayTime.value = .42;
      const fb = ctx.createGain(); fb.gain.value = .34;
      const wet = ctx.createGain(); wet.gain.value = .2;
      delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(lp);
      lp.connect(master); master.connect(ctx.destination);
    }catch(e){}
  }
  function pad(freq, t, dur, vol){
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type='sine'; o2.type='triangle';
    o.frequency.value = freq; o2.frequency.value = freq; o2.detune.value = 5;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur*.34);
    g.gain.setValueAtTime(vol, t + dur*.56);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); o2.connect(g);
    g.connect(lp); g.connect(delay);
    o.start(t); o2.start(t); o.stop(t+dur+.1); o2.stop(t+dur+.1);
  }
  function spark(freq, t, vol){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type='sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t+.035);
    g.gain.exponentialRampToValueAtTime(.0001, t+2.9);
    o.connect(g); g.connect(lp); g.connect(delay);
    o.start(t); o.stop(t+3.1);
  }
  function loop(){
    if(!on || !ctx) return;
    const t = ctx.currentTime + .06, dur = 9;
    CHORDS[chordIdx % CHORDS.length].forEach((f,i) => pad(f, t, dur+2.2, .045 - i*.005));
    const pent = [523.25, 587.33, 659.25, 783.99, 880];
    for(let i=0;i<2;i++) spark(pent[Math.floor(rand(0,pent.length))], t+rand(1.2,7.4), .028);
    chordIdx++;
    timers.push(setTimeout(loop, dur*1000));
  }
  function start(){
    unlock(); if(!ctx) return false;
    if(ctx.state === 'suspended') ctx.resume();
    if(on) return true;
    on = true;
    master.gain.setTargetAtTime(.9, ctx.currentTime, .9);
    loop(); return true;
  }
  function stop(){
    on = false; timers.forEach(clearTimeout); timers = [];
    if(master && ctx) master.gain.setTargetAtTime(0, ctx.currentTime, .5);
  }
  return { unlock, start, stop, get on(){return on;} };
})();

const musicBtn = $('#musicBtn');
musicBtn.addEventListener('click', () => {
  musicBtn.classList.remove('attn');
  if(Music.on){ Music.stop(); musicBtn.classList.remove('on'); musicBtn.setAttribute('aria-pressed','false'); musicBtn.setAttribute('aria-label','Play ambient music'); }
  else { Music.start(); musicBtn.classList.add('on'); musicBtn.setAttribute('aria-pressed','true'); musicBtn.setAttribute('aria-label','Pause ambient music'); }
});

/* ============ NAME ============ */
function applyName(){
  $$('[data-nm]').forEach(el => el.textContent = state.name);
}
function cap(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/* ============ GATE ============ */
const gate = $('#gate'), field = $('#nameField'), gateBtn = $('#gateBtn'), gateErr = $('#gateErr');
const saved = sessionStorage.getItem('for-name');
if(saved) field.value = saved;
new URLSearchParams(location.search).get('name') && (field.value = new URLSearchParams(location.search).get('name').slice(0,20));

gateBtn.addEventListener('click', begin);
field.addEventListener('keydown', e => { if(e.key === 'Enter') begin(); });

function begin(){
  const raw = field.value.replace(/[<>&"]/g,'').trim().replace(/\s+/g,' ');
  if(!raw){
    gate.classList.add('shake');
    gateErr.textContent = 'a name makes this yours — tell me yours';
    gateErr.classList.add('show');
    setTimeout(()=>gate.classList.remove('shake'), 550);
    return;
  }
  state.name = cap(raw).slice(0,20);
  sessionStorage.setItem('for-name', state.name);
  applyName();
  Music.unlock();

  gate.classList.add('gone');
  document.body.classList.remove('locked');

  const T = FAST ? {in:.15, hold:.5, gap:.15} : {in:.65, hold:1.7, gap:.65};
  cine(`Nice to meet you, ${state.name}.`, T)
    .then(() => cine('Now let me show you something...', T))
    .then(startExperience);
}

/* cinema line */
const cinema = $('#cinema'), cineLine = $('#cineLine');
function cine(text, T){
  return new Promise(res => {
    cineLine.textContent = text;
    cinema.classList.add('show');
    setTimeout(() => {
      cinema.classList.remove('show');
      setTimeout(res, T.gap*1000);
    }, (T.in + T.hold)*1000);
  });
}

/* ============ EXPERIENCE START ============ */
function startExperience(){
  $('#exp').removeAttribute('hidden');
  window.scrollTo(0,0);
  requestAnimationFrame(() => {
    buildScroll();
    if(USE_GSAP) ScrollTrigger.refresh();
    playReveal();
  });
}

/* reveal choreography */
function playReveal(){
  if(!USE_GSAP){
    $('#rev1').style.display='none';
    $('#rev2').style.display='none';
    const f = $('#revFinal'); f.style.opacity=1;
    $('#waitBtn').style.opacity=1;
    Sky.bloom();
    return;
  }
  const T = FAST ? .25 : 1;
  const tl = gsap.timeline();
  tl.fromTo('#rev1', {opacity:0, y:26, filter:'blur(10px)'},
      {opacity:1, y:0, filter:'blur(0px)', duration:1.2*T, ease:'power2.out'})
    .to('#rev1', {opacity:0, y:-18, filter:'blur(8px)', duration:.8*T, ease:'power1.in'}, `+=${1.7*T}`)
    .fromTo('#rev2', {opacity:0, y:26, filter:'blur(10px)'},
      {opacity:1, y:0, filter:'blur(0px)', duration:1.2*T, ease:'power2.out'}, '-=.25')
    .to('#rev2', {opacity:0, y:-18, filter:'blur(8px)', duration:.8*T, ease:'power1.in'}, `+=${1.7*T}`)
    .add(() => Sky.bloom(), '-=.4')
    .fromTo('#revFinal', {opacity:0, scale:.93, filter:'blur(12px)'},
      {opacity:1, scale:1, filter:'blur(0px)', duration:1.6*T, ease:'power3.out'})
    .fromTo('#waitBtn', {opacity:0, y:26}, {opacity:1, y:0, duration:1.1*T, ease:'power3.out'}, `+=${.55*T}`);
}

/* wait button → cinematic scroll */
$('#waitBtn').addEventListener('click', () => {
  if(USE_GSAP){
    gsap.timeline()
      .to('#flash', {opacity:1, duration:.4, ease:'power1.out'})
      .add(() => gsap.to(window, {scrollTo:'#s-message', duration:1.35, ease:'power2.inOut'}))
      .to('#flash', {opacity:0, duration:.8, ease:'power1.out'}, '+=.45');
  } else {
    $('#s-message').scrollIntoView({behavior:'smooth'});
  }
});

/* ============ SCROLL CHOREOGRAPHY ============ */
function buildScroll(){
  if(!USE_GSAP) return;
  const D = FAST ? .25 : 1;

  const fadeUp = (sel, vars={}) => {
    gsap.utils.toArray(sel).forEach(el => {
      gsap.fromTo(el, {opacity:0, y:28, filter:'blur(7px)'},
        {opacity:1, y:0, filter:'blur(0px)', duration:.95*D, ease:'power2.out',
         ...vars, scrollTrigger:{trigger:el, start:'top 82%', once:true}});
    });
  };
  fadeUp('#s-message .eyebrow, #s-wishes .eyebrow, #s-dua .eyebrow');
  fadeUp('.sec-title');

  gsap.utils.toArray('.msg__line').forEach((el,i) => {
    gsap.fromTo(el, {opacity:0, y:30, filter:'blur(7px)'},
      {opacity:1, y:0, filter:'blur(0px)', duration:.95*D, ease:'power2.out',
       delay:(i%3)*.12, scrollTrigger:{trigger:el, start:'top 82%', once:true}});
  });

  gsap.utils.toArray('.wcard').forEach((el,i) => {
    const x = i%2 ? 44 : -44;
    gsap.fromTo(el, {opacity:0, x, filter:'blur(8px)'},
      {opacity:1, x:0, filter:'blur(0px)', duration:1*D, ease:'power3.out',
       scrollTrigger:{trigger:el, start:'top 86%', once:true}});
  });

  gsap.utils.toArray('.dua__line').forEach((el,i) => {
    gsap.fromTo(el, {opacity:0, y:24, filter:'blur(6px)'},
      {opacity:1, y:0, filter:'blur(0px)', duration:.9*D, ease:'power2.out',
       delay:(i%2)*.1, scrollTrigger:{trigger:el, start:'top 84%', once:true}});
  });

  /* hold intro */
  gsap.timeline({scrollTrigger:{trigger:'#s-hold', start:'top 62%', once:true}})
    .fromTo('#holdPre', {opacity:0, y:24, filter:'blur(8px)'},
      {opacity:1, y:0, filter:'blur(0px)', duration:1*D, ease:'power2.out'})
    .fromTo('#holdSub', {opacity:0, y:14}, {opacity:1, y:0, duration:.8*D, ease:'power2.out'}, '-=.4')
    .fromTo('#holdBtn', {opacity:0, scale:.82},
      {opacity:1, scale:1, duration:1.1*D, ease:'back.out(1.6)'}, '-=.25')
    .fromTo('#holdMsg', {opacity:0}, {opacity:.9, duration:.8*D}, '-=.5')
    .add(() => $('#holdMsg').classList.add('show'));

  /* after-transformation scenes */
  gsap.timeline({scrollTrigger:{trigger:'#s-final', start:'top 60%', once:true}})
    .fromTo('.final-name', {opacity:0, y:30, filter:'blur(10px)'},
      {opacity:1, y:0, filter:'blur(0px)', duration:1.1*D, ease:'power2.out'})
    .fromTo('.final-line', {opacity:0, y:26, filter:'blur(8px)'},
      {opacity:1, y:0, filter:'blur(0px)', duration:1*D, stagger:.35*D, ease:'power2.out'}, '-=.45');

  gsap.timeline({scrollTrigger:{trigger:'#s-end', start:'top 62%', once:true}})
    .fromTo('.end-big', {opacity:0, y:34, filter:'blur(10px)'},
      {opacity:1, y:0, filter:'blur(0px)', duration:1.2*D, ease:'power2.out'})
    .fromTo('.end-sub', {opacity:0, y:22}, {opacity:1, y:0, duration:1*D, ease:'power2.out'}, '-=.5')
    .fromTo('.end-made', {opacity:0}, {opacity:1, duration:1.4*D, ease:'power1.out'}, '-=.3')
    .add(() => Sky.setDim(.12), '-=.8');

  /* gentle parallax on scene inner content */
  gsap.utils.toArray('.sec-title').forEach(el => {
    gsap.fromTo(el, {y:0}, {y:-14, ease:'none',
      scrollTrigger:{trigger:el.closest('.scene'), start:'top bottom', end:'bottom top', scrub:1.4}});
  });
}

/* ============ 10-SECOND HOLD ============ */
const HOLD_MS = 10000, CIRC = 628.318;
const holdBtn = $('#holdBtn'), ring = $('#ringProg'), holdTime = $('#holdTime'), holdMsg = $('#holdMsg');
const MSGS = ['Keep holding...','Something is happening...','Almost there...','Just a little longer...'];
let holding=false, startT=0, raf=null, prog=0, done=false;

function phaseIdx(p){ return p < .35 ? 0 : p < .65 ? 1 : p < .9 ? 2 : 3; }
function setMsg(text){
  holdMsg.textContent = text;
  holdMsg.classList.add('show');
}
function draw(p){
  ring.style.strokeDashoffset = CIRC * (1 - p);
  holdBtn.style.setProperty('--hg', p.toFixed(3));
}
function drawReset(p){
  draw(p);
  holdTime.textContent = Math.max(1, Math.round(HOLD_MS * (1 - p) / 1000)) || 10;
}

function tick(){
  if(!holding) return;
  const el = performance.now() - startT;
  prog = Math.min(el / HOLD_MS, 1);
  draw(prog);
  holdTime.textContent = Math.max(0, Math.ceil((HOLD_MS - el) / 1000));
  Sky.setSpeed(1 + prog * 2.6);
  setMsg(MSGS[phaseIdx(prog)]);
  if(prog >= 1){ holding = false; complete(); return; }
  raf = requestAnimationFrame(tick);
}

function startHold(){
  if(done) return;
  holding = true;
  holdBtn.classList.add('holding');
  startT = performance.now() - prog * HOLD_MS;
  raf = requestAnimationFrame(tick);
}
function endHold(){
  if(!holding) return;
  holding = false;
  cancelAnimationFrame(raf);
  holdBtn.classList.remove('holding');
  Sky.setSpeed(1);
  const reached = prog;
  if(prog > .7) setMsg('So close. Take a breath, and try again.');
  else if(prog > 0) setMsg('Take your time — hold on as long as you can.');
  /* smooth reset */
  if(USE_GSAP){
    gsap.to({p:prog}, {p:0, duration:.7, ease:'power2.out', onUpdate(){ drawReset(this.targets()[0].p); },
      onComplete(){ prog = 0; drawReset(0); }});
  } else { prog = 0; drawReset(0); }
}

holdBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  try{ holdBtn.setPointerCapture(e.pointerId); }catch(err){}
  startHold();
});
holdBtn.addEventListener('pointerup', endHold);
holdBtn.addEventListener('pointercancel', endHold);
holdBtn.addEventListener('lostpointercapture', endHold);
holdBtn.addEventListener('contextmenu', e => e.preventDefault());
holdBtn.addEventListener('keydown', e => {
  if((e.key === 'Enter' || e.key === ' ') && !e.repeat){ e.preventDefault(); startHold(); }
});
holdBtn.addEventListener('keyup', e => {
  if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); endHold(); }
});

/* ============ TRANSFORMATION ============ */
function complete(){
  done = true;
  draw(1);
  holdTime.textContent = '0';
  holdBtn.classList.add('done');
  holdMsg.textContent = '';
  try{ navigator.vibrate && navigator.vibrate(60); }catch(e){}
  Sky.setSpeed(1);
  setTimeout(transform, FAST ? 150 : 500);
}

function madeTL(){
  if(!USE_GSAP){
    $('#madeTitle').style.opacity=1; $('#madeSub').style.opacity=1; $('#madeCue').style.opacity=1;
    return;
  }
  const D = FAST ? .3 : 1;
  gsap.timeline()
    .fromTo('#madeTitle', {opacity:0, y:30, filter:'blur(12px)'},
      {opacity:1, y:0, filter:'blur(0px)', duration:1.3*D, ease:'power3.out'})
    .fromTo('#madeSub', {opacity:0, y:20, filter:'blur(8px)'},
      {opacity:1, y:0, filter:'blur(0px)', duration:1.1*D, ease:'power2.out'}, '-=.55')
    .fromTo('#madeCue', {opacity:0}, {opacity:1, duration:1*D}, '-=.4');
}

function transform(){
  const doMoon = () => {
    document.body.classList.add('moonlit');
    Sky.setMode(1);
  };
  if(!USE_GSAP){
    doMoon();
    $('#after').hidden = false;
    $('#s-made').scrollIntoView({behavior:'smooth'});
    setTimeout(madeTL, 900);
    return;
  }
  const D = FAST ? .35 : 1;
  const tl = gsap.timeline();
  tl.set('#sweep', {opacity:1})
    .fromTo('#sweep', {xPercent:-130}, {xPercent:130, duration:1.15*D, ease:'power2.inOut'}, 0)
    .add(doMoon, .5*D)
    .to('#holdInner', {scale:1.08, filter:'blur(12px)', opacity:0, duration:.9*D, ease:'power2.in'}, .1*D)
    .add(() => {
      $('#after').hidden = false;
      ScrollTrigger.refresh();
    }, .75*D)
    .set('#sweep', {opacity:0}, 1.1*D)
    .add(() => gsap.to(window, {scrollTo:'#s-made', duration:1.5*D, ease:'power2.inOut'}), 1.05*D)
    .add(() => {
      $('#s-hold').style.display = 'none';
      ScrollTrigger.refresh();
    }, 2.4*D)
    .add(madeTL, 2.5*D);
}