// emerge.js — tenant hero entrance picker. Runs the actual Codrops
// "Emerging WebGL Image Effects" shader (akella/CodropsEmergingImages,
// MIT) over the hero photo. The fragment shader is verbatim apart from
// two WebGL1 adaptations: the derivatives extension is enabled, and
// type 4's dynamic uniform-array index is read through a loop symbol
// (GLSL ES 1.00 only allows const/loop indices on uniforms).
//
// Modes: ?fx=0|1|2|3 runs one effect; ?fx=demo plays all four with a
// settle hold and a dark pause between each, labelled for client pick.
// The texture is a baked composite of the real hero layers (ambient
// backdrop + photo at its live box/fit/focal) so the reveal lands
// exactly on the settled page. No WebGL / reduced-motion → page shows.
(() => {
  const fx = new URLSearchParams(location.search).get("fx");
  const demo = fx === "demo";
  const solo = /^[0-3]$/.test(fx || "") ? Number(fx) : null;
  if (!demo && solo === null) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.__emerge = true; // hero-reveal.js checks this and stands down

  const boot = () => {
    const section = document.querySelector(".hero--bleed");
    const mask = section && section.querySelector(".hero-mask");
    const img = mask && mask.querySelector(".hero-img");
    if (!section || !mask || !img) return;

    const VS = `
      attribute vec2 a_pos;
      varying vec2 vUv;
      void main() {
        vUv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }`;

    const FS = `
      #extension GL_OES_standard_derivatives : enable
      precision mediump float;
      uniform float uTime;
      uniform vec3 uFillColor;
      uniform float uProgress;
      uniform float uType;
      uniform float uPixels[36];
      uniform vec2 uTextureSize;
      uniform vec2 uElementSize;
      uniform sampler2D uTexture;
      varying vec2 vUv;
      vec3 blendNormal(vec3 base, vec3 blend) {
        return blend;
      }

      vec3 blendNormal(vec3 base, vec3 blend, float opacity) {
        return (blendNormal(base, blend) * opacity + base * (1.0 - opacity));
      }
      float blendOverlay(float base, float blend) {
        return base<0.5?(2.0*base*blend):(1.0-2.0*(1.0-base)*(1.0-blend));
      }

      vec3 blendOverlay(vec3 base, vec3 blend) {
        return vec3(blendOverlay(base.r,blend.r),blendOverlay(base.g,blend.g),blendOverlay(base.b,blend.b));
      }

      vec3 blendOverlay(vec3 base, vec3 blend, float opacity) {
        return (blendOverlay(base, blend) * opacity + base * (1.0 - opacity));
      }
      float blendSubtract(float base, float blend) {
        return max(base+blend-1.0,0.0);
      }

      vec3 blendSubtract(vec3 base, vec3 blend) {
        return max(base+blend-vec3(1.0),vec3(0.0));
      }

      vec3 blendSubtract(vec3 base, vec3 blend, float opacity) {
        return (blendSubtract(base, blend) * opacity + base * (1.0 - opacity));
      }
      float hashwithoutsine12(vec2 p){
        vec3 p3  = fract(vec3(p.xyx) * .1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
      }

      //	Classic Perlin 2D Noise
      //	by Stefan Gustavson
      //
      vec2 fade(vec2 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
      vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
      vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
      vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
      float cnoise(vec2 P){
        vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
        vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
        Pi = mod(Pi, 289.0); // To avoid truncation effects in permutation
        vec4 ix = Pi.xzxz;
        vec4 iy = Pi.yyww;
        vec4 fx = Pf.xzxz;
        vec4 fy = Pf.yyww;
        vec4 i = permute(permute(ix) + iy);
        vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0; // 1/41 = 0.024...
        vec4 gy = abs(gx) - 0.5;
        vec4 tx = floor(gx + 0.5);
        gx = gx - tx;
        vec2 g00 = vec2(gx.x,gy.x);
        vec2 g10 = vec2(gx.y,gy.y);
        vec2 g01 = vec2(gx.z,gy.z);
        vec2 g11 = vec2(gx.w,gy.w);
        vec4 norm = 1.79284291400159 - 0.85373472095314 *
          vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
        g00 *= norm.x;
        g01 *= norm.y;
        g10 *= norm.z;
        g11 *= norm.w;
        float n00 = dot(g00, vec2(fx.x, fy.x));
        float n10 = dot(g10, vec2(fx.y, fy.y));
        float n01 = dot(g01, vec2(fx.z, fy.z));
        float n11 = dot(g11, vec2(fx.w, fy.w));
        vec2 fade_xy = fade(Pf.xy);
        vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
        float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
        return 2.3 * n_xy;
      }



      float PristineGrid(vec2 uv, vec2 lineWidth){
        vec4 uvDDXY = vec4(dFdx(uv), dFdy(uv));
        vec2 uvDeriv = vec2(length(uvDDXY.xz), length(uvDDXY.yw));
        bool invertLine = lineWidth.x > 0.5;
        vec2 targetWidth = invertLine ? vec2(1.0) - lineWidth : lineWidth;
        vec2 drawWidth = clamp(targetWidth, uvDeriv, vec2(0.5));
        vec2 lineAA = max(uvDeriv, 0.000001) * 5.5;
        vec2 gridUV = abs(fract(uv) * 2.0 - 1.0);
        gridUV = invertLine ? gridUV : 1.0 - gridUV;
        vec2 grid2 = smoothstep(drawWidth + lineAA, drawWidth - lineAA, gridUV);
        grid2 *= clamp(targetWidth / drawWidth,0.,1.);
        grid2 = mix(grid2, targetWidth, clamp(uvDeriv * 2.0 - vec2(1.0),vec2(0.),vec2(1.)));
        grid2 = invertLine ? 1.0 - grid2 : grid2;
        return mix(grid2.x, 1.0, grid2.y);
      }

      float cubicOut(float t) {
        float f = t - 1.0;
        return f * f * f + 1.0;
      }
      float quadraticOut(float t) {
        return -t * (t - 2.0);
      }
      float cubicIn(float t) {
        return t * t * t;
      }
      float qinticIn(float t) {
        return pow(t, 4.0);
      }
      float map(float value, float min1, float max1, float min2, float max2) {
        float val = min2 + (value - min1) * (max2 - min2) / (max1 - min1);
        return clamp(val, min2, max2);
      }
      float cubicInOut(float t) {
        return t < 0.5
          ? 4.0 * t * t * t
          : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0;
      }
      float quarticInOut(float t) {
        return t < 0.5
          ? +8.0 * pow(t, 4.0)
          : -8.0 * pow(t - 1.0, 4.0) + 1.0;
      }

      float quadraticInOut(float t) {
        float p = 2.0 * t * t;
        return t < 0.5 ? p : -p + (4.0 * t) - 1.0;
      }
      float parabola( float x, float k ) {
        return pow( 4. * x * ( 1. - x ), k );
      }
      void main() {
        vec2 uv = vUv - vec2(0.5);
        float aspect1 = uTextureSize.x/uTextureSize.y;
        float aspect2 = uElementSize.x/uElementSize.y;
        if(aspect1>aspect2){uv *= vec2( aspect2/aspect1,1.);}
        else{uv *= vec2( 1.,aspect1/aspect2);}
        uv += vec2(0.5);
        float uAspect = uElementSize.x/uElementSize.y;
        float imageAspect = uTextureSize.x/uTextureSize.y;

        vec4 defaultColor = texture2D(uTexture, uv);

        if(uType==0.){

          // pixelize
          float pixelateProgress = map(uProgress,0.3,1.,0.,1.);
          pixelateProgress = floor(pixelateProgress*12.)/12.;
          float s = floor(mix(11., 50.,quadraticOut(pixelateProgress)));
          vec2 gridSize = vec2(
            s,
            floor(s/uAspect)
          );

          vec2 newUV = floor(vUv * gridSize) / gridSize + 0.5/vec2(gridSize);
          vec4 color = texture2D(uTexture, newUV);
          float finalProgress = map(uProgress,0.75,1.,0.,1.);
          color = mix(color, defaultColor, finalProgress);


          // grid lines
          vec2 multUV = fract(vUv * gridSize);
          float lines = PristineGrid(vUv * gridSize, vec2(0.2*(1.-uProgress)));


          // discard - slide in animation
          float discardProgress = map(uProgress,0.,0.8,0.,1.);
          if(vUv.x>cubicOut(discardProgress)) discard;


          // fill color
          vec3 fillColor = uFillColor;
          float gradWidth = mix(0.4,0.2,uProgress);
          float customProg = map(cubicInOut(uProgress), 0.0, 1., -gradWidth, 1. - gradWidth);
          float fillGradient = smoothstep(customProg, customProg+gradWidth, vUv.x);



          gl_FragColor.a = 1.;
          gl_FragColor.rgb = blendNormal(vec3(1.-lines),color.rgb , 0.9);
          gl_FragColor.rgb = mix( gl_FragColor.rgb,fillColor, fillGradient);
          gl_FragColor.rgb = mix( gl_FragColor.rgb,defaultColor.rgb, finalProgress);

        }else if(uType==1.){

          float hash = hashwithoutsine12(vUv*1000. + floor(uTime*3.)*0.1);
          float hash1 = hashwithoutsine12(vUv*1000. + 10. + floor(uTime*3.)*0.1);
          float hash2 = hashwithoutsine12(vUv*1000. + 20. + floor(uTime*3.)*0.1);
          vec3 fillColor = uFillColor;
          fillColor +=  (vec3(hash)-vec3(0.5))*0.2;


          float n = (cnoise(vUv*vec2(35.,1.)) + 1.)*0.5;
          float border = 1.;

          float dt = parabola( cubicInOut(uProgress),1.);
          vec2 distUV = uv;
          distUV.y = 1.-(1.-uv.y)*(1. -dt*0.3) ;
          defaultColor = texture2D(uTexture, distUV);
          float width = 1.;
          float w = width*dt;

          float maskvalue = smoothstep(1. - w,1.,vUv.y + mix(-w/2., 1. - w/2., cubicInOut(uProgress)));
          float maskvalue0 = smoothstep(1.,1.,vUv.y + cubicInOut(uProgress));

          float mask = maskvalue + maskvalue*n;

          float final = smoothstep(1.,1.+0.01,mask);
          float dist = -0.5;
          float final1 = smoothstep(1.,1.+0.01,mask-dist);
          if(final1==0.) discard;

          vec3 finalColor = mix(fillColor,defaultColor.rgb,final);
          gl_FragColor = vec4(finalColor,1.);

        } else if(uType==2.){

          float s = 120.;

          vec2 gridSize = vec2(
            s,
            floor(s/uAspect)
          );

          vec2 newUV = floor(vUv * gridSize);

          float x = floor(vUv.x * 10.);
          float y = floor(vUv.y * 10.);
          float pattern = hashwithoutsine12(newUV);

          float w = 0.5;

          float p0 = (clamp( (uProgress - 0.2*0.)/0.8,0.,1.));

          float p1 = (clamp( (uProgress - 0.2*1.)/0.8,0.,1.));


          p0  = map(p0, 0., 1., -w,  1.);
          p0 = smoothstep(p0,p0+w,1.-vUv.y);
          float p0_ = clamp(1. - 2.*p0 +pattern,0.,1.);



          p1  = map(p1, 0., 1., -w,  1.);
          p1 = smoothstep(p1,p1+w,1.-vUv.y);
          float p1_ = clamp(1. - 2.*p1 +pattern,0.,1.);



          vec3 finalColor = mix( uFillColor,defaultColor.rgb,p1_);

          gl_FragColor = vec4(finalColor,p0_);

        }  else if(uType==3.){

          float progress = quadraticInOut(1.-uProgress);
          float s = 50.;
          vec2 gridSize = vec2(
            s,
            floor(s/imageAspect)
          );

          // curtain
          float v = smoothstep(0.0, 1.0, vUv.y + sin(vUv.x*4.0+progress*6.0) * mix(0.3, 0.1, abs(0.5-vUv.x)) * 0.5 * smoothstep(0.0, 0.2, progress) + (1.0 - progress * 2.0));

          float mixnewUV =(vUv.x * 3. + (1.0-v) * 50.0)*progress;
          vec2 subUv = mix(uv, floor(uv * gridSize) / gridSize, mixnewUV);

          vec4 color = texture2D(uTexture, subUv);
          color.a =  mix(1.0, pow(v, 5.0) , step(0.0, progress));
          color.a = pow(v, 1.0);
          color.rgb = mix(color.rgb, uFillColor, smoothstep(0.5, 0.0, abs(0.5-color.a)) * progress);

          gl_FragColor = color;

        }
        else if(uType==4.){
          int indexProgress = int(uProgress*36.);
          float pixRand = 0.;
          for(int i=0;i<36;i++){ if(i==indexProgress) pixRand = uPixels[i]; }
          float pixellation = floor(uElementSize.x*pixRand);

          vec2 gridSize = vec2(
            pixellation,
            floor(pixellation/imageAspect)
          );
          vec2 newUV = floor(uv * gridSize) / gridSize + 0.5/vec2(gridSize);
          vec4 color = texture2D(uTexture, newUV);
          gl_FragColor = color;
        }

        gl_FragColor.rgb = pow(gl_FragColor.rgb,vec3(1./2.2));

      }
    `;

    // Mount the canvas exactly over the photo's painted rect (its content
    // box resolved through live object-fit/object-position) and texture it
    // with the raw <img> — the identical path to the standalone demo. The
    // mask's own feather/clip applies to the canvas automatically.
    const start = () => {
      const ics = getComputedStyle(img);
      // offset* gives the layout box relative to the mask (offsetParent)
      // and ignores the hero-drift transform — getBoundingClientRect
      // would bake the live pulse into our mount and the settled DOM
      // photo would land in a slightly different spot
      const pl = parseFloat(ics.paddingLeft) || 0;
      const pr = parseFloat(ics.paddingRight) || 0;
      const pt = parseFloat(ics.paddingTop) || 0;
      const pb = parseFloat(ics.paddingBottom) || 0;
      const bx = img.offsetLeft + pl;
      const by = img.offsetTop + pt;
      const bw = img.offsetWidth - pl - pr;
      const bh = img.offsetHeight - pt - pb;
      const posF = (v) => {
        const t = String(v).trim().split(/\s+/);
        const f = (s) =>
          s === "left" || s === "top"
            ? 0
            : s === "right" || s === "bottom"
              ? 1
              : s && s.endsWith("%")
                ? parseFloat(s) / 100
                : 0.5;
        return [f(t[0]), f(t[1])];
      };
      const [ofx, ofy] = posF(ics.objectPosition);
      const iw = img.naturalWidth,
        ih = img.naturalHeight;
      const s =
        ics.objectFit === "contain"
          ? Math.min(bw / iw, bh / ih)
          : Math.max(bw / iw, bh / ih);
      const dw = iw * s,
        dh = ih * s;
      const px = bx + ofx * (bw - dw),
        py = by + ofy * (bh - dh);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      canvas.className = "emerge-canvas";
      canvas.style.cssText =
        "position:absolute;pointer-events:none;z-index:2;left:" +
        px +
        "px;top:" +
        py +
        "px;width:" +
        dw +
        "px;height:" +
        dh +
        "px";
      canvas.width = Math.max(2, Math.round(dw * dpr));
      canvas.height = Math.max(2, Math.round(dh * dpr));
      mask.appendChild(canvas);
      const gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: false,
      });
      if (!gl) {
        canvas.remove();
        return;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.getExtension("OES_standard_derivatives");

      const sh = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
          throw gl.getShaderInfoLog(s);
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
        throw gl.getProgramInfoLog(prog);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const aPos = gl.getAttribLocation(prog, "a_pos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);

      const u = (n) => gl.getUniformLocation(prog, n);
      const uTime = u("uTime"),
        uFill = u("uFillColor"),
        uProgress = u("uProgress"),
        uType = u("uType"),
        uPixels = u("uPixels"),
        uTexSize = u("uTextureSize"),
        uElSize = u("uElementSize"),
        uTex = u("uTexture");
      gl.uniform3f(uFill, 0.95, 0.95, 0.97);
      gl.uniform2f(uTexSize, iw, ih);
      gl.uniform2f(uElSize, dw, dh);
      gl.uniform1i(uTex, 0);
      gl.uniform1fv(
        uPixels,
        Float32Array.from({ length: 36 }, () => Math.random() * 0.5 + 0.5),
      );

      // Photo hidden for the run — the blurred ambient stays up as the
      // dark stage; restored at the end (or on any bail)
      img.style.visibility = "hidden";
      const restore = () => {
        img.style.visibility = "";
      };

      let tag = null;
      if (demo) {
        tag = document.createElement("div");
        tag.style.cssText =
          "position:absolute;left:16px;bottom:14px;z-index:60;background:rgba(0,0,0,.55);color:#fff;padding:6px 12px;border-radius:99px;font:600 11px/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;pointer-events:none";
        section.appendChild(tag);
      }

      const NAMES = ["pixel slide", "noise melt", "random squares", "curtain wave"];
      const SHOW = 2200,
        HOLD = 900,
        PAUSE = 1400;
      const types = demo ? [0, 1, 2, 3] : [solo];
      const seq = types.flatMap((t, i) => {
        const label = demo
          ? `${i + 1} / ${types.length} · ${NAMES[t]}`
          : NAMES[t];
        return [
          { type: t, dur: SHOW, label },
          { type: t, dur: HOLD, label, hold: true },
          { pause: true, dur: PAUSE },
        ];
      });
      seq.pop();

      const t0 = performance.now() + 350;
      const total = seq.reduce((a, P) => a + P.dur, 0);
      const frame = (now) => {
        const el = now - t0;
        let acc = 0,
          ph = seq[seq.length - 1],
          lt = 1;
        for (const P of seq) {
          if (el < acc + P.dur) {
            ph = P;
            lt = Math.max(0, Math.min(1, (el - acc) / P.dur));
            break;
          }
          acc += P.dur;
        }
        // stay hidden until the reveal front is actually moving —
        // uProgress≈0 renders a full white sheet for some effects
        if (ph.pause || el < 0 || (!ph.hold && lt < 0.08)) {
          canvas.style.opacity = "0";
          if (tag) tag.textContent = "";
        } else {
          canvas.style.opacity = "1";
          if (tag) tag.textContent = ph.label;
          gl.uniform1f(uTime, now * 0.001);
          gl.uniform1f(uProgress, ph.hold ? 1 : lt);
          gl.uniform1f(uType, ph.type);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        if (el < total + 150) return requestAnimationFrame(frame);
        canvas.remove();
        if (tag) tag.remove();
        restore();
      };
      requestAnimationFrame(frame);
    };

    const go = () => {
      if (img.complete && img.naturalWidth) return start();
      img.addEventListener("load", start, { once: true });
      setTimeout(() => {
        if (!document.querySelector(".emerge-canvas")) start();
      }, 2500);
    };
    go();
  };

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
