// =====================================================================
//  OPERACIÓN ÚLTIMA COLONIA  ·  v0.2  ·  servidor autoritativo (Node + Socket.IO)
//  El servidor calcula TODO (enemigos, jefes, daño, proyectiles). Los celulares solo dibujan.
// =====================================================================
const express=require('express'),http=require('http'),{Server}=require('socket.io');
const app=express();
// no-cache: así los celulares siempre cargan la versión nueva después de actualizar en Render
app.use(express.static(__dirname+'/public',{maxAge:0,setHeaders:res=>res.setHeader('Cache-Control','no-cache')}));
const srv=http.createServer(app),io=new Server(srv);
const W=1600,H=1000,CX=800,CY=500,DT=1/30,rooms={};
const SIDES=['NORTE','SUR','OESTE','ESTE'];

// ---------------------------------------------------------------------
//  CONFIGURACIÓN (aquí se ajusta la dificultad sin tocar la lógica)
// ---------------------------------------------------------------------
const CFG={
  MAX_ACTIVOS:25,       // enemigos vivos a la vez (el resto espera en cola)
  MAX_INVOCADOS:8,      // enemigos extra que puede invocar la Reina Ácida
  MAX_PROYECTILES:40,   // proyectiles de ácido simultáneos por sala
  ESC_HP:.09,  ESC_HP_MAX:4,    // la salud de los enemigos normales sube 9 % por oleada (tope x4)
  ESC_VEL:.02, ESC_VEL_MAX:1.5, // la velocidad sube 2 % por oleada (tope x1.5)
  REPARO:12,            // el reactor se repara al superar una oleada
  REPARO_JEFE:15,       // reparación extra al derrotar un jefe
  DESCANSO:15,          // segundos entre oleadas
  F16:{base:40,crec:1.06,tope:110}, // desde la oleada 16: enemigos = base * crec^(oleada-15) (máx. tope)
  JEFE_ESC:.6           // cada 3 jefes (oleada 20, 25, 30...) el jefe tiene +60 % de salud
};
// Cantidad TOTAL de enemigos por oleada (sin contar al jefe)
const OLEADAS={1:8,2:12,3:16,4:20,5:15,6:25,7:30,8:35,9:40,10:25,11:32,12:36,13:40,14:44,15:35};
const EVENTOS={1:'INVASIÓN INICIAL',2:'MÁS RASTREADORES',3:'APARECEN LOS CAZADORES',4:'ATAQUE COMBINADO',5:'DEVORADOR',
  6:'INVASIÓN INTENSIFICADA',7:'APARECEN LOS ESCUPIDORES',8:'ATAQUE DESDE VARIOS FRENTES',9:'APARECEN LOS EXPLOSIVOS',10:'REINA ÁCIDA',15:'TITÁN'};

// Tipos 0-4: enemigos normales. Tipos 5-7: jefes.
// hp=salud · sp=velocidad · dmg=daño a soldados · rdmg=daño al reactor · rad=tamaño · cd=segundos entre ataques
// desde=primera oleada en que aparece · peso=frecuencia de aparición (más alto = más común)
const TIPOS=[
  {n:'RASTREADOR',hp:20, sp:100,dmg:5, rdmg:1, rad:10,cd:1,  desde:1,peso:w=>10},
  {n:'CAZADOR',   hp:14, sp:175,dmg:6, rdmg:1, rad:9, cd:.7, desde:3,peso:w=>3+.6*(w-3)},
  {n:'ACORAZADO', hp:150,sp:52, dmg:18,rdmg:5, rad:18,cd:1.2,desde:5,peso:w=>1.5+.3*(w-5)},
  {n:'ESCUPIDOR', hp:34, sp:78, dmg:8, rdmg:2, rad:11,cd:2.1,desde:7,peso:w=>2+.3*(w-7),alc:280,pref:235},
  {n:'EXPLOSIVO', hp:24, sp:130,dmg:22,rdmg:12,rad:12,cd:1,  desde:9,peso:w=>2+.25*(w-9),area:70},
  {n:'DEVORADOR',  hp:2000,sp:48,dmg:20,rdmg:5,rad:40,cd:1.3,jefe:1,emb:{cada:10,aviso:1.1,vel:320,dur:1.2,dmg:28,rdmg:10}},
  {n:'REINA ÁCIDA',hp:3200,sp:82,dmg:10,rdmg:3,rad:34,cd:2.4,jefe:1,alc:430,orb:350,inv:{cada:12,n:4}},
  {n:'TITÁN',      hp:6500,sp:30,dmg:38,rdmg:9,rad:56,cd:3.4,jefe:1,area:{r:170,rp:115,aviso:1.5}}
];

