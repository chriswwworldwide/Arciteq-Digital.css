#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("approval")
    parser.add_argument("source")
    parser.add_argument("outdir")
    parser.add_argument("--cols", type=int, default=5)
    parser.add_argument("--tile", type=int, default=320)
    args = parser.parse_args()

    approval = json.loads(Path(args.approval).read_text())
    source = Path(args.source)
    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    for slot, filename in approval.get("slots", {}).items():
        target = source / filename
        if not target.exists():
            print("missing", slot, filename)
            continue
        rows.append((slot.replace("images/", ""), filename, Image.open(target).convert("RGB")))

    tile, cols, label_height = args.tile, args.cols, 42
    per_sheet = cols * 5
    for start in range(0, len(rows), per_sheet):
        chunk = rows[start : start + per_sheet]
        sheet_rows = (len(chunk) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * tile, sheet_rows * (tile + label_height)), "black")
        draw = ImageDraw.Draw(sheet)
        for index, (slot, filename, image) in enumerate(chunk):
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
            draw.text((x + 5, y + tile + 3), slot, fill="white")
            draw.text((x + 5, y + tile + 20), filename, fill="#aaaaaa")
        target = out / f"allocation-{start // per_sheet + 1}.jpg"
        sheet.save(target, quality=90)
        print(target)


if __name__ == "__main__":
    main()
