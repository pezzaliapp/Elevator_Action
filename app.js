/* app.js — Elevator Action — PezzaliAPP Edition (ES5) */
if (!window.requestAnimationFrame) { window.requestAnimationFrame = function (cb) { return setTimeout(cb, 16); }; }

var canvas = document.getElementById('screen');
var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
if (!canvas || !ctx) { alert('Canvas non inizializzato.'); throw new Error('Canvas missing'); }

var started = false;        // ▶️ gating avvio
var audioEnabled = true;
var audioUnlocked = false;
var SFX = {};
var AUDIO_SPRITES = {
  step: './assets/sfx/step.wav',
  door: './assets/sfx/door.wav',
  pick: './assets/sfx/pickup.wav',
  shot: './assets/sfx/shot.wav'
};

function loadAudio() {
  ['step','door','pick','shot'].forEach(function(id){
    var el = document.getElementById('sfx_'+id);
    if (el) { el.src = AUDIO_SPRITES[id] || ''; SFX[id] = el; }
  });
}
function playSfx(id){
  if (!audioEnabled || !audioUnlocked || !SFX[id]) return;
  try { SFX[id].currentTime = 0; SFX[id].play(); } catch(e){}
}

/* ====================== INPUT ====================== */
var Keys = {};
var showDebug = false;

var KEYMAP = {37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',13:'Enter',32:'Space',65:'ArrowLeft',68:'ArrowRight',87:'ArrowUp',83:'ArrowDown',90:'KeyZ',74:'KeyJ',88:'KeyX',75:'KeyK',72:'KeyH'};

function keyName(e){
  if (e.code) { if (e.code==='KeyA') return 'ArrowLeft'; if (e.code==='KeyD') return 'ArrowRight'; if (e.code==='KeyW') return 'ArrowUp'; if (e.code==='KeyS') return 'ArrowDown'; return e.code; }
  if (e.key) { if (e.key===' ') return 'Space'; if (e.key==='Left') return 'ArrowLeft'; if (e.key==='Right') return 'ArrowRight'; if (e.key==='Up') return 'ArrowUp'; if (e.key==='Down') return 'ArrowDown'; return e.key; }
  var k=e.keyCode||e.which||0; return KEYMAP[k]||('Key'+k);
}
function onKey(e, down){
  var name = keyName(e);
  if (name === 'KeyH' && down){ showDebug = !showDebug; }
  Keys[name] = down;
  if (!audioUnlocked && down) audioUnlocked = true;

  if (name==='Space'||name==='Enter'||(name && name.indexOf('Arrow')===0)){
    if (e.preventDefault) e.preventDefault();
    e.returnValue = false;
  }

  // START con Enter/Space
  if (!started && down && (name==='Enter' || name==='Space')) {
    startGame();
  }
}
function resetKeys(){ for (var k in Keys) Keys[k] = false; }
window.addEventListener('keydown', function(e){ onKey(e,true); }, false);
window.addEventListener('keyup',   function(e){ onKey(e,false); }, false);
window.addEventListener('blur',    function(){ resetKeys(); }, false);

// TOUCH PAD
var supportsPassive=false;
try{
  var opts = Object.defineProperty({},'passive',{get:function(){supportsPassive=true;}});
  window.addEventListener('testPassive',function(){},opts);
  window.removeEventListener('testPassive',function(){},opts);
}catch(e){}
var touchOpts = supportsPassive ? {passive:false} : false;

var controls = document.getElementById('controls');
function keyFromPoint(x,y){
  var el = document.elementFromPoint(x,y);
  if (!el || !el.getAttribute) return null;
  return el.getAttribute('data-k') || null;
}
function setKey(k, down){ if (!k) return; Keys[k] = !!down; if (down) audioUnlocked = true; }

if (controls){
  controls.addEventListener('touchstart', function(e){
    for (var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i]; var k=keyFromPoint(t.clientX,t.clientY); if (k){ setKey(k,true); }
    }
    if (e.preventDefault) e.preventDefault();
  }, touchOpts);
  controls.addEventListener('touchend', function(e){
    for (var i=0;i<e.changedTouches.length;i++){
      var t=e.changedTouches[i]; var k=keyFromPoint(t.clientX,t.clientY); if (k){ setKey(k,false); }
    }
    if (e.preventDefault) e.preventDefault();
  }, touchOpts);
  controls.addEventListener('mousedown',  function(e){ var k=keyFromPoint(e.clientX,e.clientY); setKey(k,true); }, false);
  controls.addEventListener('mouseup',    function(e){ var k=keyFromPoint(e.clientX,e.clientY); setKey(k,false); }, false);
}

