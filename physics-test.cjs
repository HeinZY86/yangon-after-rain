const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),path=require('path');
const dir=__dirname, mock=new Map(),memory=new Map(),events={};
const context2d=new Proxy({},{get(o,k){return k in o?o[k]:()=>{}},set(o,k,v){o[k]=v;return true}});
const mkClass=()=>({add(){},remove(){},toggle(){}});
function el(id){if(!mock.has(id)){let n={id,width:100,height:100,style:{},classList:mkClass(),dataset:{},hidden:false,addEventListener(){},setAttribute(){},getBoundingClientRect(){return {width:160,height:110}},getContext(){return context2d},querySelector(){return null},querySelectorAll(){return []},focus(){doc.activeElement=n},blur(){doc.activeElement=doc.body}};mock.set(id,n)}return mock.get(id)}
const doc={getElementById:el,createElement:el,body:{classList:mkClass(),blur(){}},querySelectorAll(){return []},addEventListener(){}};doc.activeElement=doc.body;
const ctx={document:doc,window:{addEventListener:(e,cb)=>events[e]=cb},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},innerWidth:1060,innerHeight:650,devicePixelRatio:1,clearInterval,requestAnimationFrame(){},performance:{now:()=>1000},console};vm.createContext(ctx);const run=s=>vm.runInContext(s,ctx);
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');let app=html.split('<script>')[1].split('</script>')[0].split('boot();if(ready')[0];run(app);run("buildModels();bakeNav();resetWorld(0);width=1060;height=650;titleScreen()");

run("start(true);session={world:'district',online:false};cars.splice(0,cars.length,...cars.filter(c=>!c.ai));props.length=0;player.x=-7.65;player.z=-10.55");
assert(run('nearCar()?.id')==='coupe');
run("car=cars[0];car.a=0;car.x=0;car.z=0;keys.add('KeyW');for(let i=0;i<120;i++)movePlayer(1/60);keys.clear()");
const start=run('car.v'),z=run('car.z');
run("for(let i=0;i<60;i++)movePlayer(1/60)");
const coast=run('car.v'),dist=run('car.z')-z;
assert(coast>0&&coast<start&&dist>4);
run("keys.add('Space');for(let i=0;i<180;i++)movePlayer(1/60);keys.clear()");assert(Math.abs(run('car.v'))<.001);
run("car=null;player.y=0;jump();for(let i=0;i<20;i++)updateSandbox(1/60)");assert(run('player.y')>.7);run("for(let i=0;i<70;i++)updateSandbox(1/60)");assert.equal(run('player.y'),0);
run("camera(.016);switchView();camera(.016)");assert(run('Number.isFinite(view.x)&&Number.isFinite(view.y)&&Number.isFinite(view.z)'));
assert(run("solidAt(17.25,17.25,.3)&&!solidAt(0,0,.3)"));
console.log('PASS 120-frame throttle, one-second coast, brake to zero, grounded jump, camera and solids.',{initialMps:start,coastingMps:coast,coastingMeters:dist});
