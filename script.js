/* ===== FOR YOU — experience engine ===== */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const rand = (a,b) => a + Math.random()*(b-a);

const FAST = new URLSearchParams(location.search).has('fast');
const SPEED = FAST ? .3 : 1;
const T = ms => ms * SPEED;
const USE_GSAP = !!window.gsap;
if(USE_GSAP) gsap.registerPlugin(null);
else document.body.classList.add('no-gsap');

const state = { name:'', muted:false, unlockedAudio:false };

/* ================= SKY ================= */
const Sky = (() => {
  const cv = $('#sky'), c = cv.getContext('2d');
  let W=0, H=0, pts=[], fx=[], mode=0, speed=1, dimT=1, dim=1;
  const PALETTES = [
    [[236,238,255],[236,238,255],[167,139,250],[125,168,254]],
    [[240,242,255],[190,170,255],[167,139,250],[125,178,255],[96,165,250],[251,215,138]]
  ];
  function mk(){
    const P = PALETTES[mode];
    return { x:Math.random()*W, y:Math.random()*H,
      r:.6+Math.random()*(mode?1.8:1.1),
      vx:(Math.random()-.5)*.12, vy:-(.04+Math.random()*.14),
      p:Math.random()*Math.PI*2, s:.4+Math.random()*.9,
      col:P[Math.floor(Math.random()*P.length)], base:.22+Math.random()*.4 };
  }
  function resize(){
    const dpr = Math.min(devicePixelRatio||1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W*dpr; cv.height = H*dpr;
    cv.style.width = W+'px'; cv.style.height = H+'px';
    c.setTransform(dpr,0,0,dpr,0,0);
    const n = Math.round(Math.min(100, Math.max(40, W*H/17000)));
    pts = Array.from({length:n}, mk);
  }
  addEventListener('resize', resize); resize();
  function burst(x, y, count, power, spread){
    for(let i=0;i<count;i++){
      const a = rand(0, Math.PI*2), v = rand(.2, power);
      fx.push({ x, y, vx:Math.cos(a)*v*spread, vy:Math.sin(a)*v*spread,
        life:1, decay:rand(.006,.014), r:rand(1,2.8),
        col:[[236,238,255],[190,170,255],[125,178,255],[251,215,138]][Math.floor(rand(0,4))] });
    }
  }
  function bigBloom(){ burst(W/2, H*.46, 90, 4.2, 1.4); }
  function setMode(m){
    mode = m;
    pts.forEach(p => { const n = mk(); p.col = n.col; p.r = Math.max(p.r, n.r*.8); p.base = Math.max(p.base, .28); });
  }
  function loop(){
    c.clearRect(0,0,W,H);
    dim += (dimT - dim)*.006;
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
    for(let i=fx.length-1;i>=0;i--){
      const q = fx[i];
      q.x += q.vx*speed; q.y += q.vy*speed;
      q.vx *= .985; q.vy = q.vy*.985 + .008;
      q.life -= q.decay;
      if(q.life <= 0){ fx.splice(i,1); continue; }
      c.beginPath(); c.arc(q.x,q.y,q.r*q.life,0,6.2832);
      c.fillStyle = `rgba(${q.col[0]},${q.col[1]},${q.col[2]},${q.life.toFixed(3)})`;
      c.fill();
    }
    requestAnimationFrame(loop);
  }
  loop();
  return { burst, bigBloom, setMode, setSpeed:v=>{speed=v;},
    fadeTo(v){ dimT = v; } };
})();

/* ================= SOUND ================= */
const Sound = (() => {
  let ctx=null, master=null, music=null, sfx=null, started=false, playing=false, timers=[], ci=0;
  let lp=null, delay=null;
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
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      music = ctx.createGain(); music.gain.value = 1;
      sfx = ctx.createGain(); sfx.gain.value = .5;
      lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 2400;
      delay = ctx.createDelay(1); delay.delayTime.value = .44;
      const fb = ctx.createGain(); fb.gain.value = .34;
      const wet = ctx.createGain(); wet.gain.value = .2;
      delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(lp);
      lp.connect(music);
      music.connect(master); sfx.connect(master);
      state.unlockedAudio = true;
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
    o.connect(g); o2.connect(g); g.connect(lp); g.connect(delay);
    o.start(t); o2.start(t); o.stop(t+dur+.1); o2.stop(t+dur+.1);
  }
  function spark(freq, t, vol){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type='sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t+.03);
    g.gain.exponentialRampToValueAtTime(.0001, t+2.6);
    o.connect(g); g.connect(lp); g.connect(delay);
    o.start(t); o.stop(t+2.8);
  }
  function musicLoop(){
    if(!playing || !ctx) return;
    const t = ctx.currentTime + .06, dur = 9;
    CHORDS[ci % CHORDS.length].forEach((f,i) => pad(f, t, dur+2.2, .05 - i*.005));
    const pent = [523.25, 587.33, 659.25, 783.99, 880];
    spark(pent[Math.floor(rand(0,pent.length))], t+rand(1.5,7.5), .026);
    ci++;
    timers.push(setTimeout(musicLoop, dur*1000));
  }
  function startAmbient(){
    unlock(); if(!ctx) return;
    if(ctx.state === 'suspended') ctx.resume();
    if(playing) return;
    playing = true;
    if(state.muted) return;
    master.gain.setTargetAtTime(.85, ctx.currentTime, 1.4);
    musicLoop();
  }
  function chime(f=880, vol=.16){
    if(!ctx || state.muted) return;
    const t = ctx.currentTime;
    [f, f*1.5].forEach((fr,i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type='sine'; o.frequency.value = fr;
      g.gain.setValueAtTime(0, t+i*.03);
      g.gain.linearRampToValueAtTime(vol*(i?.4:1), t+.02+i*.03);
      g.gain.exponentialRampToValueAtTime(.0001, t+1.5+i*.1);
      o.connect(g); g.connect(sfx);
      o.start(t); o.stop(t+1.7);
    });
  }
  function whoosh(){
    if(!ctx || state.muted) return;
    const t = ctx.currentTime, len = .5;
    const buf = ctx.createBuffer(1, ctx.sampleRate*len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type='bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(280, t);
    bp.frequency.exponentialRampToValueAtTime(2200, t+.32);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.09, t+.07);
    g.gain.exponentialRampToValueAtTime(.0001, t+.48);
    src.connect(bp); bp.connect(g); g.connect(sfx);
    src.start(t);
  }
  function pop(){
    if(!ctx || state.muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(720, t+.14);
    g.gain.setValueAtTime(.22, t);
    g.gain.exponentialRampToValueAtTime(.0001, t+.3);
    o.connect(g); g.connect(sfx);
    o.start(t); o.stop(t+.32);
    chime(1046.5, .08);
  }
  function mute(v){
    state.muted = v;
    if(!ctx) return;
    master.gain.setTargetAtTime(v ? 0 : (playing ? .85 : 0), ctx.currentTime, .5);
    if(v){ timers.forEach(clearTimeout); timers = []; }
    else if(playing && !timers.length){ musicLoop(); }
  }
  return { unlock, startAmbient, chime, whoosh, pop, mute, get muted(){return state.muted;} };
})();

const musicBtn = $('#musicBtn');
musicBtn.addEventListener('click', e => {
  e.stopPropagation();
  Sound.unlock();
  Sound.mute(!Sound.muted);
  musicBtn.classList.toggle('muted', Sound.muted);
  musicBtn.setAttribute('aria-pressed', String(!Sound.muted));
});

/* first interaction unlocks audio + soft ambient */
addEventListener('pointerdown', () => {
  Sound.unlock();
  if(!Sound.muted) Sound.startAmbient();
}, { once:true, capture:true });

/* ================= NAME ================= */
function applyName(){
  $$('.nm').forEach(el => el.textContent = state.name);
}
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/* ================= SCENE MANAGER ================= */
const ON_ENTER = {};
let current = 'sc-name';
function show(id){ $('#'+id).classList.add('active'); }
function hide(id){ $('#'+id).classList.remove('active'); }

function goTo(id, kind='fade'){
  if(id === current) return;
  const from = $('#'+current), to = $('#'+id);
  current = id;
  Sound.whoosh();
  if(!USE_GSAP){
    from.classList.remove('active');
    show(id);
    if(ON_ENTER[id]) ON_ENTER[id]();
    return;
  }
  if(kind === 'bloom'){
    gsap.timeline()
      .to('#veil', {opacity:.92, duration:.4, ease:'power2.in'})
      .add(() => { from.classList.remove('active'); show(id); Sky.bigBloom(); if(ON_ENTER[id]) ON_ENTER[id](); })
      .to('#veil', {opacity:0, duration:.75, ease:'power1.out'})
      .fromTo(to, {scale:1.05, filter:'blur(10px)'}, {scale:1, filter:'blur(0px)', duration:.9, ease:'power2.out'}, '<-.25');
  } else {
    gsap.timeline()
      .to(from, {opacity:0, scale:1.06, filter:'blur(10px)', duration:.55, ease:'power2.in'})
      .add(() => { from.classList.remove('active'); gsap.set(from, {clearProps:'all'}); show(id); if(ON_ENTER[id]) ON_ENTER[id](); })
      .fromTo(to, {opacity:0, scale:.97, filter:'blur(8px)'}, {opacity:1, scale:1, filter:'blur(0px)', duration:.8, ease:'power2.out'}, '+=.05');
  }
}

/* ===== SCENE 1 · name ===== */
(() => {
  const pre = $('#namePre'), wrap = $('#nameWrap'), field = $('#nameField'),
        btn = $('#enterBtn'), err = $('#nameErr'), welcome = $('#welcomeLine');
  pre.classList.add('show');
  setTimeout(() => {
    pre.classList.remove('show');
    setTimeout(() => {
      pre.hidden = true;
      wrap.hidden = false;
    }, T(800));
  }, T(2400));

  function enter(){
    const raw = field.value.replace(/[<>&"]/g,'').trim().replace(/\s+/g,' ');
    if(!raw){
      wrap.classList.remove('shake'); void wrap.offsetWidth; wrap.classList.add('shake');
      err.textContent = 'a name makes this yours';
      err.classList.add('show');
      return;
    }
    state.name = cap(raw).slice(0,20);
    applyName();
    Sound.chime(660, .12);
    wrap.style.transition = 'opacity .5s ease';
    wrap.style.opacity = '0';
    setTimeout(() => {
      wrap.hidden = true;
      welcome.textContent = `Welcome, ${state.name}.`;
      welcome.classList.add('show');
    }, T(550));
    setTimeout(() => goTo('sc-envelope', 'bloom'), T(2300));
  }
  btn.addEventListener('click', enter);
  field.addEventListener('keydown', e => { if(e.key === 'Enter') enter(); });
})();

/* ===== SCENE 2 · envelope ===== */
(() => {
  const env = $('#env'), hint = $('#envHint');
  let opened = false;
  ON_ENTER['sc-envelope'] = () => setTimeout(() => { if(!opened) hint.classList.add('show'); }, T(3600));
  function open(){
    if(opened) return; opened = true;
    hint.classList.remove('show');
    env.classList.add('open');
    Sound.pop();
    const r = env.getBoundingClientRect();
    Sky.burst(r.left + r.width/2, r.top + r.height*.4, 70, 3, 1.1);
    setTimeout(() => goTo('sc-stars', 'bloom'), T(1500));
  }
  env.addEventListener('pointerdown', e => { e.stopPropagation(); open(); });
  env.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(); } });
})();