// Mute e toggle pad
var btnMute = document.getElementById('btnMute');
if (btnMute){ btnMute.addEventListener('click', function(){ audioEnabled = !audioEnabled; btnMute.textContent = audioEnabled ? '🔊' : '🔇'; }, false); }
var btnControls = document.getElementById('btnControls');
if (btnControls){ btnControls.addEventListener('click', function(){ var pad = controls && controls.querySelector('.pad'); if (pad) pad.classList.toggle('hidden'); }, false); }

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js'); }

/* ====================== GAME ====================== */
var W = canvas.width, H = canvas.height;
var GRAV = 0.7, FRICTION = 0.85, MAX_LIVES = 3;

function floorY(floor, totalFloors){ var step=(H-64)/(totalFloors-1); return 32 + step*floor; }
function rectsOverlap(a,b){ return !(a.x+a.w<b.x || a.x>b.x+b.w || a.y+a.h<b.y || a.y>b.y+b.h); }

var LEVELS = [
  { floors:8,
    doors:[{x:64,floor:1,red:true},{x:160,floor:2,red:false},{x:288,floor:3,red:true},
           {x:48,floor:4,red:false},{x:208,floor:5,red:false},{x:320,floor:6,red:true}],
    elevators:[{x:112,yMin:64,yMax:H-48,speed:1.1},{x:240,yMin:80,yMax:H-64,speed:1.0}],
    enemies:[{x:300,floor:2,dir:-1},{x:80,floor:4,dir:1},{x:220,floor:6,dir:-1}] },
  { floors:10,
    doors:[{x:48,floor:1,red:true},{x:96,floor:3,red:true},{x:144,floor:4,red:false},
           {x:192,floor:6,red:true},{x:256,floor:7,red:false},{x:304,floor:8,red:true}],
    elevators:[{x:80,yMin:64,yMax:H-32,speed:1.2},{x:192,yMin:48,yMax:H-48,speed:1.0},{x:304,yMin:96,yMax:H-64,speed:0.9}],
    enemies:[{x:260,floor:2,dir:1},{x:120,floor:5,dir:-1},{x:200,floor:7,dir:1},{x:320,floor:8,dir:-1}] }
];

var state = { levelIndex:0, lives:MAX_LIVES, gameOver:false };
function Hero(x,y){ this.x=x; this.y=y; this.vx=0; this.vy=0; this.w=10; this.h=14; this.facing=1; this.inElevator=null; this.reloading=0; }
Hero.prototype.update=function(world){
  var speed=1.6;
  if (this.inElevator){
    var el=this.inElevator;
    if (Keys['ArrowUp']) el.vy = -el.speed; else if (Keys['ArrowDown']) el.vy = el.speed; else el.vy = 0;
    var left=!!Keys['ArrowLeft'], right=!!Keys['ArrowRight'];
    if (left||right){ this.x += (left?-1:1); this.inElevator=null; }
    this.y = el.y - this.h;
  } else {
    if (Keys['ArrowLeft']) { this.vx -= 0.5; this.facing=-1; }
    if (Keys['ArrowRight']){ this.vx += 0.5; this.facing= 1; }
    if (Keys['ArrowUp']){
      var el2 = world.elevatorsNear(this);
      if (el2 && Math.abs(el2.x-(this.x+this.w/2))<6 && Math.abs((el2.y - this.h) - this.y) < 4){
        this.inElevator = el2; playSfx('door');
      }
    }
    this.vy += GRAV; this.vx *= FRICTION;
    if (this.vx> 1.6) this.vx = 1.6; if (this.vx<-1.6) this.vx = -1.6;
    this.x += this.vx; this.y += this.vy;
    var fy = world.snapFloor(this);
    if (fy!==null && this.y+this.h>fy){ this.y=fy-this.h; this.vy=0; }
  }
  if (this.reloading>0) this.reloading--;
  var fire = Keys['Enter']||Keys['Space']||Keys['KeyX']||Keys['KeyK'];
  if (fire && this.reloading===0){ world.spawnBullet(this.x+this.w/2, this.y+6, this.facing); this.reloading=14; playSfx('shot'); }
  if (this.x<4) this.x=4; if (this.x>W-14) this.x=W-14;
  if (this.y+this.h>=H-8 && world.intelLeft()===0){ world.winLevel(); }
};
Hero.prototype.draw=function(){ ctx.fillStyle='#ffe08a'; ctx.fillRect(this.x,this.y,this.w,this.h); ctx.fillRect(this.facing>0?this.x+this.w:this.x-3,this.y+5,3,2); };

