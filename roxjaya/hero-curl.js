// hero-curl.js — WebGL "loose parchment" page-curl on the home hero.
// A canvas overlays the hero <img>; the shader unrolls the photo
// diagonally (bottom-right first, top-left last) — the curl reads purely
// through shading: lit crown on the roll, dark underside, cast shadow on
// the still-unlaid paper ahead. At the end the canvas fades out and the
// plain <img> takes over (hero-drift resumes). Progressive enhancement:
// no WebGL / small screen / reduced-motion → the <img> just shows.
(() => {
  const html = document.documentElement;
  const done = () => {
    html.classList.remove("curl-live");
    html.classList.add("curl-done");
  };
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    window.matchMedia("(max-width: 800px)").matches
  )
    return done();

  const section = document.querySelector(".hero--bleed");
  const img = section && section.querySelector(".hero-img");
  if (!img) return done();

  const VS = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }`;

  const FS = `
    precision mediump float;
    varying vec2 v_uv;
    uniform sampler2D u_tex;
    uniform vec4 u_rect;    // x0,y0,x1,y1 of painted image, canvas uv (origin bottom-left)
    uniform float u_prog;
    const float W0 = 0.16;     // roll tube width at start — fat = loosely rolled
    const float SW = 0.11;     // how far the roll's shadow reaches ahead
    const vec3 PARCH = vec3(0.93, 0.86, 0.72);   // parchment back-face

    void main() {
      if (v_uv.x < u_rect.x || v_uv.x > u_rect.z ||
          v_uv.y < u_rect.y || v_uv.y > u_rect.w) {
        gl_FragColor = vec4(0.0);
        return;
      }
      vec2 iuv = vec2((v_uv.x - u_rect.x) / (u_rect.z - u_rect.x),
                      (v_uv.y - u_rect.y) / (u_rect.w - u_rect.y));
      vec2 tuv = iuv;                                 // bottom-left origin, y up
      vec2 dir = normalize(vec2(-1.0, 1.0));         // travel toward top-left
      float diag = dot(tuv - 0.5, dir);              // + toward top-left
      float front = mix(-0.95, 0.95, u_prog);        // roll position
      float d = diag - front;                        // >0 = still in the roll
      // The roll is a fat tube of paper — it slims as the sheet pays out
      float paid = clamp((front + 0.95) / 1.9, 0.0, 1.0);
      float W = W0 * (0.30 + 0.70 * sqrt(1.0 - paid));
      vec3 col = vec3(0.0);
      float a = 0.0;
      if (d <= 0.0) {
        // Laid flat — thin contact shadow where the roll meets the table
        col = texture2D(u_tex, tuv).rgb;
        col *= 1.0 - 0.28 * exp(d * 60.0);
        a = 1.0;
      } else if (d <= W) {
        // On the roll — the paper tube seen end-on: photo pays out at the
        // contact line, parchment back-face over the crown, dark underside
        // tucking under toward the leading edge
        float u = d / W;
        float crown = pow(sin(u * 3.14159), 0.75);
        float sh = 0.30 + 0.85 * crown - 0.30 * smoothstep(0.72, 1.0, u);
        vec3 paper = PARCH * sh;
        // thin seam at the very leading edge — the cut edge of the paper
        paper *= 1.0 - 0.35 * smoothstep(0.94, 1.0, u);
        vec3 photo = texture2D(u_tex, tuv).rgb * 0.85;
        col = mix(photo, paper, smoothstep(0.0, 0.09, u));
        a = 1.0;
      } else if (d <= W + SW) {
        // Shadow the roll throws onto the table just ahead of it
        a = 0.34 * (1.0 - (d - W) / SW);
      }
      gl_FragColor = vec4(col, a);
    }`;

  let canvas, gl, prog, uRect, uProg, tex;
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
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    uRect = gl.getUniformLocation(prog, "u_rect");
    uProg = gl.getUniformLocation(prog, "u_prog");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  } catch {
    return done();
  }

  // Painted rect of the <img> (object-fit: contain, 58% center, padding
  // 40px top / 56px bottom) expressed in canvas uv, origin bottom-left.
  const imageRect = () => {
    const cw = canvas.width;
    const ch = canvas.height;
    if (!cw || !ch) return null;
    const padT = 40,
      padB = 56,
      padL = 0,
      padR = 0;
    const cW = cw - padL - padR;
    const cH = ch - padT - padB;
    const iw = img.naturalWidth || 1125;
    const ih = img.naturalHeight || 1080;
    const s = Math.min(cW / iw, cH / ih);
    const w = iw * s,
      h = ih * s;
    const x = padL + (cW - w) * 0.58;
    const yTop = padT + (cH - h) * 0.5;
    return [x / cw, (ch - yTop - h) / ch, (x + w) / cw, (ch - yTop) / ch];
  };

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = img.clientWidth,
      h = img.clientHeight;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
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
    } catch {
      return done();
    }

    html.classList.add("curl-live");
    const wrap = section.querySelector(".wrap");
    section.insertBefore(canvas, wrap);

    const DURATION = 3200;
    const DELAY = 150;
    // Smoothstep — the roll is pulled at a near-steady pace and eases to a
    // stop as the last of the sheet lays flat; not a race-and-snap.
    const ease = (t) => t * t * (3 - 2 * t);
    const start = performance.now() + DELAY;
    const frame = (now) => {
      const t = Math.max(0, Math.min(1, (now - start) / DURATION));
      const r = imageRect();
      if (r) gl.uniform4fv(uRect, r);
      gl.uniform1f(uProg, ease(t));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
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
