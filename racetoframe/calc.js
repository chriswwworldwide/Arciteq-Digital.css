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

// Next-race target: two finish times → trend + safe/realistic/stretch.
(function () {
  const form = document.getElementById("target-form");
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const MIN_GAIN = 60;
  const MAX_GAIN = 6 * 60;
  const BAND = 2 * 60;

  function parse(t) {
    const p = String(t || "")
      .trim()
      .split(":")
      .map(Number);
    if (p.length < 2 || p.length > 3 || p.some((n) => !Number.isFinite(n)))
      return NaN;
    return p.reduce((acc, n) => acc * 60 + n, 0);
  }

  function fmt(totalSec) {
    const s = Math.max(0, Math.round(totalSec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  function signed(sec) {
    const a = Math.abs(sec);
    const m = Math.floor(a / 60);
    const s = a % 60;
    return `${sec < 0 ? "−" : "+"}${m}:${String(s).padStart(2, "0")}`;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const a = parse($("target-a").value);
    const b = parse($("target-b").value);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 2400 || b < 2400) {
      $("target-a").focus();
      return;
    }
    const delta = b - a;
    const best = Math.min(a, b);
    let gain;
    let trend;
    if (delta < 0) {
      gain = Math.min(MAX_GAIN, Math.max(MIN_GAIN, -delta / 2));
      trend = `You took ${signed(delta)} off last race — nice. Carry roughly half of that forward.`;
    } else if (delta === 0) {
      gain = MIN_GAIN;
      trend =
        "Same time twice: you've found a plateau. Aim to nudge it, not smash it.";
    } else {
      gain = MIN_GAIN;
      trend = `Last race was ${signed(delta)} slower than the one before (heat, course, life). Target your best, then a bit more.`;
    }
    const real = best - gain;
    $("target-trend").textContent = trend;
    $("target-safe").textContent = fmt(real + BAND);
    $("target-real").textContent = fmt(real);
    $("target-stretch").textContent = fmt(real - BAND);
    $("target-out").hidden = false;
  });
})();