// ---------------------------------------------------------------------
//  MAPA: obstáculos sólidos (círculos) y puntos de aparición en los bordes
// ---------------------------------------------------------------------
const OBS=[];
for(let i=0;i<6;i++){const a=i*Math.PI/3+Math.PI/6;OBS.push({x:Math.round(CX+Math.cos(a)*195),y:Math.round(CY+Math.sin(a)*195),r:22})}
[[400,300,36],[1200,300,34],[400,700,34],[1200,700,36],[800,185,28],[800,815,28]].forEach(a=>OBS.push({x:a[0],y:a[1],r:a[2]}));
const FR=[.15,.5,.85]; // 3 puntos de aparición por lado = 12 puntos alrededor del mapa

const R=(a,b)=>a+Math.random()*(b-a);
const say=(r,t)=>io.to(r.id).emit('ev',t);
function newCode(){let c;do{c=Math.random().toString(36).slice(2,6).toUpperCase()}while(rooms[c]);return c}
function newPlayer(role,s){return{role,sock:s.id,tok:Math.random().toString(36).slice(2),x:0,y:0,hp:100,dn:0,ix:0,iy:0,rv:false,rp:0,cd:0,ready:false,on:true}}
function reset(r){
  Object.assign(r,{st:'lobby',wave:0,reactor:100,en:[],cola:[],pj:[],fx:[],sides:[0],avs:1,tw:0,toSpawn:0,sp:0,nx:0,sh:[],kills:0,nid:1,al:0});
  for(const p of Object.values(r.pl)){p.hp=100;p.dn=0;p.rp=0;p.ready=false;p.x=CX+(p.role=='CORONEL'?-80:80);p.y=CY+90}
}
function hurt(r,p,d){
  if(p.hp<=0)return;p.hp-=d;
  if(p.hp<=0){p.hp=0;p.dn=20;p.rp=0;say(r,'¡'+p.role+' HA CAÍDO!')}
}
function dañar(r,d){ // daño al reactor
  r.reactor=Math.max(0,r.reactor-d);
  if(r.al<=0){r.al=8;say(r,'¡EL REACTOR ESTÁ SIENDO ATACADO!')}
}
// sacar a una entidad de dentro de los obstáculos sólidos
function sacar(o,rad){
  for(const b of OBS){const dx=o.x-b.x,dy=o.y-b.y,m=b.r+rad,d=Math.hypot(dx,dy);
    if(d<m){if(d<.001){o.x=b.x+m}else{o.x=b.x+dx/d*m;o.y=b.y+dy/d*m}}}
}

