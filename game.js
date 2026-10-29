// OPERACIÓN ÚLTIMA COLONIA v0.2 - cliente (HTML5 Canvas). El servidor manda; aquí solo se dibuja.
const $=id=>document.getElementById(id),cv=$('c'),g=cv.getContext('2d'),W=1600,H=1000,CX=800,CY=500;
const sock=io();
let me=null,S=null,pl={},ents={},pjs={},shots=[],parts=[],rings=[],bq=[],cur=null,snd=true,ac,cw,ch,dpr=devicePixelRatio||1,shake=0,lastT=0,wasConn=true;
function rs(){cw=cv.width=innerWidth*dpr;ch=cv.height=innerHeight*dpr}rs();onresize=rs;
function beep(f,d,v,ty){if(!snd)return;try{ac=ac||new AudioContext();const o=ac.createOscillator(),a=ac.createGain();o.type=ty||'square';o.frequency.value=f;a.gain.value=v||.03;o.connect(a);a.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}

// ---- Mapa (igual que en el servidor; el servidor también lo envía al unirse) ----
let OBS=[];
for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6;OBS.push({x:Math.round(CX+Math.cos(a)*195),y:Math.round(CY+Math.sin(a)*195),r:22})}
[[400,300,36],[1200,300,34],[400,700,34],[1200,700,36],[800,185,28],[800,815,28]].forEach(a=>OBS.push({x:a[0],y:a[1],r:a[2]}));
const FR=[.15,.5,.85],NOMLADO=['NORTE','SUR','OESTE','ESTE'];
const portal=(s,f)=>s==0?[W*f,6]:s==1?[W*f,H-6]:s==2?[6,H*f]:[W-6,H*f];
const craters=[];{let q=7;const rnd=()=>(q=(q*16807)%2147483647)/2147483647;
  for(let i=0;i<26;i++){const x=80+rnd()*(W-160),y=80+rnd()*(H-160);if(Math.hypot(x-CX,y-CY)>150)craters.push([x,y,10+rnd()*22])}}

// ---- Aspecto de cada tipo: nombre, color oscuro, color claro, tamaño ----
const TV=[{n:'RASTREADOR',c:'#8e1010',c2:'#ff4a4a',r:10},{n:'CAZADOR',c:'#d4b000',c2:'#fff06a',r:9},
  {n:'ACORAZADO',c:'#6b2aa8',c2:'#c58aff',r:18},{n:'ESCUPIDOR',c:'#3f8f12',c2:'#b6ff3d',r:11},
  {n:'EXPLOSIVO',c:'#ff7a00',c2:'#ffe27a',r:12},{n:'DEVORADOR',c:'#c40c0c',c2:'#ff5a5a',r:40},
  {n:'REINA ÁCIDA',c:'#0f4a24',c2:'#6dff7a',r:34},{n:'TITÁN',c:'#14090c',c2:'#ff2a2a',r:56}];

// ---- Mensajes grandes en pantalla (en cola para que no se pisen) ----
const show=t=>{bq.push(t);if(bq.length>3)bq.shift()};
const ov=id=>['menu','lobby','over'].forEach(k=>$(k).style.display=k==id?'flex':'none');
sock.on('connect',()=>{try{const j=JSON.parse(localStorage.ucj||'null');if(j)sock.emit('rejoin',j)}catch(e){}});
sock.on('norejoin',()=>localStorage.removeItem('ucj'));
sock.on('joined',j=>{me=j.role;localStorage.ucj=JSON.stringify({code:j.code,tok:j.tok});$('code').textContent=j.code;if(j.obs&&j.obs.length)OBS=j.obs});
sock.on('err',m=>$('msg').textContent=m);
sock.on('ev',t=>{show(t);beep(/CAÍDO|ATACADO|DESTRUIDO/.test(t)?110:/ALERTA|AMENAZA/.test(t)?70:260,.25,.06,/ALERTA|AMENAZA/.test(t)?'sawtooth':'square')});

