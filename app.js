(function(){
  'use strict';
  var W=384,H=512, GRAV=0.7, FRICTION=0.85, MAX_LIVES=3;
  var canvas=document.getElementById('screen'), ctx=canvas.getContext('2d');
  var started=false, audioUnlocked=false, audioEnabled=true;
  var SFX={pick:document.getElementById('sfx_pick'), shot:document.getElementById('sfx_shot'), door:document.getElementById('sfx_door')};
  function sfx(id){ if(!audioEnabled||!audioUnlocked||!SFX[id]) return; try{ SFX[id].currentTime=0; SFX[id].play(); }catch(e){} }

  // HUD
  function set(id,txt){ var el=document.getElementById(id); if(el) el.textContent=txt; }
  var btnMute=document.getElementById('btnMute');
  btnMute.addEventListener('click', function(){ audioEnabled=!audioEnabled; btnMute.textContent=audioEnabled?'🔊':'🔇'; });

  // Input
  var Keys={};
  function key(e,down){
    var c=e.code||e.key||e.keyCode;
    var name = (function(c){
      if(c==='KeyA')return'ArrowLeft'; if(c==='KeyD')return'ArrowRight'; if(c==='KeyW')return'ArrowUp'; if(c==='KeyS')return'ArrowDown';
      if(c===' ')return'Space'; if(c==='Enter'||c===13)return'Enter';
      if(typeof c==='number'){ if(c===37)return'ArrowLeft'; if(c===39)return'ArrowRight'; if(c===38)return'ArrowUp'; if(c===40)return'ArrowDown'; if(c===32)return'Space'; if(c===13)return'Enter'; if(c===90)return'KeyZ'; if(c===88)return'KeyX'; }
      return c;
    })(c);
    Keys[name]=down;
    if(down) audioUnlocked=true;
    if(name==='Space'||name==='Enter'||(name&&name.indexOf('Arrow')===0)){ e.preventDefault&&e.preventDefault(); e.returnValue=false; }
    if(!started && down && (name==='Enter'||name==='Space')) start();
  }
  addEventListener('keydown',function(e){key(e,true);},false);
  addEventListener('keyup',function(e){key(e,false);},false);

  // On-screen controls (pointer events)
  function getK(t){ return t && t.getAttribute ? t.getAttribute('data-k') : null; }
  var controls=document.getElementById('controls');
  if(window.PointerEvent && controls){
    controls.addEventListener('pointerdown',function(e){ var k=getK(e.target); if(!k)return; Keys[k]=true; audioUnlocked=true; e.preventDefault(); },false);
    function up(e){ var k=getK(e.target); if(!k)return; Keys[k]=false; }
    controls.addEventListener('pointerup',up,false);
    controls.addEventListener('pointercancel',up,false);
    controls.addEventListener('pointerleave',up,false);
  } else if (controls) {
    controls.addEventListener('mousedown',function(e){ var k=getK(e.target); if(k){ Keys[k]=true; audioUnlocked=true; }},false);
    controls.addEventListener('mouseup',function(e){ var k=getK(e.target); if(k){ Keys[k]=false; }},false);
    controls.addEventListener('touchstart',function(e){ var t=e.changedTouches[0]; var el=document.elementFromPoint(t.clientX,t.clientY); var k=getK(el); if(k){ Keys[k]=true; audioUnlocked=true; } e.preventDefault(); },{passive:false});
    controls.addEventListener('touchend',function(e){ var t=e.changedTouches[0]; var el=document.elementFromPoint(t.clientX,t.clientY); var k=getK(el); if(k){ Keys[k]=false; } e.preventDefault(); },{passive:false});
  }

  // World
  function floorY(f,total){ var step=(H-64)/(total-1); return 32+step*f; }
  function clamp(v,min,max){ return v<min?min:(v>max?max:v); }
  function overlap(a,b){ return !(a.x+a.w<b.x||a.x>b.x+b.w||a.y+a.h<b.y||a.y>b.y+b.h); }

  var LEVELS=[
    {floors:8,
      doors:[{x:64,floor:1,red:true},{x:160,floor:2,red:false},{x:288,floor:3,red:true},{x:48,floor:4,red:false},{x:208,floor:5,red:false},{x:320,floor:6,red:true}],
      elevators:[{x:112,yMin:64,yMax:H-48,speed:1.1},{x:240,yMin:80,yMax:H-64,speed:1.0}],
      enemies:[{x:300,floor:2,dir:-1},{x:80,floor:4,dir:1},{x:220,floor:6,dir:-1}]}
  ];

  var state={level:0,lives:MAX_LIVES,gameOver:false};
  function Hero(x,y){ this.x=x; this.y=y; this.w=10; this.h=14; this.vx=0; this.vy=0; this.facing=1; this.inElevator=null; this.reload=0; }
  Hero.prototype.update=function(w){
    var speed=1.6;
    if(this.inElevator){
      var el=this.inElevator;
      if(Keys['ArrowUp']) el.vy=-el.speed; else if(Keys['ArrowDown']) el.vy=el.speed; else el.vy=0;
      if(Keys['ArrowLeft']||Keys['ArrowRight']){ this.x+=Keys['ArrowLeft']?-1:1; this.inElevator=null; }
      this.y=el.y-this.h;
    }else{
      if(Keys['ArrowLeft']){ this.vx-=0.5; this.facing=-1; }
      if(Keys['ArrowRight']){ this.vx+=0.5; this.facing=1; }
      if(Keys['ArrowUp']){
        var el2=w.nearElevator(this);
        if(el2 && Math.abs(el2.x-(this.x+this.w/2))<6 && Math.abs((el2.y-this.h)-this.y)<4){ this.inElevator=el2; sfx('door'); }
      }
      this.vy+=GRAV; this.vx*=FRICTION;
      this.vx=clamp(this.vx,-speed,speed);
      this.x+=this.vx; this.y+=this.vy;
      var fy=w.snap(this);
      if(fy!==null && this.y+this.h>fy){ this.y=fy-this.h; this.vy=0; }
    }
    if(this.reload>0) this.reload--;
    var fire=Keys['Enter']||Keys['Space']||Keys['KeyX'];
    if(fire && this.reload===0){ w.bullets.push(new Bullet(this.x+this.w/2,this.y+6,this.facing,false)); this.reload=14; sfx('shot'); }
    this.x=clamp(this.x,4,W-14);
    if(this.y+this.h>=H-8 && w.intelLeft()===0){ win(); }
  };
  Hero.prototype.draw=function(){ ctx.fillStyle='#ffe08a'; ctx.fillRect(this.x,this.y,this.w,this.h); ctx.fillRect(this.facing>0?this.x+this.w:this.x-3,this.y+5,3,2); };

  function Enemy(x,floor,dir,w){ this.x=x; this.floor=floor; this.dir=dir||1; this.w=10; this.h=14; this.y=floorY(floor,w.floors)-this.h; this.reload=90; }
  Enemy.prototype.update=function(w){
    var speed=0.6; this.x+=speed*this.dir; if(this.x<8||this.x>W-18) this.dir*=-1;
    if(this.reload>0) this.reload--;
    var h=w.hero;
    if(this.reload===0 && Math.abs(this.y-h.y)<4){ w.bullets.push(new Bullet(this.x+this.w/2,this.y+6,(h.x>this.x)?1:-1,true)); this.reload=120; sfx('shot'); }
  };
  Enemy.prototype.draw=function(){ ctx.fillStyle='#ff6b6b'; ctx.fillRect(this.x,this.y,this.w,this.h); };

  function Bullet(x,y,dir,evil){ this.x=x; this.y=y; this.dir=dir||1; this.evil=!!evil; this.w=4; this.h=2; this.life=90; }
  Bullet.prototype.update=function(w){
    this.x+=3*this.dir; if(--this.life<=0) this.dead=true;
    var box={x:this.x,y:this.y,w:this.w,h:this.h};
    if(this.evil){ var h=w.hero; if(overlap(box,{x:h.x,y:h.y,w:h.w,h:h.h})){ w.hurt(); this.dead=true; } }
    else { for(var i=0;i<w.enemies.length;i++){ var e=w.enemies[i]; if(e && overlap(box,{x:e.x,y:e.y,w:e.w,h:e.h})){ w.enemies.splice(i,1); this.dead=true; break; } } }
  };
  Bullet.prototype.draw=function(){ ctx.fillStyle='#eaf1ff'; ctx.fillRect(this.x,this.y,this.w,this.h); };

  function Elevator(x,yMin,yMax,speed){ this.x=x; this.yMin=yMin; this.yMax=yMax; this.y=yMin; this.vy=speed; this.speed=speed; this.w=20; this.h=4; }
  Elevator.prototype.update=function(){ this.y+=this.vy; if(this.y<this.yMin){this.y=this.yMin; this.vy=Math.abs(this.vy);} if(this.y>this.yMax){this.y=this.yMax; this.vy=-Math.abs(this.vy);} };
  Elevator.prototype.draw=function(){ ctx.fillStyle='#c7d2fe'; ctx.fillRect(this.x-10,this.y,this.w,this.h); };

  function Door(x,floor,red,w){ this.x=x; this.floor=floor; this.red=!!red; this.w=14; this.h=12; this.y=floorY(floor,w.floors)-this.h; this.opened=false; }
  Door.prototype.try=function(h,w){ if(this.opened) return false; var near=Math.abs((this.x+this.w/2)-(h.x+h.w/2))<10 && Math.abs(this.y-h.y)<4; var action=Keys['KeyZ']; if(near&&action){ this.opened=true; if(this.red){ w.docs++; sfx('pick'); } else { sfx('door'); } return true; } return false; };
  Door.prototype.draw=function(){ ctx.fillStyle=this.red?'#f74d4d':'#3e8ef7'; ctx.fillRect(this.x,this.y,this.w,this.h); };

  function World(def){
    this.floors=def.floors; this.doors=[]; this.elevators=[]; this.enemies=[]; this.bullets=[];
    this.hero=new Hero(24,floorY(0,def.floors)-20);
    this.docs=0; this.docsTotal=0;
    for(var i=0;i<def.doors.length;i++){ var d=def.doors[i]; this.doors.push(new Door(d.x,d.floor,d.red,this)); if(d.red) this.docsTotal++; }
    for(var j=0;j<def.elevators.length;j++){ var e=def.elevators[j]; this.elevators.push(new Elevator(e.x,e.yMin,e.yMax,e.speed)); }
    for(var k=0;k<def.enemies.length;k++){ var en=def.enemies[k]; this.enemies.push(new Enemy(en.x,en.floor,en.dir,this)); }
  }
  World.prototype.snap=function(ent){
    var closest=null;
    for(var f=0;f<this.floors;f++){ var y=floorY(f,this.floors); if(ent.y+ent.h<=y && (closest===null || y<closest)) closest=y; }
    return closest;
  };
  World.prototype.nearElevator=function(ent){
    for(var i=0;i<this.elevators.length;i++){ var el=this.elevators[i]; var x=Math.abs((ent.x+ent.w/2)-el.x)<8; var y=Math.abs((el.y-ent.h)-ent.y)<5; if(x&&y) return el; } return null;
  };
  World.prototype.intelLeft=function(){ return this.docsTotal-this.docs; };
  World.prototype.hurt=function(){ if(state.lives>0) state.lives--; if(state.lives<=0) { state.gameOver=true; } this.hero=new Hero(24,floorY(0,this.floors)-20); };
  World.prototype.update=function(){
    for(var i=0;i<this.elevators.length;i++) this.elevators[i].update();
    this.hero.update(this);
    for(var d=0;d<this.doors.length;d++) this.doors[d].try(this.hero,this);
    for(var e=0;e<this.enemies.length;e++) this.enemies[e].update(this);
    for(var b=0;b<this.bullets.length;b++){ var bb=this.bullets[b]; bb.update(this); if(bb.dead){ this.bullets.splice(b,1); b--; } }
  };
  World.prototype.draw=function(){
    ctx.fillStyle='#101634'; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#2b396b'; ctx.lineWidth=1;
    for(var f=0; f<this.floors; f++){ var y=floorY(f,this.floors); ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    for(var i=0;i<this.elevators.length;i++) this.elevators[i].draw();
    for(var j=0;j<this.doors.length;j++) this.doors[j].draw();
    // exit pad (blink when ready)
    var done=this.intelLeft()===0; ctx.fillStyle= done ? (Math.floor(Date.now()/250)%2? '#72ff72' : '#2e7d32') : '#2e7d32';
    ctx.fillRect(W-72,H-12,64,8); ctx.fillStyle=done?'#eaffea':'#a5d6a7'; ctx.fillRect(W-64,H-20,48,8);
    for(var k=0;k<this.enemies.length;k++) this.enemies[k].draw();
    for(var m=0;m<this.bullets.length;m++) this.bullets[m].draw();
    this.hero.draw();
    ctx.fillStyle='#eaf1ff'; ctx.font='12px monospace'; ctx.fillText('Docs:'+this.docs+'/'+this.docsTotal,8,12);
  };

  var world=null;
  function startLevel(i){
    world=new World(LEVELS[i]);
    set('level','LV '+(i+1));
    set('intel','📄 0/'+world.docsTotal);
    set('lives','❤'.repeat(state.lives) || '—');
  }
  function updateHud(){
    if(!world) return;
    set('intel','📄 '+world.docs+'/'+world.docsTotal);
    set('lives','❤'.repeat(state.lives) || '—');
  }
  function win(){ state.level=0; startLevel(0); }

  function loop(){
    if(!started){
      // Title screen
      ctx.fillStyle='#0b1022'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#eaf1ff'; ctx.font='18px monospace'; ctx.fillText('ELEVATOR ACTION', 80, 240);
      ctx.font='12px monospace'; ctx.fillText('Premi START o Enter', 110, 265);
    }else if(!state.gameOver){
      world.update(); world.draw(); updateHud();
    }else{
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#fff'; ctx.font='20px monospace'; ctx.fillText('GAME OVER', 150, 250);
      ctx.font='12px monospace'; ctx.fillText('Premi Enter per ripartire', 120, 275);
      if(Keys['Enter']){ state.lives=MAX_LIVES; state.gameOver=false; startLevel(0); }
    }
    requestAnimationFrame(loop);
  }

  function start(){
    if(started) return;
    started=true; audioUnlocked=true;
    var ov=document.getElementById('startOverlay'); if(ov) ov.style.display='none';
    startLevel(0); canvas.focus();
  }

  document.getElementById('btnStart').addEventListener('click', start, false);
  canvas.addEventListener('mousedown', function(){ if(!started) start(); }, false);
  canvas.addEventListener('touchstart', function(e){ if(!started) start(); }, {passive:true});

  loop();
})();