// ---------------------------------------------------------------------
//  OLEADAS
// ---------------------------------------------------------------------
const evento=w=>EVENTOS[w]||(w%5==0?TIPOS[5+(w/5-1)%3].n:'DIFICULTAD CRECIENTE');
function cantidad(w){
  let n=OLEADAS[w]||Math.min(CFG.F16.tope,Math.round(CFG.F16.base*Math.pow(CFG.F16.crec,w-15)));
  if(w>15&&w%5==0)n=Math.round(n*.65); // las oleadas de jefe llevan menos acompañantes
  return n;
}
function elegirTipo(w){
  const ws=TIPOS.slice(0,5).map(T=>w>=T.desde?T.peso(w):0);
  let x=Math.random()*ws.reduce((a,b)=>a+b,0);
  for(let i=0;i<ws.length;i++){x-=ws[i];if(x<=0)return i}
  return 0;
}
// Cola de la oleada: cada elemento = [tipo, multiplicador de salud, multiplicador de daño]
function armarCola(w){
  const c=[];
  for(let i=0;i<cantidad(w);i++)c.push([elegirTipo(w),1,1]);
  if(w%5==0){
    const k=w/5-1,j=k%3,ci=Math.floor(k/3),hm=1+CFG.JEFE_ESC*ci,dm=1+.25*ci;
    const jefes=[[5+j,hm,dm]];
    if(ci>=2)jefes.push([5+(j+1)%3,hm*.7,dm]); // desde la oleada 35: un segundo jefe más débil
    c.unshift(...jefes);
  }
  return c;
}
function planOleada(r){ // elige por cuáles lados llegará la siguiente oleada
  const w=r.wave+1,n=w<4?1:w<8?2:3;
  r.sides=[0,1,2,3].sort(()=>Math.random()-.5).slice(0,n);
}
function startWave(r){
  r.wave++;const w=r.wave;
  r.cola=armarCola(w);r.st='wave';r.sp=w%5==0?2.5:0;r.tw=0;
  say(r,'¡OLEADA '+w+'! '+evento(w)+' — '+(r.sides.length>1?'FRENTES: ':'INVASIÓN POR EL ')+r.sides.map(s=>SIDES[s]).join(', '));
}
function punto(r){ // punto de aparición: lejos de los soldados y del reactor
  const ps=Object.values(r.pl).filter(p=>p.hp>0);let best=null;
  for(let i=0;i<12;i++){
    const side=Math.random()<.8?r.sides[Math.random()*r.sides.length|0]:(Math.random()*4|0),f=FR[Math.random()*3|0]+R(-.05,.05);
    const x=side<2?W*f:(side==2?12:W-12),y=side>=2?H*f:(side==0?12:H-12);
    if(ps.every(p=>Math.hypot(p.x-x,p.y-y)>300))return[x,y];
    best=[x,y];
  }
  return best;
}
function crear(r,t,x,y,hm,dm,inv){
  const T=TIPOS[t],w=r.wave,j=!!T.jefe;
  const sp=j?T.sp*(1+.1*(hm-1)):T.sp*Math.min(CFG.ESC_VEL_MAX,1+CFG.ESC_VEL*(w-1));
  const hp=T.hp*(j?1:Math.min(CFG.ESC_HP_MAX,1+CFG.ESC_HP*(w-1)))*hm;
  const e={id:r.nid++,t,x,y,hp,mx:hp,sp,rad:T.rad,dm,cd:R(0,.6),st:0,stt:0,ec:t==5?6:t==6?5:0,
    sd:Math.random()<.5?-1:1,sm:inv?1:0,hit:0,ax:0,ay:0,ar:0,oa:Math.atan2(y-CY,x-CX),od:Math.random()<.5?-1:1};
  r.en.push(e);return e;
}
function aparecer(r){
  const it=r.cola.shift();if(!it)return;
  const[x,y]=punto(r);crear(r,it[0],x,y,it[1],it[2],false);
  if(TIPOS[it[0]].jefe)say(r,'¡ALERTA! AMENAZA GIGANTE DETECTADA');
}

