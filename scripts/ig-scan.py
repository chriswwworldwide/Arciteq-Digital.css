#!/usr/bin/env python3
# ig-scan.py — score IG handles as creator-site prospects.
#
#   /tmp/igenv/bin/python3 scripts/ig-scan.py handle1 handle2 ... [--posts 12] [--csv]
#
# For each handle: followers, post cadence, engagement rate, whether the bio
# routes through a link-in-bio tool (the thing a chassis site replaces),
# coaching signals in bio/captions, and a rough score. Prints a table;
# --csv emits rows for a spreadsheet.
#
# Ranking logic (rough, tune as we learn):
#   + engaged mid-size audience (10k–250k is the sweet spot — big enough to
#     monetise, small enough to not have a team)
#   + coaching/programmes keywords in bio or recent captions
#   + linktree/beacons/etc in bio → fragmented stack we replace
#   + posts recently (dead accounts score 0)
#
# Uses the Chrome IG session — same account-safety notes as ig-pull.py:
# keep --sleep >= 2 when scanning lists.

import argparse, re, sys, time
from datetime import datetime, timezone

import browser_cookie3
import instaloader

BIO_LINK_TOOLS = ("linktr.ee", "beacons.ai", "bio.site", "linkin.bio",
                  "koji.to", "stan.store", "hoo.be", "campsite.bio")
COACH_WORDS = re.compile(
    r"coach|coaching|programme|program|1:1|training plan|pt\b|personal train|"
    r"online coach|apply|enrol|book", re.I)


def classify(p: instaloader.Profile, posts):
    external = (p.external_url or "").lower()
    bio = (p.biography or "").lower()
    linktool = next((t for t in BIO_LINK_TOOLS if t in external or t in bio), "")

    coaching_bio = bool(COACH_WORDS.search(p.biography or ""))
    cap_hits = sum(
        1 for post in posts if COACH_WORDS.search(post.get("caption") or "")
    )
    likes = [post.get("likes") or 0 for post in posts]
    avg_likes = sum(likes) / len(likes) if likes else 0
    eng = avg_likes / p.followers if p.followers else 0

    dates = sorted((post.get("date") for post in posts if post.get("date")), reverse=True)
    last_post = dates[0].isoformat()[:10] if dates else ""
    days_since = (datetime.now(timezone.utc) - dates[0]).days if dates else 9999
    cadence = ""
    if len(dates) >= 2:
        span = (dates[0] - dates[-1]).days or 1
        cadence = f"{len(dates)}/{span}d"

    score = 0
    score += 2 if 10_000 <= p.followers <= 250_000 else (1 if p.followers >= 1_000 else 0)
    score += 2 if coaching_bio else 0
    score += min(cap_hits, 3)
    score += 3 if linktool else 0
    score += 2 if days_since <= 14 else (1 if days_since <= 45 else 0)
    score += 1 if eng >= 0.01 else 0

    return {
        "handle": p.username,
        "name": p.full_name,
        "followers": p.followers,
        "posts": p.mediacount,
        "cadence": cadence,
        "last_post": last_post,
        "eng_rate": round(eng * 100, 2),
        "linktool": linktool or "-",
        "coaching_bio": "Y" if coaching_bio else "-",
        "coach_caps": cap_hits,
        "score": score,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("handles", nargs="+")
    ap.add_argument("--posts", type=int, default=12, help="recent posts to sample")
    ap.add_argument("--sleep", type=float, default=2.0)
    ap.add_argument("--csv", action="store_true")
    args = ap.parse_args()

    cookies = {c.name: c.value for c in browser_cookie3.chrome(domain_name="instagram.com")}
    if "sessionid" not in cookies:
        sys.exit("no IG session in Chrome — log into instagram.com first")

    L = instaloader.Instaloader(
        download_pictures=False, download_videos=False,
        download_geotags=False, download_comments=False, save_metadata=False,
    )
    L.context.load_session(str(cookies["ds_user_id"]), cookies)

    cols = ["handle", "name", "followers", "posts", "cadence", "last_post",
            "eng_rate", "linktool", "coaching_bio", "coach_caps", "score"]
    rows = []
    for h in args.handles:
        h = h.lstrip("@")
        try:
            p = instaloader.Profile.from_username(L.context, h)
            posts = []
            for i, post in enumerate(p.get_posts()):
                if i >= args.posts:
                    break
                posts.append({"caption": post.caption, "likes": post.likes,
                              "date": post.date_utc.replace(tzinfo=timezone.utc)})
            rows.append(classify(p, posts))
        except Exception as e:
            print(f"  ! {h}: {e}", file=sys.stderr)
        time.sleep(args.sleep)

    rows.sort(key=lambda r: -r["score"])
    if args.csv:
        print(",".join(cols))
        for r in rows:
            print(",".join(str(r[c]) for c in cols))
    else:
        if not rows:
            sys.exit("no profiles resolved")
        w = {c: max(len(c), *(len(str(r[c])) for r in rows)) for c in cols}
        print("  ".join(c.ljust(w[c]) for c in cols))
        print("  ".join("-" * w[c] for c in cols))
        for r in rows:
            print("  ".join(str(r[c]).ljust(w[c]) for c in cols))


if __name__ == "__main__":
    main()
