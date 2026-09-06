(function () {
  const form = document.getElementById("calc-form");
  if (!form) return;
  const out = document.getElementById("calc-out");
  const $ = (id) => document.getElementById(id);

  const STATION_MIN = { new: 40, mid: 30, strong: 23 };
  const PRO_FACTOR = 1.1;
  const ROXZONE_MIN = 5;
  const RUN_PENALTY_SEC_PER_KM = 25;
  const WINDOW_MIN = 3;

  function fmt(totalSec) {
    const s = Math.max(0, Math.round(totalSec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const mm = String(m).padStart(h ? 2 : 1, "0");
    const ss = String(sec).padStart(2, "0");
    return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const min = Number($("calc-min").value);
    const sec = Number($("calc-sec").value || 0);
    if (!Number.isFinite(min) || min < 12 || min > 60) {
      $("calc-min").focus();
      return;
    }
    const fiveK = min * 60 + Math.min(59, Math.max(0, sec));
    const pacePerKm = fiveK / 5 + RUN_PENALTY_SEC_PER_KM;
    const runs = pacePerKm * 8 + ROXZONE_MIN * 60;
    let stations = STATION_MIN[$("calc-level").value] * 60;
    if ($("calc-div").value === "pro") stations *= PRO_FACTOR;
    const finish = runs + stations;

    $("calc-pace").textContent = `${fmt(pacePerKm)} /km`;
    $("calc-runs").textContent = fmt(runs);
    $("calc-stations").textContent = `~${fmt(stations)}`;
    $("calc-finish").textContent =
      `${fmt(finish - WINDOW_MIN * 60)} – ${fmt(finish + WINDOW_MIN * 60)}`;
    out.hidden = false;
  });
})();
