// hero-reveal.js — WebGL unroll-and-resolve on the home hero.
// A canvas overlays the hero <img>. The photo starts wrapped into a
// spiral scroll at the top-left corner (real mesh deformation — the
// vertex shader is ported from Yuriy Artyukh's Codrops "Unrolling
// Images" demo) and physically unrolls diagonally to the bottom-right.
// As each strip of paper lays flat it lands as a coarse mosaic of the
// photo — dark seams, dimmed blocks — that sharpens to full resolution
// just behind the roll front (the Codrops "Revealing WebGL Images"
// pixel-resolve). At the end the canvas fades out and the plain <img>
// takes over (hero-drift resumes). Progressive enhancement: no WebGL /
// small screen / reduced-motion → the <img> just shows.
(() => {
  const html = document.documentElement;
  // ?revdebug=info pins a badge on the hero reporting which path the
  // script took — for diagnosing browsers we can't remote-inspect.
  const dbgParam = new URLSearchParams(location.search).get("revdebug");
  const dbgBadge = (msg) => {
    if (dbgParam !== "info") return;
    const b = document.createElement("div");
    b.style.cssText =
      "position:absolute;z-index:999;top:6px;left:6px;background:rgba(0,0,0,.85);color:#7f7;font:11px/1.5 monospace;padding:4px 8px;white-space:pre";
    b.textContent = msg;
    (document.querySelector(".hero--bleed") || document.body).appendChild(b);
  };
  const done = () => {
    html.classList.remove("reveal-live");
    html.classList.add("reveal-done");
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    dbgBadge("exit: reduced-motion");
    return done();
  }

  const section = document.querySelector(".hero--bleed");
  const img = section && section.querySelector(".hero-img");
  if (!img) {
    dbgBadge("exit: no .hero-img");
    return done();
  }
  // ?fx=0-3 / ?fx=demo are owned by emerge.js (Codrops emerge shader) —
  // bail so the roll doesn't fight it.
  if (window.__emerge) {
    dbgBadge("exit: emerge owns ?fx");
    return done();
  }

  // Ported from akella/UnrollingImages (Codrops) — the plane is deformed
  // into a spiral scroll; `u_progress` pays it out along the `u_angle`
  // diagonal. vResolve trails the front so the fragment side can settle
  // the freshly laid paper from mosaic to sharp.
  const VS = `
    attribute vec3 a_pos;
    attribute vec2 a_uv;
    uniform mat4 u_mvp;
    uniform float u_progress;
    uniform float u_angle;
    uniform float u_dim;
    uniform float u_fx; // 1 = displace preview: flat quad, dissolve in FS
    varying vec2 vUv;
    varying float vShadow;
    varying float vResolve;
    varying float vTube;
    const float pi = 3.14159265359;

    mat4 rotationMatrix(vec3 axis, float angle) {
      axis = normalize(axis);
      float s = sin(angle);
      float c = cos(angle);
      float oc = 1.0 - c;
      return mat4(
        oc*axis.x*axis.x + c,          oc*axis.x*axis.y - axis.z*s,   oc*axis.z*axis.x + axis.y*s,   0.0,
        oc*axis.x*axis.y + axis.z*s,   oc*axis.y*axis.y + c,          oc*axis.y*axis.z - axis.x*s,   0.0,
        oc*axis.z*axis.x - axis.y*s,   oc*axis.y*axis.z + axis.x*s,   oc*axis.z*axis.z + c,          0.0,
        0.0,                           0.0,                           0.0,                           1.0);
    }
    vec3 rotate(vec3 v, vec3 axis, float angle) {
      return (rotationMatrix(axis, angle) * vec4(v, 1.0)).xyz;
    }

    void main() {
      vUv = a_uv;
      if (u_fx > 0.5) {
        // flat sheet covering the section — the reveal lives in the FS
        vShadow = 1.0;
        vResolve = 1.0;
        vTube = 1.0;
        gl_Position = u_mvp * vec4(a_pos, 1.0);
        return;
      }
      vec3 newposition = a_pos;
      float rad = 0.1;
      float rolls = 5.0;

      // measure the vertex along the unroll axis (rotate into roll space)
      newposition = rotate(newposition - vec3(-.5,.5,0.), vec3(0.,0.,1.), -u_angle) + vec3(-.5,.5,0.);
      float offs = (newposition.x + 0.5) / (sin(u_angle) + cos(u_angle));
      float tProgress = clamp((u_progress - offs*0.99) / 0.01, 0., 1.);
      // curled paper reads as dark scroll, not a second copy of the image:
      // pow keeps the dim on through the mid-unwrap, image emerges at ~flat
      vTube = pow(tProgress, 6.0);
      vShadow = clamp((u_progress - offs*0.95) / 0.05, u_dim, 1.);
      // the mosaic trail: a wide band of paper settling behind the roll —
      // u_progress runs past 1 so the last-laid corner finishes resolving
      // after the roll has emptied
      vResolve = clamp((u_progress - offs*0.99) / 0.38, 0.0, 1.0);

      // wrap the sheet into spiral turns, shrinking along the roll
      newposition.z = rad + rad*(1. - offs/2.) * sin(-offs*rolls*pi - 0.5*pi);
      newposition.x = -0.5 + rad*(1. - offs/2.) * cos(-offs*rolls*pi + 0.5*pi);
      newposition = rotate(newposition - vec3(-.5,.5,0.), vec3(0.,0.,1.), u_angle) + vec3(-.5,.5,0.);
      // and unwind it as progress sweeps
      newposition = rotate(newposition - vec3(-.5,0.5,rad), vec3(sin(u_angle),cos(u_angle),0.), -pi*u_progress*rolls);
      newposition += vec3(
        -.5 + u_progress*cos(u_angle)*(sin(u_angle)+cos(u_angle)),
        0.5 - u_progress*sin(u_angle)*(sin(u_angle)+cos(u_angle)),
        rad*(1. - u_progress/2.));
      vec3 finalposition = mix(newposition, a_pos, tProgress);
      gl_Position = u_mvp * vec4(finalposition, 1.0);
    }`;

  const FS = `
    precision mediump float;
    varying vec2 vUv;
    varying float vShadow;
    varying float vResolve;
    varying float vTube;
    uniform sampler2D u_tex;
    uniform highp float u_progress;
    uniform vec4 u_uv;      // xy = crop offset, zw = crop scale (cover fit)
    uniform float u_feather;
    uniform float u_seam;
    uniform vec4 u_photo;   // photo rect in sheet uv (fullRoll); else 0,0,1,1
    uniform float u_pmargin;
    uniform float u_tube;   // dimming of the still-rolled face
    uniform float u_full;   // 1 in fullRoll — no mosaic, wave covers sheet
    uniform highp float u_fx; // 1 = displace preview: noise-dissolve reveal
    uniform highp float u_time; // seconds — drives the sparkle twinkle

    // Dave Hoskins hash — deterministic per-cell random, the standard
    // sparkle/glitter building block
    float hash21(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }
    // smooth value noise for the dissolve field
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
        mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
        f.y);
    }

    void main() {
      // ?fx=displace preview — the Codrops "revealing WebGL images"
      // family: the photo resolves out of the page through a distorted
      // noise front. Flat quad; no roll, no wave, no sparkle.
      if (u_fx > 0.5) {
        // diagonal sweep TL→BR (same direction as the roll) — the noise
        // warps the front so it reads organic, not a straight wipe
        float sweep = (vUv.x + vUv.y) * 0.5;
        float n =
          vnoise(vUv * 6.0) * 0.75 + vnoise(vUv * 22.0) * 0.25;
        float f = sweep * 0.55 + n * 0.45;
        float d = 1.0 - smoothstep(u_progress - 0.05, u_progress + 0.15, f);
        // distortion concentrated on the reveal edge — the developing
        // moment where the front is passing
        float edge =
          smoothstep(0.0, 0.2, d) * (1.0 - smoothstep(0.2, 0.5, d));
        vec2 duv =
          vUv +
          (vec2(vnoise(vUv * 14.0 + 3.7), vnoise(vUv * 14.0 + 9.1)) - 0.5) *
            edge * 0.18;
        vec3 dc = texture2D(u_tex, u_uv.xy + duv * u_uv.zw).rgb;
        dc *= mix(0.35, 1.0, d) + edge * 0.5; // dim inside, bloom on edge
        float a2 = clamp(u_progress * 4.0, 0.0, 1.0) * d;
        float fe = max(u_feather, 0.0001);
        a2 *= smoothstep(0.0, fe, vUv.x) * smoothstep(0.0, fe, 1.0 - vUv.x) *
              smoothstep(0.0, fe, vUv.y) * smoothstep(0.0, fe, 1.0 - vUv.y);
        gl_FragColor = vec4(dc, a2);
        return;
      }

      // fullRoll: the ambient area is just a blurred backdrop — running the
      // mosaic resolve on it renders a blocky dark version of the photo
      // beside the real one (the "shadow image"). And even the photo's own
      // mosaic reads as "bitmappy" during laydown — in full mode the sheet
      // renders clean throughout; the classic img-pinned roll keeps it.
      vec2 pd = max(max(u_photo.xy - vUv, vUv - u_photo.zw), 0.0);
      float inPhoto = 1.0 - smoothstep(0.0, u_pmargin, length(pd));
      float resolve = max(vResolve, mix(1.0 - inPhoto, 1.0, u_full));

      // Pixelated reveal à la the Codrops demo: resolution jumps through
      // discrete steps (4→256 cells) rather than interpolating, and each
      // tile sits inside its cell with the dark curtain showing between
      // them — the gaps close as the paper settles and sharpens.
      float level = floor(mix(2.0, 8.0, resolve));
      float cells = exp2(level);
      // fullRoll samples the texture straight — the 256-cell snap is
      // exactly the "bitmappy till it settles" look; mosaic is a classic-
      // mode effect only
      vec2 cuv =
        u_full > 0.5
          ? u_uv.xy + vUv * u_uv.zw
          : u_uv.xy + ((floor(vUv * cells) + 0.5) / cells) * u_uv.zw;
      vec3 col = texture2D(u_tex, cuv).rgb;

      vec2 f = fract(vUv * cells);
      float gap = mix(0.0, 0.11, 1.0 - resolve);     // gap closes fully as it sharpens
      float tile = step(gap * 0.5, f.x) * step(f.x, 1.0 - gap * 0.5) *
                   step(gap * 0.5, f.y) * step(f.y, 1.0 - gap * 0.5);
      // the +5% lift compensates the dark seams while tiles are apart —
      // applied unconditionally it makes the landed sheet brighter than the
      // DOM img beneath, so the crossfade shows a darker second image
      col *= mix(1.05, 1.0, resolve);

      col *= vShadow;
      // The ambient half carries no mosaic, so flat-tone paper lands
      // identical to the page — the sweep is invisible there. Freshly-laid
      // ambient arrives bright AND rose-tinted, settling to tone: a
      // coloured light wave trailing the roll, unmissable on the dark hero.
      // The pink settle wave: paper arrives hot pink and settles to tone
      // as the trail passes. In fullRoll it washes the WHOLE sheet —
      // straight through the photo to the right edge, no demarcation.
      float fresh = (1.0 - vResolve) * u_full;
      col = mix(col, vec3(1.0, 0.16, 0.62), fresh);
      // shimmer — the canonical sweep: a bright band hugging the roll
      // front (skeleton-shimmer style) over a soft lift across all
      // freshly-laid paper.
      float band = (1.0 - smoothstep(0.0, 0.4, vResolve)) * u_full;
      col += vec3(1.0, 0.5, 0.85) * band * 0.8;
      col += vec3(0.9, 0.25, 0.6) * fresh * 0.5;
      // sparkle — the Comeau recipe ported into the sheet so the stars
      // deform with the paper: a jittered grid of four-point stars
      // (crossed gaussian flares) twinkling in/out at random phases,
      // alive only on freshly-laid paper.
      vec2 sg = vUv * 60.0;
      vec2 cell = floor(sg);
      vec2 sp = (vec2(hash21(cell + 17.0), hash21(cell + 31.0)) - 0.5) * 0.55;
      vec2 sd = fract(sg) - 0.5 - sp;
      float star = exp(-28.0 * sd.y * sd.y) * exp(-4.0 * sd.x * sd.x)
                 + exp(-28.0 * sd.x * sd.x) * exp(-4.0 * sd.y * sd.y)
                 + exp(-90.0 * dot(sd, sd)) * 0.7;
      float tw = 0.5 + 0.5 * sin(u_time * (3.0 + hash21(cell) * 5.0)
                                 + hash21(cell) * 6.2831);
      float on = step(hash21(cell + 5.0), 0.22); // ~22% of cells hold a star
      col += vec3(1.0, 0.9, 1.0) * star * tw * on * fresh * 0.3;
      // The still-rolled face samples the same texture — on the full-width
      // sheet it reads as a second copy of the picture riding ahead of the
      // roll. Dim it into a dark scroll; laid paper is untouched (vTube→1).
      col *= mix(u_tube, 1.0, vTube);
      // gaps are dark seams of the tile's own colour — NOT transparent:
      // during the reveal the <img> below is hidden, so see-through gaps
      // would show the light page background as a bright seam (worst on
      // mobile, where there's no ambient to blend into). The seam also
      // fades as the paper resolves, so no grid lingers over the photo.
      float seam = mix(1.0, u_seam, 1.0 - resolve);
      col *= mix(seam, 1.0, tile);
      float a = clamp(u_progress * 5.0, 0.0, 1.0);
      // feather the painted edges into what's behind — on desktop that's
      // the ambient (same photo, blurred) so the fade colour-matches itself
      float feat = max(u_feather, 0.0001);
      a *= smoothstep(0.0, feat, vUv.x) * smoothstep(0.0, feat, 1.0 - vUv.x) *
           smoothstep(0.0, feat, vUv.y) * smoothstep(0.0, feat, 1.0 - vUv.y);
      gl_FragColor = vec4(col, a);
    }`;

  let canvas,
    gl,
    uMVP,
    uProgress,
    uAngle,
    uProg2,
    uUv,
    uFeather,
    uDim,
    uSeam,
    uPhoto,
    uPmargin,
    uTube,
    uFull,
    uTime,
    uFx,
    tex,
    indexCount;
  const uvCrop = new Float32Array(4); // off.x, off.y, scale.x, scale.y
  uvCrop.set([0, 0, 1, 1]);
  const small = window.matchMedia("(max-width: 800px)").matches;
  // data-hero-roll="full": the sheet covers the WHOLE section (ambient
  // blur + photo baked into one texture — a single piece, no stitched
  // edges). Desktop only; mobile keeps the img-pinned roll.
  const fullRoll = section.dataset.heroRoll === "full";
  // ?fx= preview modes — tenant entrance demos. slit = CSS clip-path
  // entrance on the photo; displace = WebGL noise-dissolve handled
  // in-shader via u_fx. Anything else falls through to the normal roll.
  const fx = new URLSearchParams(location.search).get("fx");
  const heroMask = section.querySelector(".hero-mask");
  // slit + demo share the CSS clip-path entrance — a slanted sliver
  // widening to the full frame (diagonal, matching the roll's travel)
  if (fx === "slit" || fx === "demo") {
    const st = document.createElement("style");
    st.textContent =
      ".hero--bleed .hero-mask.fx-slit{animation:fx-slit 1.15s cubic-bezier(.7,0,.2,1) .2s both}" +
      "@keyframes fx-slit{" +
      "from{clip-path:polygon(52% -5%,72% -5%,48% 105%,28% 105%)}" +
      "to{clip-path:polygon(0 -5%,100% -5%,100% 105%,0 105%)}}";
    document.head.appendChild(st);
    if (fx === "slit") {
      if (heroMask) heroMask.classList.add("fx-slit");
      return done();
    }
  }
  dbgBadge(
    `small=${small} attr=${section.dataset.heroRoll} fullRoll=${fullRoll}\nua=${navigator.userAgent.match(/Version\/[\d.]+|Edg\/[\d.]+|Chrome\/[\d.]+|Firefox\/[\d.]+/)?.[0] || "?"}`,
  );
  try {
    canvas = document.createElement("canvas");
    canvas.className = "hero-canvas";
    canvas.setAttribute("aria-hidden", "true");
    gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });
    if (!gl) {
      dbgBadge("exit: no webgl context");
      return done();
    }

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) || "shader");
      }
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog) || "link");
    gl.useProgram(prog);

    // Grid mesh over the unit plane — dense enough for smooth spiral wraps
    const SEG = 120;
    const verts = new Float32Array((SEG + 1) * (SEG + 1) * 5);
    const idx = new Uint16Array(SEG * SEG * 6);
    let vi = 0;
    for (let y = 0; y <= SEG; y++) {
      for (let x = 0; x <= SEG; x++) {
        const u = x / SEG - 0.5;
        const v = 0.5 - y / SEG;
        verts[vi++] = u;
        verts[vi++] = v;
        verts[vi++] = 0;
        verts[vi++] = x / SEG;
        verts[vi++] = 1 - y / SEG;
      }
    }
    let ii = 0;
    for (let y = 0; y < SEG; y++) {
      for (let x = 0; x < SEG; x++) {
        const a = y * (SEG + 1) + x;
        const b = a + 1;
        const c = a + SEG + 1;
        const d = c + 1;
        idx[ii++] = a;
        idx[ii++] = c;
        idx[ii++] = b;
        idx[ii++] = b;
        idx[ii++] = c;
        idx[ii++] = d;
      }
    }
    indexCount = idx.length;
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_pos");
    const aUv = gl.getAttribLocation(prog, "a_uv");
    gl.enableVertexAttribArray(aPos);
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 20, 0);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 20, 12);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    uMVP = gl.getUniformLocation(prog, "u_mvp");
    uProgress = gl.getUniformLocation(prog, "u_progress");
    uAngle = gl.getUniformLocation(prog, "u_angle");
    uProg2 = gl.getUniformLocation(prog, "u_prog");
    uUv = gl.getUniformLocation(prog, "u_uv");
    uFeather = gl.getUniformLocation(prog, "u_feather");
    uDim = gl.getUniformLocation(prog, "u_dim");
    uSeam = gl.getUniformLocation(prog, "u_seam");
    uPhoto = gl.getUniformLocation(prog, "u_photo");
    uPmargin = gl.getUniformLocation(prog, "u_pmargin");
    uTube = gl.getUniformLocation(prog, "u_tube");
    uFull = gl.getUniformLocation(prog, "u_full");
    uTime = gl.getUniformLocation(prog, "u_time");
    uFx = gl.getUniformLocation(prog, "u_fx");
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    // fullRoll only: opaque clear so where the sheet hasn't laid yet the
    // page never shows the DOM beneath. Darker than the sheet's flat-ink
    // face so the roll front is actually VISIBLE sweeping the full width —
    // plum-on-plum read as "the roll only happens over the photo".
    if (fullRoll && fx !== "displace") gl.clearColor(0.045, 0.016, 0.04, 1);
    gl.uniform1f(uAngle, Math.PI / 4); // unrolls top-left → bottom-right
    // fullRoll: the sheet spans ambient + photo, so the Codrops trailing
    // dim + dark seams would read as a cast shadow beside the picture.
    // Halve both — the roll keeps its shading, the ambient stays clean.
    gl.uniform1f(uDim, fullRoll ? 0.85 : 0.7);
    gl.uniform1f(uSeam, fullRoll ? 0.75 : 0.55);
    gl.uniform4f(uPhoto, 0, 0, 1, 1); // classic: whole sheet is the photo
    gl.uniform1f(uPmargin, 0.03);
    gl.uniform1f(uTube, fullRoll ? 0.12 : 1.0);
    gl.uniform1f(uFull, fullRoll ? 1 : 0);
    gl.uniform1f(uFx, fx === "displace" ? 1 : 0);
  } catch (e) {
    console.warn("hero-reveal:", e);
    dbgBadge("setup catch: " + e.message);
    return done();
  }

  // MVP: world units = canvas CSS px, origin centre, y up — same trick as
  // the source demo (fov picked so 1 world unit ≈ 1 screen px at z=0).
  // Reads the img's real geometry (object-fit, object-position, padding)
  // so it works for the desktop contain/letterbox layout AND the mobile
  // cover-cropped square.
  // fullRoll: composite the whole hero into ONE texture — ambient layer
  // (cover-fit, blurred via downsample-upsample, darkened) plus the photo
  // drawn contain-fit at its painted rect with the left-edge feather baked
  // in. Single sheet, so there are no seams to misbehave mid-roll.
  const buildFullTex = (W, H, dpr) => {
    const cw = Math.max(2, Math.round(W * dpr));
    const ch = Math.max(2, Math.round(H * dpr));
    const comp = document.createElement("canvas");
    comp.width = cw;
    comp.height = ch;
    const c = comp.getContext("2d");
    c.imageSmoothingQuality = "high";
    const iw = tex2d.naturalWidth || 1125;
    const ih = tex2d.naturalHeight || 1080;
    // ambient: flat ink, NOT a blurred copy of the pic. Any readable copy
    // baked here reads as a second image on the rolling sheet — and
    // approximating .hero-amb's CSS filter stack can never be pixel-exact
    // across browsers (ctx.filter support, resampling), so a visible
    // mismatch is guaranteed somewhere. The DOM's own blurred ambient fades
    // in underneath at handoff and carries the look from there.
    // ?revdebug=amb re-enables the blurred bake for comparisons.
    const dbg = new URLSearchParams(location.search).get("revdebug");
    if (dbg !== "amb") {
      // Paper needs a faint diagonal sheen — flat fill identical to the
      // page plum makes the laid sheet invisible on the ambient half
      // ("very transparent, can't make it out"). A subtle tone sweep
      // reads as paper without carrying any image content.
      const sheen = c.createLinearGradient(0, 0, cw * 0.9, ch);
      sheen.addColorStop(0, "#0e061c");
      sheen.addColorStop(0.55, "#090413");
      sheen.addColorStop(1, "#07030e");
      c.fillStyle = sheen;
      c.fillRect(0, 0, cw, ch);
    } else {
    const ambS = Math.max(cw / iw, ch / ih);
    const ambW = iw * ambS * 1.15;
    const ambH = ih * ambS * 1.15;
    const ambX = cw / 2 + ((cw - iw * ambS) * 0.55 - cw / 2) * 1.15;
    const ambY = ch / 2 + ((ch - ih * ambS) * 0.3 - ch / 2) * 1.15;
    // Detect REAL ctx.filter support BEFORE assigning — where unsupported,
    // `c.filter = ...` just sets a plain property, the string reads back
    // non-"none", and the ambient draws UNFILTERED: a bright full-size copy
    // of the photo next to the sharp one (the ghost image).
    if (typeof c.filter === "string") {
      c.filter = `blur(${48 * dpr}px) brightness(0.55) saturate(1.15)`;
      // overshoot the draw rect so the blur doesn't pull in transparent
      // fringes at the canvas edges
      const m = Math.ceil(96 * dpr);
      c.drawImage(
        tex2d,
        ambX - m,
        ambY - m * (ambH / ambW),
        ambW + 2 * m,
        ambH + 2 * m * (ambH / ambW),
      );
      c.filter = "none";
    } else {
      const sm = document.createElement("canvas");
      sm.width = Math.max(2, Math.round(cw / 16));
      sm.height = Math.max(2, Math.round(ch / 16));
      const sc = sm.getContext("2d");
      sc.drawImage(tex2d, ambX / 16, ambY / 16, ambW / 16, ambH / 16);
      c.drawImage(sm, 0, 0, cw, ch);
      c.fillStyle = "rgba(0, 0, 0, 0.45)";
      c.fillRect(0, 0, cw, ch);
    }
    }

    // photo: painted where CSS actually puts it — the img's own layout
    // box minus padding, with its real object-fit/object-position.
    // Desktop = contain, right-pinned; mobile = cover full-width square
    // at a 65%/45% focal point.
    const ib = layoutBox(img, section) || { x: 0, y: 0, w: W, h: H };
    const cs = getComputedStyle(img);
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const bx = ib.x + pl;
    const by = ib.y + pt;
    const cW = ib.w - pl - pr;
    const cH = ib.h - pt - pb;
    const cover = cs.objectFit === "cover";
    const s2 = cover
      ? Math.max(cW / iw, cH / ih)
      : Math.min(cW / iw, cH / ih);
    const pw = iw * s2;
    const ph = ih * s2;
    const [pxs = "50%", pys = "50%"] = String(
      cs.objectPosition || "50% 50%",
    )
      .trim()
      .split(/\s+/);
    const pos = (v) =>
      v === "center" ? 0.5 : v.endsWith("%") ? parseFloat(v) / 100 : 0.5;
    const px = bx + (cW - pw) * pos(pxs);
    const py = by + (cH - ph) * pos(pys);

    // visible rect = where the drawn image intersects the content box
    // (contain: the image; cover: the box) — the shader uses it for
    // inPhoto tests
    const vx0 = Math.max(bx, px);
    const vy0 = Math.max(by, py);
    const vx1 = Math.min(bx + cW, px + pw);
    const vy1 = Math.min(by + cH, py + ph);
    // photo rect in sheet uv (texture is y-flipped on upload) — the
    // fragment shader only mosaics inside it, so the ambient can't render
    // as a blocky shadow beside the real pic
    gl.uniform4f(uPhoto, vx0 / W, 1 - vy1 / H, vx1 / W, 1 - vy0 / H);

    // photo layer on its own canvas so the feather only fades the photo,
    // revealing the ambient beneath. Must mirror app.js's dynamic mask on
    // .hero-mask: destination-out gradients at ALL FOUR painted edges, 2.5%
    // deep — NOT the old 190px stylesheet zone, which was overridden inline
    // and would bake a long soft "shadow" band the DOM never shows.
    const lay = document.createElement("canvas");
    lay.width = cw;
    lay.height = ch;
    const lc = lay.getContext("2d");
    lc.imageSmoothingQuality = "high"; // match the browser's CSS image scaling
    // clip cover-fit overflow to the content box (mobile crops the photo)
    lc.save();
    lc.beginPath();
    lc.rect(bx * dpr, by * dpr, cW * dpr, cH * dpr);
    lc.clip();
    lc.drawImage(tex2d, px * dpr, py * dpr, pw * dpr, ph * dpr);
    lc.restore();
    lc.globalCompositeOperation = "destination-out";
    // DOM edge treatment differs by breakpoint: desktop feathers all four
    // sides ~2.5% (matches the baked mask); mobile only has the mask's
    // 12px ink fade along the bottom — sides stay hard (overflow:hidden).
    const ex = vx0 * dpr,
      ey = vy0 * dpr,
      ew = (vx1 - vx0) * dpr,
      eh = (vy1 - vy0) * dpr;
    const edge = (x1, y1, x2, y2) => {
      const gr = lc.createLinearGradient(x1, y1, x2, y2);
      gr.addColorStop(0, "rgba(0,0,0,1)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      lc.fillStyle = gr;
      lc.fillRect(0, 0, cw, ch);
    };
    if (small) {
      // mobile: bottom-only fade, deep enough that no line reads as the
      // wave crosses the photo→ink boundary (DOM mask gets the same)
      edge(0, ey + eh, 0, ey + eh - eh * 0.15);
    } else {
      const fw = ew * 0.025;
      const fh = eh * 0.025;
      edge(ex, 0, ex + fw, 0); // left
      edge(ex + ew, 0, ex + ew - fw, 0); // right
      edge(0, ey, 0, ey + fh); // top
      // bottom fades ~3x deeper — the sweep highlights a hard line where
      // the photo meets ink, so it needs a real gradient, not a fringe
      edge(0, ey + eh, 0, ey + eh - eh * 0.08);
    }
    c.drawImage(lay, 0, 0);
    // Power-of-two pad: WebGL1 only mipmaps POT textures, and without
    // mipmaps the photo aliases ("bitmappy") while the sheet is still
    // angled mid-unroll. Upscale-to-POT keeps UV mapping identical.
    const pw2 = (v) => 2 ** Math.ceil(Math.log2(Math.max(2, v)));
    const pot = document.createElement("canvas");
    pot.width = pw2(cw);
    pot.height = pw2(ch);
    pot.getContext("2d").drawImage(comp, 0, 0, pot.width, pot.height);
    return pot;
  };

  let mvp = null;
  const buildMVP = () => {
    const W = fullRoll ? section.clientWidth : img.clientWidth;
    const H = fullRoll ? section.clientHeight : img.clientHeight;
    if (!W || !H) return;
    const cs = getComputedStyle(img);
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const pl = parseFloat(cs.paddingLeft) || 0;
    const pr = parseFloat(cs.paddingRight) || 0;
    const cW = W - pl - pr;
    const cH = H - pt - pb;
    const iw = tex2d.naturalWidth || 1125;
    const ih = tex2d.naturalHeight || 1080;
    const cover = cs.objectFit === "cover";
    const s = cover ? Math.max(cW / iw, cH / ih) : Math.min(cW / iw, cH / ih);
    const pw = iw * s;
    const ph = ih * s;
    const [pxs = "50%", pys = "50%"] = String(cs.objectPosition || "50% 50%")
      .trim()
      .split(/\s+/);
    const pos = (v) =>
      v === "center" ? 0.5 : v.endsWith("%") ? parseFloat(v) / 100 : 0.5;
    const fx = pos(pxs);
    const fy = pos(pys);
    // the plane = what's visibly painted: the letterboxed rect for contain,
    // the whole content box for cover — and the whole section for fullRoll,
    // where the baked texture already contains ambient + photo
    const rw = fullRoll ? W : cover ? cW : pw;
    const rh = fullRoll ? H : cover ? cH : ph;
    const rx0 = fullRoll ? 0 : cover ? pl : pl + (cW - pw) * fx;
    const ry0 = fullRoll ? 0 : cover ? pt : pt + (cH - ph) * fy;
    const rx = rx0 + rw / 2 - W / 2; // rect centre, world x
    const ry = H / 2 - (ry0 + rh / 2); // world y (y up)
    uvCrop.set(
      !fullRoll && cover
        ? [((pw - cW) * fx) / pw, ((ph - cH) * fy) / ph, cW / pw, cH / ph]
        : [0, 0, 1, 1],
    );

    const camZ = 400;
    const fov = 2 * Math.atan(H / 2 / camZ);
    const near = 50,
      far = 1500;
    const f = 1 / Math.tan(fov / 2);
    const aspect = W / H;
    const P = [
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (far + near) / (near - far),
      -1,
      0,
      0,
      (2 * far * near) / (near - far),
      0,
    ];
    // model = translate(rect centre) * scale(rect w, rect h, rect w/2)
    const M = [rw, 0, 0, 0, 0, rh, 0, 0, 0, 0, rw / 2, 0, rx, ry, -camZ, 1];
    // mvp = P * M (column-major)
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        for (let k = 0; k < 4; k++) o[c * 4 + r] += P[k * 4 + r] * M[c * 4 + k];
    mvp = new Float32Array(o);
  };

  // offset* are pure layout values — they ignore the img's enter/drift
  // transforms AND scroll, so the canvas pins to where the photo actually
  // lays out and stays dead still while the hidden img's entrance
  // animation plays underneath. Pinning to getBoundingClientRect instead
  // made the canvas chase the rotating bounding box: 23 re-pins during
  // the 2.8s enter, each rebuilding the plane — a visible shudder.
  const layoutBox = (el, parent) => {
    let x = 0,
      y = 0,
      n = el;
    while (n && n !== parent) {
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent;
    }
    return n === parent
      ? { x, y, w: el.offsetWidth, h: el.offsetHeight }
      : null;
  };

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parent = canvas.parentElement;
    // fullRoll covers the whole section; classic pins to the img's layout box
    let lb = fullRoll
      ? { x: 0, y: 0, w: section.clientWidth, h: section.clientHeight }
      : layoutBox(img, parent);
    if (!lb) {
      // fallback: parent isn't in the img's offset chain — use rects
      const pr = parent.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      lb = {
        x: ir.left - pr.left,
        y: ir.top - pr.top,
        w: ir.width,
        h: ir.height,
      };
    }
    canvas.style.top = `${lb.y}px`;
    canvas.style.left = `${lb.x}px`;
    canvas.style.width = `${lb.w}px`;
    // Pin to the img's exact rect — shrinking the canvas squashes the photo
    // and the bottom visibly clicks down at handoff. Edge leak is handled
    // by the 14px clip-path on the canvas instead.
    canvas.style.height = `${lb.h}px`;
    canvas.width = Math.round(lb.w * dpr);
    canvas.height = Math.round(lb.h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    buildMVP();
  };

  const tex2d = new Image();
  tex2d.onload = () => {
    // Mount inside the mask wrapper BEFORE size() — it reads the parent's
    // rect to position the canvas. On mobile its overflow:hidden clips the
    // tilted canvas exactly at the photo's bottom edge (killing the corner
    // leak without a dead strip); on desktop it shares the baked feather
    // mask. fullRoll mounts on the section itself, before .wrap, so the
    // sheet covers the whole hero but stays under the headline copy.
    const host = section.querySelector(".hero-mask") || section;
    if (fullRoll) {
      const wrap = section.querySelector(".wrap");
      section.insertBefore(canvas, wrap || null);
    } else {
      host.appendChild(canvas);
    }
    try {
      size();
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        fullRoll
          ? buildFullTex(section.clientWidth, section.clientHeight, dpr)
          : tex2d,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // fullRoll texture is POT (buildFullTex pads it) — mipmaps +
      // anisotropy smooth the angled mid-roll sampling; NPOT classic
      // texture can't mipmap in WebGL1 and is left as-is.
      if (fullRoll) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.LINEAR_MIPMAP_LINEAR,
        );
        const aniso =
          gl.getExtension("EXT_texture_filter_anisotropic") ||
          gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic") ||
          gl.getExtension("MOZ_EXT_texture_filter_anisotropic");
        if (aniso) {
          const max = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
          gl.texParameterf(
            gl.TEXTURE_2D,
            aniso.TEXTURE_MAX_ANISOTROPY_EXT,
            Math.min(8, max || 1),
          );
        }
      }
    } catch (e) {
      console.warn("hero-reveal:", e);
      dbgBadge("onload catch: " + e.message);
      canvas.remove();
      return done();
    }

    html.classList.add("reveal-live");
    // fullRoll: the DOM layer must not show through the sheet — the page
    // already carries the pic twice (.hero-amb blurred backdrop + .hero-img)
    // and the composite bakes both in, so a visible DOM copy under a
    // not-yet-laid sheet is literally a second image. Hide the whole layer;
    // the canvas is cleared opaque so the un-laid region is flat ink.
    if (fullRoll) html.classList.add("reveal-full");

    const DURATION = 3400;
    const DELAY = 200;
    // ?revdebug=hold freezes the roll at ~45% and outlines the canvas —
    // shows exactly what area the sheet covers and what it looks like
    // mid-flight on the actual browser.
    const hold = dbgParam === "hold";
    if (hold) {
      canvas.style.outline = "2px solid #f0f";
      canvas.style.outlineOffset = "-2px";
    }
    // power2.out like the source demo — the roll decelerates as it empties.
    // Progress overshoots to 1.35 so the mosaic keeps settling after the
    // roll has finished laying the sheet (~74% through the sweep).
    // fullRoll uses near-linear progress instead: power2.out crosses the
    // ambient half in the first ~0.7s while the front is fastest, leaving
    // ~2.5s of action over the photo — reads as "photo-only roll". A
    // steady front makes the whole-hero sweep actually visible.
    const ease = (t) => 1 - Math.pow(1 - t, 2);
    const start = performance.now() + DELAY;
    // ?fx=demo — the sales loop: three entrances play back-to-back with
    // clean-page pauses between, each labelled so a prospect can compare
    // (choosing = buying). slit is a DOM clip-path phase; displace + roll
    // run in GL. Everything sweeps top-left → bottom-right.
    const PHASES =
      fx === "demo"
        ? [
            { fx: "slit", label: "1 / 3 · slit in", dur: 1500 },
            { fx: "pause", dur: 1600 },
            { fx: "displace", label: "2 / 3 · dissolve", dur: 2600 },
            { fx: "pause", dur: 1600 },
            { fx: "roll", label: "3 / 3 · the roll", dur: 3400 },
          ]
        : null;
    let demoTag = null;
    if (PHASES) {
      demoTag = document.createElement("div");
      demoTag.style.cssText =
        "position:absolute;left:16px;bottom:14px;z-index:60;" +
        "background:rgba(0,0,0,.55);color:#fff;padding:6px 12px;" +
        "border-radius:99px;font:600 11px/1 system-ui,sans-serif;" +
        "letter-spacing:.14em;text-transform:uppercase;pointer-events:none";
      section.appendChild(demoTag);
    }
    // Re-pin only when the img's LAYOUT box genuinely moves (resize,
    // reflow) — never for transforms or scroll, which can't affect where
    // the canvas sits inside its parent.
    let lastPin = "";
    const pin = () => {
      const lb = fullRoll
        ? { w: section.clientWidth, h: section.clientHeight, x: 0, y: 0 }
        : layoutBox(img, canvas.parentElement);
      const key = lb
        ? `${lb.x}|${lb.y}|${lb.w}|${lb.h}`
        : `${img.offsetWidth}|${img.offsetHeight}`;
      if (key !== lastPin) {
        lastPin = key;
        size();
      }
    };
    const frame = (now) => {
      pin();
      let t;
      let fxNow = fx;
      if (PHASES) {
        const el = now - start;
        let acc = 0;
        let ph = null;
        for (const P of PHASES) {
          if (el < acc + P.dur) {
            ph = P;
            break;
          }
          acc += P.dur;
        }
        if (!ph) {
          // demo over — hand the page back
          canvas.style.transition = "opacity .35s ease";
          canvas.style.opacity = "0";
          if (demoTag) demoTag.remove();
          setTimeout(() => canvas.remove(), 400);
          return done();
        }
        t = Math.min(1, (el - acc) / ph.dur);
        if (ph.fx === "pause" || ph.fx === "slit") {
          // DOM-side phase: settled page visible; slit animates the mask
          canvas.style.opacity = "0";
          html.classList.remove("reveal-live");
          if (ph.fx === "slit" && heroMask)
            heroMask.classList.add("fx-slit");
          if (demoTag) demoTag.textContent = ph.label || "";
          return requestAnimationFrame(frame);
        }
        // GL phase — canvas back on top, DOM img hidden again
        canvas.style.opacity = "1";
        html.classList.add("reveal-live");
        if (heroMask) heroMask.classList.remove("fx-slit");
        fxNow = ph.fx;
        if (demoTag) demoTag.textContent = ph.label || "";
      } else {
        t = hold
          ? 0.45
          : Math.max(0, Math.min(1, (now - start) / DURATION));
      }
      const p =
        fxNow === "displace"
          ? ease(t) * 1.15
          : (fullRoll ? t : ease(t)) * 1.35;
      if (mvp) gl.uniformMatrix4fv(uMVP, false, mvp);
      gl.uniform1f(uProgress, p);
      gl.uniform1f(uProg2, p);
      gl.uniform1f(uFx, fxNow === "displace" ? 1 : 0);
      gl.uniform4fv(uUv, uvCrop);
      gl.uniform1f(uTime, now * 0.001);
      // feather only where there's an ambient backdrop to melt into
      gl.uniform1f(uFeather, small ? 0 : 0.025);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
      if (t < 1 || hold || PHASES) return requestAnimationFrame(frame);
      // Race-finish popper: confetti pop from both bottom corners as the
      // sheet settles into the page. Respects reduced-motion.
      if (
        fullRoll &&
        !fx &&
        typeof window.confetti === "function" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        const pink = ["#7c3aed", "#e98dff", "#ffffff", "#dfc8ff"];
        // a fixed burst covers a phone but reads as a weak corner
        // firework on a wide desktop — scale count/spread/velocity so
        // the pop crosses the page
        const wide = window.innerWidth > 800;
        const burst = {
          colors: pink,
          scalar: 1.1,
          spread: wide ? 100 : 70,
          startVelocity: wide ? 75 : 45,
          ticks: wide ? 280 : 200,
        };
        window.confetti({
          ...burst,
          particleCount: wide ? 170 : 60,
          angle: 60,
          origin: { x: 0, y: 0.95 },
        });
        window.confetti({
          ...burst,
          particleCount: wide ? 170 : 60,
          angle: 120,
          origin: { x: 1, y: 0.95 },
        });
      }
      // Hand back to the plain <img> — fade the canvas out, then drop it.
      canvas.style.transition = "opacity .35s ease";
      canvas.style.opacity = "0";
      setTimeout(() => canvas.remove(), 400);
      done();
    };
    requestAnimationFrame(frame);
  };
  tex2d.onerror = done;
  tex2d.src = img.currentSrc || img.src;
})();
