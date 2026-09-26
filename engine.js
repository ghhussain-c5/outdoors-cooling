/* Deterministic engineering model. SI units unless explicitly stated.
   The transport solver is a 2-D passive-scalar finite-volume approximation.
   It does NOT solve Navier–Stokes, obstacles, buoyancy or a validated CFD model. */
(function(root){
  'use strict';
  const D=root.LAB_DATA, rad=Math.PI/180, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const base=[[0,0],[21.068,0],[28.602016,16.156749],[27.780016,17.580495],[20.335893,20.740337],[11.602062,17.283656],[0,5.016]];
  const defaults={time:13,profile:'sep',manual:false,temp:38,rh:60,wind:1.2,windDir:330,sky:0.85,
    width:28.602016,depth:20.740337,heading:0,treeHeight:4,trees:5,panelId:'jinko580',panelCount:35,strips:5,height:4.5,tilt:10,soiling:8,
    dxId:'fral40',dxCount:4,inverterId:'deye12',inverterCount:2,solarOnly:false,start:9,end:21,
    adp:12,bypass:0.12,derate:1.0,powerRise:1.5,outletArea:0.12,mix:0.35,mixHeight:2,pf:0.9,dcVoltage:550,
    panelPrice:70,dxPrice:1600,inverterPrice:605,steelRate:30,footingRate:65,pvLabor:12,dxLabor:180,inverterLabor:100,wiringRate:45,drainRate:65,design:650,shipping:300,contingency:10,tax:10,
    tariff:0.022,exportTariff:0,days:300,pvMaint:3,dxMaint:100,invMaint:30,cleaning:1.5,visits:4,years:15,discount:5,
    selected:'solar',layer:'scene',view:'iso',playing:false,showFlows:true,showCanopy:true};
  function area(poly){return Math.abs(poly.reduce((a,p,i)=>{const q=poly[(i+1)%poly.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2;}
  function inside(x,y,p){let ok=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])ok=!ok;}return ok;}
  function sat(t){return 0.61094*Math.exp(17.625*t/(t+243.04));}
  function humidity(t,rh){const pv=sat(t)*clamp(rh,0,100)/100;return 0.621945*pv/(101.325-pv);}
  function relative(t,w){return clamp(100*(101.325*w/(0.621945+w))/sat(t),0,100);}
  function enthalpy(t,w){return 1.006*t+w*(2501+1.86*t);}
  function dryMass(t,w,vol){return vol/(0.287042*(t+273.15)*(1+1.607858*w)/101.325);}
  function dewpoint(t,rh){const a=Math.log(Math.max(0.0001,rh/100))+17.625*t/(243.04+t);return 243.04*a/(17.625-a);}
  function weather(s,time=s.time){const p=D.weather.find(x=>x.id===s.profile)||D.weather[0];
    // Representative cycle: mean daily minimum at 05:00, maximum at 15:00.
    const h=((time-5)%24+24)%24,f=h<=10?(1-Math.cos(Math.PI*h/10))/2:(1+Math.cos(Math.PI*(h-10)/14))/2;
    return {temp:s.manual?s.temp:p.min+(p.max-p.min)*f,rh:s.manual?s.rh:p.rhMax-(p.rhMax-p.rhMin)*f,wind:s.wind,profile:p};}
  function sun(s,time=s.time){const date=new Date((D.weather.find(x=>x.id===s.profile)||D.weather[0]).date+'T12:00:00Z');
    const n=Math.floor((date-Date.UTC(date.getUTCFullYear(),0,0))/86400000),g=2*Math.PI/365*(n-1+(time-12)/24);
    const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
    const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
    const lat=26.257*rad,H=(time*60+eq+4*50.611-180)/4*rad-Math.PI;
    const east=-Math.cos(dec)*Math.sin(H),north=Math.cos(lat)*Math.sin(dec)-Math.sin(lat)*Math.cos(dec)*Math.cos(H),up=Math.sin(lat)*Math.sin(dec)+Math.cos(lat)*Math.cos(dec)*Math.cos(H);
    const heading=s.heading*rad,x=east*Math.cos(heading)+north*Math.sin(heading),y=-east*Math.sin(heading)+north*Math.cos(heading),elevation=Math.asin(clamp(up,-1,1))/rad;
    const azimuth=(Math.atan2(east,north)/rad+360)%360,solarNoon=(720-eq-4*50.611+180)/60;
    const ha=Math.acos(clamp(-Math.tan(lat)*Math.tan(dec),-1,1))/rad/15;
    // Clear-sky envelope, not measured radiation. sky is an editable atmospheric factor.
    const ghi=up>0?1098*up*Math.exp(-0.059/Math.max(up,0.02))*s.sky:0;
    const diffuse=ghi*0.18,dni=up>0?0.82*ghi/Math.max(up,0.02):0;
    return {x,y,z:up,elevation,azimuth,ghi,dni,diffuse,solarNoon,sunrise:solarNoon-ha,sunset:solarNoon+ha};}
  function layout(s){const poly=base.map(p=>[p[0]*s.width/28.602016,p[1]*s.depth/20.740337]);
    const panel=D.panels.find(p=>p.id===s.panelId),dx=D.dx.find(p=>p.id===s.dxId),inverter=D.inverters.find(p=>p.id===s.inverterId);
    const treeSeeds=[[0.05,0.14],[0.36,0.86],[0.63,0.98],[0.93,0.87],[0.94,0.54],[0.21,0.67],[0.74,0.06],[0.09,0.40]];
    const trees=treeSeeds.slice(0,s.trees).map(p=>({x:p[0]*s.width,y:p[1]*s.depth,z:s.treeHeight*0.72,r:s.treeHeight*0.35}));
    const rows=[],panels=[],posts=[],dy=panel.width*Math.cos(s.tilt*rad),dz=panel.width*Math.sin(s.tilt*rad),pitch=panel.length+0.10;
    for(let row=0;row<s.strips;row++){const y=1.3+(s.depth-2.6)*(row+0.5)/s.strips,candidates=[];
      for(let x=1;x+panel.length<s.width-0.5;x+=pitch){const coords=[[x,y-dy/2],[x+panel.length,y-dy/2],[x+panel.length,y+dy/2],[x,y+dy/2]];
        const collision=trees.some(t=>Math.hypot(x+panel.length/2-t.x,y-t.y)<t.r+0.5&&s.height<s.treeHeight+0.4);
        if(coords.every(p=>inside(p[0],p[1],poly))&&!collision)candidates.push({x:x+panel.length/2,y,row,corners:coords.map((p,i)=>[p[0],p[1],s.height+(i<2?-dz/2:dz/2)])});
      }rows.push(candidates);
    }
    // Fill all strips evenly before adding another module to each strip.
    for(let col=0;col<100;col++){let more=false;for(const row of rows){if(row[col]){more=true;if(panels.length<s.panelCount)panels.push(row[col]);}}if(!more)break;}
    for(let row=0;row<s.strips;row++){const items=panels.filter(p=>p.row===row);if(!items.length)continue;const min=Math.min(...items.map(p=>p.x))-panel.length/2,max=Math.max(...items.map(p=>p.x))+panel.length/2;
      const spans=Math.max(1,Math.ceil((max-min)/5));for(let j=0;j<=spans;j++)posts.push({x:min+(max-min)*j/spans,y:items[0].y,z:s.height,row});}
    const dxUnits=[];
    for(let i=0;i<s.dxCount;i++){const side=i%2,ratio=(Math.floor(i/2)+1)/(Math.ceil(s.dxCount/2)+1),target={x:s.width*(0.16+ratio*0.62),y:s.depth*(side?0.70:0.17)};
      const used=dxUnits.map(p=>p.postIndex);
      let closest=-1,dist=Infinity;posts.forEach((p,idx)=>{if(used.includes(idx))return;const dd=Math.hypot(p.x-target.x,p.y-target.y);if(dd<dist){closest=idx;dist=dd;}});
      const p=closest>=0?posts[closest]:target;
      // Outlets face inward. Equipment is at ground level beside supports.
      const cx=s.width*.52,cy=s.depth*.48,angle=Math.atan2(cy-p.y,cx-p.x);
      dxUnits.push({x:p.x,y:p.y,z:1.3,angle,postIndex:closest,index:i});
    }
    const gym=[[.23,.25],[.40,.26],[.58,.27],[.36,.48],[.54,.53],[.70,.59]].map((p,i)=>({x:p[0]*s.width,y:p[1]*s.depth,type:i}));
    const invUnits=Array.from({length:s.inverterCount},(_,i)=>({x:2.8+i*1.1,y:0.75,z:0.8}));
    return {poly,area:area(poly),panel,dx,inverter,panels,posts,trees,dxUnits,gym,invUnits,maxPanels:rows.reduce((n,r)=>n+r.length,0)};
  }
  function treeBlocks(x,y,z,t,ss){if(ss.z<=0)return false;const vx=t.x-x,vy=t.y-y,vz=t.z-z,d=vx*ss.x+vy*ss.y+vz*ss.z;return d>0&&vx*vx+vy*vy+vz*vz-d*d<t.r*t.r;}
  function shadowPolys(g,ss){return ss.z>0.025?g.panels.map(p=>p.corners.map(c=>[c[0]-c[2]*ss.x/ss.z,c[1]-c[2]*ss.y/ss.z])):[];}
  function shading(s,g,ss){const shadows=shadowPolys(g,ss),step=0.6;let count=0,pv=0,tree=0,union=0;
    for(let y=step/2;y<s.depth;y+=step)for(let x=step/2;x<s.width;x+=step){if(!inside(x,y,g.poly))continue;count++;const a=shadows.some(p=>inside(x,y,p)),b=ss.z>0.025&&g.trees.some(t=>treeBlocks(x,y,0,t,ss));pv+=a;tree+=b;union+=(a||b);}
    return {pv:count?pv/count:0,tree:count?tree/count:0,union:count?union/count:0,polys:shadows};}
  function pvPower(s,g,w,ss){const beta=s.tilt*rad,inc=Math.max(0,-ss.y*Math.sin(beta)+ss.z*Math.cos(beta));
    let unblocked=0;for(const p of g.panels){let rays=0;for(const c of p.corners)if(!g.trees.some(t=>treeBlocks(c[0],c[1],c[2]+.01,t,ss)))rays++;unblocked+=rays/4;}
    const treeFactor=g.panels.length?unblocked/g.panels.length:1;
    // Conservative row shadow factor using upstream panel-center ray-plane intersections.
    let rowClear=0;for(const p of g.panels){let blocked=false;if(ss.z>0.025){for(const other of g.panels){if(other.row===p.row)continue;
      const denom=ss.z-ss.y*Math.tan(beta);if(Math.abs(denom)<1e-5)continue;
      const u=((p.y-other.y)*Math.tan(beta))/denom;
      if(u>0.02){const x=p.x+u*ss.x,y=p.y+u*ss.y;if(Math.abs(x-other.x)<g.panel.length/2&&Math.abs(y-other.y)<g.panel.width*Math.cos(beta)/2){blocked=true;break;}}}}
      if(!blocked)rowClear++;}
    const rowFactor=g.panels.length?rowClear/g.panels.length:1;
    const poa=ss.z>0?(ss.dni*inc*treeFactor*rowFactor+ss.diffuse*(1+Math.cos(beta))/2+0.2*ss.ghi*(1-Math.cos(beta))/2):0;
    const cell=w.temp+(g.panel.noct-20)/800*poa;
    const dc=Math.max(0,g.panels.length*g.panel.watts/1000*poa/1000*(1+g.panel.gamma*(cell-25))*(1-s.soiling/100)*0.98);
    const maxAC=s.inverterCount*g.inverter.kw,ac=Math.min(maxAC,dc*g.inverter.eff),loss=dc*(1-g.inverter.eff),clipping=Math.max(0,dc*g.inverter.eff-maxAC);
    return {dc,ac,cell,poa,treeFactor,rowFactor,loss,clipping,nameplate:g.panels.length*g.panel.watts/1000,maxAC};}
  function coil(s,g,w){const win=humidity(w.temp,w.rh),hin=enthalpy(w.temp,win),mdry=dryMass(w.temp,win,g.dx.flow/3600);
    const maxQ=g.dx.cooling*clamp(1-s.derate/100*Math.max(0,w.temp-35),0.3,1.1);
    const targetT=Math.min(s.adp,w.temp),wadp=Math.min(win,humidity(targetT,100)),hadp=enthalpy(targetT,wadp);
    const q=Math.max(0,Math.min(maxQ,mdry*(hin-hadp)*(1-s.bypass)));
    const fraction=hin>hadp?q/(mdry*(hin-hadp)):0,hout=hin-q/mdry;
    let wout=win-fraction*(win-wadp),tout=(hout-2501*wout)/(1.006+1.86*wout);
    // A mixed ADP state can supersaturate at very high inlet RH. Project onto
    // the saturation curve at the same enthalpy; condensed liquid heat is neglected.
    if(wout>humidity(tout,100)){let lo=targetT,hi=w.temp;for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(enthalpy(mid,humidity(mid,100))>hout)hi=mid;else lo=mid;}tout=(lo+hi)/2;wout=Math.min(win,humidity(tout,100));}
    const water=mdry*Math.max(0,win-wout)*3600;
    const sensible=mdry*(1.006+1.86*wout)*Math.max(0,w.temp-tout);
    const power=g.dx.power*(1+s.powerRise/100*Math.max(0,w.temp-35));
    return {win,wout,hin,hout,mdry,tout,rhout:relative(tout,wout),water,q,sensible,latent:q-sensible,power,delta:w.temp-tout,cop:q/power,maxQ};}
  function isOpen(s,t){return s.start===s.end?false:s.start<s.end?t>=s.start&&t<s.end:t>=s.start||t<s.end;}
  function instant(s,g,time=s.time,withShade=true){const w=weather(s,time),ss=sun(s,time),pv=pvPower(s,g,w,ss),c=coil(s,g,w);
    let active=isOpen(s,time)&&w.temp>24&&(!g.dx.ambientLimit||w.temp<=g.dx.ambientLimit)?s.dxCount:0;
    if(s.solarOnly)active=Math.min(active,Math.floor((pv.ac+1e-9)/c.power));
    const load=active*c.power,self=Math.min(pv.ac,load),grid=Math.max(0,load-pv.ac),surplus=Math.max(0,pv.ac-load);
    const sh=withShade?shading(s,g,ss):null;
    // Shortwave-only mean radiant temperature equivalent; not UTCI or air temperature.
    const absorbed=0.7*0.25*ss.dni+0.7*0.5*ss.diffuse,blocked=0.7*0.25*ss.dni;
    const mrtSun=Math.pow((w.temp+273.15)**4+absorbed/(0.95*5.670374419e-8),0.25)-273.15;
    const mrtShade=Math.pow((w.temp+273.15)**4+(absorbed-blocked)/(0.95*5.670374419e-8),0.25)-273.15;
    return {w,sun:ss,pv,coil:c,active,load,self,grid,surplus,water:active*c.water,totalQ:active*c.q,totalSensible:active*c.sensible,totalFlow:active*g.dx.flow,shade:sh,mrtSun,mrtShade,mrtDrop:mrtSun-mrtShade};}
  function daily(s,g){const rows=[],sum={pv:0,load:0,self:0,grid:0,surplus:0,water:0,cooling:0};for(let i=0;i<96;i++){const t=(i+.5)/4,r=instant(s,g,t,false);rows.push({t,...r});sum.pv+=r.pv.ac*.25;sum.load+=r.load*.25;sum.self+=r.self*.25;sum.grid+=r.grid*.25;sum.surplus+=r.surplus*.25;sum.water+=r.water*.25;sum.cooling+=r.totalQ*.25;}return {rows,...sum};}
  function economics(s,g,day){const n=g.panels.length,has=g.posts.length+s.dxCount+s.inverterCount>0;
    const lines=[['PV modules',n,s.panelPrice,'module'],['Canopy steel & rails',n*g.panel.length*g.panel.width,s.steelRate*Math.pow(s.height/4.5,1.35),'m² of modules'],['Foundations / pillar bases',g.posts.length,s.footingRate,'base'],['DX equipment',s.dxCount,s.dxPrice,'unit'],['DC → AC inverters',s.inverterCount,s.inverterPrice,'unit'],['PV installation labor',n,s.pvLabor,'module'],['DX pads, ducts & fitting',s.dxCount,s.dxLabor,'unit'],['Inverter installation',s.inverterCount,s.inverterLabor,'unit'],['Cabling, isolators & protection',n*g.panel.watts/1000,s.wiringRate,'kWp'],['Condensate drains',s.dxCount,s.drainRate,'unit'],['Engineering / permits allowance',has?1:0,s.design,'allowance'],['Freight / site mobilization',has?1:0,s.shipping,'allowance']].map(([label,qty,rate,unit])=>({label,qty,rate,unit,total:qty*rate}));
    const subtotal=lines.reduce((a,l)=>a+l.total,0),contingency=subtotal*s.contingency/100,tax=(subtotal+contingency)*s.tax/100,capex=subtotal+contingency+tax;
    const op=[['Grid electricity',day.grid*s.days,s.tariff,'kWh/year'],['PV inspection',n,s.pvMaint,'module/year'],['DX service & filters',s.dxCount,s.dxMaint,'unit/year'],['Inverter service',s.inverterCount,s.invMaint,'unit/year'],['Panel cleaning',n*s.visits,s.cleaning,'module-visits/year'],['Export revenue allowance',day.surplus*s.days,-s.exportTariff,'kWh/year']].map(([label,qty,rate,unit])=>({label,qty,rate,unit,total:qty*rate}));
    const opex=op.reduce((a,l)=>a+l.total,0),replacement=s.years>=12?s.inverterCount*(s.inverterPrice+s.inverterLabor)*(1+s.tax/100):0;
    const npv=capex+Array.from({length:s.years},(_,i)=>opex/Math.pow(1+s.discount/100,i+1)).reduce((a,b)=>a+b,0)+(replacement?replacement/Math.pow(1+s.discount/100,12):0);
    return {lines,subtotal,contingency,tax,capex,op,opex,year1:capex+opex,lifetime:capex+opex*s.years+replacement,npv,replacement,avoided:day.self*s.days*s.tariff};}
  function transport(s,g,r,res=64){const nx=res,ny=Math.max(24,Math.round(res*s.depth/s.width)),dx=s.width/nx,dy=s.depth/ny,N=nx*ny;
    const field=new Float32Array(N),mask=new Uint8Array(N),vx=new Float32Array(N),vy=new Float32Array(N),source=new Float32Array(N);
    const from=s.windDir*rad,hd=s.heading*rad,ex=-Math.sin(from)*s.wind,ey=-Math.cos(from)*s.wind;
    const ux=ex*Math.cos(hd)+ey*Math.sin(hd),uy=-ex*Math.sin(hd)+ey*Math.cos(hd),active=g.dxUnits.slice(0,r.active),qv=g.dx.flow/3600;
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i,x=(i+.5)*dx,y=(j+.5)*dy;if(!inside(x,y,g.poly))continue;mask[k]=1;vx[k]=ux;vy[k]=uy;
      for(const u of active){const cx=Math.cos(u.angle),cy=Math.sin(u.angle),a=(x-u.x)*cx+(y-u.y)*cy,b=-(x-u.x)*cy+(y-u.y)*cx;
        if(a>=0&&a<16){const spread=.32+.16*a,vel=Math.min(qv/s.outletArea,12)/(1+a/1.2)*Math.exp(-.5*(b/spread)**2);vx[k]+=vel*cx;vy[k]+=vel*cy;}}
    }
    // Each unit injects qv into an occupied-height source control volume.
    for(const u of active){const cells=[];let total=0;const cx=u.x+.45*Math.cos(u.angle),cy=u.y+.45*Math.sin(u.angle);
      for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const k=j*nx+i;if(!mask[k])continue;const rr=Math.hypot((i+.5)*dx-cx,(j+.5)*dy-cy);if(rr<Math.max(dx,dy)*1.5){const v=Math.exp(-rr*rr/.30);cells.push([k,v]);total+=v;}}
      for(const [k,v] of cells)source[k]+=qv*v/Math.max(total,1e-9)/(dx*dy*s.mixHeight);
    }
    const K=s.mix,leak=.015+s.wind*.012,cx=K/(dx*dx),cy=K/(dy*dy);let residual=0,iterations=0;
    for(let it=0;it<360;it++){residual=0;const reverse=it%2;for(let n=0;n<N;n++){const k=reverse?N-1-n:n;if(!mask[k])continue;const i=k%nx,j=Math.floor(k/nx),u=vx[k],v=vy[k];
      const aw=cx+Math.max(u,0)/dx,ae=cx+Math.max(-u,0)/dx,as=cy+Math.max(v,0)/dy,an=cy+Math.max(-v,0)/dy;
      const left=i>0&&mask[k-1]?field[k-1]:0,right=i<nx-1&&mask[k+1]?field[k+1]:0,bottom=j>0&&mask[k-nx]?field[k-nx]:0,top=j<ny-1&&mask[k+nx]?field[k+nx]:0;
      const next=(aw*left+ae*right+as*bottom+an*top+source[k])/(aw+ae+as+an+leak+source[k]);residual=Math.max(residual,Math.abs(next-field[k]));field[k]=next;
    }iterations=it+1;if(residual<1e-5)break;}
    let sum=0,count=0,max=0,cooled=0;for(let k=0;k<N;k++)if(mask[k]){sum+=field[k];count++;max=Math.max(max,field[k]);if(field[k]*r.coil.delta>=1)cooled++;}
    function sample(x,y){const i=clamp(Math.floor(x/dx),0,nx-1),j=clamp(Math.floor(y/dy),0,ny-1),f=field[j*nx+i];return {f,temp:r.w.temp-r.coil.delta*f,rh:relative(r.w.temp-r.coil.delta*f,r.coil.win-(r.coil.win-r.coil.wout)*f)};}
    const profile=Array.from({length:31},(_,i)=>{const d=i*.4,u=active[0]||g.dxUnits[0];return {d,...(u?sample(u.x+d*Math.cos(u.angle),u.y+d*Math.sin(u.angle)):{temp:r.w.temp,rh:r.w.rh,f:0})};});
    return {nx,ny,dx,dy,field,mask,vx,vy,source,iterations,residual,meanDrop:count?sum/count*r.coil.delta:0,maxDrop:max*r.coil.delta,cooledArea:count?cooled/count*g.area:0,profile,sample};}
  root.LabEngine={defaults,clamp,area,inside,sat,humidity,relative,enthalpy,dryMass,dewpoint,weather,sun,layout,shadowPolys,shading,pvPower,coil,instant,daily,economics,transport};
})(typeof window!=='undefined'?window:globalThis);
