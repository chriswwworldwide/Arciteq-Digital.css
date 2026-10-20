#!/usr/bin/env python3
"""Score candidate images against slot descriptions and reference photos using CLIP.

Usage:
  python scripts/image-clip-score.py <source-dir> [--reference <dir>] [--slots <slots.json>] [--cues <station-cues.json>]

Outputs <source-dir>/clip-scores.json with per-image scores for:
  - Every slot description (how well the image matches what the slot needs)
  - Reference face similarity (how likely this is the coach vs. a stranger)
  - Activity/scene labels (burpee, sled push, rowing, running, etc.)

The model downloads once (~350MB) and caches in ~/.cache/huggingface/.
Runs on CPU on Apple Silicon in about 1-2s per image.
"""

import argparse
import json
import os
import sys

import open_clip
import torch
from PIL import Image

# -------------------------------------------------------------------
# Slot prompts: natural-language descriptions of what each slot needs.
# These are scored against every candidate image.
# -------------------------------------------------------------------

def build_slot_prompts(slots_path, cues_path):
    """Build CLIP text prompts from slots.json and station-cues.json."""
    prompts = {}

    if os.path.exists(slots_path):
        manifest = json.load(open(slots_path))
        for name, slot in manifest.get("slots", {}).items():
            label = slot.get("label", name)
            keywords = slot.get("keywords", [])
            desc = f"a photo suitable for '{label}'"
            if keywords:
                desc += f": {', '.join(keywords[:6])}"
            prompts[name] = desc

    # Station-specific prompts from cues
    if os.path.exists(cues_path):
        cues = json.load(open(cues_path))
        for station, info in cues.get("stations", {}).items():
            slot_name = f"images/station-{station}.jpg"
            cue_list = info.get("cues", [])
            if cue_list:
                prompts[f"station_{station}"] = (
                    f"athlete doing {station.replace('-', ' ')} at a fitness event: "
                    + "; ".join(cue_list[:4])
                )

    return prompts


# -------------------------------------------------------------------
# Scene/activity labels: scored against every image to classify content.
# -------------------------------------------------------------------

SCENE_PROMPTS = {
    "burpee_broad_jump": "athlete doing burpee broad jumps on a marked lane at a HYROX fitness event",
    "sled_push": "athlete pushing a weighted sled at a HYROX fitness event",
    "sled_pull": "athlete pulling a rope attached to a sled at a HYROX fitness event",
    "skierg": "athlete using a SkiErg machine pulling handles downward",
    "rowing": "athlete rowing on a Concept2 rowing machine at a fitness event",
    "wall_balls": "athlete throwing a wall ball upward at a target",
    "farmers_carry": "athlete carrying heavy kettlebells walking",
    "sandbag_lunges": "athlete doing lunges while carrying a sandbag on shoulders",
    "running": "person running at a race event or on a track",
    "finish_line": "athlete crossing a finish line at a race event, celebrating",
    "time_board": "results board or timing screen showing race times and scores",
    "podium": "athletes standing on a podium celebrating with medals",
    "coaching": "fitness coach directing athletes during a training session in a gym",
    "group_event": "large group of athletes at a fitness event or competition",
    "portrait": "portrait photo of one person looking at camera in a gym",
    "selfie": "selfie or mirror photo",
    "food_drink": "food, drink, restaurant or bar setting",
    "nature_scenic": "outdoor nature landscape, trail, park or scenic view",
    "text_graphic": "graphic with text overlay, social media post or infographic",
    "transformation": "before and after body transformation comparison photos",
    "equipment_setup": "gym equipment being assembled or set up",
}


