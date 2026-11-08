#!/usr/bin/env python3
"""Cross-tenant ghost check: each site's distinctive verified strings must
never appear on another site's pages. Run after a batch rebuild:
  python3 scripts/check-batch-ghosts.py /tmp/pitch-batch
Exit 1 on any violation."""
import json, os, re, sys
from pathlib import Path

ROOT = Path('/Users/chri/Desktop/roxjaya')
RESKIN = ROOT/'scripts/reskin'
BATCH = Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/pitch-batch')

# gather every chassis config -> slug -> signature strings
cfg_files = list(RESKIN.glob('*.json'))
sigs = {}   # slug -> set(str)
defaults_seen = {}  # value -> count of configs using it
per_cfg = {}
for f in cfg_files:
    try: c = json.load(open(f))
    except Exception: continue
    if not isinstance(c,dict): continue
    if c.get('mode')!='chassis' or not c.get('slug'): continue
    slug=c['slug']; vals=set()
    for k,v in (c.get('tokens') or {}).items():
        if isinstance(v,str) and len(v)>=8: vals.add(v.strip())
    for o in (c.get('copyOverrides') or []):
        r=o.get('replace','')
        # long literal phrases inside overrides
        for ph in re.findall(r'[A-Za-z][A-Za-z\'’ &\-]{10,60}', r):
            ph=ph.strip()
            # keep only distinctive phrases: >=20 chars or containing a mid-string capital
            if len(ph)>=20 or any(c.isupper() for c in ph[1:]): vals.add(ph)
    for k in ('brand','coachName','igHandle'):
        if c.get(k) and len(str(c[k]))>=6: vals.add(str(c[k]))
    per_cfg.setdefault(slug,set()).update(vals)
for slug,vals in per_cfg.items():
    for v in vals: defaults_seen[v]=defaults_seen.get(v,0)+1

# signature = value used by exactly ONE config (shared defaults/IG urls are fine)
SKIP = re.compile(r'^https?://|^#|^\d|instagram\.com|typeform\.com')
for slug,vals in per_cfg.items():
    s={v for v in vals if defaults_seen[v]==1 and not SKIP.search(v)}
    sigs[slug]=s

ALLOW={ 'Moriarty','HYROX arena','HYROX Cardiff','Istanbul','istanbul','Gymshark','DFYNE',
 'FITR programme','Race ready','Race-floor proof, studio-owner focus.','HYROX Elite','gymshark','dfyne',
 # legitimate shared facts between race partners (Zara/Gabby) and same-event cities (Bordeaux flags)
 'Budapest','budapest','Bordeaux','bordeaux','Piergianni','Gabby Moriarty' }

# anything present in the current chassis source or engine defaults is template boilerplate, not a leak
CHASSIS_TXT=(ROOT/'scripts/reskin-tenant.js').read_text(errors='ignore')
for p in (ROOT/'chassis').rglob('*'):
    if p.suffix in ('.html','.js','.json','.css') and p.stat().st_size<4_000_000:
        CHASSIS_TXT+=p.read_text(errors='ignore')
for slug in list(sigs):
    sigs[slug]={v for v in sigs[slug] if v not in CHASSIS_TXT}

viol=0
for site in sorted(BATCH.iterdir()):
    if not site.is_dir() or site.is_symlink(): continue
    slug=site.name
    text=[]
    for p in site.rglob('*'):
        if p.suffix in ('.html','.js','.json') and p.stat().st_size<4_000_000:
            text.append((p, p.read_text(errors='ignore')))
    for other,sset in sigs.items():
        if other==slug: continue
        for v in sset:
            if v in ALLOW: continue
            for p,t in text:
                if v in t:
                    print(f"GHOST  {slug} contains {other}'s: {v[:80]!r}  ({p.relative_to(site)})")
                    viol+=1
print(f"\n{'FAIL — '+str(viol)+' violations' if viol else 'PASS — no cross-tenant ghosts'}")
sys.exit(1 if viol else 0)
