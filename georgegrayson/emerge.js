// emerge.js — the ninth station hero reveal. Self-contained drop-in: needs only
//   <section class="hero--bleed">
//     <div class="hero-mask"><img class="hero-img" ...></div>
//     <div class="wrap"> ... headline/copy ... </div>
//   </section>
// plus a <script defer>. No CSS, no other JS.
//
// Fragment shader is the Codrops "Emerging WebGL Image Effects" set
// (akella/CodropsEmergingImages, MIT) with one WebGL1 adaptation: the
// derivatives extension is enabled.
//
// Choreography: hero mounts as flat stage colour → pixelated squares
// wash down revealing a baked whole-section composite (stage colour +
// blurred ambient where the photo sits + the real photo + the real
// headline text drawn via Range rects) → ~1.4s cross-fade hands off to
// the live DOM. The texture IS the finished page, so handoff is
// seamless — do NOT try to snapshot DOM via SVG foreignObject here,
// it taints the canvas and texImage2D throws.
//
// ?fx=0|1|2|3 picks one effect (0 pixel slide, 1 noise melt,
// 2 random squares [default], 3 curtain wave); ?fx=demo auditions all
// four with labels; ?fx=off disables. Reduced-motion and no-WebGL fall
// straight through to the normal page.
(() => {
  const fx = new URLSearchParams(location.search).get("fx");
  const demo = fx === "demo";
  // Default load belongs to hero-reveal.js (unroll + shimmer + confetti).
  // emerge only runs when ?fx= is passed: ?fx=0-3 picks one effect,
  // ?fx=demo auditions all four, ?fx=off also stands down.
  const solo = /^[0-3]$/.test(fx || "") ? Number(fx) : null;
  if (!demo && solo === null) return;
  if (window.matchMedia("(max-width: 800px)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  window.__emerge = true; // hero-reveal.js checks this and stands down

  const boot = () => {
    const section = document.querySelector(".hero--bleed");
    const mask = section && section.querySelector(".hero-mask");
    const img = mask && mask.querySelector(".hero-img");
    if (!section || !mask || !img) return;
    // Black start: hide the rendered hero now so the page never flashes
    // a finished hero that then vanishes — the opaque canvas is the
    // first thing anyone sees. Restored if WebGL bails.
    // opacity (not visibility) for the wrap: hidden elements return no
    // Range rects, and the text-stamp needs real line boxes to bake
    const wrapEl0 = section.querySelector(".wrap");
    mask.style.visibility = "hidden";
    if (wrapEl0) wrapEl0.style.opacity = "0";

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

        // codrops gamma lift during the reveal, converging to raw sRGB at
        // settle so the canvas lands identical to the DOM photo (no dark
        // click at handoff)
        gl_FragColor.rgb = pow(gl_FragColor.rgb,vec3(mix(1./2.2,1.0,smoothstep(0.55,1.,uProgress))));

      }
    `;

    const unhide = () => {
      mask.style.visibility = "";
      if (wrapEl0) wrapEl0.style.opacity = "";
    };
    const start = async () => {
      // image genuinely missing/broken → bail to the normal page
      if (!img.naturalWidth || !img.naturalHeight) return unhide();
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
      // The canvas covers the WHOLE hero section — photo, backdrop AND
      // the headline column — so the squares sweep across everything as
      // one piece. Mounted above the .wrap text layer (z-index 3 vs 2).
      const sectionRect = section.getBoundingClientRect();
      const maskRect = mask.getBoundingClientRect();
      const mx = maskRect.left - sectionRect.left + px;
      const my = maskRect.top - sectionRect.top + py;
      const mw = sectionRect.width,
        mh = sectionRect.height;
      if (getComputedStyle(section).position === "static") {
        section.style.position = "relative";
      }
      const canvas = document.createElement("canvas");
      canvas.className = "emerge-canvas";
      // Opaque stage background from frame zero — the hero reads as a
      // solid dark panel before the wave starts, and the squares reveal
      // the finished page (text included) as they wash down. Nothing of
      // the real DOM shows through at any point.
      const stageBg =
        getComputedStyle(section).backgroundColor || "#06080e";
      canvas.style.cssText =
        "position:absolute;pointer-events:none;z-index:3;left:0;top:0;width:" +
        mw +
        "px;height:" +
        mh +
        "px;background:" +
        stageBg;
      canvas.width = Math.max(2, Math.round(mw * dpr));
      canvas.height = Math.max(2, Math.round(mh * dpr));
      section.appendChild(canvas);
      const gl = canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: false,
      });
      if (!gl) {
        canvas.remove();
        return unhide();
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

      // Bake the whole-section composite: flat stage base, blurred
      // ambient clipped to the photo's painted rect (plus a soft
      // feather), the hero's overlay gradients replicated, the real
      // photo at its painted rect, then the real words stamped on top —
      // the texture is the finished page, so handoff is pixel-ident.
      const bake = document.createElement("canvas");
      bake.width = Math.max(2, Math.round(mw * dpr));
      bake.height = Math.max(2, Math.round(mh * dpr));
      const bctx = bake.getContext("2d");
      const W = bake.width,
        H = bake.height;
      // Blurred ambient only where the photo actually sits: its painted
      // rect plus a soft feather outward. The headline side bakes as
      // flat stage ink — no silhouette to settle on the left.
      bctx.fillStyle =
        getComputedStyle(section).backgroundColor || "#0b1020";
      bctx.fillRect(0, 0, W, H);
      const feather = 48 * dpr;
      bctx.save();
      bctx.beginPath();
      bctx.rect(mx * dpr - feather, 0, dw * dpr + feather, H);
      bctx.clip();
      const cs = Math.max(bake.width / iw, bake.height / ih);
      bctx.filter = "blur(48px) brightness(0.55) saturate(1.15)";
      bctx.drawImage(
        img,
        (bake.width - iw * cs) / 2,
        (bake.height - ih * cs) / 2,
        iw * cs,
        ih * cs,
      );
      bctx.filter = "none";
      // feather the clip's left edge into the flat stage
      let fxg = bctx.createLinearGradient(
        mx * dpr - feather,
        0,
        mx * dpr + feather,
        0,
      );
      fxg.addColorStop(0, getComputedStyle(section).backgroundColor || "#0b1020");
      fxg.addColorStop(1, "rgba(6, 8, 14, 0)");
      bctx.fillStyle = fxg;
      bctx.fillRect(mx * dpr - feather, 0, feather * 2, H);
      bctx.restore();
      let g = bctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(11, 11, 14, 0)");
      g.addColorStop(0.6, "rgba(11, 11, 14, 0.02)");
      g.addColorStop(1, "rgba(11, 11, 14, 0.18)");
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, W, H);
      g = bctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, "rgba(11, 11, 14, 0.2)");
      g.addColorStop(0.35, "rgba(11, 11, 14, 0.07)");
      g.addColorStop(0.5, "rgba(11, 11, 14, 0)");
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, W, H);
      bctx.filter = "brightness(1.22) contrast(1.02)";
      bctx.drawImage(img, mx * dpr, my * dpr, dw * dpr, dh * dpr);
      bctx.filter = "none";

      // Stamp the real words into the bake so the wave reveals them
      // too — walk every text node in .wrap, use Range rects for true
      // per-line positions + wrapping, paint with each element's
      // computed font. Button chrome comes from element boxes under
      // the text. No foreignObject → no canvas taint.
      const wrapForBake = section.querySelector(".wrap");
      if (wrapForBake) {
        // Freeze any entrance animations/transitions while we measure —
        // Range rects captured mid-slide bake text at the wrong offset
        // and it "pops" at handoff. Style tag scoped to the hero only.
        const freeze = document.createElement("style");
        freeze.textContent =
          ".hero--bleed,.hero--bleed *{animation:none!important;transition:none!important}";
        document.head.appendChild(freeze);
        void wrapForBake.offsetWidth; // flush styles before measuring
        const paintBox = (el) => {
          const cs = getComputedStyle(el);
          const bg = cs.backgroundColor;
          const bw = parseFloat(cs.borderTopWidth) || 0;
          const hasBg = bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
          if (!hasBg && !bw) return;
          const r = el.getBoundingClientRect();
          bctx.beginPath();
          bctx.roundRect(
            (r.left - sectionRect.left) * dpr,
            (r.top - sectionRect.top) * dpr,
            r.width * dpr,
            r.height * dpr,
            (parseFloat(cs.borderTopLeftRadius) || 0) * dpr,
          );
          if (hasBg) {
            bctx.fillStyle = bg;
            bctx.fill();
          }
          if (bw) {
            bctx.lineWidth = bw * dpr;
            bctx.strokeStyle = cs.borderTopColor;
            bctx.stroke();
          }
        };
        paintBox(wrapForBake);
        for (const el of wrapForBake.querySelectorAll("a,button,span"))
          paintBox(el);

        const range = document.createRange();
        const walker = document.createTreeWalker(
          wrapForBake,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (n) =>
              n.textContent.trim()
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT,
          },
        );
        let tn;
        while ((tn = walker.nextNode())) {
          const p = tn.parentElement;
          if (!p) continue;
          const cs = getComputedStyle(p);
          bctx.font =
            cs.fontStyle +
            " " +
            cs.fontWeight +
            " " +
            parseFloat(cs.fontSize) * dpr +
            "px " +
            cs.fontFamily;
          bctx.fillStyle = cs.color;
          try {
            bctx.letterSpacing =
              (parseFloat(cs.letterSpacing) || 0) * dpr + "px";
          } catch (e) {
            /* letterSpacing unsupported — draw untracked */
          }
          bctx.textBaseline = "top";
          // split the node into its real wrapped lines: each char's
          // Range rect tells us which visual line it sits on
          const lines = [];
          let cur = { rect: null, text: "" };
          for (let i = 0; i < tn.length; i++) {
            range.setStart(tn, i);
            range.setEnd(tn, i + 1);
            const rs = range.getClientRects();
            const r = rs[rs.length - 1];
            const ch = tn.textContent[i];
            // Chars with no rect (source-indent whitespace, \n) are
            // dropped ONLY until the line's first visible glyph —
            // dropping them unconditionally ate real spaces like the
            // one before "pace."
            if (!r || r.width === 0) {
              if (cur.rect) cur.text += ch;
              continue;
            }
            if (!cur.rect) cur.rect = r;
            if (Math.abs(r.top - cur.rect.top) > 1) {
              lines.push(cur);
              cur = { rect: r, text: "" };
            }
            cur.text += ch;
          }
          if (cur.text) lines.push(cur);
          const tform = cs.textTransform;
          for (const L of lines) {
            if (!L.rect || !L.text.trim()) continue;
            const txt =
              tform === "uppercase"
                ? L.text.toUpperCase()
                : tform === "lowercase"
                  ? L.text.toLowerCase()
                  : L.text;
            bctx.fillText(
              txt,
              (L.rect.left - sectionRect.left) * dpr,
              (L.rect.top - sectionRect.top) * dpr,
            );
          }
          bctx.letterSpacing = "0px";
        }
        freeze.remove();
      }

      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bake);
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
        uTexSize = u("uTextureSize"),
        uElSize = u("uElementSize"),
        uTex = u("uTexture");
      gl.uniform3f(uFill, 0.004, 0.002, 0.0035); // stage-matched plum —
      // the shader gamma-brightens, so the fill band lands around #150f13
      // and reads as the dark stage itself, not a sheet over it
      gl.uniform2f(uTexSize, bake.width, bake.height);
      gl.uniform2f(uElSize, mw * dpr, mh * dpr);
      gl.uniform1i(uTex, 0);

      // Park the photo's entrance/drift animations for the run so the
      // DOM lands at the same pose the canvas settled at.
      img.style.animation = "none";
      const restore = unhide;

      let tag = null;
      if (demo) {
        tag = document.createElement("div");
        tag.style.cssText =
          "position:absolute;left:16px;bottom:14px;z-index:60;background:rgba(0,0,0,.55);color:#fff;padding:6px 12px;border-radius:99px;font:600 11px/1 system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;pointer-events:none";
        section.appendChild(tag);
      }

      const NAMES = ["pixel slide", "noise melt", "random squares", "curtain wave"];
      const SHOW = 2200,
        // demo mode keeps a labelled hold between effects; the real
        // run goes wave → fade with no static beat
        HOLD = demo ? 900 : 60,
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
        // Canvas stays visible (opaque stage bg) for the whole run —
        // transparent shader pixels show the stage, not the DOM, so the
        // page reads as black before the wave and the reveal is the only
        // thing ever on screen. Pauses just skip drawing.
        if (ph.pause || el < 0 || (!ph.hold && lt < 0.02)) {
          if (tag) tag.textContent = "";
        } else {
          if (tag) tag.textContent = ph.label;
          gl.uniform1f(uTime, now * 0.001);
          gl.uniform1f(uProgress, ph.hold ? 1 : lt);
          gl.uniform1f(uType, ph.type);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        if (el < total + 150) return requestAnimationFrame(frame);
        if (tag) tag.remove();
        restore();
        // Long soft cross-fade into the real page — a short fade made
        // the swap read as a "click"; ~1.4s lets the baked texture and
        // the DOM blend so the settle feels like landing, not dropping
        canvas.style.transition = "opacity 1.4s ease-in-out";
        canvas.style.opacity = "0";
        setTimeout(() => canvas.remove(), 1500);
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
