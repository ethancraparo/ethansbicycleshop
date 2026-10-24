(function () {
  const works = window.ARTWORKS;
  const root = document.documentElement;
  const room = document.querySelector(".room");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The page's own size. Unlike innerWidth/innerHeight, these stay put while
  // someone pinch-zooms on a phone, so zooming in never re-sizes the art.
  const viewW = () => document.documentElement.clientWidth;
  const viewH = () => document.documentElement.clientHeight;
  // run fn on a real resize (rotating the phone, resizing the window), not on zoom
  function onLayoutResize(fn) {
    let w = viewW(), h = viewH();
    addEventListener("resize", () => {
      if (viewW() === w && viewH() === h) return;
      w = viewW();
      h = viewH();
      fn();
    });
  }
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const FRAME_CM = 4.8; // both sides of the frame moulding
  const MAT_CM = 9; // both sides of the mat, when a piece has no framed size

  // One side of a piece's mat, in cm. With a real framed size ("22 × 16 in"),
  // the mat is whatever is left between the art and the frame moulding, so the
  // piece hangs at its true framed size.
  function matSide(a) {
    if (!a.mat) return 0;
    const m = String(a.framed || "").match(/([\d.]+)\s*[×x]\s*([\d.]+)\s*(in|cm)?/i);
    if (!m) return MAT_CM / 2;
    const unit = (m[3] || "in").toLowerCase() === "cm" ? 1 : 2.54;
    const fw = parseFloat(m[1]) * unit, fh = parseFloat(m[2]) * unit;
    const side = ((fw - a.width) / 2 + (fh - a.height) / 2) / 2 - FRAME_CM / 2;
    return Math.max(0.6, side);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  // titles are always shown in quotation marks: “Six Shooter”
  const quote = (title) => `\u201c${title}\u201d`;

  // numbered editions always show three digits each side: "2/6" -> "002/006"
  const pad3 = (n) => String(n).padStart(3, "0");
  function editionLabel(ed) {
    const m = String(ed || "1/1").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    return m ? `${pad3(m[1])}/${pad3(m[2])}` : String(ed);
  }

  // "2026 · Ink on paper · 1/1", leaving out anything not filled in yet
  function details(...parts) {
    return parts.filter((p) => p != null && String(p).trim() !== "").map(esc).join(" · ");
  }

  function hangHTML(a) {
    // metallic foil catches the light: a silver sheen, cut to the foil's shape, that moves with the tilt
    const foil = a.foil
      ? `<span class="foil" style="-webkit-mask-image:url('${esc(a.foil)}');mask-image:url('${esc(a.foil)}')"></span>`
      : "";
    const img = `<span class="art"><img src="${esc(a.image)}" alt="${esc(a.title)}" draggable="false">${foil}</span>`;
    return `
      <div class="hang" style="--w:${a.width};--h:${a.height};--mat:${matSide(a).toFixed(2)}">
        <div class="cast"></div>
        <div class="piece-3d">
          <div class="frame frame--${esc(a.frame)}">
            <span class="side side--t"></span><span class="side side--b"></span>
            <span class="side side--l"></span><span class="side side--r"></span>
            ${a.mat ? `<div class="mat">${img}</div>` : img}
            <span class="glass"></span>
          </div>
          ${a.available === 0 ? `<span class="sold-dot frame-dot" aria-hidden="true"></span>` : ""}
        </div>
      </div>`;
  }

  function outerSize(a) {
    const extra = FRAME_CM + matSide(a) * 2;
    return { w: a.width + extra, h: a.height + extra };
  }

  /* ---------- Salon hang: a loose, organic cluster ---------- */

  function seededRandom(seed) {
    let t = seed >>> 0;
    return () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Lays pieces out in cm, biggest first, each one tucked against the cluster
  // where it keeps the whole group closest to the wall's proportions. Pieces are
  // nudged partway along their neighbours rather than flush, and placements that
  // line edges up neatly score worse, so even same-size work hangs staggered.
  function salonLayout(items, aspect, seed) {
    const rand = seededRandom(seed);
    const GAP = 5;
    const SHIFTS = [-0.4, -0.24, 0, 0.24, 0.4]; // offset along a neighbour, as a share of the piece's size
    const ALIGN_PENALTY = 10;
    const order = items
      .map((a, i) => ({ i, ...outerSize(a) }))
      .sort((p, q) => q.w * q.h - p.w * p.h);
    const placed = [];
    const hits = (r) =>
      placed.some(
        (p) =>
          r.x < p.x + p.w + GAP - 0.01 && r.x + r.w > p.x - GAP + 0.01 &&
          r.y < p.y + p.h + GAP - 0.01 && r.y + r.h > p.y - GAP + 0.01
      );

    for (const it of order) {
      if (!placed.length) {
        placed.push({ ...it, x: -it.w / 2, y: -it.h / 2 });
        continue;
      }
      let best = null;
      let bestScore = Infinity;
      // how many of this spot's edges or centres line up with a piece already hung
      const aligned = (r) => {
        let n = 0;
        for (const q of placed) {
          for (const [a, b] of [
            [r.x, q.x], [r.x + r.w, q.x + q.w], [r.x + r.w / 2, q.x + q.w / 2],
            [r.y, q.y], [r.y + r.h, q.y + q.h], [r.y + r.h / 2, q.y + q.h / 2],
          ]) {
            if (Math.abs(a - b) < 2.5) n++;
          }
        }
        return n;
      };
      for (const p of placed) {
        for (const s of SHIFTS) {
          const g = GAP + rand() * 5;
          const y = p.y + (p.h - it.h) / 2 + s * it.h + (rand() - 0.5) * 4;
          const x = p.x + (p.w - it.w) / 2 + s * it.w + (rand() - 0.5) * 4;
          const candidates = [
            { x: p.x + p.w + g, y },
            { x: p.x - g - it.w, y },
            { x, y: p.y - g - it.h },
            { x, y: p.y + p.h + g },
          ];
          for (const c of candidates) {
            const r = { ...c, w: it.w, h: it.h };
            if (hits(r)) continue;
            const all = placed.concat(r);
            const minX = Math.min(...all.map((q) => q.x));
            const maxX = Math.max(...all.map((q) => q.x + q.w));
            const minY = Math.min(...all.map((q) => q.y));
            const maxY = Math.max(...all.map((q) => q.y + q.h));
            const score =
              Math.max((maxX - minX) / aspect, maxY - minY) +
              // stay near the middle; on a long wall, sideways distance matters less
              0.12 * Math.hypot((r.x + r.w / 2) / Math.max(1, aspect / 1.6), r.y + r.h / 2) +
              ALIGN_PENALTY * aligned(r) +
              rand() * 4;
            if (score < bestScore) {
              bestScore = score;
              best = r;
            }
          }
        }
      }
      placed.push({ ...it, x: best.x, y: best.y });
    }

    const minX = Math.min(...placed.map((q) => q.x));
    const minY = Math.min(...placed.map((q) => q.y));
    const width = Math.max(...placed.map((q) => q.x + q.w)) - minX;
    const height = Math.max(...placed.map((q) => q.y + q.h)) - minY;
    const spots = [];
    for (const q of placed) spots[q.i] = { x: q.x - minX, y: q.y - minY };
    return { spots, width, height };
  }

  /* ---------- Motion: smooth tilt that follows the cursor ---------- */

  const hangs = [];
  let frame = 0;

  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v) => Math.max(-1, Math.min(1, v));

  function tick() {
    frame = 0;
    let moving = false;
    const step = (o, keys, k) => {
      for (const key of keys) {
        const t = o["t" + key];
        o[key] = lerp(o[key], t, k);
        if (Math.abs(t - o[key]) > 0.0005) moving = true;
        else o[key] = t;
      }
    };
    for (const h of hangs) {
      step(h, ["x", "y", "l"], 0.12);
      h.el.style.setProperty("--hx", h.x.toFixed(4));
      h.el.style.setProperty("--hy", h.y.toFixed(4));
      h.el.style.setProperty("--lift", h.l.toFixed(4));
    }
    if (moving) kick();
  }
  function kick() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  // Tilt one piece toward wherever the cursor is over `area`.
  function track(el, area, restingLift) {
    const h = { el, x: 0, y: 0, l: 0, tx: 0, ty: 0, tl: 0 };
    hangs.push(h);
    const rest = () => {
      h.tx = h.ty = 0;
      h.tl = restingLift || 0;
      kick();
    };
    rest();
    if (reduceMotion) return h;
    if (finePointer) {
      area.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const spanX = area === root ? viewW() / 2 : r.width / 2;
        const spanY = area === root ? viewH() / 2 : r.height / 2;
        h.tx = clamp((e.clientX - (r.left + r.width / 2)) / spanX);
        h.ty = clamp((e.clientY - (r.top + r.height / 2)) / spanY);
        h.tl = 1;
        kick();
      });
      area.addEventListener("pointerleave", rest);
    }
    if (area !== root) {
      area.addEventListener("focus", () => { h.tl = 1; kick(); });
      area.addEventListener("blur", rest);
    }
    touchTilt(h, area === root ? el : area, rest);
    return h;
  }

  // On a phone: press and hold a piece, then drag to tilt it toward your finger.
  // A quick swipe still scrolls or walks the wall, two fingers still zoom, and
  // letting go after tilting doesn't open the piece.
  function touchTilt(h, target, rest) {
    const HOLD_MS = 220;
    let timer = 0;
    let tilting = false;
    let start = null;
    const aim = (t) => {
      const r = h.el.getBoundingClientRect();
      h.tx = clamp((t.clientX - (r.left + r.width / 2)) / (r.width / 2));
      h.ty = clamp((t.clientY - (r.top + r.height / 2)) / (r.height / 2));
      h.tl = 1;
      kick();
    };
    const stop = () => {
      clearTimeout(timer);
      timer = 0;
      if (tilting) rest();
      tilting = false;
      target.classList.remove("is-tilting");
    };
    target.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return stop();
        const t = e.touches[0];
        start = { x: t.clientX, y: t.clientY };
        clearTimeout(timer);
        timer = setTimeout(() => {
          tilting = true;
          target.classList.add("is-tilting");
          aim(start);
        }, HOLD_MS);
      },
      { passive: true }
    );
    target.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length !== 1) return stop();
        const t = e.touches[0];
        if (tilting) {
          e.preventDefault(); // the drag tilts the piece instead of scrolling
          aim(t);
        } else if (start && Math.hypot(t.clientX - start.x, t.clientY - start.y) > 8) {
          clearTimeout(timer); // moved too soon: it's a scroll or swipe
          timer = 0;
        }
      },
      { passive: false }
    );
    target.addEventListener("touchend", (e) => {
      if (tilting) e.preventDefault(); // no tap: letting go doesn't open the piece
      stop();
    });
    target.addEventListener("touchcancel", stop);
  }

  /* ---------- Page transitions ---------- */

  function leave(href, fromEl) {
    if (reduceMotion) {
      location.href = href;
      return;
    }
    if (fromEl && room) {
      // fly the camera toward the clicked piece
      const r = fromEl.getBoundingClientRect();
      const px = r.left + r.width / 2;
      const py = r.top + r.height / 2;
      room.style.transformOrigin = `${px}px ${py}px`;
      const zoom = Math.max(1.8, Math.min(5, (viewH() * 0.55) / r.height));
      room.style.transform = `translate(${viewW() / 2 - px}px, ${viewH() / 2 - py}px) scale(${zoom})`;
    }
    root.classList.add("is-leaving");
    setTimeout(() => (location.href = href), 720);
  }

  function interceptLink(a, fromEl) {
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      leave(a.getAttribute("href"), fromEl && fromEl());
    });
  }

  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    root.classList.remove("is-leaving");
    if (room) room.style.transform = "";
  });

  function arrive() {
    // flush the "entering" styles first so removing the class animates
    void document.body.offsetWidth;
    setTimeout(() => root.classList.remove("is-entering"), 30);
  }

  /* ---------- Home: the wall ---------- */

  // Splits the collection into walls of about WALL_SIZE pieces, like rooms in a
  // gallery. Pieces with a `wall` name hang together; the rest fill walls in
  // list order. Each wall is split evenly (25 pieces -> walls of 7, 6, 6, 6).
  function wallGroups(list) {
    const per = window.WALL_SIZE || 8;
    const named = new Map();
    const loose = [];
    list.forEach((a, i) => {
      if (a.wall) {
        if (!named.has(a.wall)) named.set(a.wall, []);
        named.get(a.wall).push(i);
      } else loose.push(i);
    });
    const out = [];
    const chunk = (idx, name) => {
      const n = Math.max(1, Math.ceil(idx.length / per));
      let start = 0;
      for (let k = 0; k < n; k++) {
        // spread any remainder over the first walls: 25 -> 7, 6, 6, 6
        const size = Math.floor(idx.length / n) + (k < idx.length % n ? 1 : 0);
        out.push({ name, idx: idx.slice(start, start + size) });
        start += size;
      }
    };
    named.forEach((idx, name) => chunk(idx, name));
    if (loose.length) chunk(loose, null);
    return out;
  }

  // the second line of a piece's label: edition · price (or Sold)
  function placardLine(a) {
    return details(
      a.edition && editionLabel(a.edition),
      a.available === 0 ? "Sold" : a.price != null ? money(a.price) : "Price on request"
    );
  }

  function initWall() {
    const wall = document.querySelector(".wall");
    const walk = document.querySelector(".walk");
    const hint = document.querySelector(".hint");
    const groups = wallGroups(works);
    const many = groups.length > 1;
    const wallName = (g, n) => g.name || `Wall ${n + 1} of ${groups.length}`;

    walk.innerHTML = groups
      .map(
        (g, n) => `
        <section class="bay" aria-label="${esc(wallName(g, n))}">
          <div class="salon">
            ${g.idx
              .map((i) => {
                const a = works[i];
                return `
                <a class="piece" data-i="${i}" href="piece.html?id=${encodeURIComponent(a.id)}"
                   aria-label="${details(quote(a.title), a.year)}${a.available === 0 ? ", sold" : ""}. View piece">
                  ${hangHTML(a)}
                  <span class="placard" aria-hidden="true">
                    <em>${esc(quote(a.title))}</em>
                    <span>${placardLine(a)}</span>
                  </span>
                </a>`;
              })
              .join("")}
          </div>
        </section>`
      )
      .join("");
    const bays = [...walk.querySelectorAll(".bay")];
    wall.classList.toggle("has-walls", many);

    // dots under the wall, one per wall
    const dots = document.createElement("div");
    dots.className = "bay-dots";
    dots.innerHTML = groups
      .map((g, n) => `<button type="button" aria-label="Go to ${esc(wallName(g, n))}"></button>`)
      .join("");
    if (many) document.body.appendChild(dots);

    // Hang each wall as its own salon cluster, sized to the screen.
    const hangWalls = () => {
      const narrow = viewW() <= 760;
      // phones are narrow, so the art gets nearly the full width and more height
      const availW = walk.clientWidth * (narrow ? 0.93 : 0.64);
      const availH = wall.clientHeight * (narrow ? 0.7 : 0.6);
      bays.forEach((bay, n) => {
        const salon = bay.querySelector(".salon");
        const items = groups[n].idx.map((i) => works[i]);
        const { spots, width, height } = salonLayout(items, availW / availH, (window.HANG_SEED || 7) + n);
        salon.style.setProperty("--sw", width);
        salon.style.setProperty("--sh", height);
        salon.style.setProperty("--cm", `${Math.min(availW / width, availH / height)}px`);
        [...salon.querySelectorAll(".piece")].forEach((el, k) => {
          el.style.setProperty("--x", spots[k].x);
          el.style.setProperty("--y", spots[k].y);
        });
      });
    };

    // The floor is drawn in perspective, so it's smaller at the baseboard than
    // up close. Measure that scale, so the boards where they meet the wall move
    // exactly with the wall (and the near boards move faster, like real parallax).
    let floorScale = 0.82;
    const measureFloor = () => {
      const plane = document.querySelector(".floor-plane");
      const floor = document.querySelector(".floor");
      if (!plane || !floor) return;
      const top = floor.getBoundingClientRect().top;
      const at = (frac, x) => {
        const d = document.createElement("i");
        d.style.cssText = `position:absolute;width:1px;height:1px;left:${x}px;top:${plane.offsetHeight * (1 - frac)}px`;
        plane.appendChild(d);
        const r = d.getBoundingClientRect();
        d.remove();
        return r;
      };
      let lo = 0, hi = 0.5;
      for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        if (at(mid, 0).top > top) lo = mid;
        else hi = mid;
      }
      const a = at(lo, 0), b = at(lo, 100);
      if (b.left - a.left > 1) floorScale = (b.left - a.left) / 100;
    };

    // which wall you're standing at, and the walk between them
    let current = 0;
    const idleHint = () => {
      if (!many) return "";
      const how = finePointer ? "use the arrows to walk to the next wall" : "swipe for the next wall";
      return `${esc(wallName(groups[current], current))} · ${how}`;
    };
    const naming = () => hint.classList.contains("is-naming");
    const onWalk = () => {
      root.style.setProperty("--walk", walk.scrollLeft);
      root.style.setProperty("--floor-walk", walk.scrollLeft / floorScale);
      const n = Math.round(walk.scrollLeft / Math.max(1, walk.clientWidth));
      if (n !== current) {
        current = Math.max(0, Math.min(groups.length - 1, n));
        if (!naming()) hint.innerHTML = idleHint();
      }
      wall.classList.toggle("at-start", current === 0);
      wall.classList.toggle("at-end", current === groups.length - 1);
      [...dots.children].forEach((d, k) => d.setAttribute("aria-current", String(k === current)));
    };
    walk.addEventListener("scroll", onWalk, { passive: true });
    const go = (n) => {
      n = Math.max(0, Math.min(groups.length - 1, n));
      walk.scrollTo({ left: n * walk.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
    };
    [...dots.children].forEach((d, k) => d.addEventListener("click", () => go(k)));

    // a mouse wheel turns to the next or previous wall, one wall per flick
    let wheelLock = 0;
    walk.addEventListener(
      "wheel",
      (e) => {
        if (!many || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        e.preventDefault();
        const now = Date.now();
        if (now < wheelLock || Math.abs(e.deltaY) < 8) return;
        wheelLock = now + 700;
        go(current + Math.sign(e.deltaY));
      },
      { passive: false }
    );

    // drag the wall sideways with a mouse; a drag never counts as a click
    let drag = null;
    walk.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || !many) return;
      drag = { x: e.clientX, left: walk.scrollLeft, moved: false };
    });
    addEventListener("pointermove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6 && !drag.moved) {
        drag.moved = true;
        wall.classList.add("is-dragging");
      }
      if (drag.moved) walk.scrollLeft = drag.left - dx;
    });
    addEventListener("pointerup", (e) => {
      if (!drag) return;
      if (drag.moved) {
        const swallow = (ev) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
        };
        addEventListener("click", swallow, { capture: true, once: true });
        setTimeout(() => removeEventListener("click", swallow, { capture: true }), 50);
        const dx = e.clientX - drag.x;
        const start = Math.round(drag.left / walk.clientWidth);
        wall.classList.remove("is-dragging");
        go(Math.abs(dx) > walk.clientWidth * 0.12 ? start - Math.sign(dx) : start);
      }
      drag = null;
    });

    // arrow buttons and keyboard arrows
    for (const dir of [-1, 1]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `walk-arrow walk-arrow--${dir < 0 ? "prev" : "next"}`;
      b.setAttribute("aria-label", dir < 0 ? "Previous wall" : "Next wall");
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${dir < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}"/></svg>`;
      b.addEventListener("click", () => go(current + dir));
      wall.appendChild(b);
    }
    addEventListener("keydown", (e) => {
      if (!many || document.querySelector(".menu.is-open, .cart.is-open")) return;
      if (e.key === "ArrowRight") go(current + 1);
      if (e.key === "ArrowLeft") go(current - 1);
    });

    const layout = () => {
      measureFloor();
      hangWalls();
      walk.scrollLeft = current * walk.clientWidth;
      onWalk();
    };
    layout();
    onLayoutResize(layout);
    hint.innerHTML = idleHint();

    walk.querySelectorAll(".piece").forEach((piece) => {
      const hang = piece.querySelector(".hang");
      const a = works[+piece.dataset.i];
      track(hang, piece);
      interceptLink(piece, () => hang);
      // the caption under the wall names whatever you're looking at
      const placard = piece.querySelector(".placard");
      // Hang the placard on whichever side of the piece is clear: below, then
      // above, then to the right or left. Clear means not over another frame,
      // the header, the caption at the bottom, or off the screen.
      const SIDES = ["", "is-above", "is-right", "is-left"];
      const placePlacard = () => {
        const blockers = [...walk.querySelectorAll(".hang")]
          .filter((x) => x !== hang)
          .map((x) => x.getBoundingClientRect());
        const head = document.querySelector(".wall-head .menu").getBoundingClientRect();
        const tools = document.querySelector(".head-tools").getBoundingClientRect();
        const sign = document.querySelector(".signature").getBoundingClientRect();
        blockers.push(head, tools, sign);
        const floorTop = document.querySelector(".trim").getBoundingClientRect().top;
        const clear = (r) =>
          r.left >= 8 && r.right <= viewW() - 8 && r.top >= 8 && r.bottom <= floorTop - 8 &&
          !blockers.some((o) => r.left < o.right + 6 && r.right > o.left - 6 && r.top < o.bottom + 6 && r.bottom > o.top - 6);
        for (const side of SIDES) {
          SIDES.forEach((c) => c && placard.classList.remove(c));
          if (side) placard.classList.add(side);
          if (clear(placard.getBoundingClientRect())) return;
        }
        SIDES.forEach((c) => c && placard.classList.remove(c)); // nowhere is clear: below
      };
      const show = () => {
        if (finePointer) return placePlacard(); // the placard names the piece with a mouse
        hint.innerHTML = `<em>${esc(quote(a.title))}</em><span>${placardLine(a)}</span>`;
        hint.classList.add("is-naming");
      };
      const hide = () => {
        hint.classList.remove("is-naming");
        hint.innerHTML = idleHint();
      };
      piece.addEventListener("pointerenter", show);
      piece.addEventListener("pointerleave", hide);
      piece.addEventListener("focus", show);
      piece.addEventListener("blur", hide);
    });
  }

  /* ---------- Piece page ---------- */

  // Hang one framed piece large on the stage, sized to the screen.
  function showOnStage(a) {
    const stage = document.querySelector(".stage");
    stage.innerHTML = hangHTML(a);
    const hang = stage.querySelector(".hang");
    const fit = () => {
      const s = outerSize(a);
      const narrow = viewW() <= 760;
      const maxH = viewH() * (narrow ? 0.4 : 0.5);
      const maxW = viewW() * (narrow ? 0.78 : 0.44);
      hang.style.setProperty("--cm", `${Math.min(maxH / s.h, maxW / s.w)}px`);
    };
    fit();
    onLayoutResize(fit);
    // only tilts while the cursor is over the piece itself
    track(hang, hang, 0.25);
  }

  function initPiece() {
    const id = new URLSearchParams(location.search).get("id");
    let i = works.findIndex((a) => a.id === id);
    if (i < 0) i = 0;
    const a = works[i];
    const prev = works[(i - 1 + works.length) % works.length];
    const next = works[(i + 1) % works.length];

    document.title = `${quote(a.title)} · ${document.title}`;
    showOnStage(a);

    document.querySelector(".wall-text").innerHTML = `
      <h1>${esc(quote(a.title))}</h1>
      ${factsHTML(a)}
      <p class="desc">${esc(a.description)}</p>
      <div class="buy"></div>
      <nav class="steps" aria-label="More work">
        <a class="prev" href="piece.html?id=${encodeURIComponent(prev.id)}">
          <span class="step-label">← Previous</span>
          <span class="step-title">${esc(quote(prev.title))}</span>
        </a>
        <a class="next" href="piece.html?id=${encodeURIComponent(next.id)}">
          <span class="step-label">Next →</span>
          <span class="step-title">${esc(quote(next.title))}</span>
        </a>
      </nav>`;

    document.querySelectorAll(".steps a").forEach((link) => interceptLink(link));

    // price, availability and the add-to-cart button, kept in step with the cart
    const buy = document.querySelector(".buy");
    const renderBuy = () => {
      if (a.available === 0) {
        buy.innerHTML = `
          <div class="buy-row"><p class="price"><span class="sold-dot" aria-hidden="true"></span>Sold</p></div>`;
      } else if (a.price == null) {
        buy.innerHTML = `
          <div class="buy-row">
            <p class="price">Price on request</p>
            <a class="buy-button" href="contact.html">Enquire</a>
          </div>
          ${availabilityNote(a) ? `<p class="buy-note">${esc(availabilityNote(a))}</p>` : ""}`;
      } else {
        const inCart = cart.qtyOf(a.id);
        const full = !cart.canAdd(a.id);
        buy.innerHTML = `
          <div class="buy-row">
            <p class="price">${money(a.price)}</p>
            <button class="buy-button" type="button">${full ? "In your cart · View" : inCart ? "Add another" : "Add to cart"}</button>
          </div>
          ${(() => {
            const note = details(availabilityNote(a), inCart ? `${inCart} in your cart` : "");
            return note ? `<p class="buy-note">${note}</p>` : "";
          })()}`;
        buy.querySelector("button").addEventListener("click", () => {
          cart.add(a.id);
          openCart();
        });
      }
      buy.querySelectorAll("a").forEach((link) => interceptLink(link));
    };
    cart.onChange(renderBuy);
    renderBuy();

    addEventListener("keydown", (e) => {
      if (document.querySelector(".menu.is-open, .cart.is-open")) return;
      if (e.key === "Escape") leave("index.html");
      if (e.key === "ArrowLeft") leave(document.querySelector(".steps .prev").getAttribute("href"));
      if (e.key === "ArrowRight") leave(document.querySelector(".steps .next").getAttribute("href"));
    });
  }

  /* ---------- About & Contact ---------- */

  function initPage() {
    const stage = document.querySelector(".stage[data-portrait]");
    if (stage) {
      showOnStage({ title: "Portrait", image: stage.dataset.portrait, width: 30, height: 40, frame: "oak", mat: true });
    }
    document.querySelectorAll(".steps a").forEach((link) => interceptLink(link));
  }

  /* ---------- Menu ---------- */

  function initMenu() {
    const menu = document.querySelector(".menu");
    if (!menu) return;
    const toggle = menu.querySelector(".menu-toggle");
    const setOpen = (open) => {
      menu.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
    };
    toggle.addEventListener("click", () => setOpen(!menu.classList.contains("is-open")));

    // On phones the light/dark switch and the cart are two more items in the
    // menu, styled like the rest; they just press the header's own buttons.
    const list = menu.querySelector(".menu-list");
    const extra = (label, onClick) => {
      const li = document.createElement("li");
      li.className = "menu-extra";
      li.innerHTML = `<button type="button"></button>`;
      const b = li.firstChild;
      b.textContent = label;
      b.addEventListener("click", onClick);
      list.appendChild(li);
      return b;
    };
    extra("Cart", () => {
      setOpen(false);
      const c = document.querySelector(".cart-button");
      if (c) c.click();
    });
    const themeText = () => (root.dataset.theme === "light" ? "Dark mode" : "Light mode");
    const themeItem = extra(themeText(), () => {
      const t = document.querySelector(".theme-toggle");
      if (!t) return;
      // once the wall has switched, close the menu
      addEventListener("themechange", () => setOpen(false), { once: true });
      t.click();
    });
    addEventListener("themechange", () => (themeItem.textContent = themeText()));
    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("is-open")) setOpen(false);
    });
    document.querySelectorAll(".wall-head a").forEach((link) => interceptLink(link));
    addEventListener("pageshow", () => setOpen(false));
  }

  /* ---------- Cart ---------- */

  const shop = window.SHOP || { currency: "USD" };
  const CART_KEY = "cart-v1";
  const byId = (id) => works.find((a) => a.id === id);
  const forSale = (a) => a && a.price != null && a.available > 0;

  function money(n) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: shop.currency, maximumFractionDigits: 0 }).format(n);
    } catch (e) {
      return `${shop.currency} ${n}`;
    }
  }

  // The visitor's cart, kept in this browser so it follows them from page to page.
  const cart = {
    items: [],
    listeners: [],
    load() {
      let saved = [];
      try {
        saved = JSON.parse(localStorage.getItem(CART_KEY)) || [];
      } catch (e) {}
      // drop anything that has since sold or been removed, and respect what's left
      this.items = saved
        .filter((it) => forSale(byId(it.id)))
        .map((it) => ({ id: it.id, qty: Math.max(1, Math.min(it.qty | 0, byId(it.id).available)) }));
    },
    save() {
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(this.items));
      } catch (e) {}
      this.listeners.forEach((fn) => fn());
    },
    onChange(fn) {
      this.listeners.push(fn);
    },
    qtyOf(id) {
      const it = this.items.find((x) => x.id === id);
      return it ? it.qty : 0;
    },
    count() {
      return this.items.reduce((n, it) => n + it.qty, 0);
    },
    subtotal() {
      return this.items.reduce((n, it) => n + byId(it.id).price * it.qty, 0);
    },
    canAdd(id) {
      const a = byId(id);
      return forSale(a) && this.qtyOf(id) < a.available;
    },
    add(id) {
      if (!this.canAdd(id)) return false;
      const it = this.items.find((x) => x.id === id);
      if (it) it.qty += 1;
      else this.items.push({ id, qty: 1 });
      this.save();
      return true;
    },
    set(id, qty) {
      const a = byId(id);
      qty = Math.max(0, Math.min(qty, a ? a.available : 0));
      this.items = qty
        ? this.items.map((it) => (it.id === id ? { id, qty } : it))
        : this.items.filter((it) => it.id !== id);
      this.save();
    },
  };
  cart.load();
  // keep several open tabs in step
  addEventListener("storage", (e) => {
    if (e.key !== CART_KEY) return;
    cart.load();
    cart.listeners.forEach((fn) => fn());
  });

  // The edition, shown once and large under a piece's title: "Original 1/1",
  // "Edition 2/6", or "Edition of 5" for a run you're selling several copies of.
  // A museum-label facts block: one row per fact, blanks left out. The edition
  // row is set larger so it stays easy to spot.
  function factsHTML(a) {
    const ed = String(a.edition || "1/1").trim();
    const numbered = ed.match(/^(\d+)\s*\/\s*(\d+)$/);
    let edition;
    if (numbered && numbered[1] === "1" && numbered[2] === "1") {
      edition = `<span class="fact-num">001<span class="fact-slash">/</span>001</span>`;
    } else if (numbered) {
      edition = `<span class="fact-num">${pad3(numbered[1])}<span class="fact-slash">/</span>${pad3(numbered[2])}</span>`;
    } else {
      edition = `<span class="fact-num">${esc(ed.replace(/^edition\s*/i, ""))}</span>`;
    }
    const rows = [
      ["Edition", edition, "fact-edition"],
      ["Size", a.size && esc(a.size)],
      ["Framed", a.framed && esc(a.framed)],
      ["Medium", a.medium && esc(a.medium)],
      ["Year", a.year && esc(a.year)],
    ].filter((r) => r[1]);
    return `<dl class="facts">${rows
      .map(([label, value, cls]) => `<div${cls ? ` class="${cls}"` : ""}><dt>${label}</dt><dd>${value}</dd></div>`)
      .join("")}</dl>`;
  }

  // copies left, only for multi-copy editions ("Edition of 5"); a single
  // numbered sheet or an original needs no note
  function availabilityNote(a) {
    if (!a.edition || /^\s*\d+\s*\/\s*\d+\s*$/.test(a.edition)) return "";
    const total = (String(a.edition).match(/\d+/) || [])[0];
    return total ? `${a.available} of ${total} still available` : `${a.available} still available`;
  }

  function checkoutLink() {
    const lines = cart.items.map((it) => {
      const a = byId(it.id);
      return `${quote(a.title)} (${editionLabel(a.edition)})${it.qty > 1 ? ` × ${it.qty}` : ""}: ${money(a.price * it.qty)}`;
    });
    const subject = `Order request: ${cart.items.map((it) => quote(byId(it.id).title)).join(", ")}`;
    const body = [
      "Hi Ethan,",
      "",
      "I'd like to buy:",
      ...lines.map((l) => `  ${l}`),
      "",
      `Subtotal: ${money(cart.subtotal())}`,
      "",
      "Name:",
      "Shipping address:",
      "",
    ].join("\n");
    return `mailto:${shop.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function shippingNote() {
    const ship = shop.shipping;
    if (!ship) return "Shipping is arranged after you order.";
    return ship.amount ? `${ship.label}: ${money(ship.amount)}, added at checkout.` : `${ship.label}: free.`;
  }

  let openCart = () => {};

  function initCart() {
    const button = document.querySelector(".cart-button");
    if (!button) return;

    const panel = document.createElement("div");
    panel.className = "cart";
    panel.id = "cart";
    panel.innerHTML = `
      <div class="cart-backdrop"></div>
      <aside class="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div class="cart-head">
          <p class="eyebrow" id="cart-title">Cart</p>
          <button class="cart-close" type="button">Close</button>
        </div>
        <div class="cart-body" aria-live="polite"></div>
      </aside>`;
    document.body.appendChild(panel);
    const body = panel.querySelector(".cart-body");
    const close = panel.querySelector(".cart-close");

    const render = () => {
      const n = cart.count();
      button.setAttribute("aria-label", `Cart, ${n} item${n === 1 ? "" : "s"}`);

      if (!n) {
        body.classList.add("is-empty");
        body.innerHTML = `
          <p class="cart-empty">Your cart is empty.</p>
          <p class="cart-note">Originals and limited editions can be added from each piece's page. Questions? <a href="contact.html">Get in touch</a>.</p>`;
        interceptLink(body.querySelector("a"));
        return;
      }

      body.classList.remove("is-empty");
      body.innerHTML = `
        <ul class="cart-items">
          ${cart.items
            .map((it) => {
              const a = byId(it.id);
              const qty =
                a.available > 1
                  ? `<span class="qty">
                       <button type="button" data-qty="-1" data-id="${esc(a.id)}" aria-label="One fewer ${esc(quote(a.title))}">−</button>
                       <span>${it.qty}</span>
                       <button type="button" data-qty="1" data-id="${esc(a.id)}" aria-label="One more ${esc(quote(a.title))}"${it.qty >= a.available ? " disabled" : ""}>+</button>
                     </span>`
                  : "";
              return `
                <li class="cart-item">
                  <a class="cart-thumb" href="piece.html?id=${encodeURIComponent(a.id)}"><img src="${esc(a.image)}" alt=""></a>
                  <div class="cart-info">
                    <a class="cart-title" href="piece.html?id=${encodeURIComponent(a.id)}">${esc(quote(a.title))}</a>
                    <span class="cart-meta">${details(editionLabel(a.edition), a.medium)}</span>
                    <span class="cart-line">${qty}<button class="cart-remove" type="button" data-remove="${esc(a.id)}">Remove</button></span>
                  </div>
                  <span class="cart-price">${money(a.price * it.qty)}</span>
                </li>`;
            })
            .join("")}
        </ul>
        <div class="cart-foot">
          <p class="cart-subtotal"><span>Subtotal</span><span>${money(cart.subtotal())}</span></p>
          <p class="cart-fine">${esc(shippingNote())}</p>
          <a class="cart-checkout" href="checkout.html">Checkout</a>
          <p class="cart-fine">Secure card payment by Stripe, right here on the site. Apple Pay and Google Pay work too.</p>
        </div>`;
      body.querySelectorAll(".cart-thumb, .cart-title, .cart-checkout").forEach((link) => interceptLink(link));
    };

    body.addEventListener("click", (e) => {
      const step = e.target.closest("[data-qty]");
      const remove = e.target.closest("[data-remove]");
      if (step) cart.set(step.dataset.id, cart.qtyOf(step.dataset.id) + Number(step.dataset.qty));
      if (remove) cart.set(remove.dataset.remove, 0);
    });

    const setOpen = (open) => {
      panel.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", String(open));
      if (open) close.focus();
      else button.focus({ preventScroll: true });
    };
    openCart = () => setOpen(true);
    button.addEventListener("click", () => setOpen(true));
    close.addEventListener("click", () => setOpen(false));
    panel.querySelector(".cart-backdrop").addEventListener("click", () => setOpen(false));
    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("is-open")) {
        e.stopImmediatePropagation();
        setOpen(false);
      }
    }, true);

    cart.onChange(render);
    render();
  }

  /* ---------- Light / dark wall ---------- */

  function initTheme() {
    const button = document.querySelector(".theme-toggle");
    if (!button) return;
    const isLight = () => root.dataset.theme === "light";
    const label = () =>
      button.setAttribute("aria-label", isLight() ? "Switch to the charcoal wall" : "Switch to the cream wall");

    const swap = () => {
      if (isLight()) delete root.dataset.theme;
      else root.dataset.theme = "light";
      try {
        localStorage.setItem("theme", isLight() ? "light" : "dark");
      } catch (e) {}
      if (window.refreshWall) window.refreshWall();
      label();
      dispatchEvent(new Event("themechange"));
    };

    button.addEventListener("click", () => {
      if (reduceMotion) {
        swap();
        return;
      }
      // fade the room out, repaint the wall, fade back in
      root.classList.add("is-theming");
      setTimeout(() => {
        swap();
        setTimeout(() => root.classList.remove("is-theming"), 60);
      }, 210);
    });
    label();
  }

  /* ---------- Checkout page: Stripe's payment fields, styled like the gallery ---------- */

  // Stripe's fields live in secure frames, so they're styled through its
  // Appearance settings, built here from the site's own colour tokens.
  function stripeAppearance() {
    const css = getComputedStyle(root);
    const v = (name) => css.getPropertyValue(name).trim();
    const light = root.dataset.theme === "light";
    return {
      theme: light ? "stripe" : "night",
      labels: "above",
      variables: {
        colorPrimary: v("--ink"),
        colorBackground: v("--panel"),
        colorText: v("--ink"),
        colorTextSecondary: v("--ink-soft"),
        colorTextPlaceholder: v("--ink-faint"),
        colorDanger: v("--error"),
        colorIcon: v("--ink-soft"),
        fontFamily: "'Alegreya Sans', system-ui, -apple-system, sans-serif",
        fontSizeBase: "15px",
        fontWeightNormal: "500",
        borderRadius: "0px",
        spacingUnit: "4px",
        gridRowSpacing: "22px",
        gridColumnSpacing: "18px",
      },
      rules: {
        ".Label": {
          fontSize: "10.5px",
          fontWeight: "600",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: v("--ink-faint"),
          marginBottom: "8px",
        },
        ".Input": {
          backgroundColor: "transparent",
          border: "none",
          borderBottom: `1px solid ${v("--line")}`,
          boxShadow: "none",
          padding: "10px 2px 12px",
        },
        ".Input:focus": { borderBottomColor: v("--ink"), boxShadow: "none" },
        ".Input--invalid": { borderBottomColor: v("--error"), boxShadow: "none", color: v("--ink") },
        ".Tab": { backgroundColor: "transparent", border: `1px solid ${v("--line-soft")}`, boxShadow: "none" },
        ".Tab:hover": { borderColor: v("--line") },
        ".Tab--selected, .Tab--selected:hover, .Tab--selected:focus": {
          backgroundColor: "transparent",
          borderColor: v("--ink"),
          boxShadow: "none",
        },
        ".Block": { backgroundColor: "transparent", border: `1px solid ${v("--line-soft")}`, boxShadow: "none" },
        ".Error": { fontSize: "12.5px" },
      },
    };
  }

  function initCheckout() {
    const list = document.querySelector(".co-lines");
    const totals = document.querySelector(".co-totals");
    const form = document.querySelector(".co-form");
    const offline = document.querySelector(".co-offline");
    const payButton = form.querySelector(".co-pay");
    const error = form.querySelector(".co-error");
    const email = form.querySelector("#co-email");
    document.querySelectorAll(".checkout .back").forEach((link) => interceptLink(link));

    const editionText = (ed) => (/^\s*1\s*\/\s*1\s*$/.test(ed || "1/1") ? "Original 001/001" : `Edition ${editionLabel(ed)}`);
    const shipLabel = (shop.shipping && shop.shipping.label) || "Shipping";
    const shipAmount = (shop.shipping && shop.shipping.amount) || 0;

    const showTotals = (subtotal, shipping, total) => {
      totals.innerHTML = `
        <div><dt>Subtotal</dt><dd>${money(subtotal)}</dd></div>
        <div><dt>${esc(shipping.label)}</dt><dd>${shipping.amount ? money(shipping.amount) : "Free"}</dd></div>
        <div class="co-total"><dt>Total</dt><dd>${money(total)}</dd></div>`;
      payButton.textContent = `Pay ${money(total)}`;
    };

    // the order, laid out from the cart straight away
    if (!cart.items.length) {
      list.innerHTML = `<li class="co-empty">Your cart is empty. <a href="index.html">Choose a piece on the wall</a>.</li>`;
      interceptLink(list.querySelector("a"));
      document.querySelector(".co-panel").hidden = true;
      return;
    }
    list.innerHTML = cart.items
      .map((it) => {
        const a = byId(it.id);
        return `
          <li class="co-line">
            <a class="co-thumb" href="piece.html?id=${encodeURIComponent(a.id)}"><span><img src="${esc(a.image)}" alt=""></span></a>
            <div class="co-info">
              <a class="co-title" href="piece.html?id=${encodeURIComponent(a.id)}">${esc(quote(a.title))}</a>
              <span class="co-meta">${details(editionText(a.edition), a.size, it.qty > 1 ? `× ${it.qty}` : "")}</span>
            </div>
            <span class="co-price">${money(a.price * it.qty)}</span>
          </li>`;
      })
      .join("");
    list.querySelectorAll("a").forEach((link) => interceptLink(link));
    showTotals(cart.subtotal(), { label: shipLabel, amount: shipAmount }, cart.subtotal() + shipAmount);

    const goOffline = () => {
      form.hidden = true;
      offline.hidden = false;
      offline.querySelector(".co-email-order").href = checkoutLink();
    };

    (async () => {
      let r, data;
      try {
        r = await fetch("api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: cart.items }),
        });
        data = await r.json().catch(() => ({}));
      } catch (e) {
        r = null;
      }
      if (!r || [404, 405, 501, 503].includes(r.status) || !window.Stripe) {
        goOffline();
        return;
      }
      if (!r.ok) {
        error.textContent = data.error || "Checkout couldn't be started. Please try again.";
        return;
      }

      // the server's prices are the ones charged
      showTotals(data.subtotal, data.shipping, data.total);

      const stripe = window.Stripe(data.publishableKey);
      const elements = stripe.elements({
        clientSecret: data.clientSecret,
        appearance: stripeAppearance(),
        fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Alegreya+Sans:wght@500;700&display=swap" }],
      });
      elements
        .create("address", { mode: "shipping", allowedCountries: shop.shipTo, fields: { phone: "always" }, validation: { phone: { required: "always" } } })
        .mount("#co-address");
      const payment = elements.create("payment", { layout: { type: "accordion", defaultCollapsed: false, radios: true, spacedAccordionItems: false } });
      payment.mount("#co-payment");
      payment.on("ready", () => (payButton.disabled = false));
      addEventListener("themechange", () => elements.update({ appearance: stripeAppearance() }));

      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        error.textContent = "";
        if (!email.checkValidity() || !email.value.trim()) {
          error.textContent = "Please add an email for your receipt.";
          email.focus();
          return;
        }
        payButton.disabled = true;
        payButton.textContent = "Processing…";
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: new URL("thanks.html", location.href).href,
            receipt_email: email.value.trim(),
          },
        });
        // only reached if the payment couldn't go ahead (a declined card, a typo...)
        error.textContent = (result.error && result.error.message) || "Payment didn't go through. Please try again.";
        payButton.disabled = false;
        payButton.textContent = `Pay ${money(data.total)}`;
      });
    })();
  }

  /* ---------- Pages that scroll ---------- */

  // On every page but the wall, the room runs the page's whole length with the
  // floor at the very end, so text never scrolls over the floorboards.
  function fitRoom() {
    if (!room || document.body.dataset.page === "wall") return;
    room.style.height = "";
    room.style.height = `${Math.max(viewH(), document.documentElement.scrollHeight)}px`;
  }

  /* ---------- Archives: every piece, in a tidy grid ---------- */

  function initArchives() {
    const grid = document.querySelector(".archives-grid");
    const buttons = [...document.querySelectorAll(".archives-filter button")];
    const status = (a) =>
      a.available === 0 ? `<span class="sold-dot" aria-hidden="true"></span>Sold` : a.price != null ? money(a.price) : "Price on request";

    grid.innerHTML = works
      .map(
        (a) => `
        <li class="arc-item" data-sold="${a.available === 0}">
          <a class="arc-link" href="piece.html?id=${encodeURIComponent(a.id)}">
            <span class="arc-thumb"><span${a.mat ? ' class="arc-mat"' : ""}><img src="${esc(a.image)}" alt="" loading="lazy"></span></span>
            <span class="arc-title">${esc(quote(a.title))}</span>
            <span class="arc-meta">${details(editionLabel(a.edition), a.size, a.year)}</span>
            <span class="arc-status">${status(a)}</span>
          </a>
        </li>`
      )
      .join("");
    grid.querySelectorAll("a").forEach((link) => interceptLink(link));

    const show = (filter) => {
      grid.querySelectorAll(".arc-item").forEach((li) => {
        const sold = li.dataset.sold === "true";
        li.hidden = !(filter === "all" || (filter === "sold" ? sold : !sold));
      });
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === filter)));
    };
    buttons.forEach((b) =>
      b.addEventListener("click", () => {
        show(b.dataset.filter);
        fitRoom();
      })
    );
    show("all");
    grid.querySelectorAll("img").forEach((img) => img.addEventListener("load", fitRoom));
  }

  // After Stripe hands the buyer back: empty the cart only if the payment went
  // through; otherwise say so and keep the cart for another try.
  function initThanks() {
    const status = new URLSearchParams(location.search).get("redirect_status");
    if (status && status !== "succeeded") {
      const text = document.querySelector(".wall-text");
      text.querySelector(".eyebrow").textContent = status === "processing" ? "Payment processing" : "Payment not completed";
      text.querySelector("h1").textContent = status === "processing" ? "Almost there." : "That didn't go through.";
      text.querySelector(".desc").textContent =
        status === "processing"
          ? "Your payment is still being confirmed. You'll get a receipt by email as soon as it clears."
          : "Your card wasn't charged. Your cart is still saved if you'd like to try again.";
      if (status !== "processing") return;
    }
    cart.items = [];
    cart.save();
  }

  const page = document.body.dataset.page;
  if (page === "thanks") initThanks();
  if (page === "piece") initPiece();
  else if (page === "wall") initWall();
  else if (page === "checkout") initCheckout();
  else if (page === "archives") initArchives();
  else initPage();
  initMenu();
  initCart();
  initTheme();
  fitRoom();
  onLayoutResize(fitRoom);
  addEventListener("load", fitRoom);
  if (window.ResizeObserver && page !== "wall") new ResizeObserver(fitRoom).observe(document.querySelector("main") || document.body);
  arrive();
})();
