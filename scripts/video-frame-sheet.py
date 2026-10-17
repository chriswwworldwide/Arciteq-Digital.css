#!/usr/bin/env python3
import argparse
import json
import subprocess
import tempfile
import urllib.request
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("records")
    parser.add_argument("shortcode")
    parser.add_argument("outdir")
    parser.add_argument("--video", type=int, default=1)
    parser.add_argument("--frames", type=int, default=12)
    args = parser.parse_args()

    records = json.loads(Path(args.records).read_text())
    record = next((item for item in records if item.get("shortcode") == args.shortcode), None)
    if not record:
        raise SystemExit(f"shortcode not found: {args.shortcode}")
    videos = record.get("videos") or []
    if args.video < 1 or args.video > len(videos):
        raise SystemExit(f"video {args.video} unavailable; post has {len(videos)} videos")

    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(videos[args.video - 1], headers={"User-Agent": "Mozilla/5.0"})
    with tempfile.NamedTemporaryFile(suffix=".mp4") as video:
        video.write(urllib.request.urlopen(request, timeout=60).read())
        video.flush()
        _, seconds = imageio_ffmpeg.count_frames_and_secs(video.name)
        executable = imageio_ffmpeg.get_ffmpeg_exe()
        images = []
        for index in range(args.frames):
            fraction = (index + 1) / (args.frames + 1)
            target = out / f"{args.shortcode}_v{args.video}_p{round(fraction * 100):02d}.jpg"
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
            images.append((target.stem, Image.open(target).convert("RGB")))

    tile, label_height, cols = 320, 24, 4
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tile, rows * (tile + label_height)), "black")
    draw = ImageDraw.Draw(sheet)
    for index, (label, image) in enumerate(images):
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
    sheet_path = out / f"{args.shortcode}_v{args.video}_sheet.jpg"
    sheet.save(sheet_path, quality=90)
    print(sheet_path)


if __name__ == "__main__":
    main()
