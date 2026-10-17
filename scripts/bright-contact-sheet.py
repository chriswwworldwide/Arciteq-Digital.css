#!/usr/bin/env python3
import argparse
import json
import urllib.request
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw


def owner(record):
    profile = record.get("user_posted") or record.get("account")
    if profile:
        return str(profile).lower()
    for value in (record.get("profile_url"), (record.get("discovery_input") or {}).get("url")):
        if value and "instagram.com/" in value:
            return value.split("instagram.com/", 1)[1].split("/", 1)[0].lower()
    return ""


def media(record):
    candidates = []
    children = record.get("post_content") or []
    if children:
        for index, child in enumerate(children[:6], 1):
            url = child.get("image_url") or child.get("display_url") or child.get("thumbnail")
            if url:
                candidates.append((f"{record.get('shortcode', 'post')}_{index}", url, bool(child.get("video_url"))))
    if not candidates:
        url = record.get("thumbnail") or record.get("image_url")
        if not url:
            images = record.get("images") or []
            url = images[0] if images else None
        if url:
            candidates.append((record.get("shortcode", "post"), url, bool(record.get("videos"))))
    return candidates


def grab(url):
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return Image.open(BytesIO(urllib.request.urlopen(request, timeout=30).read())).convert("RGB")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("records")
    parser.add_argument("outdir")
    parser.add_argument("handles", nargs="+")
    parser.add_argument("--max", type=int, default=60)
    parser.add_argument("--cols", type=int, default=6)
    parser.add_argument("--tile", type=int, default=320)
    args = parser.parse_args()

    records = json.loads(Path(args.records).read_text())
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)

    for requested in args.handles:
        handle = requested.lstrip("@").lower()
        tiles = []
        for record in records:
            if owner(record) != handle:
                continue
            for label, url, video in media(record):
                if len(tiles) >= args.max:
                    break
                try:
                    tiles.append((f"{label}{' [VID]' if video else ''}", grab(url)))
                except Exception as error:
                    print("skip", handle, label, error)
            if len(tiles) >= args.max:
                break

        tile, cols, label_height = args.tile, args.cols, 24
        per_sheet = cols * 5
        for start in range(0, len(tiles), per_sheet):
            chunk = tiles[start : start + per_sheet]
            rows = (len(chunk) + cols - 1) // cols
            sheet = Image.new("RGB", (cols * tile, rows * (tile + label_height)), "black")
            draw = ImageDraw.Draw(sheet)
            for index, (label, image) in enumerate(chunk):
                x = (index % cols) * tile
                y = (index // cols) * (tile + label_height)
                width, height = image.size
                crop = min(width, height)
                image = image.crop(
                    (
                        (width - crop) // 2,
                        (height - crop) // 2,
                        (width + crop) // 2,
                        (height + crop) // 2,
                    )
                ).resize((tile, tile))
                sheet.paste(image, (x, y))
                draw.text((x + 5, y + tile + 4), label, fill="white")
            target = out / f"{handle}-sheet-{start // per_sheet + 1}.jpg"
            sheet.save(target, quality=88)
            print(target, len(chunk))


if __name__ == "__main__":
    main()
