// OPERACIÓN ÚLTIMA COLONIA - servidor autoritativo (Node + Socket.IO)
const express=require('express'),http=require('http'),{Server}=require('socket.io');
const app=express();app.use(express.static(__dirname+'/public'));
const srv=http.createServer(app),io=new Server(srv);
const W=1600,H=1000,CX=800,CY=500,DT=1/30,rooms={};
const WAVES=[8,12,18,25,20];
const TYPES={s:{sp:120,hp:20,dmg:5,rad:10},g:{sp:65,hp:90,dmg:15,rad:18}};
const SIDES=['NORTE','SUR','OESTE','ESTE'];
const R=(a,b)=>a+Math.random()*(b-a);
const say=(r,t)=>io.to(r.id).emit('ev',t);
const spawnPos=r=>[[0,0],[0,0]];
function newCode(){let c;do{c=Math.random().toString(36).slice(2,6).toUpperCase()}while(rooms[c]);return c}
function newPlayer(role,s){return{role,sock:s.id,tok:Math.random().toString(36).slice(2),x:0,y:0,hp:100,dn:0,ix:0,iy:0,rv:false,rp:0,cd:0,ready:false,on:true}}
function reset(r){
  Object.assign(r,{st:'lobby',wave:0,reactor:100,en:[],toSpawn:0,sp:0,nx:0,sh:[],kills:0,nid:1,al:0,side:0});
  for(const p of Object.values(r.pl)){p.hp=100;p.dn=0;p.rp=0;p.ready=false;p.x=CX+(p.role=='CORONEL'?-80:80);p.y=CY+90}
}
function hurt(r,p,d){
  if(p.hp<=0)return;p.hp-=d;
  if(p.hp<=0){p.hp=0;p.dn=20;p.rp=0;say(r,'¡'+p.role+' HA CAÍDO!')}
}
function startWave(r){
  r.wave++;const n=r.wave<=5?WAVES[r.wave-1]:Math.min(70,Math.round(25*Math.pow(1.2,r.wave-4)));
  r.toSpawn=n;r.st='wave';r.side=Math.random()*4|0;r.sp=0;
  say(r,'¡OLEADA '+r.wave+' INICIADA! ¡INVASIÓN POR EL '+SIDES[r.side]+'!');
}
function spawn(r){
  const side=Math.random()<.7?r.side:(Math.random()*4|0);let x,y;
  if(side==0){x=R(0,W);y=0}else if(side==1){x=R(0,W);y=H}else if(side==2){x=0;y=R(0,H)}else{x=W;y=R(0,H)}
  const t=r.wave>1&&Math.random()<.3?'g':'s',T=TYPES[t],m=1+.12*(r.wave-1);
  r.en.push({id:r.nid++,t,x,y,hp:T.hp*m,sp:T.sp*(1+.03*(r.wave-1)),cd:0});
}
function tick(r){
  const ps=Object.values(r.pl);
  if(ps.some(p=>p.on))r.seen=Date.now();
  if(r.st=='lobby'){if(ps.length==2&&ps.every(p=>p.ready)){r.st='break';r.nx=5;say(r,'PREPÁRENSE, SOLDADOS...')}return}
  if(r.st=='over')return;
  if(r.st=='break'){r.nx-=DT;if(r.nx<=0)startWave(r)}
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
    p.cd-=DT;
    if(p.cd<=0){ // disparo automático al enemigo más cercano (hitscan)
      let b=null,bd=320;
      for(const e of r.en){const d=Math.hypot(e.x-p.x,e.y-p.y);if(d<bd){bd=d;b=e}}
      if(b){b.hp-=12;p.cd=.14;r.sh.push([p.x|0,p.y|0,b.x|0,b.y|0,p.role=='CORONEL'?0:1])}
    }
  }
  if(r.st=='wave'&&r.toSpawn>0){r.sp-=DT;if(r.sp<=0){spawn(r);r.toSpawn--;r.sp=Math.max(.25,.8-.03*r.wave)}}
  for(const e of r.en){
    const T=TYPES[e.t];let tx=CX,ty=CY,tp=null,best=260;
    for(const p of ps)if(p.hp>0){const d=Math.hypot(p.x-e.x,p.y-e.y);if(d<best){best=d;tx=p.x;ty=p.y;tp=p}}
    const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy)||1,reach=T.rad+(tp?14:42);
    e.cd-=DT;
    if(d>reach){e.x+=dx/d*e.sp*DT;e.y+=dy/d*e.sp*DT}
    else if(e.cd<=0){
      e.cd=1;
      if(tp)hurt(r,tp,T.dmg);
      else{r.reactor=Math.max(0,r.reactor-T.dmg/5);if(r.al<=0){r.al=8;say(r,'¡EL REACTOR ESTÁ SIENDO ATACADO!')}}
    }
  }
  const alive=[];for(const e of r.en){if(e.hp>0)alive.push(e);else r.kills++}r.en=alive;
  if(r.st=='wave'&&r.toSpawn==0&&r.en.length==0){
    r.st='break';r.nx=15;say(r,'¡OLEADA SUPERADA!');
    for(const p of ps){if(p.hp<=0){p.hp=60;p.dn=0}else p.hp=Math.min(100,p.hp+30)}
  }
  if(r.reactor<=0||(ps.length==2&&ps.every(p=>p.hp<=0))){r.st='over';say(r,'REACTOR DESTRUIDO - FIN DE LA PARTIDA')}
}
const snap=r=>({st:r.st,w:r.wave,r:Math.ceil(r.reactor),n:r.en.length+r.toSpawn,nx:Math.ceil(r.nx),k:r.kills,
  p:Object.values(r.pl).map(p=>[p.role,p.x|0,p.y|0,p.hp|0,Math.ceil(p.dn),p.ready?1:0,p.on?1:0,+p.rp.toFixed(1)]),
  e:r.en.map(e=>[e.id,e.t=='g'?1:0,e.x|0,e.y|0,e.hp|0]),sh:r.sh});
let f=0;
setInterval(()=>{f++;
  for(const id in rooms){const r=rooms[id];tick(r);if(f%2==0){io.to(id).emit('s',snap(r));r.sh=[]}
    if(Date.now()-r.seen>600000)delete rooms[id]}
},1000/30);
io.on('connection',s=>{
  let r=null,p=null;
  const bind=(room,pl)=>{r=room;p=pl;s.join(r.id);s.emit('joined',{code:r.id,role:p.role,tok:p.tok})};
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
srv.listen(process.env.PORT||3000,()=>console.log('Servidor listo en puerto '+(process.env.PORT||3000)));
