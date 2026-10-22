(function () {
  var root = document.querySelector(".pitch");
  var slug = root && root.getAttribute("data-slug");
  if (!slug) return;

  var sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
  function send(event, pct) {
    var payload = JSON.stringify({ slug: slug, event: event, pct: pct, sid: sid });
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

  send("view");

  var video = document.getElementById("pitchVideo");
  var cover = document.getElementById("playerCover");
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
        send("progress", Number(m));
      }
    }
  });

  video.addEventListener("ended", function () {
    send("complete");
  });

  document.querySelectorAll("[data-cta]").forEach(function (a) {
    a.addEventListener("click", function () {
      send(a.getAttribute("data-cta"));
    });
  });
})();