function Enemy(x,floor,dir,world){ this.x=x; this.floor=floor; this.dir=dir||1; this.w=10; this.h=14; this.y=floorY(floor,world.floors)-this.h; this.reload=Math.floor(60+Math.random()*90); }
Enemy.prototype.update=function(world){
  var speed=0.6; this.x += speed*this.dir; if (this.x<8 || this.x>W-18) this.dir*=-1;
  if (this.reload>0) this.reload--; var hero=world.hero;
  if (this.reload===0 && Math.abs(this.y-hero.y)<4){ var d=hero.x>this.x?1:-1; world.spawnBullet(this.x+this.w/2,this.y+6,d,true); this.reload=Math.floor(90+Math.random()*120); playSfx('shot'); }
};
Enemy.prototype.draw=function(){ ctx.fillStyle='#ff6b6b'; ctx.fillRect(this.x,this.y,this.w,this.h); };

function Bullet(x,y,dir,evil){ this.x=x; this.y=y; this.dir=dir||1; this.evil=!!evil; this.w=4; this.h=2; this.life=90; }
Bullet.prototype.update=function(world){
  this.x += 3*this.dir; if(--this.life<=0) this.dead=true;
  var box={x:this.x,y:this.y,w:this.w,h:this.h};
  if (this.evil){ var h=world.hero; if (rectsOverlap(box,{x:h.x,y:h.y,w:h.w,h:h.h})){ world.hurtHero(); this.dead=true; } }
  else { for (var i=0;i<world.enemies.length;i++){ var e=world.enemies[i]; if(e && rectsOverlap(box,{x:e.x,y:e.y,w:e.w,h:e.h})){ world.enemies.splice(i,1); this.dead=true; break; } } }
};
Bullet.prototype.draw=function(){ ctx.fillStyle='#eaf1ff'; ctx.fillRect(this.x,this.y,this.w,this.h); };

function Elevator(x,yMin,yMax,speed){ this.x=x; this.yMin=yMin; this.yMax=yMax; this.y=yMin; this.vy=speed; this.speed=speed; this.w=20; this.h=4; }
Elevator.prototype.update=function(){ this.y+=this.vy; if (this.y<this.yMin){this.y=this.yMin; this.vy=Math.abs(this.vy);} if (this.y>this.yMax){this.y=this.yMax; this.vy=-Math.abs(this.vy);} };
Elevator.prototype.draw=function(){ ctx.fillStyle='#c7d2fe'; ctx.fillRect(this.x-10,this.y,this.w,this.h); };

function Door(x,floor,red,world){ this.x=x; this.floor=floor; this.red=!!red; this.w=14; this.h=12; this.y=floorY(floor,world.floors)-this.h; this.opened=false; }
Door.prototype.tryOpen=function(hero,world){
  if (this.opened) return false;
  var near = Math.abs((this.x+this.w/2)-(hero.x+hero.w/2))<10 && Math.abs(this.y-hero.y)<4;
  var action = Keys['KeyZ']||Keys['KeyJ'];
  if (near && action){ this.opened=true; if (this.red){ world.intelGot++; playSfx('pick'); } else { playSfx('door'); } return true; }
  return false;
};
Door.prototype.draw=function(){ ctx.fillStyle=this.red?'#f74d4d':'#3e8ef7'; ctx.fillRect(this.x,this.y,this.w,this.h); };

