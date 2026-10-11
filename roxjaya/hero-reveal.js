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
  try {
    canvas = document.createElement("canvas");
    canvas.className = "hero-canvas";
    canvas.setAttribute("aria-hidden", "true");
    // Never paint the bottom 14px of the canvas — the enter-tilt swings its
    // corner below the photo row and tiles leak into a thin line. The strip
    // sits inside the dark fade overlay, so dead space reads as nothing.
    canvas.style.clipPath = "inset(0 0 14px 0)";
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
  let mvp = null;
  const buildMVP = () => {
    const W = img.clientWidth;
    const H = img.clientHeight;
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
    // the whole content box for cover (texture is cropped via u_uv)
    const rw = cover ? cW : pw;
    const rh = cover ? cH : ph;
    const rx0 = cover ? pl : pl + (cW - pw) * fx;
    const ry0 = cover ? pt : pt + (cH - ph) * fy;
    const rx = rx0 + rw / 2 - W / 2; // rect centre, world x
    const ry = H / 2 - (ry0 + rh / 2); // world y (y up)
    uvCrop.set(
      cover
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

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // pin the canvas exactly over the img's box — the img is absolute on
    // desktop but a static grid child on mobile
    const sr = section.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    canvas.style.top = `${ir.top - sr.top}px`;
    canvas.style.left = `${ir.left - sr.left}px`;
    canvas.style.width = `${ir.width}px`;
    // Shave 2px off the bottom AND clip the canvas's own bottom 14px:
    // the enter animation tilts the canvas -1.2deg, swinging its corner
    // ~8px below the photo row early in the sweep — a thin wedge of tile
    // tops under the photo's bottom-right. The dead strip sits inside the
    // dark ::after fade, so it reads as nothing.
    const h = Math.max(0, ir.height - 2);
    canvas.style.height = `${h}px`;
    canvas.width = Math.round(ir.width * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    buildMVP();
  };

  const tex2d = new Image();
  tex2d.onload = () => {
    try {
      size();
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        tex2d,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } catch (e) {
      console.warn("hero-reveal:", e);
      return done();
    }

    html.classList.add("reveal-live");
    const wrap = section.querySelector(".wrap");
    section.insertBefore(canvas, wrap);

    const DURATION = 3400;
    const DELAY = 200;
    // power2.out like the source demo — the roll decelerates as it empties.
    // Progress overshoots to 1.35 so the mosaic keeps settling after the
    // roll has finished laying the sheet (~74% through the sweep).
    const ease = (t) => 1 - Math.pow(1 - t, 2);
    const start = performance.now() + DELAY;
    const frame = (now) => {
      // Re-pin the canvas to the img's live rect every frame — webfont
      // swaps or the URL bar collapsing can shift layout mid-sweep, and a
      // stale canvas leaves a mosaic strip + a jump at handoff
      size();
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