// ---- Efectos visuales ----
function burst(x,y,n,c,sp,life,sz){for(let i=0;i<n&&parts.length<220;i++){const a=Math.random()*6.283,v=sp*(.3+Math.random());parts.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,l:life*(.6+Math.random()*.6),m:life,c,s:sz*(.6+Math.random()*.8)})}}
function ring(x,y,r,c,life,fill){if(rings.length<40)rings.push({x,y,r,c,l:life,m:life,f:fill})}
function morir(o){
  const V=TV[o.t]||TV[0],big=o.t>=5,n=big?46:o.t==2?16:9;
  burst(o.x,o.y,n,V.c2,big?300:150,big?.9:.5,big?5:2.6);burst(o.x,o.y,Math.round(n/2),V.c,big?200:100,.7,big?6:3);
  ring(o.x,o.y,V.r*(big?2.2:1.4),V.c2,big?.6:.35,false);
  if(big){shake=Math.max(shake,14);beep(60,.6,.08,'sawtooth')}else beep(220,.05,.012);
}
function fxEvent(f){ // [x,y,radio,tipo]  0=explosión 1=impacto de jefe 2=ácido
  const x=f[0],y=f[1],r=f[2];
  if(f[3]==0){burst(x,y,28,'#ffa83a',270,.6,3.6);ring(x,y,r,'#ffb347',.45,true);shake=Math.max(shake,8);beep(90,.3,.07,'sawtooth')}
  else if(f[3]==1){ring(x,y,r,'#ff5a5a',.55,true);burst(x,y,22,'#b9b9b9',200,.6,3.4);shake=Math.max(shake,13);beep(55,.45,.09,'sawtooth')}
  else{burst(x,y,10,'#8cff3a',130,.4,2.5);beep(400,.05,.012)}
}
sock.on('s',s=>{
  S=s;if(!me)return;const now=performance.now();
  for(const p of s.p){const o=pl[p[0]]||(pl[p[0]]={x:p[1],y:p[2],aim:0});o.tx=p[1];o.ty=p[2];o.hp=p[3];o.dn=p[4];o.rd=p[5];o.on=p[6];o.rp=p[7]}
  const seen={};
  for(const e of s.e){seen[e[0]]=1;let o=ents[e[0]];
    if(!o)o=ents[e[0]]={x:e[2],y:e[3],a:0,id:e[0],hp:e[4],ph:Math.random()*6.28,mv:0};
    if(e[4]<o.hp)o.fl=now+110; // destello al recibir daño
    o.t=e[1];o.tx=e[2];o.ty=e[3];o.hp=e[4];o.mx=e[5]||e[4];o.st=e[6]}
  for(const id in ents)if(!seen[id]){morir(ents[id]);delete ents[id]}
  const sp={};for(const q of s.pj){sp[q[0]]=1;const o=pjs[q[0]]||(pjs[q[0]]={x:q[1],y:q[2]});o.tx=q[1];o.ty=q[2]}
  for(const id in pjs)if(!sp[id])delete pjs[id];
  for(const k of s.sh){shots.push({k,t:now+70});const o=pl[k[4]?'VICKY':'CORONEL'];if(o)o.aim=Math.atan2(k[3]-k[1],k[2]-k[0])}
  if(s.sh.length)beep(700,.03,.012);
  for(const f of s.fx)fxEvent(f);
  if(s.st=='lobby'){ov('lobby');$('who').textContent=s.p.map(p=>p[0]+(p[6]?' ✔ conectado':' ✖ desconectado')+(p[5]?' · LISTO':'')).join('   |   ')+(s.p.length<2?'   |   Esperando compañero...':'')}
  else if(s.st=='over'){ov('over');$('stats').textContent='Oleada alcanzada: '+s.w+' · Alienígenas eliminados: '+s.k}
  else ov(null);
  $('rv').style.display=(s.st=='wave'||s.st=='break')&&s.p.some(p=>p[0]!=me&&p[3]<=0&&p[4]>0)?'block':'none';
});
$('bc').onclick=()=>{beep(300,.05);sock.emit('create')};
$('bj').onclick=()=>{beep(300,.05);sock.emit('join',$('ci').value)};
$('br').onclick=()=>sock.emit('ready');$('ba').onclick=()=>sock.emit('again');
$('snd').onclick=()=>{snd=!snd;$('snd').textContent=snd?'🔊':'🔇'};

// ---- Controles: joystick táctil izquierdo (o WASD/flechas) y botón de revivir ----
let js=null,jv={x:0,y:0},rv=false,keys={};
cv.addEventListener('touchstart',e=>{for(const t of e.changedTouches)if(t.clientX<innerWidth/2&&!js)js={id:t.identifier,x:t.clientX,y:t.clientY,px:t.clientX,py:t.clientY};e.preventDefault()},{passive:false});
cv.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(js&&t.identifier==js.id){let dx=t.clientX-js.x,dy=t.clientY-js.y,l=Math.hypot(dx,dy),m=55;if(l>m){dx*=m/l;dy*=m/l}jv={x:dx/m,y:dy/m};js.px=js.x+dx;js.py=js.y+dy}e.preventDefault()},{passive:false});
const tend=e=>{for(const t of e.changedTouches)if(js&&t.identifier==js.id){js=null;jv={x:0,y:0}}};
cv.addEventListener('touchend',tend);cv.addEventListener('touchcancel',tend);
$('rv').onpointerdown=()=>rv=true;$('rv').onpointerup=$('rv').onpointerleave=()=>rv=false;
onkeydown=e=>{keys[e.key.toLowerCase()]=1;if(e.key==' ')rv=true};onkeyup=e=>{keys[e.key.toLowerCase()]=0;if(e.key==' ')rv=false};
setInterval(()=>{
  if(!me||!S)return;let x=jv.x,y=jv.y;
  if(keys.a||keys.arrowleft)x-=1;if(keys.d||keys.arrowright)x+=1;if(keys.w||keys.arrowup)y-=1;if(keys.s||keys.arrowdown)y+=1;
  sock.emit('in',{x,y,rv});
},50);

