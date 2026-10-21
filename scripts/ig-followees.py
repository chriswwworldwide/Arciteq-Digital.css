#!/usr/bin/env python3
"""Pull the list of accounts a public IG handle FOLLOWS (followees).

Designed for the HYROX UK ambassador excavation: pull @hyroxuk's followees
slowly, save progress for resume, and cap page count for a smoke test.

Pacing: the followee iterator fetches GraphQL pages of ~50 lazily, so a
~2.5s jittered sleep between yielded items spaces real network requests to
roughly one page per ~2 minutes — well under the "1 req / 2-3s" ceiling.

Usage:
  .venv/bin/python scripts/ig-followees.py hyroxuk --pages 1        # smoke test
  .venv/bin/python scripts/ig-followees.py hyroxuk                  # full pull
  .venv/bin/python scripts/ig-followees.py hyroxuk --resume         # continue

Output: scripts/reskin/prospects/followees-<handle>.json
Resume state: scripts/reskin/prospects/followees-<handle>.resume
"""

import argparse
import json
import os
import random
import time

import browser_cookie3
import instaloader
from instaloader import resumable_iteration

OUT_DIR = os.path.join(os.path.dirname(__file__), "reskin", "prospects")
PAGE_SIZE = 50  # IG edge_follow GraphQL page size


def load_instaloader():
    L = instaloader.Instaloader(quiet=False)
    cookies = {c.name: c.value for c in browser_cookie3.chrome(domain_name="instagram.com")}
    if "sessionid" not in cookies or "ds_user_id" not in cookies:
        raise SystemExit(
            "No Instagram login found in Chrome cookies "
            f"(have: {sorted(cookies)}). Log into IG in Chrome first."
        )
    L.context.load_session(str(cookies["ds_user_id"]), cookies)
    user = L.test_login()
    if not user:
        raise SystemExit("IG session rejected (rate limit or expired cookies). Wait and retry.")
    print(f"logged in as: {user}")
    return L


def main():
    p = argparse.ArgumentParser()
    p.add_argument("handle")
    p.add_argument("--pages", type=int, default=0, help="cap GraphQL pages (~50 each); 0 = no cap")
    p.add_argument("--resume", action="store_true", help="resume from saved iterator state")
    args = p.parse_args()

    out_path = os.path.join(OUT_DIR, f"followees-{args.handle}.json")
    resume_path = os.path.join(OUT_DIR, f"followees-{args.handle}.resume")
    os.makedirs(OUT_DIR, exist_ok=True)

    results = []
    if args.resume:
        if os.path.exists(out_path):
            results = json.load(open(out_path))
            print(f"loaded {len(results)} existing rows from {out_path}")
        if not os.path.exists(resume_path):
            raise SystemExit(f"no resume state at {resume_path}")

    L = load_instaloader()
    profile = instaloader.Profile.from_username(L.context, args.handle)
    print(f"@{args.handle}: followee_count={profile.followees}")

    iterator = profile.get_followees()
    ann_id = f"followees:{args.handle}"

    max_items = args.pages * PAGE_SIZE if args.pages else None
    fetched = 0

    def load_state(context, path):
        try:
            with open(path, "rb") as f:
                return instaloader.load_structure_from_file(context, f)
        except FileNotFoundError:
            return None

    def save_state(frozen, path):
        with open(path, "wb") as f:
            instaloader.save_structure_to_file(frozen, f)

    with resumable_iteration(
        L.context, iterator,
        load=load_state,
        save=save_state,
        format_path=lambda _: resume_path,
        # Always enabled: resumption is driven by whether the resume file
        # exists. To restart from scratch, delete the .resume file first.
    ) as (is_resuming, start_index):
        if is_resuming:
            print(f"resuming from iterator index {start_index}")
        for i, followee in enumerate(iterator):
            if i < start_index:
                continue
            results.append({
                "username": followee.username,
                "full_name": followee.full_name,
                "is_verified": followee.is_verified,
                "is_private": followee.is_private,
                "external_url": followee.external_url,
                "biography": followee.biography,
            })
            fetched += 1
            # Persist after every page boundary so a crash loses <50 rows.
            if len(results) % PAGE_SIZE == 0:
                json.dump(results, open(out_path, "w"), indent=1, ensure_ascii=False)
                print(f"  {len(results)} saved")
            if max_items and fetched >= max_items:
                print(f"page cap reached ({args.pages} page(s)); run again with --resume")
                break
            time.sleep(random.uniform(2.0, 3.0))

    json.dump(results, open(out_path, "w"), indent=1, ensure_ascii=False)
    print(f"done: {len(results)} followees -> {out_path}")


if __name__ == "__main__":
    main()