/* ===== SCENE 3 · stars ===== */
(() => {
  const stars = [...$$('.sstar')], l1 = $('#starsL1'), l2 = $('#starsL2'),
        count = $('#starCount'), done = $('#starsDone');
  let found = 0, finished = false;
  ON_ENTER['sc-stars'] = () => {
    l1.classList.add('show');
    setTimeout(() => { l1.classList.remove('show'); }, T(2200));
    setTimeout(() => { l1.hidden = true; l2.hidden = false; l2.classList.add('show'); count.classList.add('show'); }, T(3000));
  };
  stars.forEach(s => {
    s.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if(s.classList.contains('lit')) return;
      s.classList.add('lit');
      Sound.chime(700 + found*160, .15);
      const r = s.getBoundingClientRect();
      Sky.burst(r.left + r.width/2, r.top + r.height/2, 40, 3.4, 1);
      found++;
      if(found < 3){
        count.textContent = (3-found) + (3-found === 1 ? ' more' : ' more');
      } else {
        count.classList.remove('show');
        l2.classList.remove('show');
        done.hidden = false; done.classList.add('show');
        setTimeout(() => goTo('sc-reveal', 'bloom'), T(1800));
      }
    });
  });
})();

/* ===== SCENE 4 · reveal ===== */
(() => {
  const l1 = $('#revL1'), l2 = $('#revL2'), hb = $('#revHB'), cue = $('#revCue'), sc = $('#sc-reveal');
  let started = false;
  ON_ENTER['sc-reveal'] = () => {
    if(started) return; started = true;
    setTimeout(() => {
      l1.classList.add('show');
      setTimeout(() => {
        l1.classList.remove('show');
        setTimeout(() => { l1.hidden = true; l2.hidden = false; l2.classList.add('show'); }, T(900));
      }, T(2400));
      setTimeout(() => {
        l2.classList.remove('show');
        setTimeout(() => {
          l2.hidden = true;
          hb.hidden = false;
          document.body.classList.add('glow-up');
          Sky.bigBloom(); Sky.setMode(1);
          if(USE_GSAP){
            gsap.fromTo(hb, {scale:.82, filter:'blur(14px)', opacity:0},
              {scale:1, filter:'blur(0px)', opacity:1, duration:1.3, ease:'power3.out'});
          } else hb.style.opacity = 1;
          Sound.chime(523.25, .2);
          setTimeout(() => Sound.chime(783.99, .14), T(350));
          setTimeout(() => Sound.chime(1046.5, .1), T(700));
          setTimeout(() => { cue.hidden = false; cue.classList.add('show'); }, T(1600));
        }, T(900));
      }, T(5300));
    }, T(600));
  };
  sc.addEventListener('pointerdown', () => {
    if(!cue.classList.contains('show')) return;
    goTo('sc-gift', 'fade');
  });
})();

