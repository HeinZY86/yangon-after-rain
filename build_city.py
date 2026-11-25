"""Compile OSM ways into small independent gameplay cells, in local metres."""
import gzip, json, math, os, sys
from collections import defaultdict
from pathlib import Path
import osmium
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import polygonize, unary_union

BASE_LON, BASE_LAT = 96.158, 16.776
MX, MZ = 111320 * math.cos(math.radians(BASE_LAT)), 110650
CELL = 320
BOUNDS = [95.90, 16.52, 96.40, 17.16]
centres = [('Sule',96.1584,16.7756),('Chinatown',96.1463,16.7738),('Kandawgyi',96.1676,16.7932),('Inya Lake',96.1363,16.8280),('North Dagon',96.1852,16.8847),('Insein',96.1036,16.8887),('Hlaing Tharyar',96.0619,16.8571),('Mingaladon',96.1261,16.9291),('Thanlyin',96.2495,16.7560),('Dala',96.1507,16.7536),('South Okkalapa',96.1775,16.8506),('Hmawbi',96.0349,17.0950)]
widths = dict(motorway=16,trunk=14,primary=12,secondary=10,tertiary=8,residential=6.5,unclassified=6,service=4.2,living_street=5,road=6,track=3.6,footway=1.8,path=1.5,pedestrian=4,steps=1.5,cycleway=2)
def xy(lon,lat): return (round((lon-BASE_LON)*MX,1),round((lat-BASE_LAT)*MZ,1))
def quant(points): return [[round(x,1),round(z,1)] for x,z in points]
lo = xy(*BOUNDS[:2]); hi = xy(*BOUNDS[2:])
extent=box(*lo,*hi)
tiles=defaultdict(lambda:{'r':[],'b':[],'w':[],'g':[]})
nodes={}; hydro={}; relations=[]; overview=[]
best=[[float('inf'),None] for _ in centres]
targets=[Point(xy(lon,lat)) for _,lon,lat in centres]
def parts(g):
    if g.is_empty: return
    if hasattr(g,'geoms'):
        for child in g.geoms: yield from parts(child)
    else: yield g
def cells(g):
    x,z,X,Z=g.bounds
    for i in range(math.floor(x/CELL),math.floor(X/CELL)+1):
        for j in range(math.floor(z/CELL),math.floor(Z/CELL)+1):
            yield (i,j),box(i*CELL,j*CELL,(i+1)*CELL,(j+1)*CELL)
def add_area(poly,kind,height=0,style=0):
    if not poly.is_valid: poly=poly.buffer(0)
    for p in parts(poly.intersection(extent)):
        if p.geom_type!='Polygon' or p.area<2: continue
        for key,cell in cells(p):
            g=p if cell.covers(p) else p.intersection(cell)
            for q in parts(g):
                if q.geom_type!='Polygon' or q.area<1:continue
                rings=[quant(q.exterior.coords[:-1])]+[quant(h.coords[:-1]) for h in q.interiors]
                tris=[quant(t.exterior.coords[:3]) for t in constrained_delaunay_triangles(q).geoms]
                tiles[key][kind].append([height,style,rings,tris])
def add_road(points,w,name,bridge,major):
    line=LineString(points).simplify(.5)
    for p in parts(line.intersection(extent)):
        if p.geom_type!='LineString' or p.length<1:continue
        if major: overview.append(quant(p.simplify(22).coords))
        for idx,t in enumerate(targets):
            if w<5 or bridge or p.distance(t)>min(best[idx][0],1200):continue
            along=p.project(t)
            if p.length<26:continue
            along=max(12,min(along,p.length-12)); s=p.interpolate(along); before=p.interpolate(along-2); after=p.interpolate(along+2)
            best[idx]=[s.distance(t),[round(s.x,1),round(s.y,1),round(math.atan2(after.x-before.x,after.y-before.y),4),w]]
        for key,cell in cells(p):
            for seg in parts(p.intersection(cell)):
                if seg.geom_type=='LineString' and seg.length>.2:tiles[key]['r'].append([w,name,bridge,quant(seg.coords)])