// ---------------------------------------------------------------------
//  IA ENEMIGA (máquinas de estados sencillas)
// ---------------------------------------------------------------------
// Avanza hacia (tx,ty) rodeando parcialmente los obstáculos que tenga enfrente
function mover(e,tx,ty,v){
  let dx=tx-e.x,dy=ty-e.y;const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;
  let sx=0,sy=0;
  for(const b of OBS){
    const ox=b.x-e.x,oy=b.y-e.y,al=ox*dx+oy*dy;
    if(al<=0||al>e.rad+b.r+90)continue;
    const lat=-ox*dy+oy*dx,lim=b.r+e.rad+8;
    if(Math.abs(lat)<lim){const s=Math.abs(lat)<4?e.sd:(lat>0?-1:1);sx+=-dy*s;sy+=dx*s}
  }
  dx+=sx*1.2;dy+=sy*1.2;const l=Math.hypot(dx,dy)||1;
  e.x+=dx/l*v*DT;e.y+=dy/l*v*DT;
}
function disparar(r,e,tx,ty,spread,dmg,rdmg){
  if(r.pj.length>=CFG.MAX_PROYECTILES)return;
  const a=Math.atan2(ty-e.y,tx-e.x)+spread;
  r.pj.push({id:r.nid++,x:e.x,y:e.y,vx:Math.cos(a)*230,vy:Math.sin(a)*230,dmg,rdmg,vida:2.6});
}
function ia(r,e,ps){
  const T=TIPOS[e.t];e.cd-=DT;e.stt-=DT;e.ec-=DT;
  let pn=null,dn=1e9;
  for(const p of ps)if(p.hp>0){const d=Math.hypot(p.x-e.x,p.y-e.y);if(d<dn){dn=d;pn=p}}
  const dr=Math.hypot(CX-e.x,CY-e.y),dmg=T.dmg*e.dm,rd=T.rdmg*e.dm;
  const cuerpo=()=>{ // perseguir y atacar al soldado más cercano
    if(dn>e.rad+14)mover(e,pn.x,pn.y,e.sp);
    else if(e.cd<=0){e.cd=T.cd;hurt(r,pn,dmg)}
  };
  const reactor=()=>{ // ir hacia el reactor y atacarlo
    if(dr>e.rad+42)mover(e,CX,CY,e.sp);
    else if(e.cd<=0){e.cd=T.cd;dañar(r,rd)}
  };
  switch(e.t){
    case 0:case 2: // Rastreador / Acorazado: al reactor (se defienden si un soldado se acerca)
      if(pn&&dn<(e.t?100:85))cuerpo();else reactor();break;
    case 1: // Cazador: prioriza perseguir soldados
      if(pn&&dn<650)cuerpo();else reactor();break;
    case 3:{ // Escupidor: mantiene distancia y lanza ácido
      const tg=pn&&dn<330?{x:pn.x,y:pn.y,d:dn}:{x:CX,y:CY,d:dr};
      if(tg.d<T.pref-45)mover(e,e.x*2-tg.x,e.y*2-tg.y,e.sp*.85);
      else if(tg.d>T.pref+25)mover(e,tg.x,tg.y,e.sp);
      else mover(e,e.x-(tg.y-e.y)*e.sd,e.y+(tg.x-e.x)*e.sd,e.sp*.35);
      if(tg.d<=T.alc&&e.cd<=0){e.cd=T.cd;disparar(r,e,tg.x,tg.y,0,dmg,rd)}
      break}
    case 4: // Explosivo: corre al reactor y explota
      if(dr<=e.rad+38){e.hp=0;e.sui=1}else mover(e,CX,CY,e.sp);
      break;
    case 5:{ // DEVORADOR: muerde y embiste al reactor
      const E=T.emb;
      if(e.st==0){
        if(pn&&dn<e.rad+130)cuerpo();else reactor();
        if(e.ec<=0&&dr>170){e.st=1;e.stt=E.aviso;e.hit=0}
      }else if(e.st==1){
        if(e.stt<=0){e.st=2;e.stt=E.dur}
      }else if(e.st==2){
        mover(e,CX,CY,E.vel);
        if(!e.hit)for(const p of ps)if(p.hp>0&&Math.hypot(p.x-e.x,p.y-e.y)<e.rad+16){e.hit=1;hurt(r,p,E.dmg*e.dm)}
        if(dr<=e.rad+46){dañar(r,E.rdmg*e.dm);r.fx.push([e.x|0,e.y|0,110,1]);e.st=3;e.stt=1.2;e.ec=E.cada}
        else if(e.stt<=0){e.st=3;e.stt=.9;e.ec=E.cada}
      }else if(e.stt<=0)e.st=0;
      break}
    case 6:{ // REINA ÁCIDA: rodea la base, dispara ácido e invoca
      const en=e.hp<e.mx*.5?1.35:1;
      e.oa+=e.od*.17*en*DT;
      if(e.st==1){
        if(e.stt<=0){
          for(let i=0;i<T.inv.n;i++){
            if(r.en.reduce((a,x)=>a+x.sm,0)>=CFG.MAX_INVOCADOS)break;
            const a=i*Math.PI*2/T.inv.n;crear(r,Math.random()<.35?1:0,e.x+Math.cos(a)*(e.rad+14),e.y+Math.sin(a)*(e.rad+14),1,1,true);
          }
          e.st=0;e.ec=T.inv.cada/en;
        }
      }else{
        mover(e,CX+Math.cos(e.oa+e.od*.5)*T.orb,CY+Math.sin(e.oa+e.od*.5)*T.orb,e.sp*en);
        if(e.cd<=0){
          const tg=pn&&dn<T.alc?pn:null,tx=tg?tg.x:CX,ty=tg?tg.y:CY;
          e.cd=T.cd/en;for(let k=-1;k<=1;k++)disparar(r,e,tx,ty,k*.22,dmg,rd);
        }
        if(e.ec<=0&&r.en.reduce((a,x)=>a+x.sm,0)<CFG.MAX_INVOCADOS){e.st=1;e.stt=.9}
      }
      break}
    case 7:{ // TITÁN: lento, golpes de área anunciados
      const A=T.area;
      if(e.st==0){
        if(dr>130)mover(e,CX,CY,e.sp);
        if(e.cd<=0){
          if(dr<=215){e.ax=e.x;e.ay=e.y;e.ar=A.r;e.st=1;e.stt=A.aviso}
          else if(pn&&dn<330){e.ax=pn.x;e.ay=pn.y;e.ar=A.rp;e.st=1;e.stt=A.aviso}
        }
      }else if(e.stt<=0){
        for(const p of ps)if(p.hp>0&&Math.hypot(p.x-e.ax,p.y-e.ay)<e.ar+14)hurt(r,p,dmg);
        if(Math.hypot(e.ax-CX,e.ay-CY)<e.ar+30)dañar(r,rd);
        r.fx.push([e.ax|0,e.ay|0,e.ar,1]);e.st=0;e.cd=T.cd;
      }
      break}
  }
}
function separar(a){ // evita que los enemigos se amontonen en el mismo punto
  for(let i=0;i<a.length;i++){const p=a[i];
    for(let j=i+1;j<a.length;j++){const q=a[j],m=(p.rad+q.rad)*.85,dx=q.x-p.x,dy=q.y-p.y;
      if(dx>m||dx<-m||dy>m||dy<-m)continue;
      const d=Math.hypot(dx,dy);if(d>=m)continue;
      let nx,ny;if(d<.01){nx=Math.random()-.5;ny=Math.random()-.5;const l=Math.hypot(nx,ny)||1;nx/=l;ny/=l}else{nx=dx/d;ny=dy/d}
      const ov=m-d,tot=p.rad+q.rad,fp=q.rad/tot*.5,fq=p.rad/tot*.5; // los pequeños se apartan más
      p.x-=nx*ov*fp;p.y-=ny*ov*fp;q.x+=nx*ov*fq;q.y+=ny*ov*fq;
    }}
}
function boom(r,x,y,rad,dp,dr,kind){ // explosión de área
  for(const p of Object.values(r.pl))if(p.hp>0&&Math.hypot(p.x-x,p.y-y)<rad+14)hurt(r,p,dp);
  if(Math.hypot(x-CX,y-CY)<rad+34)dañar(r,dr);
  r.fx.push([x|0,y|0,rad,kind]);
}

