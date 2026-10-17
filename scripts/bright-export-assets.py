#!/usr/bin/env python3
import argparse
import json
import subprocess
import tempfile
import urllib.request
from pathlib import Path

import imageio_ffmpeg


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
        is_video = str(child.get("type", "")).lower() == "video"
        url = (
            child.get("url")
            if is_video
            else child.get("image_url") or child.get("display_url") or child.get("thumbnail")
        )
        if url:
            output.append(
                (f"{record.get('shortcode', 'post')}_{index}", url, index, len(children), is_video)
            )
    if output:
        return output
    videos = record.get("videos") or []
    if videos:
        return [(record.get("shortcode", "post"), videos[0], 1, 1, True)]
    url = record.get("thumbnail") or record.get("image_url")
    if not url:
        images = record.get("images") or []
        url = images[0] if images else None
    return [(record.get("shortcode", "post"), url, 1, 1, False)] if url else []


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("records")
    parser.add_argument("handle")
    parser.add_argument("outdir")
    parser.add_argument("--max", type=int, default=80)
    parser.add_argument("--selection")
    args = parser.parse_args()

    selected = None
    if args.selection:
        selection = json.loads(Path(args.selection).read_text())
        selected = {item["label"] for item in selection.get("candidates", [])}
        selected.update(selection.get("spares", []))
        for labels in selection.get("slots", {}).values():
            selected.update(labels)

    records = json.loads(Path(args.records).read_text())
    handle = args.handle.lstrip("@").lower()
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    exported = 0
    for record in records:
        if owner(record) != handle:
            continue
        caption = record.get("description") or ""
        for label, url, media_index, media_count, is_video in media(record):
            if exported >= args.max:
                break
            if selected is not None and label not in selected:
                continue
            targets = []
            request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            try:
                if is_video:
                    with tempfile.NamedTemporaryFile(suffix=".mp4") as video:
                        video.write(urllib.request.urlopen(request, timeout=60).read())
                        video.flush()
                        _, seconds = imageio_ffmpeg.count_frames_and_secs(video.name)
                        executable = imageio_ffmpeg.get_ffmpeg_exe()
                        for frame_index, fraction in enumerate((0.25, 0.5, 0.75), 1):
                            target = out / f"{label}_f{frame_index}.jpg"
                            if not target.exists():
                                subprocess.run(
                                    [
                                        executable,
                                        "-y",
                                        "-ss",
                                        f"{max(seconds * fraction, 0.1):.2f}",
                                        "-i",
                                        video.name,
                                        "-frames:v",
                                        "1",
                                        "-q:v",
                                        "2",
                                        str(target),
                                    ],
                                    check=True,
                                    capture_output=True,
                                    timeout=60,
                                )
                            targets.append(target)
                else:
                    target = out / f"{label}.jpg"
                    if not target.exists():
                        target.write_bytes(urllib.request.urlopen(request, timeout=45).read())
                    targets.append(target)
            except Exception as error:
                print("skip", label, error)
                continue
            for target in targets:
                target.with_suffix(".txt").write_text(
                    f"{record.get('date_posted', '')}  {record.get('url', '')}\n\n{caption}\n"
                )
                target.with_suffix(".meta.json").write_text(
                    json.dumps(
                        {
                            "shortcode": record.get("shortcode"),
                            "media_index": media_index,
                            "media_count": media_count,
                            "is_video_frame": is_video,
                            "caption_applies_to_carousel": media_count > 1,
                        },
                        indent=2,
                    )
                    + "\n"
                )
                exported += 1
                if exported >= args.max:
                    break
        if exported >= args.max:
            break
    print(f"exported {exported} assets for @{handle} → {out}")


if __name__ == "__main__":
    main()