stop_xy=[(p.x,p.y) for p in targets]
class WaterRelations(osmium.SimpleHandler):
    def relation(self,r):
        if r.tags.get('natural')!='water' and r.tags.get('waterway')!='riverbank':return
        outer=[m.ref for m in r.members if m.type=='w' and m.role in ('','outer')]
        inner=[m.ref for m in r.members if m.type=='w' and m.role=='inner']
        if outer:relations.append((outer,inner))
class ReadMap(osmium.SimpleHandler):
    def node(self,n):
        loc=n.location
        if BOUNDS[0]-.03<=loc.lon<=BOUNDS[2]+.03 and BOUNDS[1]-.03<=loc.lat<=BOUNDS[3]+.03:
            nodes[n.id]=xy(loc.lon,loc.lat)
    def way(self,w):
        t=w.tags; road=t.get('highway','').removesuffix('_link'); kind=('b' if t.get('building') and t.get('building')!='no' else 'w' if t.get('natural')=='water' or t.get('waterway')=='riverbank' else 'g' if t.get('leisure') in ('park','garden') or t.get('landuse') in ('forest','grass','recreation_ground') else '')
        if road not in widths and not kind and w.id not in required:return
        pts=[nodes.get(n.ref) for n in w.nodes]
        if len(pts)<2 or not any(pts):return
        if road in widths:
            group=[]
            for point in pts+[None]:
                if point:group.append(point)
                else:
                    if len(group)>1:add_road(group,widths[road],t.get('name:en') or t.get('name',''),int(t.get('bridge','no')!='no'),road in ('motorway','trunk','primary','secondary'))
                    group=[]
        if not all(pts):return
        if w.id in required:hydro[w.id]=pts
        if kind=='b' and w.id%10 and all(abs(pts[0][0]-tx)>850 or abs(pts[0][1]-tz)>850 for tx,tz in stop_xy):return
        if not kind or len(pts)<4 or pts[0]!=pts[-1]:return
        if kind=='w' and w.id in required:return
        try:h=float((t.get('height') or '').split(' ')[0])
        except ValueError:
            try:h=float(t.get('building:levels',''))*3.1
            except ValueError:h=4+(w.id%4)*2.5
        add_area(Polygon(pts).simplify(.35),kind,round(max(2.8,min(180,h)),1),w.id%12)
print('Indexing Yangon waterways',flush=True)
WaterRelations().apply_file(sys.argv[1]);required={i for outer,inner in relations for i in outer+inner}
print('Building streets and neighbourhoods',flush=True)
ReadMap().apply_file(sys.argv[1]);nodes.clear()
for outer,inner in relations:
    if not any(i in hydro for i in outer):continue
    polys=list(polygonize([LineString(hydro[i]) for i in outer if i in hydro]))
    holes=list(polygonize([LineString(hydro[i]) for i in inner if i in hydro]))
    for p in polys:add_area(p.difference(unary_union(holes)).simplify(1.5),'w')
dest=Path('city');dest.mkdir(exist_ok=True)
def dump(path,data,compressed=False):
    blob=json.dumps(data,separators=(',',':'),ensure_ascii=False).encode()
    path.write_bytes(gzip.compress(blob,compresslevel=5,mtime=0) if compressed else blob)
for (i,j),data in tiles.items():dump(dest/f'{i}_{j}.json.gz',data,True)
stops=[dict(name=c[0],x=b[1][0],z=b[1][1],a=b[1][2],w=b[1][3]) for c,b in zip(centres,best) if b[1]]
assert len(stops)>=10 and stops[0]['name']=='Sule' and len(tiles)>1000
dump(dest/'cells.json.gz',[f'{i}_{j}' for i,j in tiles],True)
dump(dest/'overview.json.gz',overview,True)
dump(dest/'meta.json',dict(stops=stops,cell=CELL,bounds=[*lo,*hi],tiles=len(tiles),roads=sum(len(v['r']) for v in tiles.values()),buildings=sum(len(v['b']) for v in tiles.values())))
print('Compiled',len(tiles),'Yangon cells and',len(stops),'travel stops')