// ---- Utilidades de dibujo ----
function circ(x,y,r,c){g.fillStyle=c;g.beginPath();g.arc(x,y,r,0,7);g.fill()}
function ell(x,y,rx,ry,c){g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,7);g.fill()}
function bar(x,y,w,h,v,c){g.fillStyle='#000a';g.fillRect(x,y,w,h);g.fillStyle=c;g.fillRect(x,y,w*Math.max(0,Math.min(1,v)),h)}
function legs(R,n,len,w,ph,am,col){ // patas con animación de caminar
  g.strokeStyle=col;g.lineWidth=w;g.lineCap='round';g.beginPath();
  for(let i=0;i<n;i++){const bx=n>1?R*(.55-1.1*i/(n-1)):0;
    for(const s of[-1,1]){const sw=Math.sin(ph+i*1.3+(s>0?0:3.14))*am,y0=s*R*.4;
      g.moveTo(bx,y0);g.lineTo(bx+sw*len*.5,y0+s*len*.6);g.lineTo(bx+sw*len*.9,y0+s*len)}}
  g.stroke();
}
function eyes(x,y,sep,r,c){circ(x,y-sep,r,c);circ(x,y+sep,r,c)}

// ---- Dibujo de cada alienígena (en coordenadas locales: +x = hacia adelante) ----
function sprite(o,t){
  const V=TV[o.t]||TV[0],R=V.r,fl=t<(o.fl||0),C=c=>fl?'#fff':c,ph=o.ph,am=.35+Math.min(.5,o.mv*.12);
  g.save();g.translate(o.x,o.y);g.rotate(o.a);g.lineJoin='round';
  switch(o.t){
  case 0: // RASTREADOR: pequeño, rojo oscuro, 6 patas
    legs(R,3,9,1.6,ph,am,C('#6a0a0a'));ell(0,0,R*1.15,R*.7,C('#8e1010'));ell(-R*.3,0,R*.6,R*.45,C('#c22'));
    circ(R*.95,0,R*.5,C('#6a0a0a'));g.strokeStyle='#ff6a6a99';g.lineWidth=1;g.beginPath();g.ellipse(0,0,R*1.15,R*.7,0,0,7);g.stroke();
    eyes(R*1.2,0,R*.22,1.8,'#ff0');break;
  case 1: // CAZADOR: amarillo, delgado y veloz, con cuchillas
    if(o.mv>2){g.strokeStyle='rgba(255,230,80,.4)';g.lineWidth=1.5;g.beginPath();for(let i=-1;i<=1;i++){g.moveTo(-R*1.6,i*R*.4);g.lineTo(-R*3.6,i*R*.4)}g.stroke()}
    legs(R,2,13,1.4,ph*1.6,am+.15,C('#a08400'));ell(0,0,R*1.5,R*.5,C('#d4b000'));
    g.fillStyle=C('#fff06a');g.beginPath();g.moveTo(R*1.9,0);g.lineTo(R*1.0,-R*.55);g.lineTo(R*1.0,R*.55);g.fill();
    g.strokeStyle=C('#fffbb0');g.lineWidth=1.6;g.beginPath();g.moveTo(R*1.1,-R*.3);g.lineTo(R*2.2,-R*.9);g.moveTo(R*1.1,R*.3);g.lineTo(R*2.2,R*.9);g.stroke();
    eyes(R*1.3,0,R*.2,1.6,'#f22');break;
  case 2: // ACORAZADO: morado, grande, caparazón con placas
    legs(R,2,11,3.4,ph*.7,am,C('#3d1566'));ell(-R*.1,0,R*1.15,R*.95,C('#6b2aa8'));
    g.strokeStyle=C('#c58aff');g.lineWidth=2;for(let k=0;k<3;k++){g.beginPath();g.ellipse(-R*.1,0,R*(1-k*.28),R*(.82-k*.22),0,-1.2,1.2);g.stroke()}
    ell(R*1.1,0,R*.38,R*.3,C('#3d1566'));g.strokeStyle=C('#efe0ff');g.lineWidth=2;g.beginPath();g.moveTo(R*1.35,-R*.18);g.lineTo(R*1.8,-R*.35);g.moveTo(R*1.35,R*.18);g.lineTo(R*1.8,R*.35);g.stroke();
    eyes(R*1.25,0,R*.12,1.8,'#ff0');break;
  case 3:{ // ESCUPIDOR: verde tóxico, saco de ácido que palpita
    const pu=1+.12*Math.sin(t*.008+o.ph);legs(R,3,10,1.3,ph,am,C('#2f6f0e'));
    circ(-R*.9,0,R*1.5,'rgba(182,255,61,.22)');circ(-R*.9,0,R*.85*pu,C('#5fb31a'));circ(-R*1.05,-R*.2,R*.25,C('#c8ff7a'));circ(-R*.8,R*.25,R*.2,C('#c8ff7a'));
    ell(R*.1,0,R*.8,R*.55,C('#3f8f12'));circ(R*.95,0,R*.42,C('#8aff3a'));
    g.fillStyle='#143305';g.beginPath();g.moveTo(R*1.3,0);g.lineTo(R*1.0,-R*.2);g.lineTo(R*1.0,R*.2);g.fill();eyes(R*1.05,0,R*.22,1.4,'#fff');break}
  case 4:{ // EXPLOSIVO: naranja brillante, núcleo que late
    const pu=.5+.5*Math.sin(t*.014+o.ph);legs(R,2,6,2,ph*1.4,am,C('#a04a00'));
    circ(0,0,R*(1.6+pu*.5),'rgba(255,176,0,.25)');circ(0,0,R,C('#ff7a00'));circ(0,0,R*(.45+.2*pu),C('#ffe27a'));
    g.strokeStyle='#2a1200';g.lineWidth=2;g.beginPath();g.moveTo(-R*.7,-R*.7);g.lineTo(R*.7,R*.7);g.moveTo(R*.7,-R*.7);g.lineTo(-R*.7,R*.7);g.stroke();break}
  case 5:{ // DEVORADOR: rojo intenso, mandíbulas enormes, embiste
    const op=Math.sin(t*.006)*R*.12,wu=o.st==1&&Math.floor(t/110)%2;
    if(o.st==2){g.strokeStyle='rgba(255,90,90,.45)';g.lineWidth=3;g.beginPath();for(let i=-2;i<=2;i++){g.moveTo(-R*1.2,i*R*.3);g.lineTo(-R*2.6,i*R*.3)}g.stroke()}
    legs(R,3,26,5,ph*.8,am,C('#5a0000'));ell(0,0,R*1.1,R*.85,C(wu?'#ff8a8a':o.st==3?'#7a0a0a':'#c40c0c'));
    g.fillStyle=C('#7a0000');for(let i=0;i<5;i++){const bx=-R*.8+i*R*.3;g.beginPath();g.moveTo(bx,-R*.7);g.lineTo(bx+R*.1,-R*1.08);g.lineTo(bx+R*.22,-R*.7);g.moveTo(bx,R*.7);g.lineTo(bx+R*.1,R*1.08);g.lineTo(bx+R*.22,R*.7);g.fill()}
    circ(R*1.0,0,R*.5,C('#e01818'));g.strokeStyle=C('#ffd9d9');g.lineWidth=5;g.beginPath();
    g.moveTo(R*1.3,-R*.25);g.quadraticCurveTo(R*1.95,-R*.6-op,R*1.75,-R*.05);g.moveTo(R*1.3,R*.25);g.quadraticCurveTo(R*1.95,R*.6+op,R*1.75,R*.05);g.stroke();
    circ(R*1.12,-R*.2,3,'#ffe600');circ(R*1.12,R*.2,3,'#ffe600');circ(R*1.3,0,2.4,'#ffe600');break}
  case 6:{ // REINA ÁCIDA: verde oscuro, corona, sacos de ácido
    const pu=.5+.5*Math.sin(t*.007);
    if(o.st==1){g.strokeStyle='rgba(109,255,122,'+(.4+.4*pu)+')';g.lineWidth=3;g.beginPath();g.arc(0,0,R*(1.25+.25*pu),0,7);g.stroke()}
    legs(R,3,22,3.6,ph*.9,am,C('#0a2a14'));circ(-R*.8,0,R*1.25,'rgba(109,255,122,.18)');circ(-R*.8,0,R*.85,C('#0f4a24'));
    for(const[ax,ay]of[[-1.1,-.3],[-.7,.35],[-1.2,.3],[-.5,-.35]])circ(R*ax,R*ay,3.5+pu*1.5,C('#6dff7a'));
    ell(0,0,R*.7,R*.55,C('#145c2c'));circ(R*.8,0,R*.38,C('#1c7a3a'));
    g.strokeStyle=C('#8dffa0');g.lineWidth=2.6;g.beginPath();for(let k=-2;k<=2;k++){const a=k*.42;g.moveTo(R*.8+Math.cos(a)*R*.3,Math.sin(a)*R*.3);g.lineTo(R*.8+Math.cos(a)*R*.95,Math.sin(a)*R*.95)}g.stroke();
    eyes(R*1.05,0,R*.16,2.6,'#e6ff4a');break}
  case 7:{ // TITÁN: negro con detalles rojos, gigantesco
    const pu=.5+.5*Math.sin(t*.005),wu=o.st==1;
    legs(R,2,30,9,ph*.6,am*.8,C('#1a0a0a'));ell(0,0,R*1.1,R*.95,C('#14090c'));
    g.strokeStyle=C('#3a1015');g.lineWidth=4;for(let k=0;k<3;k++){g.beginPath();g.ellipse(-R*.1,0,R*(1.0-k*.25),R*(.88-k*.22),0,-1.3,1.3);g.stroke()}
    g.fillStyle=C('#2a0f12');for(const s of[-1,1]){g.beginPath();g.moveTo(-R*.2,s*R*.85);g.lineTo(R*.1,s*R*1.35);g.lineTo(R*.4,s*R*.85);g.fill()}
    g.strokeStyle='rgba(255,42,42,'+(wu?1:.55+.4*pu)+')';g.lineWidth=2.4;g.beginPath();g.moveTo(-R*.8,-R*.2);g.lineTo(-R*.4,R*.05);g.lineTo(-R*.1,-R*.25);g.lineTo(R*.3,.1*R);g.moveTo(-R*.6,R*.5);g.lineTo(-R*.2,R*.3);g.lineTo(R*.1,R*.55);g.stroke();
    ell(R*1.1,0,R*.45,R*.4,C('#0b0506'));circ(R*1.3,-R*.14,4+pu*1.5,'#ff3030');circ(R*1.3,R*.14,4+pu*1.5,'#ff3030');break}
  }
  g.restore();
}

