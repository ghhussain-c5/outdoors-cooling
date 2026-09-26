/* Orthographic scene renderer. All objects are model geometry, with no external assets or libraries. */
(function(root){
  'use strict';
  const E=root.LabEngine;
  class ParkScene {
    constructor(canvas,onSelect,onProbe){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onSelect=onSelect;this.onProbe=onProbe;this.yaw=-.42;this.pitch=.70;this.zoom=1;this.hits=[];this.drag=null;this.t=0;this.needs=true;
      new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;const d=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);this.ctx.setTransform(d,0,0,d,0,0);this.needs=true;}).observe(canvas);
      canvas.addEventListener('pointerdown',e=>{this.drag={x:e.offsetX,y:e.offsetY,yaw:this.yaw,moved:false};if(e.pointerType==='mouse')canvas.setPointerCapture(e.pointerId);});
      canvas.addEventListener('pointermove',e=>{if(this.drag&&this.state?.view!=='plan'&&e.pointerType==='mouse'){const dx=e.offsetX-this.drag.x;if(Math.abs(dx)>5)this.drag.moved=true;this.yaw=this.drag.yaw+dx*.006;this.needs=true;}else this.probe(e.offsetX,e.offsetY);});
      canvas.addEventListener('pointerup',e=>{if(this.drag&&!this.drag.moved)this.pick(e.offsetX,e.offsetY);this.drag=null;});
      canvas.addEventListener('pointerleave',()=>{this.drag=null;this.onProbe(null);});
      canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','+','-'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')this.yaw-=.15;if(e.key==='ArrowRight')this.yaw+=.15;if(e.key==='+')this.zoom=E.clamp(this.zoom+.1,.65,1.6);if(e.key==='-')this.zoom=E.clamp(this.zoom-.1,.65,1.6);this.needs=true;}});
      const animate=(time)=>{this.t=time/1000;if(this.state&&(!document.hidden)&&(this.needs||this.state.showFlows&&this.result.active>0)){this.draw();this.needs=false;}this.frame=requestAnimationFrame(animate);};requestAnimationFrame(animate);
    }
    update(s,g,r,f){this.state=s;this.geo=g;this.result=r;this.field=f;this.needs=true;}
    projection(){const s=this.state;this.cy=s.depth*.48;this.cx=s.width*.48;this.angle=s.view==='plan'?0:this.yaw;this.elev=s.view==='plan'?Math.PI/2:this.pitch;this.co=Math.cos(this.angle);this.si=Math.sin(this.angle);this.sn=Math.sin(this.elev);this.cs=Math.cos(this.elev);
      const projW=Math.abs(s.width*this.co)+Math.abs(s.depth*this.si),projD=Math.abs(s.width*this.si)+Math.abs(s.depth*this.co);this.scale=Math.min((this.w-125)/projW,(this.h-130)/(projD*this.sn+s.height*this.cs+2))*this.zoom;this.ox=this.w*.54;this.oy=this.h*.56;
    }
    P(x,y,z=0){x-=this.cx;y-=this.cy;return {x:this.ox+(x*this.co-y*this.si)*this.scale,y:this.oy-(x*this.si+y*this.co)*this.sn*this.scale-z*this.cs*this.scale};}
    unproject(px,py){const a=(px-this.ox)/this.scale,b=-(py-this.oy)/(this.sn*this.scale);return {x:this.cx+a*this.co+b*this.si,y:this.cy-a*this.si+b*this.co};}
    path(points){const c=this.ctx;c.beginPath();points.forEach((p,i)=>{const q=this.P(...p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.closePath();}
    polygon(points,fill,stroke,width=.8){const c=this.ctx;this.path(points);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
    line(a,b,color,width=1,dash=[]){const c=this.ctx,p=this.P(...a),q=this.P(...b);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);}
    label(x,y,z,text,color='#bfd5df',size=10,bg=false){const c=this.ctx,p=this.P(x,y,z);c.font=`${size}px ui-monospace,monospace`;c.textAlign='center';if(bg){const w=c.measureText(text).width+12;c.fillStyle='#102532d9';c.fillRect(p.x-w/2,p.y-13,w,20);}c.fillStyle=color;c.fillText(text,p.x,p.y);}
    queuePoly(points,fill,stroke,width=0.8){const d=points.reduce((s,p)=>s+(p[0]-this.cx)*this.si+(p[1]-this.cy)*this.co-p[2]*.4,0)/points.length;this.queue.push({d,draw:()=>this.polygon(points,fill,stroke,width)});}
    queueLine(a,b,color,width=2){const d=((a[0]+b[0])/2-this.cx)*this.si+((a[1]+b[1])/2-this.cy)*this.co-(a[2]+b[2])*.2;this.queue.push({d,draw:()=>this.line(a,b,color,width)});}
    box(x,y,z,w,d,h,colors){const p=[[x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y+d/2,z],[x-w/2,y+d/2,z]],top=p.map(v=>[v[0],v[1],v[2]+h]);
      for(let i=0;i<4;i++)this.queuePoly([p[i],p[(i+1)%4],top[(i+1)%4],top[i]],colors[i%2],colors[3]||'#294a56',.7);this.queuePoly(top,colors[2],colors[3]||'#426775',.8);return top;}
    heat(t,min,max){const f=E.clamp((t-min)/(max-min||1),0,1),stops=[[42,196,211],[137,204,169],[244,207,112],[232,139,83]],j=Math.min(2,Math.floor(f*3)),a=f*3-j;return `rgb(${stops[j].map((v,k)=>Math.round(v*(1-a)+stops[j+1][k]*a)).join(',')})`;}
    draw(){if(!this.w||!this.geo)return;const c=this.ctx,s=this.state,g=this.geo,r=this.result,f=this.field;this.projection();this.hits=[];this.queue=[];
      const day=E.clamp((r.sun.elevation+7)/30,0,1),grad=c.createLinearGradient(0,0,0,this.h);grad.addColorStop(0,day>.1?'#244956':'#0c1b30');grad.addColorStop(1,day>.1?'#142d3b':'#0c1c2a');c.fillStyle=grad;c.fillRect(0,0,this.w,this.h);
      // Fine workspace grid remains spatially anchored as the view turns.
      for(let x=-25;x<s.width+25;x+=2)this.line([x,-20,-.35],[x,s.depth+20,-.35],day>.1?'#3d61762c':'#30456320');
      for(let y=-25;y<s.depth+25;y+=2)this.line([-20,y,-.35],[s.width+20,y,-.35],day>.1?'#3d61762c':'#30456320');
      this.sky(day);
      const lower=g.poly.map(p=>[...p,-.35]);this.polygon(lower,'#091c29','#527681',1);
      for(let i=0;i<g.poly.length;i++){const a=g.poly[i],b=g.poly[(i+1)%g.poly.length];this.polygon([[...a,0],[...b,0],[...b,-.35],[...a,-.35]],'#40565b','#46606a',.6);}
      this.polygon(g.poly.map(p=>[...p,0]),day>.1?'#a5b6ae':'#435a63','#d0d9cf',1.6);
      c.save();this.path(g.poly.map(p=>[...p,.005]));c.clip();
      if(s.layer!=='scene'&&f){for(let j=0;j<f.ny;j++)for(let i=0;i<f.nx;i++){const k=j*f.nx+i;if(!f.mask[k])continue;const x=i*f.dx,y=j*f.dy;
        let T,min,max;if(s.layer==='temperature'){T=r.w.temp-f.field[k]*r.coil.delta;min=r.w.temp-Math.max(1,f.maxDrop);max=r.w.temp;}else{const sh=r.shade.polys.some(p=>E.inside(x+f.dx/2,y+f.dy/2,p))||(r.sun.z>0&&g.trees.some(t=>{const gx=t.x-t.z*r.sun.x/r.sun.z,gy=t.y-t.z*r.sun.y/r.sun.z;return Math.hypot(x-gx,y-gy)<t.r;}));T=sh?r.mrtShade:r.mrtSun;min=r.mrtShade;max=Math.max(min+1,r.mrtSun);}
        this.polygon([[x,y,.01],[x+f.dx+.02,y,.01],[x+f.dx+.02,y+f.dy+.02,.01],[x,y+f.dy+.02,.01]],this.heat(T,min,max));}
      }else{
        for(let x=0;x<s.width;x+=1.5)this.line([x,0,.01],[x,s.depth,.01],'#e6eee337',.5);for(let y=0;y<s.depth;y+=1.5)this.line([0,y,.01],[s.width,y,.01],'#e6eee337',.5);
        // Union shadow path prevents darkening twice where modules overlap.
        c.beginPath();for(const poly of r.shade.polys){poly.forEach((p,i)=>{const q=this.P(...p,.02);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.closePath();}c.fillStyle='#172d4185';c.fill();
        if(r.sun.z>.025)for(const t of g.trees){const tx=t.x-t.z*r.sun.x/r.sun.z,ty=t.y-t.z*r.sun.y/r.sun.z;const pts=Array.from({length:24},(_,i)=>{const a=i/24*2*Math.PI,az=Math.atan2(r.sun.y,r.sun.x),major=t.r/r.sun.z;return [tx+Math.cos(a)*major*Math.cos(az)-Math.sin(a)*t.r*Math.sin(az),ty+Math.cos(a)*major*Math.sin(az)+Math.sin(a)*t.r*Math.cos(az),.025];});this.polygon(pts,'#143d364e');}
      }c.restore();
      // Six fixed exercise stations, 2.4 m high, deliberately schematic.
      for(const u of g.gym)this.gym(u);
      // Canopy post bases and structural rails.
      for(const p of g.posts){this.box(p.x,p.y,0,.33,.33,.16,['#536361','#677572','#879592','#a7bab2']);if(s.showCanopy)this.box(p.x,p.y,.16,.14,.14,s.height-.16,['#596e75','#82949b','#c1cfcc','#abbeba']);}
      if(s.showCanopy){for(let row=0;row<s.strips;row++){const pp=g.panels.filter(p=>p.row===row);if(!pp.length)continue;this.queueLine([pp[0].x-g.panel.length/2,pp[0].y,s.height-.10],[pp.at(-1).x+g.panel.length/2,pp[0].y,s.height-.10],'#bdd2d0',3);}
        for(const p of g.panels){const coords=p.corners;this.queuePoly(coords,day>.1?'#163751':'#193043',s.selected==='solar'?'#68ced5':'#7396aa',1.15);
          const a=coords[0],b=coords[1],d=coords[3];for(let i=1;i<6;i++){const tt=i/6;this.queueLine([a[0]+(b[0]-a[0])*tt,a[1],a[2]+.004],[d[0]+(b[0]-a[0])*tt,d[1],d[2]+.004],'#528297',.45);}
          for(let j=1;j<3;j++){const tt=j/3;this.queueLine([a[0],a[1]+(d[1]-a[1])*tt,a[2]+(d[2]-a[2])*tt+.004],[b[0],b[1]+(d[1]-a[1])*tt,b[2]+(d[2]-a[2])*tt+.004],'#528297',.45);}
          this.hits.push({type:'solar',poly:coords.map(v=>this.P(...v)),depth:p.y});}}
      for(const [i,u] of g.dxUnits.entries()){const active=i<r.active,dx=g.dx.id.startsWith('daikin')?1.3:.70,dy=g.dx.id.startsWith('daikin')?1.1:.6;
        this.box(u.x-.45,u.y,0,dx,dy,.9,['#31515d','#486976','#aac3c7',active?'#7ce4e1':'#536b76']);
        for(let j=0;j<5;j++)this.queueLine([u.x-.45-dx/2+.08,u.y-dy/2-.01,.18+j*.105],[u.x-.45+dx/2-.08,u.y-dy/2-.01,.18+j*.105],active?'#96d5d7':'#748c98',1);
        this.queueLine([u.x-.1,u.y,.65],[u.x,u.y,1.3],'#9db3b9',5);
        const end=[u.x+.36*Math.cos(u.angle),u.y+.36*Math.sin(u.angle),1.3];this.queueLine([u.x,u.y,1.3],end,active?'#67f0ed':'#718e95',7);
        const pt=this.P(u.x-.4,u.y,.6);this.hits.push({type:'dx',point:pt,radius:23});
      }
      for(const inv of g.invUnits){this.box(inv.x,inv.y,0,.55,.28,1.15,['#956e46','#b99569','#decaa2',s.selected==='inverter'?'#ffd08d':'#9c947e']);const p=this.P(inv.x,inv.y,1.0);this.hits.push({type:'inverter',point:p,radius:19});}
      for(const tree of g.trees)this.tree(tree,day);
      this.queue.sort((a,b)=>b.d-a.d);for(const primitive of this.queue)primitive.draw();
      if(s.showFlows&&r.active>0)this.flowParticles();
      // Clear labels are independently selectable, even if a canopy occludes equipment.
      if(g.panels.length){const p=g.panels[Math.min(2,g.panels.length-1)];this.callout(p.x,p.y,s.height+.1,`${g.panels.length} PV MODULES`,'solar','#74e4d3',-25,-28);}
      if(g.dxUnits.length){const u=g.dxUnits[0];this.callout(u.x,u.y,1.2,`${r.active} / ${s.dxCount} DX ACTIVE`,'dx','#93e5f5',22,35);}
      if(g.invUnits.length){const v=g.invUnits[0];this.callout(v.x,v.y,1.1,`${s.inverterCount} INVERTER${s.inverterCount>1?'S':''}`,'inverter','#eeca8d',-25,28);}
      this.dimension([0,-.85,0],[s.width*21.068/28.602016,-.85,0],`${(s.width*21.068/28.602016).toFixed(2)} m`);
      this.compass();
    }
    sky(day){const c=this.ctx,r=this.result;const p={x:this.w*.5+Math.sin((r.sun.azimuth-180)*Math.PI/180)*this.w*.34,y:65+55*(1-Math.max(0,r.sun.z))};
      if(r.sun.elevation>0){const glow=c.createRadialGradient(p.x,p.y,2,p.x,p.y,55);glow.addColorStop(0,'#ffd48530');glow.addColorStop(1,'#ffd48500');c.fillStyle=glow;c.fillRect(p.x-55,p.y-55,110,110);c.fillStyle='#f8d290';c.beginPath();c.arc(p.x,p.y,9,0,Math.PI*2);c.fill();c.strokeStyle='#f5d39488';c.lineWidth=1;for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(p.x+14*Math.cos(a),p.y+14*Math.sin(a));c.lineTo(p.x+19*Math.cos(a),p.y+19*Math.sin(a));c.stroke();}}
      else{const x=this.w*.72,y=88;c.fillStyle='#cee2ed';c.beginPath();c.arc(x,y,12,0,Math.PI*2);c.fill();c.fillStyle='#102337';c.beginPath();c.arc(x+5,y-4,11,0,Math.PI*2);c.fill();for(let i=0;i<22;i++){const a=(i*173)%Math.floor(this.w),b=43+(i*79)%90;c.fillStyle='#b5d2df77';c.fillRect(a,b,1,1);}}
    }
    gym(u){const {x,y,type}=u;this.queuePoly([[x-1,y-.75,.03],[x+1,y-.75,.03],[x+1,y+.75,.03],[x-1,y+.75,.03]],'#293e4670','#718a8980',.7);
      const top=type===3?1.15:2.25;for(const a of [-.72,.72])this.queueLine([x+a,y,0],[x+a,y,top],'#e3a268',4);this.queueLine([x-.72,y,top],[x+.72,y,top],'#e7b982',3);
      if(type%3===0){for(let i=1;i<4;i++)this.queueLine([x-.72,y,i*.45],[x+.72,y,i*.45],'#d9ad81',2);}else if(type%3===1){this.queueLine([x-.35,y,top],[x-.35,y,1.45],'#708991',1);this.queueLine([x+.35,y,top],[x+.35,y,1.45],'#708991',1);for(const dx of [-.35,.35]){const pts=Array.from({length:12},(_,i)=>[x+dx+.13*Math.cos(i*Math.PI/6),y,1.35+.13*Math.sin(i*Math.PI/6)]);this.queuePoly(pts,null,'#efc196',2);}}else{this.queueLine([x+.72,y,0],[x+.72,y+.9,1.0],'#dda16d',3);}}
    tree(t,day){this.box(t.x,t.y,0,.20,.20,t.z,['#4e6054','#66725c','#809073','#698170']);const rings=[{z:t.z-t.r*.6,r:t.r*.72},{z:t.z+.05,r:t.r},{z:t.z+t.r*.7,r:t.r*.62},{z:t.z+t.r,r:.01}];const palette=day>.1?['#417c6b','#539079','#365f52','#70a383']:['#284f4d','#315e56','#23413d','#467765'];
      for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4,A=rings[j],B=rings[j+1];this.queuePoly([[t.x+Math.cos(a)*A.r,t.y+Math.sin(a)*A.r,A.z],[t.x+Math.cos(b)*A.r,t.y+Math.sin(b)*A.r,A.z],[t.x+Math.cos(b)*B.r,t.y+Math.sin(b)*B.r,B.z],[t.x+Math.cos(a)*B.r,t.y+Math.sin(a)*B.r,B.z]],palette[(i+j)%4],null);}}
    flowParticles(){const c=this.ctx,g=this.geo,r=this.result,s=this.state,f=this.field;if(!f)return;for(let u=0;u<r.active;u++){const src=g.dxUnits[u];for(let k=0;k<18;k++){let x=src.x,y=src.y;const age=(this.t*.48+k/18)%1,d=age*10.5,spread=Math.sin(k*23)*(.1+.065*d);const cx=Math.cos(src.angle),cy=Math.sin(src.angle);x+=d*cx-spread*cy;y+=d*cy+spread*cx;const from=s.windDir*Math.PI/180,hd=s.heading*Math.PI/180,ex=-Math.sin(from),ey=-Math.cos(from);x+=(ex*Math.cos(hd)+ey*Math.sin(hd))*s.wind*d*.12;y+=(-ex*Math.sin(hd)+ey*Math.cos(hd))*s.wind*d*.12;if(!E.inside(x,y,g.poly))continue;const p=this.P(x,y,1.3);c.globalAlpha=(1-age)*.7;c.strokeStyle='#a0ffff';c.lineWidth=1.3;c.beginPath();c.moveTo(p.x,p.y);const q=this.P(x+.16*cx,y+.16*cy,1.3);c.lineTo(q.x,q.y);c.stroke();}}c.globalAlpha=1;}
    callout(x,y,z,label,type,color,dx,dy){const c=this.ctx,p=this.P(x,y,z),cx=p.x+dx,cy=p.y+dy;c.font='10px ui-monospace,monospace';const w=c.measureText(label).width+16;
      if(cx-w/2<5||cx+w/2>this.w-5||cy<65||cy>this.h-94)return;
      c.strokeStyle=color+'88';c.lineWidth=.7;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(cx,cy);c.stroke();c.fillStyle='#112b38ed';c.fillRect(cx-w/2,cy-13,w,22);c.strokeStyle=color+'88';c.strokeRect(cx-w/2,cy-13,w,22);c.fillStyle=color;c.textAlign='center';c.fillText(label,cx,cy+1);this.hits.push({type,point:{x:cx,y:cy-2},rect:{w,h:24}});}
    dimension(a,b,text){this.line(a,b,'#c6ded694',.7);this.line([a[0],a[1]-.15,0],[a[0],a[1]+.15,0],'#c6ded6',1);this.line([b[0],b[1]-.15,0],[b[0],b[1]+.15,0],'#c6ded6',1);this.label((a[0]+b[0])/2,a[1]-.45,0,text,'#d6e8e2',10);}
    compass(){const c=this.ctx,x=this.w-42,y=117,a=-this.angle+this.state.heading*Math.PI/180;c.save();c.translate(x,y);c.strokeStyle='#93b2c0';c.lineWidth=1;c.beginPath();c.arc(0,0,18,0,Math.PI*2);c.stroke();c.rotate(a);c.fillStyle='#70e2c7';c.beginPath();c.moveTo(0,-15);c.lineTo(-4,5);c.lineTo(0,2);c.lineTo(4,5);c.closePath();c.fill();c.rotate(-a);c.font='10px ui-monospace,monospace';c.textAlign='center';c.fillStyle='#cee2e6';c.fillText('N',0,-25);c.restore();}
    pick(x,y){for(let i=this.hits.length-1;i>=0;i--){const h=this.hits[i];const hit=h.poly?E.inside(x,y,h.poly.map(p=>[p.x,p.y])):h.rect?Math.abs(x-h.point.x)<h.rect.w/2&&Math.abs(y-h.point.y)<h.rect.h/2:Math.hypot(x-h.point.x,y-h.point.y)<h.radius;if(hit){this.onSelect(h.type);return;}}this.probe(x,y);}
    probe(x,y){if(!this.field||!this.state)return;const p=this.unproject(x,y);if(!E.inside(p.x,p.y,this.geo.poly)){this.onProbe(null);return;}const data=this.field.sample(p.x,p.y);this.onProbe({px:x,py:y,...p,...data});}
  }
  root.ParkScene=ParkScene;
})(window);
