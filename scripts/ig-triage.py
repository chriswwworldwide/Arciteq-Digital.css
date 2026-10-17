#!/usr/bin/env python3
# ig-triage.py — pull a profile's recent posts as thumbnails only and tile
# them into labelled contact sheets, so photo selection is a visual pass
# instead of a caption guess.
#
#   /tmp/igenv/bin/python scripts/ig-triage.py <handle> <outdir> [--max N] [--cols N]
#
# Output: <outdir>/sheet-1.jpg, sheet-2.jpg … (6-col grid, each tile labelled
# with its shortcode so picks can be named: "DeM64xSu19i, Dd4gj47RotA").
# Then fetch full-res of picks with: ig-pull.py <handle> <dir> --only CODE,CODE

import argparse, sys
from io import BytesIO
from pathlib import Path

import browser_cookie3
import instaloader
import urllib.request
from PIL import Image, ImageDraw

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("handle")
    ap.add_argument("outdir")
    ap.add_argument("--max", type=int, default=48)
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

    tiles = []  # (shortcode, PIL image)
    for post in prof.get_posts():
        if len(tiles) >= args.max:
            break
        try:
            if post.typename == "GraphSidecar":
                nodes = [n for n in post.get_sidecar_nodes() if not n.is_video]
                if not nodes:
                    continue
                url = nodes[0].display_url
            else:
                url = post.display_url
            img = Image.open(BytesIO(urllib.request.urlopen(url).read())).convert("RGB")
            tiles.append((post.shortcode, img))
        except Exception as e:
            print("skip", post.shortcode, e)

    T, C = args.tile, args.cols
    rows_per = 5
    per_sheet = rows_per * C
    for si in range(0, len(tiles), per_sheet):
        chunk = tiles[si : si + per_sheet]
        rows = (len(chunk) + C - 1) // C
        sheet = Image.new("RGB", (C * T, rows * (T + 24)), "black")
        d = ImageDraw.Draw(sheet)
        for i, (code, img) in enumerate(chunk):
            x, y = (i % C) * T, (i // C) * (T + 24)
            # centre-crop to square
            w, h = img.size
            m = min(w, h)
            img = img.crop(((w - m) // 2, (h - m) // 2, (w + m) // 2, (h + m) // 2)).resize((T, T))
            sheet.paste(img, (x, y))
            d.text((x + 6, y + T + 4), code, fill="white")
        name = out / f"sheet-{si // per_sheet + 1}.jpg"
        sheet.save(name, quality=88)
        print("wrote", name)

if __name__ == "__main__":
    main()