// ---------------------------------------------------------------------
//  TICK: un paso de simulación de una sala (30 por segundo)
// ---------------------------------------------------------------------
function tick(r){
  const ps=Object.values(r.pl),on=ps.some(p=>p.on);
  if(on)r.seen=Date.now();
  if(r.st=='lobby'){if(ps.length==2&&ps.every(p=>p.ready)){r.st='break';r.nx=5;r.avs=1;planOleada(r);say(r,'PREPÁRENSE, SOLDADOS...')}return}
  if(r.st=='over'||!on)return; // sala terminada, o nadie conectado: la partida se congela
  if(r.st=='break'){
    r.nx-=DT;
    if(!r.avs&&r.nx<=6){r.avs=1;const w=r.wave+1;say(r,w%5==0?'¡SE DETECTA UNA AMENAZA GIGANTE EN CAMINO!':'OLEADA '+w+' EN CAMINO — '+evento(w))}
    if(r.nx<=0)startWave(r);
  }
  r.al-=DT;
  for(const p of ps){
    if(p.hp<=0){ // incapacitado: el compañero lo revive manteniendo 3 s
      p.dn=Math.max(0,p.dn-DT);
      const o=r.pl[p.role=='CORONEL'?'VICKY':'CORONEL'];
      if(p.dn>0&&o&&o.hp>0&&o.rv&&Math.hypot(o.x-p.x,o.y-p.y)<70){p.rp+=DT;if(p.rp>=3){p.hp=50;p.rp=0;p.dn=0;say(r,'¡'+p.role+' REVIVIDO!')}}else p.rp=0;
      continue;
    }
    let ix=p.ix,iy=p.iy;const l=Math.hypot(ix,iy);if(l>1){ix/=l;iy/=l}
    p.x=Math.min(W-20,Math.max(20,p.x+ix*170*DT));p.y=Math.min(H-20,Math.max(20,p.y+iy*170*DT));
    sacar(p,15);
    p.cd-=DT;
    if(p.cd<=0){ // disparo automático al enemigo más cercano (hitscan)
      let b=null,bd=320;
      for(const e of r.en){const d=Math.hypot(e.x-p.x,e.y-p.y)-(e.t>=5?e.rad:0);if(d<bd){bd=d;b=e}}
      if(b){b.hp-=12;p.cd=.14;r.sh.push([p.x|0,p.y|0,b.x|0,b.y|0,p.role=='CORONEL'?0:1])}
    }
  }
  // aparición progresiva (máximo CFG.MAX_ACTIVOS vivos a la vez)
  if(r.st=='wave'){
    r.tw+=DT;
    if(r.cola.length){
      r.sp-=DT;
      if(r.sp<=0){
        if(r.en.reduce((a,e)=>a+(e.sm?0:1),0)<CFG.MAX_ACTIVOS){aparecer(r);r.sp=Math.max(.25,.8-.03*r.wave)}else r.sp=.15;
      }
    }
  }
  for(const e of r.en)ia(r,e,ps);
  separar(r.en);
  for(const e of r.en){sacar(e,e.rad);e.x=Math.min(W-e.rad,Math.max(e.rad,e.x));e.y=Math.min(H-e.rad,Math.max(e.rad,e.y))}
  // proyectiles de ácido
  if(r.pj.length){
    const keep=[];
    for(const q of r.pj){
      q.x+=q.vx*DT;q.y+=q.vy*DT;q.vida-=DT;let muere=q.vida<=0||q.x<0||q.x>W||q.y<0||q.y>H;
      if(!muere)for(const b of OBS)if(Math.hypot(q.x-b.x,q.y-b.y)<b.r+4){muere=true;break}
      if(!muere)for(const p of ps)if(p.hp>0&&Math.hypot(q.x-p.x,q.y-p.y)<20){hurt(r,p,q.dmg);muere=true;r.fx.push([q.x|0,q.y|0,20,2]);break}
      if(!muere&&Math.hypot(q.x-CX,q.y-CY)<36){dañar(r,q.rdmg);muere=true;r.fx.push([q.x|0,q.y|0,20,2])}
      if(!muere)keep.push(q);
    }
    r.pj=keep;
  }
  // muertes (el Explosivo estalla al morir)
  const vivos=[];let jefeCaido=false;
  for(const e of r.en){
    if(e.hp>0){vivos.push(e);continue}
    if(!e.sui)r.kills++;
    if(e.t==4){const T=TIPOS[4];boom(r,e.x,e.y,T.area,T.dmg*e.dm,T.rdmg*e.dm,0)}
    if(TIPOS[e.t].jefe){jefeCaido=true;say(r,'¡'+TIPOS[e.t].n+' ELIMINADO!')}
  }
  r.en=vivos;
  if(jefeCaido)for(const p of ps)if(p.hp>0)p.hp=Math.min(100,p.hp+25);
  // fin de oleada
  if(r.st=='wave'&&r.cola.length==0&&r.en.length==0){
    const boss=r.wave%5==0;
    r.st='break';r.nx=CFG.DESCANSO+(boss?3:0);r.avs=0;r.pj=[];planOleada(r);
    r.reactor=Math.min(100,r.reactor+CFG.REPARO+(boss?CFG.REPARO_JEFE:0));
    say(r,'OLEADA SUPERADA — PREPÁRENSE PARA EL SIGUIENTE ATAQUE');
    for(const p of ps){if(p.hp<=0){p.hp=60;p.dn=0}else p.hp=Math.min(100,p.hp+30)}
  }
  if(r.reactor<=0||(ps.length==2&&ps.every(p=>p.hp<=0))){r.st='over';r.cola=[];r.pj=[];say(r,'REACTOR DESTRUIDO - FIN DE LA PARTIDA')}
}