// ---- Bucle de dibujo ----
function drawMap(t){
  g.fillStyle='#0b1522';g.fillRect(0,0,W,H);
  g.fillStyle='#09111c';for(const c of craters){g.beginPath();g.arc(c[0],c[1],c[2],0,7);g.fill()}
  g.strokeStyle='#12263a';g.lineWidth=1;g.beginPath();
  for(let i=0;i<=W;i+=100){g.moveTo(i,0);g.lineTo(i,H)}for(let j=0;j<=H;j+=100){g.moveTo(0,j);g.lineTo(W,j)}g.stroke();
  g.strokeStyle='#f43';g.lineWidth=4;g.strokeRect(0,0,W,H);
  const sd=S.sd|0,pu=.5+.5*Math.sin(t/160);
  for(let s=0;s<4;s++)for(const f of FR){const[x,y]=portal(s,f),act=sd>>s&1;
    if(act)circ(x,y,46+pu*10,'rgba(255,40,40,'+(.12+.12*pu)+')');
    g.fillStyle='#1a0508';g.beginPath();g.ellipse(x,y,s<2?30:14,s<2?14:30,0,0,7);g.fill();
    g.strokeStyle=act?'#ff4040':'#5a1520';g.lineWidth=2;g.stroke()}
  for(const b of OBS){
    if(b.r<=22){circ(b.x,b.y,b.r+4,'rgba(60,220,255,.10)');circ(b.x,b.y,b.r,'#1a2a3a');g.strokeStyle='#3df';g.lineWidth=2;g.beginPath();g.arc(b.x,b.y,b.r,0,7);g.stroke();circ(b.x-5,b.y-5,b.r*.35,'#2f4a62')}
    else{g.fillStyle='#22364a';g.beginPath();for(let i=0;i<9;i++){const a=i*.698,rr=b.r*(.86+.2*Math.sin(i*2.3+b.x));g.lineTo(b.x+Math.cos(a)*rr,b.y+Math.sin(a)*rr)}g.closePath();g.fill();g.strokeStyle='#3a5873';g.lineWidth=2;g.stroke();circ(b.x-b.r*.25,b.y-b.r*.25,b.r*.3,'#2e4863')}}
  const rp=S.r/100,p2=.5+.5*Math.sin(t/300),rc=rp>.5?'60,220,255':'255,70,60';
  circ(CX,CY,70+p2*8,`rgba(${rc},.12)`);circ(CX,CY,46,`rgba(${rc},.35)`);circ(CX,CY,30,`rgb(${rc})`);
  g.strokeStyle=`rgba(${rc},.6)`;g.lineWidth=2;for(let i=0;i<8;i++){const a=i*.785+t/2500;g.beginPath();g.moveTo(CX+Math.cos(a)*50,CY+Math.sin(a)*50);g.lineTo(CX+Math.cos(a)*58,CY+Math.sin(a)*58);g.stroke()}
}
function loop(t){
  requestAnimationFrame(loop);if(!S||!me)return;
  const dt=Math.min(.05,(t-(lastT||t))/1000);lastT=t;const k=1-Math.exp(-dt*22);
  for(const n in pl){const o=pl[n];o.x+=(o.tx-o.x)*k;o.y+=(o.ty-o.y)*k}
  for(const id in ents){const o=ents[id],px=o.x,py=o.y;
    if(Math.hypot(o.tx-o.x,o.ty-o.y)>260){o.x=o.tx;o.y=o.ty}else{o.x+=(o.tx-o.x)*k;o.y+=(o.ty-o.y)*k}
    const v=Math.hypot(o.x-px,o.y-py)/Math.max(dt,.001);o.mv=o.mv*.8+v/60*.2;o.ph+=dt*(4+v*.07);
    let ta=o.a;if(v>10)ta=Math.atan2(o.y-py,o.x-px);else if(Math.hypot(CX-o.x,CY-o.y)<260)ta=Math.atan2(CY-o.y,CX-o.x);
    let da=ta-o.a;da=Math.atan2(Math.sin(da),Math.cos(da));o.a+=da*Math.min(1,dt*10)}
  for(const id in pjs){const o=pjs[id];o.x+=(o.tx-o.x)*Math.min(1,k*1.4);o.y+=(o.ty-o.y)*Math.min(1,k*1.4)}
  for(const q of parts){q.l-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.94;q.vy*=.94}parts=parts.filter(q=>q.l>0);
  for(const q of rings)q.l-=dt;rings=rings.filter(q=>q.l>0);
  shake*=Math.pow(.002,dt);
  const me_=pl[me]||{x:CX,y:CY},s=ch/600,vw=cw/s,vh=600;
  const cx=vw>=W?CX:Math.min(Math.max(me_.x,vw/2),W-vw/2),cy=Math.min(Math.max(me_.y,vh/2),H-vh/2);
  const shx=(Math.random()-.5)*shake*s,shy=(Math.random()-.5)*shake*s;
  g.setTransform(1,0,0,1,0,0);g.fillStyle='#03060b';g.fillRect(0,0,cw,ch);
  g.setTransform(s,0,0,s,cw/2-cx*s+shx,ch/2-cy*s+shy);
  const x0=cx-vw/2-80,x1=cx+vw/2+80,y0=cy-vh/2-80,y1=cy+vh/2+80,vis=(x,y)=>x>x0&&x<x1&&y>y0&&y<y1;
  drawMap(t);
  // avisos de golpes de área (Titán)
  for(const a of S.tg){const p=1-a[3]/a[4];circ(a[0],a[1],a[2],'rgba(255,40,40,'+(.12+.28*p)+')');
    g.strokeStyle='rgba(255,90,90,'+(.6+.4*Math.sin(t/60))+')';g.lineWidth=3;g.beginPath();g.arc(a[0],a[1],a[2],0,7);g.stroke();
    g.strokeStyle='rgba(255,200,200,.7)';g.lineWidth=2;g.beginPath();g.arc(a[0],a[1],a[2]*p,0,7);g.stroke()}
  for(const q of rings){const p=1-q.l/q.m;g.globalAlpha=Math.max(0,1-p);
    if(q.f){circ(q.x,q.y,q.r*(.3+.7*p),q.c);g.globalAlpha=Math.max(0,1-p)*.9}
    g.strokeStyle=q.c;g.lineWidth=3;g.beginPath();g.arc(q.x,q.y,q.r*(.3+.7*p),0,7);g.stroke();g.globalAlpha=1}
  // línea de aviso del embestida del Devorador
  for(const id in ents){const o=ents[id];if(o.t==5&&o.st==1){g.strokeStyle='rgba(255,60,60,'+(.4+.4*Math.sin(t/50))+')';g.lineWidth=4;g.setLineDash([14,10]);g.beginPath();g.moveTo(o.x,o.y);g.lineTo(CX,CY);g.stroke();g.setLineDash([])}}
  // proyectiles de ácido
  for(const id in pjs){const o=pjs[id];if(!vis(o.x,o.y))continue;circ(o.x,o.y,10,'rgba(140,255,58,.25)');circ(o.x,o.y,5,'#9dff3a');circ(o.x,o.y,2,'#eaffb0')}
  // alienígenas
  for(const id in ents){const o=ents[id];if(!vis(o.x,o.y))continue;sprite(o,t);
    const V=TV[o.t]||TV[0];
    if(o.t==2||o.t>=5){const w=V.r*(o.t>=5?2.4:2.2);bar(o.x-w/2,o.y-V.r-(o.t>=5?16:10),w,o.t>=5?6:4,o.hp/o.mx,o.t>=5?'#f33':'#c6f')}}
  // soldados
  for(const n in pl){const o=pl[n],c=n=='CORONEL'?'#3af':'#4f8';
    if(o.hp<=0){circ(o.x,o.y,14,'#555');g.fillStyle='#fff';g.font='bold 14px sans-serif';g.textAlign='center';
      g.fillText(o.dn>0?'⏱'+o.dn+'s':'☠',o.x,o.y-20);if(o.rp>0)bar(o.x-20,o.y+20,40,5,o.rp/3,'#4f8')}
    else{if(n==me){g.strokeStyle='rgba(255,255,255,'+(.35+.25*Math.sin(t/200))+')';g.lineWidth=1.5;g.beginPath();g.arc(o.x,o.y,21,0,7);g.stroke()}
      circ(o.x,o.y,16,c+'44');g.save();g.translate(o.x,o.y);g.rotate(o.aim||0);g.fillStyle='#cfe';g.fillRect(6,-2.5,15,5);g.fillStyle='#456';g.fillRect(6,-2.5,6,5);g.restore();
      circ(o.x,o.y,12,c);circ(o.x-2,o.y-2,6,'#fff3');
      if(!o.on){g.fillStyle='#f66';g.font='12px sans-serif';g.textAlign='center';g.fillText('sin conexión',o.x,o.y-24)}}
    g.fillStyle='#fff';g.font='11px sans-serif';g.textAlign='center';g.fillText(n,o.x,o.y+28)}
  shots=shots.filter(a=>a.t>t);for(const a of shots){g.strokeStyle=a.k[4]?'#8fa':'#8df';g.lineWidth=2;g.beginPath();g.moveTo(a.k[0],a.k[1]);g.lineTo(a.k[2],a.k[3]);g.stroke()}
  for(const q of parts){g.globalAlpha=Math.max(0,q.l/q.m);g.fillStyle=q.c;g.fillRect(q.x-q.s/2,q.y-q.s/2,q.s,q.s)}g.globalAlpha=1;
  hud(t,cx,cy,vw,vh);
}

