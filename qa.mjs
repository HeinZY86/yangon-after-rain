import {chromium} from 'playwright';
import {PeerServer} from 'peer';
import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const html=await fs.readFile('index.html'),sdk=await fs.readFile(require.resolve('peerjs/dist/peerjs.min.js'));
const signal=PeerServer({port:9000,path:'/qa'});
const srv=http.createServer((req,res)=>{if(req.url==='/sdk'){res.setHeader('Content-Type','text/javascript');res.end(sdk)}else if(req.url.startsWith('/city/')){res.writeHead(404);res.end()}else if(req.url==='/peers'){res.setHeader('Content-Type','text/html');res.end('<script src="/sdk"></script>')}else{res.setHeader('Content-Type','text/html');res.end(html)}});
await new Promise(r=>srv.listen(8382,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader','--allow-loopback-in-peer-connection','--disable-features=WebRtcHideLocalIpsWithMdns','--use-angle=swiftshader','--autoplay-policy=no-user-gesture-required','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
const errors=[];
signal.on('connection',()=>console.log('local signal connection'));
const context=await browser.newContext({viewport:{width:900,height:620},permissions:['clipboard-read','clipboard-write']});
await context.route('**/peerjs@*/dist/peerjs.min.js',route=>route.fulfill({contentType:'text/javascript',body:Buffer.concat([sdk,Buffer.from("\n;window.Peer=new Proxy(window.Peer,{construct(Target,[id,opts]){return new Target(id,{...opts,host:'127.0.0.1',port:9000,path:'/qa',secure:false,config:{iceServers:[]}})}});")])}));
async function page(url){
  const p=await context.newPage();p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('resource'))console.log('BROWSER',m.text())});await p.goto(url);return p;
}
const wait=(p,f,arg)=>p.waitForFunction(f,arg,{timeout:40000});
const url='http://127.0.0.1:8382/';
try{
  const a=await page(url);await a.getByRole('button',{name:/Enter World/}).click();
  await wait(a,()=>document.querySelector('#presence').textContent==='1 / 20 online');await a.getByRole('button',{name:'Invite',exact:true}).click();const invite=await a.getByRole('textbox',{name:'World link'}).inputValue();await a.getByRole('button',{name:'Back to the street',exact:true}).click();
  assert.ok(invite.includes('#world=yangon-rain-v2-'));
  const b=await page(invite);await wait(b,()=>document.querySelector('#presence').textContent==='2 / 20 online');
  await wait(a,()=>document.querySelector('#presence').textContent==='2 / 20 online');console.log('PASS two actual WebRTC clients joined via invite');
  async function resume(p){if(await p.getByRole('button',{name:'Resume',exact:true}).isVisible())await p.getByRole('button',{name:'Resume',exact:true}).click()}
  await resume(a);await a.keyboard.press('e');await wait(a,()=>seat==='driver');await resume(b);await b.keyboard.press('e');await wait(b,()=>seat==='rider');
  await resume(a);const before=await a.evaluate(()=>actor().z);await a.keyboard.down('w');await a.waitForTimeout(1800);await a.keyboard.up('w');
  await wait(a,x=>actor().z>x+.2,before);await wait(b,x=>actor().z>x+.1,before);
  const motion=await a.evaluate(()=>({speed:Math.hypot(car.vx,car.vz),position:car.z}));assert.ok(motion.speed>0);console.log('PASS shared seats, driving sync, coasting',JSON.stringify(motion));
  await resume(a);await a.keyboard.down('Space');await wait(a,()=>Math.hypot(car.vx,car.vz)<.3);await a.keyboard.up('Space');console.log('PASS braking to rest');
  await resume(b);await b.getByRole('button',{name:'Chat',exact:true}).click();await b.getByRole('textbox',{name:'Chat message'}).fill('tea shop meetup');await b.getByRole('textbox',{name:'Chat message'}).press('Enter');await a.getByText(/Explorer · tea shop meetup/).waitFor();console.log('PASS WebRTC chat');
  await resume(b);await b.keyboard.press('e');await wait(b,()=>!car);await resume(a);await a.keyboard.press('e');await wait(a,()=>!car);
  // Place both avatars on a clear nearby road to exercise combat without route-finding.
  await a.evaluate(()=>Object.assign(player,{x:4,z:4,a:0}));await b.evaluate(()=>Object.assign(player,{x:4,z:5.4,a:0}));
  await wait(a,()=>peers.some(p=>Math.hypot(p.x-4,p.z-5.4)<.35));
  for(const hp of [75,50,25,0]){await a.keyboard.press('f');await wait(b,v=>myHP===v,hp);await a.waitForTimeout(480)}
  await wait(b,()=>myHP===100&&myLife===1);console.log('PASS combat damage and respawn propagated over WebRTC');
  await a.evaluate(()=>{const p=props[0];Object.assign(player,{x:p.x,z:p.z-1.1,a:0})});await a.waitForTimeout(550);
  for(const hp of [25,0]){await a.keyboard.press('f');await wait(b,v=>props[0].hp===v,hp);await a.waitForTimeout(470)}
  await wait(b,()=>props[0].hp===50);console.log('PASS destroyed streetlight and cooldown restoration replicated');
  await b.close();await wait(a,()=>document.querySelector('#presence').textContent==='1 / 20 online');console.log('PASS disconnect releases passenger');
  // Connection-only guests run in one Chrome renderer. Each has its own Peer and RTCPeerConnection.
  const q=await context.newPage();await q.goto(url+'peers');
  const counts=await q.evaluate(async host=>{
    const clients=[];let accepted=0,rejected=0;
    async function join(i){return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('client '+i+' timeout')),20000);
      const p=new Peer('test-'+crypto.randomUUID(),{host:'127.0.0.1',port:9000,path:'/qa',secure:false,config:{iceServers:[]}});clients.push(p);
      p.on('error',reject);p.on('open',()=>{const c=p.connect(host,{reliable:true,serialization:'json',metadata:{v:2,name:'QA '+i}});c.on('data',m=>{if(m.t==='welcome'){const ping=setInterval(()=>{if(c.open)c.send({t:'ping'});else clearInterval(ping)},1800);accepted++;clearTimeout(timeout);resolve()}else if(m.t==='reject'){rejected++;clearTimeout(timeout);resolve()}})});
    })}
    for(let i=1;i<=20;i++)await join(i);window.testClients=clients;return {accepted,rejected}
  },new URLSearchParams(new URL(invite).hash.slice(1)).get('world'));
  assert.equal(counts.accepted,19);assert.equal(counts.rejected,1);await wait(a,()=>document.querySelector('#presence').textContent==='20 / 20 online');console.log('PASS host + 19 distinct RTC guests; 21st rejected',JSON.stringify(counts));
  await a.bringToFront();await resume(a);const perf=await a.evaluate(async()=>{const start=performance.now(),heap0=performance.memory?.usedJSHeapSize;let n=0;await new Promise(done=>{function step(){n++;if(performance.now()-start>8000)done();else requestAnimationFrame(step)}requestAnimationFrame(step)});return {fps:+(n*1000/(performance.now()-start)).toFixed(1),heapStartMB:Math.round(heap0/1048576),heapEndMB:Math.round(performance.memory?.usedJSHeapSize/1048576)}});console.log('MEASURE 20 connections, CI Chrome software-rendered 900x620, 8s',JSON.stringify(perf));
  await q.close();await wait(a,()=>document.querySelector('#presence').textContent==='1 / 20 online');
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  await mobile.route('**/peerjs@*/dist/peerjs.min.js',route=>route.fulfill({contentType:'text/javascript',body:Buffer.concat([sdk,Buffer.from("\n;window.Peer=new Proxy(window.Peer,{construct(Target,[id,opts]){return new Target(id,{...opts,host:'127.0.0.1',port:9000,path:'/qa',secure:false,config:{iceServers:[]}})}});")])}));
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(url);await phone.getByRole('button',{name:/Enter World/}).tap();await phone.locator('#rotatePhone').waitFor({state:'visible'});await phone.setViewportSize({width:844,height:390});await phone.locator('#rotatePhone').waitFor({state:'hidden'});await phone.locator('[data-key="Space"]').tap();await wait(phone,()=>player.y>0);await phone.getByRole('button',{name:'Open district map'}).tap();await phone.getByRole('heading',{name:'Downtown street map'}).waitFor();await mobile.close();console.log('PASS emulated touch, online host and landscape rotation, jump, minimap');
  const finalGuest=await page(invite);await wait(finalGuest,()=>document.querySelector('#presence').textContent==='2 / 20 online');
  await a.close();await wait(finalGuest,()=>document.querySelector('#connectNote').textContent.match(/host left|host stopped|host lost/i));console.log('PASS host departure returns guest to title screen');
  assert.deepEqual(errors,[]);console.log('PASS no uncaught JavaScript errors');
}catch(e){for(const p of context.pages())console.log('Diagnostic',await p.evaluate(()=>({note:document.querySelector('#connectNote')?.textContent,presence:document.querySelector('#presence')?.textContent,fallback:document.querySelector('#fallback')?.hidden,peer:typeof peer==='undefined'?null:peer?.open,mode:typeof mode==='undefined'?null:mode,dialog:document.querySelector('#mtitle')?.textContent,seat:typeof seat==='undefined'?null:seat})).catch(()=>null));console.log('Errors',errors);throw e}finally{await browser.close();srv.close();process.exitCode??=0;setTimeout(()=>process.exit(process.exitCode||0),300).unref();signal._wss?.close?.()}
