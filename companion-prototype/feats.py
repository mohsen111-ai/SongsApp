"""Find eyes and lips in each pose (pixel coords on the 896px poses) and write feats.json for the shader."""
import numpy as np, cv2, json, itertools, pathlib
here = pathlib.Path(__file__).parent
S = 896
# hand-checked fixes where detection fails: eye centres (left, right), lips (cx, cy, rx, ry, ang)
MANUAL = {
    9:  dict(eyes=[(337,264),(432,213)], lips=(385,328,27,13,-24)),
    12: dict(eyes=[(354,185),(492,202)], lips=(409,252,26,11,7)),
}
SKIP = {6}    # eyes hidden behind sunglasses
def detect(i, im):
    hsv = cv2.cvtColor(im,cv2.COLOR_BGR2HSV).astype(np.float32); hsv[...,0]/=180; hsv[...,1:]/=255
    h,s,v = hsv[...,0],hsv[...,1],hsv[...,2]
    g = ((h>0.20)&(h<0.42)&(s>0.12)&(v>0.30)).astype(np.uint8)
    g = cv2.morphologyEx(g,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    n,lab,st,cen = cv2.connectedComponentsWithStats(g,connectivity=8)
    c=[]
    for k in range(1,n):
        a=st[k,cv2.CC_STAT_AREA]; bw,bh=st[k,2],st[k,3]
        if 25<=a<=900 and bw<110 and bh<80 and a/(bw*bh)>0.25: c.append((cen[k],a))
    best=None
    for (p,pa),(q,qa) in itertools.combinations(c,2):
        d=np.hypot(*(p-q))
        if 45<d<260:
            sc=abs(np.log(pa/qa))+abs(d-130)/260
            if best is None or sc<best[0]: best=(sc,(p,pa),(q,qa))
    if not best: return None
    e=sorted([best[1],best[2]],key=lambda t:t[0][0])
    return [tuple(map(float,e[0][0])),tuple(map(float,e[1][0]))],[e[0][1],e[1][1]],v
def find_lips(eyes, v):
    M=(np.array(eyes[0])+np.array(eyes[1]))/2; e=np.array(eyes[1])-np.array(eyes[0]); d=np.linalg.norm(e); e/=d
    down=np.array([-e[1],e[0]]); down=down if down[1]>0 else -down
    exp=M+down*0.72*d
    dk=cv2.morphologyEx((v<0.30).astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    n,lab,st,cen=cv2.connectedComponentsWithStats(dk,connectivity=8); best=None
    for k in range(1,n):
        a=st[k,cv2.CC_STAT_AREA]; bw,bh=st[k,2],st[k,3]
        if not(100<=a<=0.5*d*d) or bw<bh*1.1: continue
        dist=np.linalg.norm(cen[k]-exp)
        if dist>0.55*d: continue
        sc=dist/d-0.0002*a
        if best is None or sc<best[0]: best=(sc,k)
    if not best: return None
    k=best[1]; ys,xs=np.nonzero(lab==k); pts=np.stack([xs,ys],1).astype(np.float32); c=pts.mean(0)
    ev,evec=np.linalg.eigh(np.cov((pts-c).T)); ang=float(np.degrees(np.arctan2(evec[1,1],evec[0,1])))
    ang=(ang+90)%180-90
    return (float(c[0]),float(c[1]),float(st[k,2])/2*1.1,float(st[k,3])/2*1.25,max(-35,min(35,ang)))
def skin_near(im, c, rx, ry, ang):
    hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV).astype(np.float32); hsv[...,0]/=180; hsv[...,1:]/=255
    H,W=im.shape[:2]; yy,xx=np.mgrid[0:H,0:W]
    t=np.radians(ang); dx,dy=xx-c[0],yy-c[1]
    u=(dx*np.cos(t)+dy*np.sin(t))/rx; w=(-dx*np.sin(t)+dy*np.cos(t))/ry
    r=np.sqrt(u*u+w*w)
    ring=(r>1.25)&(r<2.2)
    h,s,v=hsv[...,0],hsv[...,1],hsv[...,2]
    ok=ring&(v>0.55)&~((s>0.5)&(h>0.02)&(h<0.12))&~((h>0.2)&(h<0.45)&(s>0.12))
    if ok.sum()<30: ok=ring&(v>0.4)
    px=im[ok]; return [int(x) for x in np.median(px,0)[::-1]]
out={}
for i in range(1,21):
    im=cv2.imread(str(here/"poses"/f"{i:02d}.jpg"))
    if i in SKIP: out[i]=dict(eyes=[],lips=None); continue
    if i in MANUAL:
        eyes=[tuple(map(float,e)) for e in MANUAL[i]["eyes"]]; areas=[1,1]; lips=MANUAL[i]["lips"]; v=None
    else:
        r=detect(i,im)
        if not r: out[i]=dict(eyes=[],lips=None); continue
        eyes,areas,v=r; lips=find_lips(eyes,v)
    d=np.hypot(eyes[1][0]-eyes[0][0],eyes[1][1]-eyes[0][1]); ax=float(np.degrees(np.arctan2(eyes[1][1]-eyes[0][1],eyes[1][0]-eyes[0][0])))
    mean=np.sqrt(areas[0]*areas[1]); L=[]
    for e,a in zip(eyes,areas):
        k=float(np.clip(np.sqrt(a/mean),0.8,1.25))
        rx,ry=0.27*d*k,0.12*d*k
        L.append(dict(c=[round(e[0],1),round(e[1],1)],rx=round(rx,1),ry=round(ry,1),ang=round(ax,1),skin=skin_near(im,e,rx,ry,ax)))
    out[i]=dict(eyes=L,lips=dict(c=[round(lips[0],1),round(lips[1],1)],rx=round(lips[2],1),ry=round(lips[3],1),ang=round(lips[4],1)) if lips else None)
json.dump([out[i] for i in range(1,21)],open(here/"feats.json","w"))
print({i:(len(v["eyes"]),bool(v["lips"])) for i,v in out.items()})