/* ===== SCENE 5 · gift ===== */
(() => {
  const gift = $('#gift'), hint = $('#giftHint'), msg = $('#giftMsg');
  let opened = false;
  ON_ENTER['sc-gift'] = () => setTimeout(() => { if(!opened) hint.classList.add('show'); }, T(3600));
  function open(){
    if(opened) return; opened = true;
    hint.classList.remove('show');
    gift.classList.add('open');
    Sound.pop();
    const r = gift.getBoundingClientRect();
    Sky.burst(r.left + r.width/2, r.top + r.height/2, 80, 4, 1);
    document.body.classList.add('glow-up');
    setTimeout(() => {
      gift.style.transition = 'opacity .6s ease';
      gift.style.opacity = '0';
      msg.hidden = false; msg.classList.add('show');
    }, T(1100));
    setTimeout(() => goTo('sc-letter', 'bloom'), T(3100));
  }
  gift.addEventListener('pointerdown', e => { e.stopPropagation(); open(); });
  gift.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(); } });
})();

/* ===== SCENE 6 · letter ===== */
(() => {
  const line = $('#letterLine'), dots = $('#letterDots'), sc = $('#sc-letter');
  const LINES = [
    "There's something quiet about you, ",
    "the kind of calm people didn't know they needed.",
    "You never ask for attention, ",
    "but you leave everything softer than you found it.",
    "Today, that gets to be celebrated.",
    "So take your time. This is all yours."
  ];
  const nameLine = 0;
  let i = 0;
  LINES.forEach(() => dots.insertAdjacentHTML('beforeend', '<i></i>'));
  const dotEls = [...dots.children];

  function showLine(idx){
    const text = idx === nameLine ? LINES[idx] + state.name + '.' : LINES[idx];
    line.style.opacity = 0;
    setTimeout(() => {
      line.textContent = text;
      line.style.transition = 'opacity .7s ease';
      line.style.opacity = 1;
    }, T(280));
    dotEls.forEach((d, k) => d.classList.toggle('on', k <= idx));
    Sound.chime(620 + idx*40, .1);
  }
  let started = false;
  ON_ENTER['sc-letter'] = () => { if(!started){ started = true; showLine(0); } };
  sc.addEventListener('pointerdown', () => {
    if(!started) return;
    if(i >= LINES.length - 1){
      goTo('sc-wishes', 'fade');
      return;
    }
    i++;
    showLine(i);
  });
})();

