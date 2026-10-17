#!/usr/bin/env python3
import argparse
import json
import urllib.request
from pathlib import Path


def owner(record):
    profile = record.get("user_posted") or record.get("account")
    if profile:
        return str(profile).lower()
    for value in (record.get("profile_url"), (record.get("discovery_input") or {}).get("url")):
        if value and "instagram.com/" in value:
            return value.split("instagram.com/", 1)[1].split("/", 1)[0].lower()
    return ""


def media(record):
    children = record.get("post_content") or []
    output = []
    for index, child in enumerate(children, 1):
        url = child.get("image_url") or child.get("display_url") or child.get("thumbnail")
        if url:
            output.append((f"{record.get('shortcode', 'post')}_{index}", url))
    if output:
        return output
    url = record.get("thumbnail") or record.get("image_url")
    if not url:
        images = record.get("images") or []
        url = images[0] if images else None
    return [(record.get("shortcode", "post"), url)] if url else []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("records")
    parser.add_argument("handle")
    parser.add_argument("outdir")
    parser.add_argument("--max", type=int, default=80)
    args = parser.parse_args()

    records = json.loads(Path(args.records).read_text())
    handle = args.handle.lstrip("@").lower()
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    exported = 0
    for record in records:
        if owner(record) != handle:
            continue
        caption = record.get("description") or ""
        for label, url in media(record):
            if exported >= args.max:
                break
            target = out / f"{label}.jpg"
            if not target.exists():
                request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                try:
                    target.write_bytes(urllib.request.urlopen(request, timeout=45).read())
                except Exception as error:
                    print("skip", label, error)
                    continue
            target.with_suffix(".txt").write_text(
                f"{record.get('date_posted', '')}  {record.get('url', '')}\n\n{caption}\n"
            )
            exported += 1
        if exported >= args.max:
            break
    print(f"exported {exported} assets for @{handle} → {out}")


if __name__ == "__main__":
    main()
