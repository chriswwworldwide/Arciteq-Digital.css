#!/usr/bin/env python3
# ig-triage.py — pull a profile's recent posts as thumbnails only and tile
# them into labelled contact sheets, so photo selection is a visual pass
# instead of a caption guess.
#
#   /tmp/igenv/bin/python scripts/ig-triage.py <handle> <outdir> [--max N] [--cols N]
#
# Output: <outdir>/sheet-1.jpg, sheet-2.jpg … (6-col grid).
#   - Photo posts:        tile labelled CODE
#   - Carousels:          EVERY node tiled as CODE_1, CODE_2 … (first frame
#                         rarely represents the set — we want to see inside)
#   - Video posts:        thumbnail labelled CODE [VID] — promising ones can
#                         be frame-grabbed via ig-pull.py --frames
#
# Then fetch full-res of picks with: ig-pull.py <handle> <dir> --only CODE,CODE

import argparse, sys
from io import BytesIO
from pathlib import Path

import browser_cookie3
import instaloader
import urllib.request
from PIL import Image, ImageDraw

MAX_CAROUSEL = 20  # show every carousel child — a single HYROX race carousel can hold 12+ professional shots

# HYROX event locations — carousels referencing these are almost always professional event photography
HYROX_LOCATIONS = [
    "rome", "london", "birmingham", "manchester", "glasgow", "hamburg", "warsaw",
    "dublin", "vienna", "amsterdam", "paris", "madrid", "munich", "berlin", "nice",
    "chicago", "dallas", "atlanta", "new york", "nyc", "boston", "toronto",
    "sydney", "melbourne", "worlds", "world champs", "world championship",
    "elite 15", "challenger", "athens", "copenhagen", "lisbon", "zurich",
]

# Photographer credit signals — posts with these are likely professional shots
CREDIT_SIGNALS = ["📸", "photo by", "shot by", "captured by", "credit:", "📷", "@hyrox"]

def is_event_carousel(post, child_count=0):
    """Detect professional event carousels: 6+ images or HYROX location in caption.
    Pass child_count to avoid a redundant API call for sidecar node enumeration."""
    caption = (post.caption or "").lower()
    sidecar = post.typename == "GraphSidecar"
    has_location = any(loc in caption for loc in HYROX_LOCATIONS) or "hyrox" in caption
    has_credit = any(sig in caption for sig in CREDIT_SIGNALS)
    return (child_count >= 6 and sidecar) or (has_location and sidecar) or has_credit

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("handle")
    ap.add_argument("outdir")
    ap.add_argument("--max", type=int, default=100)
    ap.add_argument("--cols", type=int, default=6)
    ap.add_argument("--tile", type=int, default=360)
    args = ap.parse_args()

    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)

    cookies = {c.name: c.value for c in browser_cookie3.chrome(domain_name="instagram.com")}
    if "sessionid" not in cookies or "ds_user_id" not in cookies:
        sys.exit("no IG session in Chrome — log into instagram.com first")

    L = instaloader.Instaloader(
        download_pictures=False, download_videos=False,
        download_geotags=False, download_comments=False, save_metadata=False,
    )
    L.context.load_session(str(cookies["ds_user_id"]), cookies)
    print("session:", L.test_login())

    prof = instaloader.Profile.from_username(L.context, args.handle)
    print(f"{prof.full_name} — {prof.mediacount} posts; taking first {args.max}")

    def grab(url):
        return Image.open(BytesIO(urllib.request.urlopen(url).read())).convert("RGB")

    tiles = []  # (label, PIL image)
    event_carousels = []  # track professional carousels for the log
    seen = 0
    for post in prof.get_posts():
        if seen >= args.max:
            break
        seen += 1
        try:
            if post.typename == "GraphSidecar":
                children = list(post.get_sidecar_nodes())
                pro = is_event_carousel(post, child_count=len(children))
                pro_tag = " [PRO]" if pro else ""
                if pro:
                    event_carousels.append(post.shortcode)
                    print(f"  ★ PRO CAROUSEL: {post.shortcode} ({len(children)} images) — {(post.caption or '')[:80]}")
                for i, n in enumerate(children):
                    if i >= MAX_CAROUSEL:
                        break
                    tag = f"{post.shortcode}_{i+1}" + (" [VID]" if n.is_video else "") + pro_tag
                    tiles.append((tag, grab(n.display_url)))
            elif post.is_video:
                tiles.append((f"{post.shortcode} [VID]", grab(post.url)))
            else:
                tiles.append((post.shortcode, grab(post.url)))
        except Exception as e:
            print("skip", post.shortcode, e)

    if event_carousels:
        print(f"\n★ {len(event_carousels)} professional event carousel(s) found — prioritise [PRO] tiles")
    else:
        print("\n  No professional event carousels detected in this pull")

    T, C, LABEL = args.tile, args.cols, 24
    rows_per = 5
    per_sheet = rows_per * C
    for si in range(0, len(tiles), per_sheet):
        chunk = tiles[si : si + per_sheet]
        rows = (len(chunk) + C - 1) // C
        sheet = Image.new("RGB", (C * T, rows * (T + LABEL)), "black")
        d = ImageDraw.Draw(sheet)
        for i, (code, img) in enumerate(chunk):
            x, y = (i % C) * T, (i // C) * (T + LABEL)
            w, h = img.size
            m = min(w, h)
            img = img.crop(((w - m) // 2, (h - m) // 2, (w + m) // 2, (h + m) // 2)).resize((T, T))
            sheet.paste(img, (x, y))
            d.text((x + 6, y + T + 5), code, fill="white")
        name = out / f"sheet-{si // per_sheet + 1}.jpg"
        sheet.save(name, quality=88)
        print("wrote", name, f"({len(chunk)} tiles)")

if __name__ == "__main__":
    main()