/* ===== SCENE 7 · constellation wishes ===== */
(() => {
  const WISHES = [
    { x:18, y:30, w:'More peace.' },
    { x:50, y:14, w:'More happiness.' },
    { x:82, y:26, w:'More beautiful moments.' },
    { x:30, y:58, w:'More success.' },
    { x:72, y:52, w:'More reasons to smile.' },
    { x:52, y:80, w:'More barakah in everything you do.' }
  ];
  const holder = $('#cwStars'), count = $('#cwCount'), wish = $('#cwWish'),
        poly = $('#cwLine'), final = $('#cwFinal');
  const points = [];
  WISHES.forEach((W, i) => {
    const b = document.createElement('button');
    b.className = 'cw-star';
    b.style.setProperty('--x', W.x + '%');
    b.style.setProperty('--y', W.y + '%');
    b.style.setProperty('--d', (i*.4)+'s');
    b.setAttribute('aria-label', 'A glowing point');
    holder.appendChild(b);
    points.push({ el:b, x:W.x, y:W.y, lit:false });
  });
  let litCount = 0, unlocked = false;
  holder.addEventListener('pointerdown', e => { e.stopPropagation(); });
  points.forEach(p => {
    p.el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if(p.lit) return;
      p.lit = true; litCount++;
      p.el.classList.add('lit');
      Sound.chime(640 + litCount*90, .14);
      const r = p.el.getBoundingClientRect();
      Sky.burst(r.left + r.width/2, r.top + r.height/2, 30, 3, 1);
      const ptsAttr = poly.getAttribute('points');
      poly.setAttribute('points', (ptsAttr ? ptsAttr + ' ' : '') + `${p.x},${p.y}`);
      count.textContent = `${litCount} of 6`;
      wish.classList.remove('show');
      setTimeout(() => {
        wish.textContent = p.lit ? WISHES[points.indexOf(p)].w : '';
        wish.classList.add('show');
      }, T(200));
      if(litCount === 6){
        setTimeout(() => {
          wish.textContent = 'They were all for you.';
          wish.classList.add('show');
          final.hidden = false;
          const fr = final.getBoundingClientRect();
          Sky.burst(fr.left + fr.width/2, fr.top + fr.height/2, 50, 3.6, 1);
          Sound.chime(1046.5, .16);
          unlocked = true;
        }, T(1400));
      }
    });
  });
  final.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if(!unlocked) return;
    Sky.bigBloom();
    goTo('sc-dua', 'bloom');
  });
})();

