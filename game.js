const canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d');
let W,H,dpr=1, power=1820,temp=289,safety=94, score=0,running=true,scrammed=false;
let last=performance.now(), t=0, eventTimer=0, particles=[];
const logEl=document.getElementById('log');
function resize(){dpr=Math.min(devicePixelRatio||1,2);W=canvas.clientWidth;H=canvas.clientHeight;canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
addEventListener('resize',resize);resize();
function addLog(text,type=''){const e=document.createElement('div');e.className='event '+type;e.innerHTML='<small>'+new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})+'</small>'+text;logEl.prepend(e);while(logEl.children.length>7)logEl.lastChild.remove()}
addLog('System initierade','good');addLog('Reaktor i normaldrift','good');addLog('Övervakning aktiv');
function updateUI(){const pct=Math.max(0,Math.min(100,(power-800)/2000*100));document.getElementById('power').textContent=Math.round(power).toLocaleString('sv-SE');document.getElementById('effPct').textContent=Math.round(pct)+'%';document.getElementById('powerBar').style.width=pct+'%';
 const tp=Math.max(0,Math.min(100,(temp-220)/130*100));document.getElementById('temp').textContent=Math.round(temp);document.getElementById('tempBar').style.width=tp+'%';document.getElementById('tempBar').style.background=tp>80?'#ff8069':tp>62?'#ffc657':'#66d6be';document.getElementById('tempState').textContent=temp>305?'Varning':temp>295?'Elev.':'Normal';
 document.getElementById('safe').textContent=Math.round(safety);document.getElementById('safePct').textContent=Math.round(safety)+'%';document.getElementById('safeBar').style.width=safety+'%';document.getElementById('safeBar').style.background=safety<35?'#ff8069':safety<70?'#ffc657':'#66d6be';
 let alert='SYSTEM I NORMALDRIFT';if(temp>305||safety<35){alert='TEMPERATURKRITISK';document.getElementById('alertText').parentElement.querySelector('.alert-dot').style.background='#ff8069'}else if(temp>295||safety<70){alert='ÖVERVAKNING ÖKAD';document.getElementById('alertText').parentElement.querySelector('.alert-dot').style.background='#ffc657'}else document.getElementById('alertText').parentElement.querySelector('.alert-dot').style.background='#ffc657';document.getElementById('alertText').textContent=alert;
}
function addParticle(){particles.push({a:Math.random()*Math.PI*2,r:20+Math.random()*14,z:Math.random(),s:.15+Math.random*.25})}
function draw(){ctx.clearRect(0,0,W,H);const cx=W*.5,cy=H*.52;
 // atmospheric grid
 ctx.strokeStyle='rgba(117,151,158,.07)';ctx.lineWidth=1;for(let x=(t*3%50);x<W;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 // floor
 const floor=H*.76;ctx.fillStyle='rgba(5,12,15,.8)';ctx.beginPath();ctx.moveTo(0,floor);ctx.lineTo(W,floor);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.fill();ctx.strokeStyle='rgba(91,130,136,.18)';for(let i=-3;i<12;i++){ctx.beginPath();ctx.moveTo(cx+i*100,floor);ctx.lineTo(cx+i*210,H);ctx.stroke()}for(let y=floor;y<H;y+=38){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 // rear industrial wall
 ctx.fillStyle='rgba(16,31,36,.88)';ctx.fillRect(0,H*.18,W,floor-H*.18);ctx.strokeStyle='rgba(142,174,178,.12)';for(let x=35;x<W;x+=110){ctx.beginPath();ctx.moveTo(x,H*.18);ctx.lineTo(x,floor);ctx.stroke()}for(let y=H*.25;y<floor;y+=100){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}
 // pipes
 ctx.lineCap='round';ctx.lineWidth=15;ctx.strokeStyle='#1a3338';ctx.beginPath();ctx.moveTo(0,cy-155);ctx.bezierCurveTo(cx*.2,cy-155,cx*.24,cy-50,cx*.36,cy-50);ctx.stroke();ctx.beginPath();ctx.moveTo(W,cy-155);ctx.bezierCurveTo(W-cx*.2,cy-155,W-cx*.24,cy-50,W-cx*.36,cy-50);ctx.stroke();ctx.lineWidth=3;ctx.strokeStyle='#6a9093';ctx.globalAlpha=.45;ctx.stroke();ctx.globalAlpha=1;
 // reactor vessel shadow and body
 const sc=Math.min(W/850,H/650);ctx.save();ctx.translate(cx,cy);ctx.scale(sc,sc);
 ctx.shadowColor='rgba(0,0,0,.65)';ctx.shadowBlur=35;ctx.shadowOffsetY=28;
 ctx.beginPath();ctx.arc(0,25,196,0,Math.PI*2);ctx.fillStyle='#10252a';ctx.fill();ctx.shadowColor='transparent';
 // segmented outer ring
 ctx.strokeStyle='#536c70';ctx.lineWidth=10;ctx.beginPath();ctx.arc(0,25,202,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#1b363b';ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,25,188,0,Math.PI*2);ctx.stroke();
 for(let i=0;i<24;i++){let a=i*Math.PI*2/24;ctx.beginPath();ctx.moveTo(Math.cos(a)*188,25+Math.sin(a)*188);ctx.lineTo(Math.cos(a)*202,25+Math.sin(a)*202);ctx.strokeStyle=i%2?'#83999b':'#405b60';ctx.lineWidth=5;ctx.stroke()}
 // glowing core
 let g=ctx.createRadialGradient(0,25,20,0,25,150);g.addColorStop(0,'rgba(126,224,198,.55)');g.addColorStop(.25,'rgba(54,160,145,.18)');g.addColorStop(1,'rgba(25,72,77,.04)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,25,150,0,Math.PI*2);ctx.fill();
 // central reactor glass
 ctx.beginPath();ctx.arc(0,25,118,0,Math.PI*2);ctx.fillStyle='#0a171b';ctx.fill();ctx.strokeStyle='#78979a';ctx.lineWidth=7;ctx.stroke();
 // core hexagonal pattern
 ctx.save();ctx.beginPath();ctx.arc(0,25,94,0,Math.PI*2);ctx.clip();ctx.strokeStyle='rgba(116,207,184,.35)';ctx.lineWidth=2;for(let i=-90;i<100;i+=30){ctx.beginPath();ctx.moveTo(i,-90);ctx.lineTo(i+115,160);ctx.stroke()}for(let i=-90;i<100;i+=30){ctx.beginPath();ctx.moveTo(i,140);ctx.lineTo(i+115,-110);ctx.stroke()}ctx.restore();
 // core glow and control rods
 ctx.globalCompositeOperation='lighter';let cg=ctx.createRadialGradient(0,25,5,0,25,72);cg.addColorStop(0,scrammed?'rgba(255,180,90,.18)':'rgba(117,231,198,.75)');cg.addColorStop(.45,safety<40?'rgba(255,100,80,.35)':'rgba(63,180,157,.22)');cg.addColorStop(1,'rgba(20,80,75,0)');ctx.fillStyle=cg;ctx.beginPath();ctx.arc(0,25,72,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';
 ctx.fillStyle='#75898b';for(let i=-2;i<=2;i++){ctx.fillRect(i*34-5,-58,10,166)}ctx.fillStyle='#263d41';for(let i=-2;i<=2;i++){ctx.fillRect(i*34-2,-58,4,166)}
 ctx.restore();
 // active meter text
 ctx.fillStyle='rgba(176,208,208,.7)';ctx.font='600 10px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText('R-1  ·  REAKTOR',cx,cy+sc*235);ctx.font='700 11px ui-monospace, monospace';ctx.fillStyle='#79cfbd';ctx.fillText('KONTROLLDATOR AKTIV',cx,cy+sc*252);
 // particles
 ctx.save();ctx.translate(cx,cy);ctx.globalCompositeOperation='lighter';if(running&&Math.random()<.35)addParticle();for(let i=particles.length-1;i>=0;i--){let p=particles[i];p.a+=p.s*.018;p.r+=.08;let x=Math.cos(p.a)*p.r*sc,y=25+Math.sin(p.a)*p.r*sc;ctx.fillStyle='rgba(116,226,195,'+(0.18*(1-p.z))+')';ctx.fillRect(x,y,2,2);if(p.r>95)particles.splice(i,1)}ctx.restore();
}
function loop(now){let dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;if(running&&!scrammed){score+=dt;power+=Math.sin(t*.35)*1.5+(.06*(2350-power));temp+=((power-1750)*.012+(289-temp)*.018)*dt;safety-=((temp-285)*.005+(power>2200?.02:0))*dt;if(temp>315||safety<=0){safety=Math.max(0,safety);endGame()}eventTimer+=dt;if(eventTimer>9){eventTimer=0;temp+=2.5;addLog('Ekvivalent flöde ökar temperatur','warning');}}if(scrammed){power*=1-Math.min(dt*.08,.03);temp+=(289-temp)*dt*.2;if(power<850){running=false;endGame('scram')}}updateUI();draw();document.getElementById('clock').textContent=new Date().toLocaleTimeString('sv-SE',{hour12:false});requestAnimationFrame(loop)}
function endGame(kind){running=false;document.getElementById('overlay').className='show';if(kind==='scram'){document.getElementById('modalTitle').textContent='DRIFT STOPPAD';document.getElementById('modalText').textContent='SCRAM har säkrat reaktorn. Systemet är i ett säkert nolläge.'}else{document.getElementById('modalTitle').textContent='KRITISKT TILLSTÅND';document.getElementById('modalText').textContent='Säkerhetssystemet har stoppat reaktorn automatiskt.'}}
document.getElementById('boost').onclick=()=>{if(!running)return;power=Math.min(2800,power+100);temp+=2.5;addLog('Effekt ökad till '+Math.round(power)+' MW')};
document.getElementById('cool').onclick=()=>{if(!running)return;temp=Math.max(220,temp-6);safety=Math.min(100,safety+1);addLog('Kylsektion aktiverad','good')};
document.getElementById('pump').onclick=()=>{if(!running)return;safety=Math.min(100,safety+8);temp=Math.max(220,temp-3);document.getElementById('stCooling').textContent='Återställd';document.getElementById('stCooling').className='status';addLog('Reservpump återställd','good')};
document.getElementById('scram').onclick=()=>{if(!running||scrammed)return;scrammed=true;runnning=true;running=true;addLog('SCRAM utlöst — nödhalt','warning');document.getElementById('stRods').textContent='Insatta';document.getElementById('stRods').className='status warn'};
document.getElementById('restart').onclick=()=>{power=1820;temp=289;safety=94;score=0;running=true;scrammed=false;particles=[];logEl.innerHTML='';addLog('Drift återstartad','good');document.getElementById('overlay').className='';document.getElementById('stRods').textContent='Nedtryckta';document.getElementById('stRods').className='status'};
requestAnimationFrame(loop);