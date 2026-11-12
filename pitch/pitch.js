(function () {
  var root = document.querySelector(".pitch");
  var slug = root && root.getAttribute("data-slug");
  if (!slug) return;

  var sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
  function send(event, pct, secs) {
    var payload = JSON.stringify({ slug: slug, event: event, pct: pct, sid: sid, secs: secs });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/pitch-event", new Blob([payload], { type: "application/json" }));
    } else {
      fetch("/api/pitch-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(function () {});
    }
  }

  // First visit vs return: the flag persists per slug so we can tell a fresh
  // open from a prospect coming back for another look.
  var seenKey = "pv_" + slug;
  var returning = false;
  try { returning = !!localStorage.getItem(seenKey); localStorage.setItem(seenKey, "1"); } catch (e) { /* storage may be blocked */ }
  send(returning ? "revisit" : "view");

  var video = document.getElementById("pitchVideo");
  var cover = document.getElementById("playerCover");
  if (video && cover) {
  var milestones = { 25: false, 50: false, 75: false };
  var played = false;

  function start() {
    cover.hidden = true;
    video.play();
    if (!played) {
      played = true;
      send("play");
    }
  }

  cover.addEventListener("click", start);
  video.addEventListener("click", function () {
    if (!played) start();
  });

  video.addEventListener("timeupdate", function () {
    if (!video.duration) return;
    var pct = (video.currentTime / video.duration) * 100;
    for (var m in milestones) {
      if (!milestones[m] && pct >= Number(m)) {
        milestones[m] = true;
        send("progress", Number(m), Math.round(video.currentTime));
      }
    }
  });

  // Watch time: a heartbeat while playing and a final flush when the tab
  // hides/closes, so the log shows seconds watched even without milestones.
  var watchTimer = null;
  video.addEventListener("play", function () {
    watchTimer = setInterval(function () {
      if (!video.paused) send("watch", null, Math.round(video.currentTime));
    }, 30000);
  });
  video.addEventListener("pause", function () {
    if (watchTimer) { clearInterval(watchTimer); watchTimer = null; }
    if (played) send("watch", null, Math.round(video.currentTime));
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden" && played) {
      send("watch", null, Math.round(video.currentTime));
    }
  });

  video.addEventListener("ended", function () {
    send("complete", null, Math.round(video.currentTime));
  });

  }

  document.querySelectorAll("[data-cta]").forEach(function (a) {
    a.addEventListener("click", function () {
      send(a.getAttribute("data-cta"));
    });
  });
})();