/* ===== SCENE 8 · dua ===== */
(() => {
  const h = $('#duaH'), lines = [...$$('#duaLines p')], cue = $('#duaCue'), sc = $('#sc-dua');
  let started = false, ready = false;
  ON_ENTER['sc-dua'] = () => {
    if(started) return; started = true;
    document.body.classList.add('moonlit');
    $('.dua-moon').classList.add('show');
    setTimeout(() => {
      h.hidden = false;
      setTimeout(() => h.classList.add('show'), 40);
      Sound.chime(523.25, .1);
    }, T(800));
    lines.forEach((l, i) => {
      setTimeout(() => {
        l.classList.remove('hidden');
        setTimeout(() => l.classList.add('show'), 40);
      }, T(2000 + i*1150));
    });
    setTimeout(() => { cue.hidden = false; cue.classList.add('show'); ready = true; }, T(2000 + lines.length*1150 + 400));
  };
  sc.addEventListener('pointerdown', () => {
    if(!ready) return;
    goTo('sc-seed', 'fade');
  });
})();

/* ===== SCENE 9 · seed ===== */
(() => {
  const seed = $('#seed'), line = $('#seedLine'), hint = $('#seedHint');
  let done = false;
  ON_ENTER['sc-seed'] = () => {
    line.classList.add('show');
    setTimeout(() => { if(!done) hint.classList.add('show'); }, T(3800));
  };
  seed.addEventListener('pointerdown', e => {
    e.stopPropagation();
    if(done) return; done = true;
    hint.classList.remove('show');
    seed.classList.add('burst');
    Sound.pop();
    const r = seed.getBoundingClientRect();
    Sky.burst(r.left + r.width/2, r.top + r.height/2, 100, 4.6, 1.4);
    document.body.classList.add('glow-up');
    setTimeout(() => goTo('sc-final', 'bloom'), T(900));
  });
})();

/* ===== FINAL ===== */
(() => {
  const n = $('#fName');
  let started = false;
  ON_ENTER['sc-final'] = () => {
    if(started) return; started = true;
    n.textContent = state.name;
    const seq = [
      ['#fName', 600],
      ['#fHB', 2200],
      ['#fMsg', 4200],
      ['#fMade', 6200]
    ];
    seq.forEach(([sel, at]) => {
      setTimeout(() => {
        const el = $(sel);
        el.hidden = false;
        el.classList.add('show-f');
        if(sel === '#fHB'){ Sound.chime(659.25, .16); Sky.bigBloom(); }
      }, T(at));
    });
    /* particles slowly disappear */
    setTimeout(() => Sky.fadeTo(0), T(8000));
  };
})();

/* start */
applyName();