function World(def){
  this.floors=def.floors; this.doors=[]; this.elevs=[]; this.enemies=[]; this.bullets=[];
  this.hero = new Hero(24, floorY(0,def.floors)-20);
  this.intelGot=0; this.intelTotal=0;
  var i,d,e,en;
  for (i=0;i<def.doors.length;i++){ d=def.doors[i]; this.doors.push(new Door(d.x,d.floor,d.red,this)); if (d.red) this.intelTotal++; }
  for (i=0;i<def.elevators.length;i++){ e=def.elevators[i]; this.elevs.push(new Elevator(e.x,e.yMin,e.yMax,e.speed)); }
  for (i=0;i<def.enemies.length;i++){ en=def.enemies[i]; this.enemies.push(new Enemy(en.x,en.floor,en.dir,this)); }
}
World.prototype.snapFloor=function(ent){ var closest=null; for (var f=0; f<this.floors; f++){ var y=floorY(f,this.floors); if (ent.y+ent.h<=y && (closest===null || y<closest)) closest=y; } return closest; };
World.prototype.elevatorsNear=function(ent){
  for (var i=0;i<this.elevs.length;i++){ var el=this.elevs[i]; var nearX=Math.abs((ent.x+ent.w/2)-el.x)<8; var nearY=Math.abs((el.y-ent.h)-ent.y)<5; if (nearX && nearY) return el; }
  return null;
};
World.prototype.spawnBullet=function(x,y,dir,evil){ this.bullets.push(new Bullet(x,y,dir,evil)); };
World.prototype.hurtHero=function(){ if (state.lives>0) state.lives--; if (state.lives<=0) state.gameOver=true; this.hero=new Hero(24,floorY(0,this.floors)-20); };
World.prototype.intelLeft=function(){ return this.intelTotal - this.intelGot; };
World.prototype.update=function(){
  var i,b; for (i=0;i<this.elevs.length;i++) this.elevs[i].update();
  this.hero.update(this);
  for (i=0;i<this.doors.length;i++) this.doors[i].tryOpen(this.hero,this);
  for (i=0;i<this.enemies.length;i++) this.enemies[i].update(this);
  for (i=0;i<this.bullets.length;i++){ b=this.bullets[i]; b.update(this); if (b.dead){ this.bullets.splice(i,1); i--; } }
};
World.prototype.draw=function(){
  ctx.fillStyle='#101634'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#2b396b'; ctx.lineWidth=1;
  for (var f=0; f<this.floors; f++){ var y=floorY(f,this.floors); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  for (var i=0;i<this.elevs.length;i++) this.elevs[i].draw();
  for (i=0;i<this.doors.length;i++) this.doors[i].draw();
  ctx.fillStyle='#2e7d32'; ctx.fillRect(W-72,H-12,64,8);
  ctx.fillStyle='#a5d6a7'; ctx.fillRect(W-64,H-20,48,8);
  for (i=0;i<this.enemies.length;i++) this.enemies[i].draw();
  for (i=0;i<this.bullets.length;i++) this.bullets[i].draw();
  this.hero.draw();
  ctx.fillStyle='#eaf1ff'; ctx.font='12px monospace'; ctx.fillText('Docs:'+this.intelGot+'/'+this.intelTotal,8,12);

  if (showDebug){
    var ktext = Object.keys(Keys).filter(function(k){return Keys[k];}).join(' ');
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(6, H-36, 220, 30);
    ctx.fillStyle='#fff'; ctx.font='11px monospace';
    ctx.fillText('Keys: '+ktext, 10, H-16);
  }
};
World.prototype.winLevel=function(){ state.levelIndex++; if (state.levelIndex>=LEVELS.length) state.levelIndex=0; startLevel(state.levelIndex); };

var world=null;
function startLevel(idx){
  world = new World(LEVELS[idx]);
  var lvl = document.getElementById('level'); if (lvl) lvl.textContent = 'LV '+(idx+1);
  var intel = document.getElementById('intel'); if (intel) intel.textContent = '📄 0/'+world.intelTotal;
  updateHud();
}
function updateHud(){
  if (!world) return;
  var intel = document.getElementById('intel'); if (intel) intel.textContent = '📄 '+world.intelGot+'/'+world.intelTotal;
  var hearts=''; for (var i=0;i<state.lives;i++) hearts+='❤';
  var livesEl = document.getElementById('lives'); if (livesEl) livesEl.textContent = hearts || '—';
}
function drawStartScreen(){
  ctx.fillStyle='#0b1022'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#eaf1ff'; ctx.font='18px monospace'; ctx.fillText('ELEVATOR ACTION', W/2-100, H/2-16);
  ctx.font='12px monospace'; ctx.fillText('Premi START o Enter', W/2-80, H/2+8);
}
function loop(){
  if (!started){
    drawStartScreen();
  } else if (!state.gameOver){
    world.update(); world.draw(); updateHud();
  } else {
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff'; ctx.font='20px monospace'; ctx.fillText('GAME OVER', W/2-60, H/2);
    ctx.font='12px monospace'; ctx.fillText('Premi B/Enter per ripartire', W/2-90, H/2+18);
    if (Keys['KeyX'] || Keys['Enter']) { state.lives=MAX_LIVES; state.gameOver=false; state.levelIndex=0; startLevel(0); }
  }
  requestAnimationFrame(loop);
}

function startGame(){
  if (started) return;
  started = true;
  audioUnlocked = true;
  var ov = document.getElementById('startOverlay'); if (ov) ov.style.display='none';
  startLevel(0);
  try{ canvas.focus(); }catch(e){}
}

function bootstrap(){
  loadAudio();
  // overlay START attivo; avvia loop subito per disegnare start screen
  var btnStart = document.getElementById('btnStart');
  if (btnStart){ btnStart.addEventListener('click', startGame, false); }
  // sblocco audio al primo tap/click
  var unlock=function(){ audioUnlocked=true; };
  canvas.addEventListener('touchstart', unlock, touchOpts);
  canvas.addEventListener('mousedown', unlock, false);
  // focus
  function focusCanvas(){ try{ canvas.focus(); }catch(e){} }
  document.addEventListener('mousedown', focusCanvas, false);
  document.addEventListener('touchstart', focusCanvas, touchOpts);
  loop();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') { bootstrap(); }
else { document.addEventListener('DOMContentLoaded', bootstrap, false); }
