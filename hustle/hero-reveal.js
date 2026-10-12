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
  const done = () => {
    html.classList.remove("reveal-live");
    html.classList.add("reveal-done");
  };
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return done();

  const section = document.querySelector(".hero--bleed");
  const img = section && section.querySelector(".hero-img");
  if (!img) return done();

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
    varying vec2 vUv;
    varying float vShadow;
    varying float vResolve;
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
      vec3 newposition = a_pos;
      float rad = 0.1;
      float rolls = 5.0;

      // measure the vertex along the unroll axis (rotate into roll space)
      newposition = rotate(newposition - vec3(-.5,.5,0.), vec3(0.,0.,1.), -u_angle) + vec3(-.5,.5,0.);
      float offs = (newposition.x + 0.5) / (sin(u_angle) + cos(u_angle));
      float tProgress = clamp((u_progress - offs*0.99) / 0.01, 0., 1.);
      vShadow = clamp((u_progress - offs*0.95) / 0.05, 0.7, 1.);
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
    uniform sampler2D u_tex;
    uniform highp float u_progress;
    uniform vec4 u_uv;      // xy = crop offset, zw = crop scale (cover fit)
    uniform float u_feather;

    void main() {
      // Pixelated reveal à la the Codrops demo: resolution jumps through
      // discrete steps (4→256 cells) rather than interpolating, and each
      // tile sits inside its cell with the dark curtain showing between
      // them — the gaps close as the paper settles and sharpens.
      float level = floor(mix(2.0, 8.0, vResolve));
      float cells = exp2(level);
      vec2 cuv = u_uv.xy + ((floor(vUv * cells) + 0.5) / cells) * u_uv.zw;
      vec3 col = texture2D(u_tex, cuv).rgb;
      // NCFC accent: unresolved mosaic tiles checkerboard canary/green,
      // fading back to the real photo as the paper resolves.
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      float chk = mod(floor(vUv.x * cells) + floor(vUv.y * cells), 2.0);
      vec3 ncfc = mix(vec3(1.0, 0.89, 0.05), vec3(0.0, 0.55, 0.24), chk);
      col = mix(ncfc * (0.4 + 0.8 * lum), col, vResolve);

      vec2 f = fract(vUv * cells);
      float gap = mix(0.0, 0.11, 1.0 - vResolve);     // gap closes fully as it sharpens
      float tile = step(gap * 0.5, f.x) * step(f.x, 1.0 - gap * 0.5) *
                   step(gap * 0.5, f.y) * step(f.y, 1.0 - gap * 0.5);
      col *= 1.05;

      col *= vShadow;
      // gaps are dark seams of the tile's own colour — NOT transparent:
      // during the reveal the <img> below is hidden, so see-through gaps
      // would show the light page background as a bright seam (worst on
      // mobile, where there's no ambient to blend into). The seam also
      // fades as the paper resolves, so no grid lingers over the photo.
      float seam = mix(1.0, 0.55, 1.0 - vResolve);
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
    tex,
    indexCount;
  const uvCrop = new Float32Array(4); // off.x, off.y, scale.x, scale.y
  uvCrop.set([0, 0, 1, 1]);
  const small = window.matchMedia("(max-width: 800px)").matches;
  // data-hero-roll="full": the sheet covers the WHOLE section (ambient
  // blur + photo baked into one texture — a single piece, no stitched
  // edges). Desktop only; mobile keeps the img-pinned roll.
  const fullRoll = !small && section.dataset.heroRoll === "full";
  try {
    canvas = document.createElement("canvas");
    canvas.className = "hero-canvas";
    canvas.setAttribute("aria-hidden", "true");
    gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
    });
    if (!gl) return done();

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
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.uniform1f(uAngle, Math.PI / 4); // unrolls top-left → bottom-right
  } catch (e) {
    console.warn("hero-reveal:", e);
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
    const iw = tex2d.naturalWidth || 1125;
    const ih = tex2d.naturalHeight || 1080;

    // ambient: cover-fit at the same object-position as .hero-amb, drawn
    // through a tiny buffer for a soft blur, then darkened (~brightness .55)
    const ambS = Math.max(cw / iw, ch / ih);
    const ambW = iw * ambS;
    const ambH = ih * ambS;
    const ambX = (cw - ambW) * 0.55;
    const ambY = (ch - ambH) * 0.3;
    const sm = document.createElement("canvas");
    sm.width = Math.max(2, Math.round(cw / 12));
    sm.height = Math.max(2, Math.round(ch / 12));
    const sc = sm.getContext("2d");
    sc.drawImage(tex2d, ambX / 12, ambY / 12, ambW / 12, ambH / 12);
    c.drawImage(sm, 0, 0, cw, ch);
    c.fillStyle = "rgba(20, 7, 15, 0.45)";
    c.fillRect(0, 0, cw, ch);

    // photo: contain-fit, padding 14/18, right-pinned — mirrors the CSS
    const cs = getComputedStyle(img);
    const pt = parseFloat(cs.paddingTop) || 0;
    const pb = parseFloat(cs.paddingBottom) || 0;
    const cW = W;
    const cH = H - pt - pb;
    const s2 = Math.min(cW / iw, cH / ih);
    const pw = iw * s2;
    const ph = ih * s2;
    const px = (cW - pw) * 1.0;
    const py = pt + (cH - ph) * 0.5;

    // photo layer on its own canvas so the feather only fades the photo,
    // revealing the ambient beneath — same composite as the masked DOM
    const lay = document.createElement("canvas");
    lay.width = cw;
    lay.height = ch;
    const lc = lay.getContext("2d");
    lc.drawImage(tex2d, px * dpr, py * dpr, pw * dpr, ph * dpr);
    lc.globalCompositeOperation = "destination-out";
    const g = lc.createLinearGradient((W - 780) * dpr, 0, (W - 590) * dpr, 0);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    lc.fillStyle = g;
    lc.fillRect(0, 0, cw, ch);
    c.drawImage(lay, 0, 0);
    return comp;
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
    } catch (e) {
      console.warn("hero-reveal:", e);
      canvas.remove();
      return done();
    }

    html.classList.add("reveal-live");

    const DURATION = 3400;
    const DELAY = 200;
    // power2.out like the source demo — the roll decelerates as it empties.
    // Progress overshoots to 1.35 so the mosaic keeps settling after the
    // roll has finished laying the sheet (~74% through the sweep).
    const ease = (t) => 1 - Math.pow(1 - t, 2);
    const start = performance.now() + DELAY;
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
      const t = Math.max(0, Math.min(1, (now - start) / DURATION));
      const p = ease(t) * 1.35;
      if (mvp) gl.uniformMatrix4fv(uMVP, false, mvp);
      gl.uniform1f(uProgress, p);
      gl.uniform1f(uProg2, p);
      gl.uniform4fv(uUv, uvCrop);
      // feather only where there's an ambient backdrop to melt into
      gl.uniform1f(uFeather, small ? 0 : 0.025);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, 0);
      if (t < 1) return requestAnimationFrame(frame);
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
