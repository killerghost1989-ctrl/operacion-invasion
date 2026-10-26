const $=id=>document.getElementById(id),cv=$('c'),g=cv.getContext('2d'),W=1600,H=1000,CX=800,CY=500;
const sock=io();let me=null,S=null,pl={},ents={},shots=[],banner='',bt=0,snd=true,ac,cw,ch,dpr=devicePixelRatio||1;
function rs(){cw=cv.width=innerWidth*dpr;ch=cv.height=innerHeight*dpr}rs();onresize=rs;
function beep(f,d,v){if(!snd)return;try{ac=ac||new AudioContext();const o=ac.createOscillator(),a=ac.createGain();o.type='square';o.frequency.value=f;a.gain.value=v||.03;o.connect(a);a.connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch(e){}}
const show=t=>{banner=t;bt=performance.now()+2600};
const ov=id=>['menu','lobby','over'].forEach(k=>$(k).style.display=k==id?'flex':'none');
sock.on('connect',()=>{try{const j=JSON.parse(localStorage.ucj||'null');if(j)sock.emit('rejoin',j)}catch(e){}});
sock.on('norejoin',()=>localStorage.removeItem('ucj'));
sock.on('joined',j=>{me=j.role;localStorage.ucj=JSON.stringify({code:j.code,tok:j.tok});$('code').textContent=j.code});
sock.on('err',m=>$('msg').textContent=m);
sock.on('ev',t=>{show(t);beep(/CAÍDO|ATACADO|DESTRUIDO/.test(t)?110:260,.25,.06)});
sock.on('s',s=>{
  S=s;if(!me)return;
  for(const p of s.p){const o=pl[p[0]]||(pl[p[0]]={x:p[1],y:p[2]});o.tx=p[1];o.ty=p[2];o.hp=p[3];o.dn=p[4];o.rd=p[5];o.on=p[6];o.rp=p[7]}
  const seen={};for(const e of s.e){seen[e[0]]=1;const o=ents[e[0]]||(ents[e[0]]={x:e[2],y:e[3]});o.g=e[1];o.tx=e[2];o.ty=e[3];o.hp=e[4];o.mx=o.mx||e[4]}
  for(const id in ents)if(!seen[id])delete ents[id];
  const t=performance.now();for(const k of s.sh)shots.push({k,t:t+70});
  if(s.sh.length)beep(700,.03,.012);
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
// ---- Render (interpolación suave hacia el último estado del servidor) ----
function circ(x,y,r,c){g.fillStyle=c;g.beginPath();g.arc(x,y,r,0,7);g.fill()}
function bar(x,y,w,h,v,c){g.fillStyle='#000a';g.fillRect(x,y,w,h);g.fillStyle=c;g.fillRect(x,y,w*Math.max(0,v),h)}
function loop(t){
  requestAnimationFrame(loop);if(!S||!me)return;
  for(const k in pl){const o=pl[k];o.x+=(o.tx-o.x)*.35;o.y+=(o.ty-o.y)*.35}
  for(const k in ents){const o=ents[k];o.x+=(o.tx-o.x)*.35;o.y+=(o.ty-o.y)*.35}
  const me_=pl[me]||{x:CX,y:CY},s=ch/600,vw=cw/s,vh=600;
  const cx=vw>=W?CX:Math.min(Math.max(me_.x,vw/2),W-vw/2),cy=Math.min(Math.max(me_.y,vh/2),H-vh/2);
  g.setTransform(1,0,0,1,0,0);g.fillStyle='#03060b';g.fillRect(0,0,cw,ch);
  g.setTransform(s,0,0,s,cw/2-cx*s,ch/2-cy*s);
  g.fillStyle='#0b1522';g.fillRect(0,0,W,H);g.strokeStyle='#12263a';g.lineWidth=1;g.beginPath();
  for(let i=0;i<=W;i+=100){g.moveTo(i,0);g.lineTo(i,H)}for(let j=0;j<=H;j+=100){g.moveTo(0,j);g.lineTo(W,j)}g.stroke();
  g.strokeStyle='#f43';g.lineWidth=4;g.strokeRect(0,0,W,H);
  g.fillStyle='#2a3a4a';for(let i=0;i<8;i++){const a=i*Math.PI/4+.4;g.save();g.translate(CX+Math.cos(a)*150,CY+Math.sin(a)*150);g.rotate(a+Math.PI/2);g.fillRect(-28,-6,56,12);g.restore()}
  const rp=S.r/100,pu=.5+.5*Math.sin(t/300),rc=rp>.5?'60,220,255':'255,70,60';
  circ(CX,CY,70+pu*8,`rgba(${rc},.12)`);circ(CX,CY,46,`rgba(${rc},.35)`);circ(CX,CY,30,`rgb(${rc})`);
  for(const k in ents){const o=ents[k];
    if(o.g){circ(o.x,o.y,18,'#c52');circ(o.x,o.y,10,'#f93');bar(o.x-18,o.y-28,36,4,o.hp/o.mx,'#f55')}
    else{circ(o.x,o.y,10,'#d33');circ(o.x+4,o.y-3,2,'#ff0');circ(o.x+4,o.y+3,2,'#ff0')}}
  for(const k in pl){const o=pl[k],c=k=='CORONEL'?'#3af':'#4f8';
    if(o.hp<=0){circ(o.x,o.y,14,'#555');g.fillStyle='#fff';g.font='bold 14px sans-serif';g.textAlign='center';
      g.fillText(o.dn>0?'⏱'+o.dn+'s':'☠',o.x,o.y-20);if(o.rp>0)bar(o.x-20,o.y+20,40,5,o.rp/3,'#4f8')}
    else{circ(o.x,o.y,16,c+'44');circ(o.x,o.y,12,c);if(!o.on){g.fillStyle='#f66';g.font='12px sans-serif';g.textAlign='center';g.fillText('sin conexión',o.x,o.y-24)}}
    g.fillStyle='#fff';g.font='11px sans-serif';g.textAlign='center';g.fillText(k,o.x,o.y+28)}
  shots=shots.filter(a=>a.t>t);for(const a of shots){g.strokeStyle=a.k[4]?'#8fa':'#8df';g.lineWidth=2;g.beginPath();g.moveTo(a.k[0],a.k[1]);g.lineTo(a.k[2],a.k[3]);g.stroke()}
  // HUD
  g.setTransform(dpr,0,0,dpr,0,0);const iw=innerWidth;g.textAlign='left';g.font='bold 12px sans-serif';
  const P=n=>(S.p.find(p=>p[0]==n)||[n,0,0,0])[3];
  g.fillStyle='#3af';g.fillText('CORONEL',8,16);bar(8,20,110,8,P('CORONEL')/100,'#3af');
  g.fillStyle='#4f8';g.fillText('VICKY',8,44);bar(8,48,110,8,P('VICKY')/100,'#4f8');
  g.textAlign='center';g.fillStyle='#8cf';g.fillText('REACTOR',iw/2,16);bar(iw/2-80,20,160,8,rp,rp>.5?'#3df':'#f44');
  g.fillStyle='#cfe';g.fillText('OLEADA '+S.w+' · ENEMIGOS '+S.n+(S.st=='break'?' · SIGUIENTE EN '+S.nx+'s':''),iw/2,46);
  g.textAlign='right';g.fillStyle=sock.connected?'#4f8':'#f44';g.fillText(sock.connected?'● ONLINE':'● SIN CONEXIÓN',iw-8,16);
  if(js){g.strokeStyle='#3df8';g.lineWidth=2;g.beginPath();g.arc(js.x,js.y,55,0,7);g.stroke();g.fillStyle='#3df6';g.beginPath();g.arc(js.px,js.py,22,0,7);g.fill()}
  if(t<bt){g.textAlign='center';g.font='bold 22px sans-serif';g.fillStyle='#fd3';g.fillText(banner,iw/2,innerHeight*.28)}
}
requestAnimationFrame(loop);