// Estado agrupado que se envía a los celulares (un solo mensaje por sala, 15 veces por segundo)
// e: [id,tipo,x,y,salud,saludMáx,estado]   pj: [id,x,y]   fx: [x,y,radio,tipo]   tg: [x,y,radio,restante,total]
function snap(r){
  let sd=0;
  if((r.st=='break'&&r.nx<=8)||(r.st=='wave'&&r.tw<5))for(const s of r.sides)sd|=1<<s;
  return{st:r.st,w:r.wave,r:Math.ceil(r.reactor),n:r.en.length+r.cola.length,nx:Math.ceil(r.nx),k:r.kills,
    p:Object.values(r.pl).map(p=>[p.role,p.x|0,p.y|0,p.hp|0,Math.ceil(p.dn),p.ready?1:0,p.on?1:0,+p.rp.toFixed(1)]),
    e:r.en.map(e=>[e.id,e.t,e.x|0,e.y|0,Math.ceil(e.hp),Math.ceil(e.mx),e.st]),
    pj:r.pj.map(q=>[q.id,q.x|0,q.y|0]),
    tg:r.en.filter(e=>e.t==7&&e.st==1).map(e=>[e.ax|0,e.ay|0,e.ar,+Math.max(0,e.stt).toFixed(2),TIPOS[7].area.aviso]),
    sd,sh:r.sh,fx:r.fx};
}
let f=0;
function bucle(){
  f++;
  for(const id in rooms){const r=rooms[id];tick(r);if(f%2==0){io.to(id).emit('s',snap(r));r.sh=[];r.fx=[]}
    if(Date.now()-r.seen>600000){r.en=r.cola=r.pj=r.fx=r.sh=null;delete rooms[id]} // limpiar sala abandonada
  }
}
io.on('connection',s=>{
  let r=null,p=null;
  const bind=(room,pl)=>{r=room;p=pl;s.join(r.id);s.emit('joined',{code:r.id,role:p.role,tok:p.tok,obs:OBS})};
  s.on('create',()=>{
    const id=newCode(),room=rooms[id]={id,pl:{},seen:Date.now()};
    room.pl.CORONEL=newPlayer('CORONEL',s);reset(room);bind(room,room.pl.CORONEL);
  });
  s.on('join',c=>{
    const room=rooms[String(c||'').toUpperCase().trim()];
    if(!room)return s.emit('err','Sala no encontrada');
    if(room.pl.VICKY)return s.emit('err','La sala ya está llena');
    room.pl.VICKY=newPlayer('VICKY',s);reset(room);bind(room,room.pl.VICKY);
  });
  s.on('rejoin',j=>{ // reconexión con el token guardado en el celular
    const room=j&&rooms[j.code],pl=room&&Object.values(room.pl).find(x=>x.tok===j.tok);
    if(!pl)return s.emit('norejoin');
    pl.sock=s.id;pl.on=true;bind(room,pl);
  });
  s.on('ready',()=>{if(p&&r.st=='lobby')p.ready=true});
  s.on('in',i=>{if(!p||!i)return;p.ix=Math.max(-1,Math.min(1,Number(i.x)||0));p.iy=Math.max(-1,Math.min(1,Number(i.y)||0));p.rv=!!i.rv});
  s.on('again',()=>{if(r&&r.st=='over')reset(r)});
  s.on('disconnect',()=>{if(p&&p.sock==s.id){p.on=false;p.ix=p.iy=0;p.rv=false;if(r.st=='lobby')p.ready=false}});
});
if(require.main===module){
  setInterval(bucle,1000/30);
  srv.listen(process.env.PORT||3000,()=>console.log('Servidor listo en puerto '+(process.env.PORT||3000)));
}else module.exports={rooms,reset,newPlayer,tick,snap,CFG,TIPOS,OBS,cantidad,armarCola,startWave,planOleada};
