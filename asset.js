(function (global) {
  const supportsBackdropSvg =
    /\b(Chrome|Edg|Chromium)\//.test(navigator.userAgent) &&
    !/\b(CriOS|FxiOS)\b/.test(navigator.userAgent);

  const XLINK_NS = "http://www.w3.org/1999/xlink";
  let svgContainer = null;
  let svgDefs = null;
  let filterSeq = 0;

  function ensureSvgRoot() {
    if (svgDefs) return;
    svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgContainer.setAttribute("id", "glisse-svg-defs");
    svgContainer.setAttribute("width", "0");
    svgContainer.setAttribute("height", "0");
    svgContainer.setAttribute("aria-hidden", "true");
    svgContainer.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;overflow:hidden;";
    svgDefs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svgContainer.appendChild(svgDefs);
    document.body.appendChild(svgContainer);
  }

  function buildDisplacementPng(w, h, radius, bezelWidth, dome, rimPower) {
    const maxDim = 240;
    const scaleFactor = Math.min(1, maxDim / Math.max(w, h));
    const cw = Math.max(4, Math.round(w * scaleFactor));
    const ch = Math.max(4, Math.round(h * scaleFactor));

    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(cw, ch);
    const data = img.data;

    const r = Math.min(radius * scaleFactor, cw / 2, ch / 2);
    const hw = cw / 2 - r;
    const hh = ch / 2 - r;
    const bezel = Math.min(bezelWidth * scaleFactor, Math.min(cw, ch) * 0.49);

    for (let y = 0; y < ch; y++) {
      const py = y + 0.5 - ch / 2;
      const ay = Math.abs(py) - hh;
      for (let x = 0; x < cw; x++) {
        const px = x + 0.5 - cw / 2;
        const ax = Math.abs(px) - hw;

        const ox = Math.max(ax, 0);
        const oy = Math.max(ay, 0);
        const out = Math.hypot(ox, oy);
        const inn = Math.min(Math.max(ax, ay), 0);
        const depth = -(out + inn - r);

        let dx = 0;
        let dy = 0;

        if (depth >= 0) {
          let nx = 0;
          let ny = 0;
          if (ax > 0 && ay > 0) {
            const len = out || 1;
            nx = Math.sign(px) * (ox / len);
            ny = Math.sign(py) * (oy / len);
          } else if (ax > ay) {
            nx = Math.sign(px);
          } else {
            ny = Math.sign(py);
          }

          const t = Math.max(0, Math.min(1, 1 - depth / Math.max(1, bezel)));
          const rimMag = Math.pow(t, rimPower);

          const cx = px / (cw / 2);
          const cy = py / (ch / 2);

          dx = -nx * rimMag - cx * dome;
          dy = -ny * rimMag - cy * dome;

          const magLen = Math.hypot(dx, dy);
          if (magLen > 1) {
            dx /= magLen;
            dy /= magLen;
          }
        }

        const idx = (y * cw + x) * 4;
        data[idx] = Math.max(0, Math.min(255, Math.round(128 + dx * 127)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(128 + dy * 127)));
        data[idx + 2] = 128;
        data[idx + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL("image/png");
  }

  function updateFilter(el) {
    if (!supportsBackdropSvg || !el || !el.isConnected) return;
    ensureSvgRoot();

    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (w < 6 || h < 6) return;

    const kind = el.dataset.lg || "card";
    const isLifted =
      el.classList.contains("is-lifted") ||
      (el.parentElement && el.parentElement.classList.contains("is-pill-lifted"));

    if (kind === "lens" && !isLifted) {
      el.style.backdropFilter = "none";
      el.style.webkitBackdropFilter = "none";
      el.dataset.lgSig = "resting-lens";
      return;
    }

    const radius = parseFloat(el.dataset.lgRadius || "24");

    let scale = 16;
    let blur = 1.2;
    let bezel = 14;
    let dome = 0.03;
    let rimPower = 1.55;
    let sat = 1.08;

    if (kind === "logo") {
      scale = isLifted ? 19 : 15;
      blur = 0.35;
      bezel = Math.min(h * 0.42, 14);
      dome = isLifted ? 0.06 : 0.03;
      rimPower = 1.55;
      sat = 1.08;
    } else if (kind === "bar") {
      scale = 13;
      blur = 0.5;
      bezel = Math.min(h * 0.38, 13);
      dome = 0.02;
      rimPower = 1.55;
      sat = 1.07;
    } else if (kind === "lens") {
      scale = 10;
      blur = 0.15;
      bezel = Math.min(h * 0.28, 10);
      dome = 0;
      rimPower = 1.6;
      sat = 1.06;
    } else if (kind === "button") {
      scale = isLifted ? 18 : 13;
      blur = isLifted ? 0.3 : 0.8;
      bezel = Math.min(h * 0.40, 13);
      dome = isLifted ? 0.06 : 0.02;
      rimPower = 1.55;
      sat = 1.08;
    } else if (kind === "card") {
      scale = 20;
      blur = 1.6;
      bezel = 18;
      dome = 0.02;
      rimPower = 1.55;
      sat = 1.06;
    }

    const qw = Math.round(w / 4) * 4;
    const qh = Math.round(h / 2) * 2;
    const sig = `${qw}x${qh}:${scale}:${blur}:${bezel}:${isLifted ? 1 : 0}`;
    if (el.dataset.lgSig === sig) return;
    el.dataset.lgSig = sig;

    const oldFilterId = el.dataset.lgFilterId;
    const newFilterId = `glisse-f-${++filterSeq}`;
    el.dataset.lgFilterId = newFilterId;

    const filterEl = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filterEl.setAttribute("id", newFilterId);
    filterEl.setAttribute("x", "0");
    filterEl.setAttribute("y", "0");
    filterEl.setAttribute("width", String(w));
    filterEl.setAttribute("height", String(h));
    filterEl.setAttribute("filterUnits", "userSpaceOnUse");
    filterEl.setAttribute("color-interpolation-filters", "sRGB");

    let inputRef = "SourceGraphic";
    if (blur > 0.05) {
      const feBlur = document.createElementNS("http://www.w3.org/2000/svg", "feGaussianBlur");
      feBlur.setAttribute("in", "SourceGraphic");
      feBlur.setAttribute("stdDeviation", String(blur));
      feBlur.setAttribute("result", "soft");
      filterEl.appendChild(feBlur);
      inputRef = "soft";
    }

    const png = buildDisplacementPng(w, h, radius, bezel, dome, rimPower);
    const feImg = document.createElementNS("http://www.w3.org/2000/svg", "feImage");
    feImg.setAttribute("x", "0");
    feImg.setAttribute("y", "0");
    feImg.setAttribute("width", String(w));
    feImg.setAttribute("height", String(h));
    feImg.setAttribute("preserveAspectRatio", "none");
    feImg.setAttribute("href", png);
    feImg.setAttributeNS(XLINK_NS, "xlink:href", png);
    feImg.setAttribute("result", "map");

    const feDisp = document.createElementNS("http://www.w3.org/2000/svg", "feDisplacementMap");
    feDisp.setAttribute("in", inputRef);
    feDisp.setAttribute("in2", "map");
    feDisp.setAttribute("scale", String(scale));
    feDisp.setAttribute("xChannelSelector", "R");
    feDisp.setAttribute("yChannelSelector", "G");
    feDisp.setAttribute("result", "disp");

    const feSat = document.createElementNS("http://www.w3.org/2000/svg", "feColorMatrix");
    feSat.setAttribute("in", "disp");
    feSat.setAttribute("type", "saturate");
    feSat.setAttribute("values", String(sat));

    filterEl.appendChild(feImg);
    filterEl.appendChild(feDisp);
    filterEl.appendChild(feSat);
    svgDefs.appendChild(filterEl);

    el.style.backdropFilter = `url(#${newFilterId})`;
    el.style.webkitBackdropFilter = `url(#${newFilterId})`;

    if (oldFilterId) {
      requestAnimationFrame(() => {
        const oldEl = document.getElementById(oldFilterId);
        if (oldEl) oldEl.remove();
      });
    }
  }

  function cleanupOrphanFilters() {
    if (!svgDefs) return;
    svgDefs.querySelectorAll("filter").forEach((f) => {
      const id = f.getAttribute("id");
      if (!document.querySelector(`[data-lg-filter-id="${id}"]`)) {
        f.remove();
      }
    });
  }

  const resizeObs = new ResizeObserver((entries) => {
    for (const entry of entries) {
      updateFilter(entry.target);
    }
  });

  function observeAll(root = document) {
    cleanupOrphanFilters();
    root.querySelectorAll("[data-lg]").forEach((el) => {
      if (!el.dataset.lgObserved) {
        el.dataset.lgObserved = "1";
        resizeObs.observe(el);
      }
      updateFilter(el);
    });
  }

  function attachPullable(el, options = {}) {
    if (!el || el.dataset.lgPullBound) return;
    el.dataset.lgPullBound = "1";
    el.classList.add("lg-pullable");
    el.setAttribute("draggable", "false");
    el.querySelectorAll("*").forEach((ch) => ch.setAttribute("draggable", "false"));

    el.addEventListener("dragstart", (e) => e.preventDefault());
    el.addEventListener("selectstart", (e) => e.preventDefault());
    el.addEventListener("contextmenu", (e) => e.preventDefault());

    const holdDelay = options.holdDelay ?? 100;
    const maxAnchorShift = options.maxAnchorShift ?? 7;
    const maxStretchX = options.maxStretchX ?? 0.15;
    const maxStretchY = options.maxStretchY ?? 0.14;
    const baseScale = options.baseScale ?? 1.035;
    const pullRange = options.pullRange ?? 75;

    let suppressClickUntil = 0;
    let activePointerId = null;

    el.addEventListener(
      "click",
      (e) => {
        if (performance.now() < suppressClickUntil) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true
    );

    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (activePointerId !== null) return;
      if (e.pointerType === "mouse") e.preventDefault();

      const pointerId = e.pointerId;
      activePointerId = pointerId;
      const startX = e.clientX;
      const startY = e.clientY;
      const startTime = performance.now();

      let lastDx = 0;
      let lastDy = 0;
      let lifted = false;
      let stretched = false;
      let finished = false;
      let captured = false;

      el.classList.add("is-pressing");

      function applyStretch(dx, dy) {
        const dist = Math.hypot(dx, dy);
        const p = Math.min(1, 0.22 + (1 - Math.exp(-dist / pullRange)) * 0.78);
        const nx = Math.tanh(dx / 65);
        const ny = Math.tanh(dy / 55);

        const tx = nx * maxAnchorShift;
        const ty = ny * (maxAnchorShift * 0.8);

        const ax = Math.abs(nx);
        const ay = Math.abs(ny);
        const sx = baseScale + ax * maxStretchX - ay * 0.02;
        const sy = baseScale + ay * maxStretchY - ax * 0.02;

        el.style.transform = `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
        el.style.setProperty("--lg-pull", p.toFixed(3));
        el.style.setProperty("--lg-glow-x", `${(50 + nx * 36).toFixed(1)}%`);
        el.style.setProperty("--lg-glow-y", `${(50 + ny * 36).toFixed(1)}%`);
      }

      function enterLifted(dx, dy) {
        if (lifted || finished) return;
        lifted = true;
        el.classList.remove("is-pressing");
        el.classList.add("is-lifted");
        try {
          el.setPointerCapture(pointerId);
          captured = true;
        } catch (_) {}
        applyStretch(dx, dy);
        updateFilter(el);
      }

      const holdTimer = setTimeout(() => enterLifted(lastDx, lastDy), holdDelay);

      function onTouchMove(ev) {
        if (!finished && lifted && ev.cancelable) {
          ev.preventDefault();
        }
      }

      function onMove(ev) {
        if (finished || ev.pointerId !== pointerId) return;
        lastDx = ev.clientX - startX;
        lastDy = ev.clientY - startY;
        const dist = Math.hypot(lastDx, lastDy);

        if (!lifted && dist > 4) {
          clearTimeout(holdTimer);
          enterLifted(lastDx, lastDy);
        }

        if (lifted) {
          if (ev.cancelable) ev.preventDefault();
          if (dist > 6) stretched = true;
          applyStretch(lastDx, lastDy);
        }
      }

      function cleanup(ev) {
        if (finished) return;
        if (ev && ev.pointerId !== undefined && ev.pointerId !== pointerId) return;
        finished = true;
        activePointerId = null;
        clearTimeout(holdTimer);
        el.classList.remove("is-pressing");

        if (captured) {
          try {
            el.releasePointerCapture(pointerId);
          } catch (_) {}
        }

        const heldLong = performance.now() - startTime >= 250;
        if (stretched || (lifted && heldLong)) {
          suppressClickUntil = performance.now() + 200;
        }

        if (lifted) {
          el.classList.remove("is-lifted");
          el.style.transform = "";
          el.style.setProperty("--lg-pull", "0");
          el.style.setProperty("--lg-glow-x", "50%");
          el.style.setProperty("--lg-glow-y", "50%");
          updateFilter(el);
        }

        window.removeEventListener("touchmove", onTouchMove, { passive: false });
        window.removeEventListener("pointermove", onMove, { passive: false });
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
      }

      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    });
  }

  function attachPillBar(container, itemSelector, pillEl, onPick) {
    if (!container || !pillEl || container.dataset.lgPillBound) return;
    container.dataset.lgPillBound = "1";

    container.addEventListener("contextmenu", (e) => e.preventDefault());
    container.addEventListener("selectstart", (e) => e.preventDefault());
    container.querySelectorAll(itemSelector).forEach((item) => {
      item.setAttribute("draggable", "false");
      item.addEventListener("dragstart", (e) => e.preventDefault());
    });

    let suppressClickUntil = 0;
    let activePointerId = null;

    container.addEventListener(
      "click",
      (e) => {
        if (performance.now() < suppressClickUntil) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true
    );

    container.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (activePointerId !== null) return;
      if (e.pointerType === "mouse") e.preventDefault();

      const items = [...container.querySelectorAll(itemSelector)];
      if (!items.length) return;

      const cRect = container.getBoundingClientRect();
      const metrics = items.map((it) => {
        const r = it.getBoundingClientRect();
        const left = r.left - cRect.left;
        const width = r.width;
        return { el: it, left, width, right: left + width, center: left + width / 2 };
      });

      const initialActive = items.find((it) => it.classList.contains("active")) || items[0];
      const pointerId = e.pointerId;
      activePointerId = pointerId;
      const startX = e.clientX;
      let lastClientX = startX;
      let lifted = false;
      let moved = false;
      let finished = false;
      let currentTarget = metrics.find((m) => m.el === initialActive) || metrics[0];
      let captured = false;

      let curLeft = pillEl.offsetLeft;
      let curWidth = pillEl.offsetWidth || currentTarget.width;
      let targetLeft = curLeft;
      let targetWidth = curWidth;
      let rafId = 0;
      let lastTick = performance.now();

      function getHoveredMetric(localX) {
        for (const m of metrics) {
          if (localX >= m.left && localX <= m.right) return m;
        }
        let best = metrics[0];
        let bestDist = Infinity;
        for (const m of metrics) {
          const d = Math.abs(m.center - localX);
          if (d < bestDist) {
            bestDist = d;
            best = m;
          }
        }
        return best;
      }

      function updateTargetAt(clientX) {
        const localX = clientX - cRect.left;
        currentTarget = getHoveredMetric(localX);
        targetWidth = currentTarget.width;

        const pad = 5;
        targetLeft = Math.max(
          pad,
          Math.min(cRect.width - targetWidth - pad, localX - targetWidth / 2)
        );

        items.forEach((it) => it.classList.toggle("active", it === currentTarget.el));
      }

      function tick(now) {
        if (!lifted || finished) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTick) / 1000));
        lastTick = now;

        const kPos = 1 - Math.exp(-16 * dt);
        const kSize = 1 - Math.exp(-12 * dt);

        curLeft += (targetLeft - curLeft) * kPos;
        curWidth += (targetWidth - curWidth) * kSize;

        pillEl.style.left = `${curLeft.toFixed(2)}px`;
        pillEl.style.width = `${curWidth.toFixed(2)}px`;
        updateFilter(pillEl);

        rafId = requestAnimationFrame(tick);
      }

      function enterLift(clientX) {
        if (lifted || finished) return;
        lifted = true;
        curLeft = pillEl.offsetLeft;
        curWidth = pillEl.offsetWidth || currentTarget.width;
        lastTick = performance.now();

        container.classList.add("is-pill-lifted");
        try {
          container.setPointerCapture(pointerId);
          captured = true;
        } catch (_) {}

        updateTargetAt(clientX);
        updateFilter(pillEl);
        rafId = requestAnimationFrame(tick);
      }

      const holdTimer = setTimeout(() => enterLift(lastClientX), 110);

      function onTouchMove(ev) {
        if (!finished && lifted && ev.cancelable) {
          ev.preventDefault();
        }
      }

      function onMove(ev) {
        if (finished || ev.pointerId !== pointerId) return;
        lastClientX = ev.clientX;
        const dx = Math.abs(ev.clientX - startX);

        if (!lifted && dx > 4) {
          clearTimeout(holdTimer);
          enterLift(ev.clientX);
        }
        if (lifted) {
          if (ev.cancelable) ev.preventDefault();
          if (dx > 4) moved = true;
          updateTargetAt(ev.clientX);
        }
      }

      function onUp(ev) {
        if (finished) return;
        if (ev && ev.pointerId !== undefined && ev.pointerId !== pointerId) return;
        finished = true;
        activePointerId = null;
        clearTimeout(holdTimer);
        if (rafId) cancelAnimationFrame(rafId);

        if (captured) {
          try {
            container.releasePointerCapture(pointerId);
          } catch (_) {}
        }

        if (lifted) {
          container.classList.remove("is-pill-lifted");
          updateFilter(pillEl);
          suppressClickUntil = performance.now() + 200;

          if (moved || currentTarget.el !== initialActive) {
            if (typeof onPick === "function") {
              onPick(currentTarget.el);
            }
          } else {
            pillEl.style.left = `${currentTarget.left}px`;
            pillEl.style.width = `${currentTarget.width}px`;
          }
        }

        window.removeEventListener("touchmove", onTouchMove, { passive: false });
        window.removeEventListener("pointermove", onMove, { passive: false });
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      }

      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("pointermove", onMove, { passive: false });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    });
  }

  global.GlisseGlass = {
    supportsSvgRefraction: supportsBackdropSvg,
    refresh: observeAll,
    updateFilter,
    attachPullable,
    attachPillBar,
  };
})(window); 