def main():
    parser = argparse.ArgumentParser(description="CLIP-score images for slot allocation")
    parser.add_argument("source_dir", help="Directory of candidate images")
    parser.add_argument("--reference", help="Directory of confirmed coach reference photos")
    parser.add_argument("--slots", default=None, help="Path to slots.json")
    parser.add_argument("--cues", default=None, help="Path to station-cues.json")
    parser.add_argument("--model", default="ViT-B-32", help="CLIP model name")
    parser.add_argument("--pretrained", default="laion2b_s34b_b79k", help="Pretrained weights")
    args = parser.parse_args()

    src = args.source_dir
    if not os.path.isdir(src):
        print(f"error: {src} is not a directory", file=sys.stderr)
        sys.exit(1)

    # Find paths
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    slots_path = args.slots or os.path.join(root, "chassis", "images", "slots.json")
    cues_path = args.cues or os.path.join(root, "chassis", "images", "station-cues.json")

    # Load CLIP
    print(f"loading CLIP model {args.model}...", file=sys.stderr)
    model, _, preprocess = open_clip.create_model_and_transforms(
        args.model, pretrained=args.pretrained
    )
    tokenizer = open_clip.get_tokenizer(args.model)
    model.eval()

    # Build text prompts
    slot_prompts = build_slot_prompts(slots_path, cues_path)
    all_prompts = {**slot_prompts, **{f"scene:{k}": v for k, v in SCENE_PROMPTS.items()}}

    prompt_names = list(all_prompts.keys())
    prompt_texts = list(all_prompts.values())

    # Encode all text prompts once
    with torch.no_grad():
        text_tokens = tokenizer(prompt_texts)
        text_features = model.encode_text(text_tokens)
        text_features /= text_features.norm(dim=-1, keepdim=True)

    # Reference photos for coach identity matching
    ref_features = None
    if args.reference and os.path.isdir(args.reference):
        ref_images = [
            f for f in os.listdir(args.reference)
            if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
        ]
        if ref_images:
            ref_tensors = []
            for f in ref_images:
                try:
                    img = preprocess(Image.open(os.path.join(args.reference, f)).convert("RGB"))
                    ref_tensors.append(img)
                except Exception:
                    continue
            if ref_tensors:
                with torch.no_grad():
                    ref_batch = torch.stack(ref_tensors)
                    ref_features = model.encode_image(ref_batch)
                    ref_features /= ref_features.norm(dim=-1, keepdim=True)
                    # Average into a single "coach" embedding
                    ref_features = ref_features.mean(dim=0, keepdim=True)
                    ref_features /= ref_features.norm(dim=-1, keepdim=True)
                print(f"reference: {len(ref_tensors)} photo(s) → coach embedding", file=sys.stderr)

    # Process candidate images
    img_exts = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
    candidates = sorted([
        f for f in os.listdir(src)
        if os.path.splitext(f)[1].lower() in img_exts
    ])
    print(f"scoring {len(candidates)} images against {len(prompt_names)} prompts...", file=sys.stderr)

    results = {}
    for i, filename in enumerate(candidates):
        filepath = os.path.join(src, filename)
        try:
            img = preprocess(Image.open(filepath).convert("RGB")).unsqueeze(0)
        except Exception as e:
            print(f"  skip {filename}: {e}", file=sys.stderr)
            continue

        with torch.no_grad():
            img_features = model.encode_image(img)
            img_features /= img_features.norm(dim=-1, keepdim=True)

            # Score against all text prompts
            similarities = (img_features @ text_features.T).squeeze(0).tolist()

            # Score against coach reference
            coach_sim = None
            if ref_features is not None:
                coach_sim = float((img_features @ ref_features.T).squeeze())

        # Build scores dict
        scores = {}
        scene_scores = {}
        slot_scores = {}
        for name, sim in zip(prompt_names, similarities):
            if name.startswith("scene:"):
                scene_scores[name[6:]] = round(sim, 4)
            else:
                slot_scores[name] = round(sim, 4)

        # Top scene matches
        top_scenes = sorted(scene_scores.items(), key=lambda x: -x[1])[:5]

        results[filename] = {
            "slotScores": slot_scores,
            "sceneScores": scene_scores,
            "topScenes": [{"label": k, "score": v} for k, v in top_scenes],
            "coachSimilarity": round(coach_sim, 4) if coach_sim is not None else None,
        }

        if (i + 1) % 10 == 0 or i == len(candidates) - 1:
            print(f"  {i + 1}/{len(candidates)}", file=sys.stderr)

    # Write output
    out_path = os.path.join(src, "clip-scores.json")
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2)
        f.write("\n")
    print(f"wrote {out_path} ({len(results)} images scored)", file=sys.stderr)


if __name__ == "__main__":
    main()
