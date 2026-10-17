#!/usr/bin/env python3
import argparse
import json
import urllib.request
from datetime import datetime, timezone
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
        for index, child in enumerate(children, 1):
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


def event_for(record, event_config):
    raw_date = record.get("date_posted") or record.get("datetime")
    if not raw_date:
        return None
    try:
        posted = datetime.fromisoformat(raw_date.replace("Z", "+00:00"))
        if posted.tzinfo is None:
            posted = posted.replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    window = int(event_config.get("windowDays", 21)) * 86400
    matches = []
    for event in event_config.get("events", []):
        event_date = datetime.fromisoformat(event["date"] + "T00:00:00+00:00")
        distance = abs((posted - event_date).total_seconds())
        if distance <= window:
            matches.append((distance, event["name"]))
    return min(matches)[1] if matches else None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("records")
    parser.add_argument("outdir")
    parser.add_argument("handles", nargs="+")
    parser.add_argument(
        "--max", type=int, default=60, help="maximum posts; every carousel child is shown"
    )
    parser.add_argument("--cols", type=int, default=6)
    parser.add_argument("--tile", type=int, default=320)
    args = parser.parse_args()

    records = json.loads(Path(args.records).read_text())
    event_config = json.loads(
        (Path(__file__).parent / "reskin" / "hyrox-event-windows.json").read_text()
    )
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)

    for requested in args.handles:
        handle = requested.lstrip("@").lower()
        tiles = []
        profile_records = [record for record in records if owner(record) == handle]
        profile_records.sort(
            key=lambda record: (
                0 if event_for(record, event_config) else 1,
                record.get("date_posted") or record.get("datetime") or "",
            )
        )
        label_records = []
        for record in profile_records[: args.max]:
            event_name = event_for(record, event_config)
            for label, url, video in media(record):
                try:
                    event_tag = f" [{event_name}]" if event_name else ""
                    tiles.append(
                        (f"{label}{' [VID]' if video else ''}{event_tag}", grab(url))
                    )
                    label_records.append(
                        {
                            "label": label,
                            "shortcode": record.get("shortcode"),
                            "video": video,
                            "event": event_name,
                            "url": url,
                        }
                    )
                except Exception as error:
                    print("skip", handle, label, error)

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
        labels_path = out / f"{handle}-labels.json"
        labels_path.write_text(json.dumps(label_records, indent=2))
        print(labels_path, len(label_records), "labels")


if __name__ == "__main__":
    main()
