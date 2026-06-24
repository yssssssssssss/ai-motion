function createSiriLightRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const state = {
    intensity: 0,
    phase: 0,
    visible: false,
    playing: true,
    width: 0,
    height: 0
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = rect.width;
    state.height = rect.height;
  }

  function drawFrame(time) {
    if (!state.playing) return;
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);
    if (!state.visible || state.intensity <= 0.001) {
      requestAnimationFrame(drawFrame);
      return;
    }

    state.phase += 0.015;
    const cx = w / 2;
    const cy = h / 2 - 1;
    const t = state.phase;
    const alpha = state.intensity;

    // soft blur base
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const layers = [
      { x: -26 + Math.sin(t * 1.6) * 4, y: 0, rx: 28, ry: 10, hue: 190, a: 0.65 },
      { x: 0 + Math.sin(t * 1.3 + 1) * 3, y: -1, rx: 34, ry: 11, hue: 270, a: 0.72 },
      { x: 28 + Math.sin(t * 1.1 + 2.4) * 4, y: 1, rx: 30, ry: 10, hue: 330, a: 0.68 },
      { x: 8 + Math.sin(t * 0.9 + 4) * 3, y: 0, rx: 26, ry: 9, hue: 42, a: 0.55 }
    ];

    ctx.filter = "blur(10px) saturate(160%)";
    for (const layer of layers) {
      const grad = ctx.createRadialGradient(
        cx + layer.x,
        cy + layer.y,
        0,
        cx + layer.x,
        cy + layer.y,
        layer.rx
      );
      grad.addColorStop(0, `hsla(${layer.hue}, 100%, 88%, ${0.9 * layer.a * alpha})`);
      grad.addColorStop(0.35, `hsla(${layer.hue}, 100%, 68%, ${0.42 * layer.a * alpha})`);
      grad.addColorStop(1, `hsla(${layer.hue}, 100%, 50%, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx + layer.x, cy + layer.y, layer.rx, layer.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // horizontal ribbon
    ctx.filter = "blur(4px)";
    const ribbon = ctx.createLinearGradient(10, cy, w - 10, cy);
    ribbon.addColorStop(0, "rgba(0,0,0,0)");
    ribbon.addColorStop(0.18, `rgba(92, 234, 255, ${0.36 * alpha})`);
    ribbon.addColorStop(0.42, `rgba(125, 105, 255, ${0.68 * alpha})`);
    ribbon.addColorStop(0.66, `rgba(255, 86, 197, ${0.72 * alpha})`);
    ribbon.addColorStop(0.84, `rgba(255, 201, 95, ${0.34 * alpha})`);
    ribbon.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ribbon;
    const ribbonScale = 0.85 + Math.sin(t * 2.2) * 0.14;
    ctx.beginPath();
    ctx.roundRect(cx - 52 * ribbonScale, cy - 6.5, 104 * ribbonScale, 13, 999);
    ctx.fill();

    // white specular line
    ctx.filter = "blur(1px)";
    const line = ctx.createLinearGradient(cx - 48, cy + 9, cx + 48, cy + 9);
    line.addColorStop(0, "rgba(255,255,255,0)");
    line.addColorStop(0.5, `rgba(255,255,255,${0.7 * alpha})`);
    line.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = line;
    ctx.beginPath();
    ctx.roundRect(cx - 40, cy + 8, 80, 2, 999);
    ctx.fill();

    ctx.restore();
    requestAnimationFrame(drawFrame);
  }

  resize();
  requestAnimationFrame(drawFrame);
  window.addEventListener("resize", resize);

  return {
    resize,
    show() {
      state.visible = true;
    },
    hide() {
      state.visible = false;
    },
    setIntensity(v) {
      state.intensity = v;
    },
    destroy() {
      state.playing = false;
      window.removeEventListener("resize", resize);
    }
  };
}

function createBottomWaveRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const state = { visible: false, intensity: 0, phase: 0, playing: true, width: 0, height: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.width = rect.width;
    state.height = rect.height;
  }

  function drawBlob(x, y, rx, ry, colors, alpha) {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rx);
    grad.addColorStop(0, `rgba(255,255,255,${0.9 * alpha})`);
    grad.addColorStop(0.18, `rgba(${colors[0]},${colors[1]},${colors[2]},${0.7 * alpha})`);
    grad.addColorStop(0.62, `rgba(${colors[3]},${colors[4]},${colors[5]},${0.18 * alpha})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFrame() {
    if (!state.playing) return;
    const w = state.width;
    const h = state.height;
    ctx.clearRect(0, 0, w, h);
    if (!state.visible || state.intensity <= 0.001) {
      requestAnimationFrame(drawFrame);
      return;
    }

    state.phase += 0.018;
    const t = state.phase;
    const alpha = state.intensity;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.filter = "blur(10px)";

    drawBlob(
      w * 0.22 + Math.sin(t * 1.4) * 14,
      h * 0.98 + Math.sin(t * 2.1) * 2,
      74,
      30,
      [106, 237, 255, 77, 98, 255],
      0.52 * alpha
    );
    drawBlob(
      w * 0.53 + Math.sin(t * 1.2 + 1.2) * 18,
      h * 0.92 + Math.cos(t * 1.8) * 3,
      92,
      34,
      [255, 220, 120, 255, 78, 196],
      0.62 * alpha
    );
    drawBlob(
      w * 0.82 + Math.sin(t * 1.5 + 2.2) * 14,
      h * 0.97 + Math.sin(t * 2.0) * 2,
      68,
      28,
      [116, 240, 255, 147, 90, 255],
      0.48 * alpha
    );

    ctx.filter = "blur(5px)";
    const ribbon = ctx.createLinearGradient(w * 0.06, h * 0.8, w * 0.94, h * 0.8);
    ribbon.addColorStop(0, "rgba(0,0,0,0)");
    ribbon.addColorStop(0.18, `rgba(96,232,255,${0.32 * alpha})`);
    ribbon.addColorStop(0.52, `rgba(255,86,197,${0.55 * alpha})`);
    ribbon.addColorStop(0.76, `rgba(255,221,129,${0.35 * alpha})`);
    ribbon.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ribbon;
    const shift = Math.sin(t * 1.8) * 10;
    ctx.beginPath();
    ctx.roundRect(w * 0.1 + shift, h * 0.7, w * 0.8, 10, 999);
    ctx.fill();

    ctx.restore();
    requestAnimationFrame(drawFrame);
  }

  resize();
  requestAnimationFrame(drawFrame);
  window.addEventListener("resize", resize);

  return {
    resize,
    show() {
      state.visible = true;
    },
    hide() {
      state.visible = false;
    },
    setIntensity(v) {
      state.intensity = v;
    },
    destroy() {
      state.playing = false;
      window.removeEventListener("resize", resize);
    }
  };
}
