// Tiny synthesized sound kit. Neutral on failure, never comic.
let ac=null, master=null, muted=false, motor=null, squeal=null;
export function unlock(){ if(ac) { if(ac.state==='suspended') ac.resume(); return; }
  try{ ac=new (window.AudioContext||window.webkitAudioContext)(); master=ac.createGain(); master.gain.value=0.55; master.connect(ac.destination); }catch(e){ ac=null; } }
export function setMuted(m){ muted=m; if(master) master.gain.value=m?0:0.55; }
export function isMuted(){ return muted; }
function env(node, t0, a, d, peak){ const g=ac.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(peak,t0+a); g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d); node.connect(g); g.connect(master); return g; }
function tone(freq, type='sine', a=0.005, d=0.12, peak=0.3, glide=null){ if(!ac) return; const t=ac.currentTime; const o=ac.createOscillator(); o.type=type; o.frequency.setValueAtTime(freq,t); if(glide) o.frequency.exponentialRampToValueAtTime(glide,t+a+d); env(o,t,a,d,peak); o.start(t); o.stop(t+a+d+0.05); }
function noise(d=0.08, peak=0.2, hp=1500){ if(!ac) return; const t=ac.currentTime; const b=ac.createBuffer(1,Math.ceil(ac.sampleRate*d),ac.sampleRate); const ch=b.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=Math.random()*2-1;
  const s=ac.createBufferSource(); s.buffer=b; const f=ac.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp; s.connect(f); env(f,t,0.003,d,peak); s.start(t); }
export const sfx = {
  tick(){ tone(1400,'triangle',0.002,0.05,0.18); },
  pop(){ tone(520,'sine',0.004,0.1,0.28,880); },
  select(){ tone(880,'triangle',0.003,0.07,0.2); tone(1320,'sine',0.003,0.06,0.08); },
  clack(){ noise(0.06,0.35,900); tone(180,'square',0.002,0.06,0.12); },
  chime(){ tone(988,'sine',0.005,0.5,0.22); setTimeout(()=>tone(1319,'sine',0.005,0.6,0.18),110); },
  coin(){ tone(1046,'square',0.002,0.06,0.09); setTimeout(()=>tone(1568,'square',0.002,0.12,0.09),70); },
  tock(){ tone(420,'sine',0.003,0.09,0.25); setTimeout(()=>tone(320,'sine',0.003,0.11,0.22),130); },
  whoosh(){ noise(0.35,0.12,600); },
  bump(){ tone(110,'sine',0.004,0.18,0.35,70); },
  shutter(){ noise(0.04,0.3,2500); setTimeout(()=>noise(0.05,0.25,1800),70); },
  fanfare(){ [784,988,1175,1568].forEach((f,i)=>setTimeout(()=>tone(f,'triangle',0.004,0.22,0.16),i*110)); },
  motor(on, rate=1){ if(!ac) return; if(on){ if(!motor){ const o=ac.createOscillator(); o.type='sawtooth'; const f=ac.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900; const g=ac.createGain(); g.gain.value=0.0; o.connect(f); f.connect(g); g.connect(master); o.start(); motor={o,f,g}; }
      motor.o.frequency.setTargetAtTime(70+rate*90, ac.currentTime, 0.05); motor.g.gain.setTargetAtTime(rate>0.02?0.06:0.0, ac.currentTime, 0.05); }
    else if(motor){ motor.g.gain.setTargetAtTime(0,ac.currentTime,0.05); const m=motor; motor=null; setTimeout(()=>{ try{m.o.stop();}catch(e){} },300); } },
  squeal(on){ if(!ac) return; if(on&&!squeal){ const o=ac.createOscillator(); o.type='triangle'; o.frequency.value=1900; const l=ac.createOscillator(); l.frequency.value=13; const lg=ac.createGain(); lg.gain.value=120; l.connect(lg); lg.connect(o.frequency); const g=ac.createGain(); g.gain.value=0.035; o.connect(g); g.connect(master); o.start(); l.start(); squeal={o,l,g}; }
    if(!on&&squeal){ const s=squeal; squeal=null; s.g.gain.setTargetAtTime(0,ac.currentTime,0.04); setTimeout(()=>{ try{s.o.stop(); s.l.stop();}catch(e){} },250); } },
  pad(dur=15){ if(!ac) return; const t=ac.currentTime; const g=ac.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.09,t+3); g.gain.setValueAtTime(0.09,t+dur-3.5); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    const f=ac.createBiquadFilter(); f.type='lowpass'; f.frequency.setValueAtTime(500,t); f.frequency.linearRampToValueAtTime(1400,t+dur*.8); f.connect(g); g.connect(master);
    [[110,'sine',0],[164.8,'triangle',-6],[220,'sine',5],[329.6,'sine',-3],[440,'sine',7]].forEach(([fr,ty,dt],i)=>{ const o=ac.createOscillator(); o.type=ty; o.frequency.value=fr; o.detune.value=dt; const og=ac.createGain(); og.gain.value=i>2?.25:.6; o.connect(og); og.connect(f); o.start(t); o.stop(t+dur+.1); }); },
  boom(){ tone(70,'sine',0.005,0.7,0.22,38); setTimeout(()=>{ for(let i=0;i<6;i++) setTimeout(()=>noise(0.05,0.05,3500),i*60+Math.random()*40); },180); },
  buzz(){ tone(120,'sawtooth',0.003,0.18,0.04); setTimeout(()=>tone(120,'sawtooth',0.003,0.3,0.05),220); },
  stopAll(){ this.motor(false); this.squeal(false); }
};
