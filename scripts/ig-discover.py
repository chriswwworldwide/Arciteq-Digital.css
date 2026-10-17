#!/usr/bin/env python3
# ig-discover.py — find prospect handles by harvesting recent authors from
# HYROX-coaching hashtags. Outputs a deduped handle list for ig-scan.py.
#
#   /tmp/igenv/bin/python scripts/ig-discover.py [--posts 40] [--sleep 2]

import argparse, sys, time

import browser_cookie3
import instaloader

HASHTAGS = [
    "hyroxcoach", "hyroxcoaching", "hyroxuk", "hyroxlondon",
    "hyroxtraining", "hyroxathlete",
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--posts", type=int, default=40, help="posts to scan per hashtag")
    ap.add_argument("--sleep", type=float, default=2.0)
    args = ap.parse_args()

    cookies = {c.name: c.value for c in browser_cookie3.chrome(domain_name="instagram.com")}
    if "sessionid" not in cookies:
        sys.exit("no IG session in Chrome — log into instagram.com first")

    L = instaloader.Instaloader(
        download_pictures=False, download_videos=False,
        download_geotags=False, download_comments=False, save_metadata=False,
    )
    L.context.load_session(str(cookies["ds_user_id"]), cookies)
    print("session:", L.test_login())

    handles = {}
    for tag in HASHTAGS:
        try:
            ht = instaloader.Hashtag.from_name(L.context, tag)
            n = 0
            for post in ht.get_posts():
                if n >= args.posts:
                    break
                n += 1
                try:
                    owner = post.owner_username
                    if owner:
                        handles[owner] = handles.get(owner, 0) + 1
                except Exception:
                    pass
            print(f"#{tag}: {n} posts → {len(handles)} handles so far")
        except Exception as e:
            print(f"#{tag} failed: {e}", file=sys.stderr)
        time.sleep(args.sleep)

    # most-frequent posters first — repeat hashtag users are the scene's coaches
    for h in sorted(handles, key=lambda h: -handles[h]):
        print(h, handles[h])

if __name__ == "__main__":
    main()
