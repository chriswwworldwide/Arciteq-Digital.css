#!/usr/bin/env python3
# ig-pull.py — pull a public creator's IG posts (full-res images + captions)
# for chassis demo builds. Uses the logged-in browser session (Chrome via
# browser_cookie3) so no password handling.
#
#   python3 scripts/ig-pull.py <handle> <outdir> [--max N] [--sleep S]
#
# Output: <outdir>/<shortcode>.jpg + <shortcode>.txt (caption + date +
# permalink). Re-run safe (skips existing). Keep --sleep >= 1 on big pulls —
# the session belongs to a real account and IG rate-limits reads.
#
# Requires: /tmp/igenv (venv with instaloader + browser_cookie3) or any
# python with those two packages.

import argparse, sys, time
from pathlib import Path

import browser_cookie3
import instaloader
import urllib.request

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("handle")
    ap.add_argument("outdir")
    ap.add_argument("--max", type=int, default=60)
    ap.add_argument("--sleep", type=float, default=1.0)
    args = ap.parse_args()

    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)

    cookies = {c.name: c.value for c in browser_cookie3.chrome(domain_name="instagram.com")}
    if "sessionid" not in cookies or "ds_user_id" not in cookies:
        sys.exit("no IG session in Chrome — log into instagram.com first")

    L = instaloader.Instaloader(
        download_pictures=False, download_videos=False,
        download_geotags=False, download_comments=False, save_metadata=False,
    )
    L.context.load_session(str(cookies["ds_user_id"]), cookies)
    print("session:", L.test_login())

    prof = instaloader.Profile.from_username(L.context, args.handle)
    print(f"{prof.full_name} — {prof.mediacount} posts")

    got = 0
    for post in prof.get_posts():
        if got >= args.max:
            break
        base = out / post.shortcode
        txt = base.with_suffix(".txt")
        if txt.exists():
            got += 1
            continue

        # images: main image or every node of a carousel
        urls = []
        if post.typename == "GraphSidecar":
            urls = [n.display_url for n in post.get_sidecar_nodes() if not n.is_video]
        elif not post.is_video:
            urls = [post.url]
        if not urls:  # pure video post — grab the thumbnail so nothing is lost
            urls = [post.url] if post.url else []

        for i, u in enumerate(urls):
            suffix = f"_{i+1}" if len(urls) > 1 else ""
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
            try:
                data = urllib.request.urlopen(req, timeout=30).read()
            except Exception as e:
                print("  ! img fail", post.shortcode, e)
                continue
            (out / f"{post.shortcode}{suffix}.jpg").write_bytes(data)

        txt.write_text(
            f"{post.date_utc.date()}  https://www.instagram.com/p/{post.shortcode}/\n\n{post.caption or ''}\n"
        )
        got += 1
        print(f"{got:3d} {post.shortcode} {post.date_utc.date()} imgs={len(urls)} {(post.caption or '')[:50]!r}")
        time.sleep(args.sleep)

    print(f"\ndone — {got} posts → {out}/")

if __name__ == "__main__":
    main()