// ---- Interfaz (HUD) ----
function hud(t,cx,cy,vw,vh){
  g.setTransform(dpr,0,0,dpr,0,0);const iw=innerWidth,ih=innerHeight;g.textAlign='left';g.font='bold 12px sans-serif';
  const P=n=>(S.p.find(p=>p[0]==n)||[n,0,0,0])[3],rp=S.r/100;
  g.fillStyle='#3af';g.fillText('CORONEL'+(P('CORONEL')<=0?' ☠':''),8,16);bar(8,20,110,8,P('CORONEL')/100,'#3af');
  g.fillStyle='#4f8';g.fillText('VICKY'+(P('VICKY')<=0?' ☠':''),8,44);bar(8,48,110,8,P('VICKY')/100,'#4f8');
  g.textAlign='center';g.fillStyle='#8cf';g.fillText('REACTOR '+S.r+'%',iw/2,16);bar(iw/2-80,20,160,8,rp,rp>.5?'#3df':'#f44');
  g.fillStyle='#cfe';g.fillText('OLEADA '+S.w+' · ENEMIGOS '+S.n+(S.st=='break'?' · SIGUIENTE EN '+S.nx+'s':''),iw/2,46);
  g.textAlign='right';g.fillStyle=sock.connected?'#4f8':'#f44';g.fillText(sock.connected?'● ONLINE':'● SIN CONEXIÓN',iw-8,16);
  // barras de jefe (máx. 2)
  let by=62;const jefes=Object.values(ents).filter(o=>o.t>=5).sort((a,b)=>b.mx-a.mx).slice(0,2);
  for(const o of jefes){const w=Math.min(iw*.5,300),V=TV[o.t];g.fillStyle=V.c2;g.font='bold 11px sans-serif';g.textAlign='center';g.fillText('☠ '+V.n,iw/2,by+8);
    bar(iw/2-w/2,by+12,w,9,o.hp/o.mx,'#e22');g.strokeStyle='#fff6';g.lineWidth=1;g.strokeRect(iw/2-w/2,by+12,w,9);by+=28;
    // flecha si el jefe está fuera de pantalla
    const sx=(o.x-cx)*(ih/vh)+iw/2,sy=(o.y-cy)*(ih/vh)+ih/2;
    if(sx<0||sx>iw||sy<0||sy>ih){const ex=Math.min(iw-14,Math.max(14,sx)),ey=Math.min(ih-14,Math.max(14,sy)),a=Math.atan2(sy-ih/2,sx-iw/2);
      g.save();g.translate(ex,ey);g.rotate(a);g.fillStyle='#f33';g.beginPath();g.moveTo(10,0);g.lineTo(-7,-8);g.lineTo(-7,8);g.fill();g.restore()}}
  // aviso de por qué lados vienen
  const sd=S.sd|0,al=.35+.3*Math.sin(t/120);g.font='bold 11px sans-serif';g.textAlign='center';
  for(let s=0;s<4;s++)if(sd>>s&1){g.fillStyle='rgba(255,40,40,'+al+')';
    if(s==0){g.fillRect(iw*.25,92,iw*.5,4);g.fillText('▲ '+NOMLADO[0],iw/2,88)}
    else if(s==1){g.fillRect(iw*.25,ih-6,iw*.5,4);g.fillText('▼ '+NOMLADO[1],iw/2,ih-10)}
    else if(s==2){g.fillRect(2,ih*.25,4,ih*.5);g.save();g.translate(16,ih/2);g.rotate(-1.5708);g.fillText('◀ '+NOMLADO[2],0,0);g.restore()}
    else{g.fillRect(iw-6,ih*.25,4,ih*.5);g.save();g.translate(iw-12,ih/2);g.rotate(1.5708);g.fillText(NOMLADO[3]+' ▶',0,0);g.restore()}}
  // minimapa
  {const mx=iw-108,my=64,w=100,h=62.5,q=w/W;
    g.fillStyle='#000b';g.fillRect(mx,my,w,h);g.strokeStyle='#3df6';g.lineWidth=1;g.strokeRect(mx,my,w,h);
    g.fillStyle='#567';for(const b of OBS)g.fillRect(mx+b.x*q-1,my+b.y*q-1,2,2);
    g.fillStyle=rp>.5?'#3df':'#f44';g.fillRect(mx+CX*q-3,my+CY*q-3,6,6);
    for(const id in ents){const o=ents[id],V=TV[o.t],z=o.t>=5?5:o.t==2?3:2;g.fillStyle=V.c2;g.fillRect(mx+o.x*q-z/2,my+o.y*q-z/2,z,z)}
    for(const n in pl){const o=pl[n];g.fillStyle=n=='CORONEL'?'#3af':'#4f8';g.beginPath();g.arc(mx+o.x*q,my+o.y*q,2.6,0,7);g.fill()}}
  if(js){g.strokeStyle='#3df8';g.lineWidth=2;g.beginPath();g.arc(js.x,js.y,55,0,7);g.stroke();g.fillStyle='#3df6';g.beginPath();g.arc(js.px,js.py,22,0,7);g.fill()}
  // mensajes grandes (uno a la vez, con ajuste de tamaño para pantallas pequeñas)
  if(!cur||t>cur.u){const m=bq.shift();cur=m?{t:m,u:t+(/AMENAZA/.test(m)?3400:2600)}:null}
  if(cur&&t<cur.u){
    const m=cur.t,rojo=/AMENAZA|ALERTA/.test(m),verde=/SUPERADA/.test(m),lines=m.split(' — ');
    let fs=rojo?24:20;g.font='bold '+fs+'px sans-serif';
    const wmax=Math.max(...lines.map(l=>g.measureText(l).width));if(wmax>iw*.92){fs=Math.max(11,fs*iw*.92/wmax);g.font='bold '+fs+'px sans-serif'}
    const y=ih*.3,hh=lines.length*(fs+4)+10;
    const ww=Math.max(...lines.map(l=>g.measureText(l).width));
    g.fillStyle=rojo?'rgba(90,0,0,.55)':'rgba(0,0,0,.4)';g.fillRect(iw/2-ww/2-12,y-fs-2,ww+24,hh);
    g.textAlign='center';g.fillStyle=rojo?(Math.floor(t/150)%2?'#ff5a5a':'#fff'):verde?'#6fff9a':'#fd3';
    lines.forEach((l,i)=>g.fillText(l,iw/2,y+i*(fs+4)));
  }
  if(!sock.connected){g.fillStyle='rgba(5,10,18,.6)';g.fillRect(0,ih*.4,iw,50);g.fillStyle='#f66';g.font='bold 18px sans-serif';g.textAlign='center';g.fillText('SIN CONEXIÓN · reconectando...',iw/2,ih*.4+31)}
}
requestAnimationFrame(loop);
