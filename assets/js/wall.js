/*
  Gives the wall a real plaster surface in whatever paint color --wall is
  (charcoal, or cream in light mode).

  The photo (assets/wall/plaster.jpg) is "White Plaster 02" by Rob Tuytel from
  Poly Haven, CC0. Only its light-and-shadow relief is kept and shaded onto the
  paint color, so both walls show exactly the same plaster. It's mirrored into a
  2x2 block so it doesn't visibly repeat. Cached for the visit.

  window.refreshWall() repaints it after the theme changes.
*/
(function () {
  const SRC = "assets/wall/plaster.jpg";
  const PIXELS = 800; // texture resolution per mirrored quarter
  const TILE = 1520; // on-screen size of the whole 2x2 block, in px
  const CACHE_PREFIX = "wall-plaster-v4-";

  const root = document.documentElement;
  let photo = null; // the loaded plaster photo, once we have it

  function apply(url) {
    root.style.setProperty("--wall-tex", `url(${url})`);
    root.style.setProperty("--wall-tex-size", `${TILE}px`);
  }

  function paintColor() {
    return getComputedStyle(root).getPropertyValue("--wall").trim().replace("#", "").toLowerCase();
  }

  // how strongly the plaster relief shows through the paint (set per wall in gallery.css)
  function relief() {
    return parseFloat(getComputedStyle(root).getPropertyValue("--wall-relief")) || 0.75;
  }

  function build(img, paint, strength) {
    const canvas = document.createElement("canvas");
    canvas.width = PIXELS * 2;
    canvas.height = PIXELS * 2;
    const g = canvas.getContext("2d");

    // mirror into four quarters: seamless on every edge, and twice the repeat length
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy], i) => {
      g.save();
      g.translate((i % 2) * PIXELS + (sx < 0 ? PIXELS : 0), Math.floor(i / 2) * PIXELS + (sy < 0 ? PIXELS : 0));
      g.scale(sx, sy);
      g.drawImage(img, 0, 0, PIXELS, PIXELS);
      g.restore();
    });

    // shade the paint by the plaster's relief: each bump lightens or darkens the
    // paint by the same proportion, so the texture reads the same on any color
    const base = [0, 2, 4].map((k) => parseInt(paint.slice(k, k + 2), 16));
    const data = g.getImageData(0, 0, canvas.width, canvas.height);
    const d = data.data;
    let total = 0;
    for (let i = 0; i < d.length; i += 4) total += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const meanLum = total / (d.length / 4);
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      const shade = 1 + ((lum - meanLum) / meanLum) * strength;
      d[i] = base[0] * shade;
      d[i + 1] = base[1] * shade;
      d[i + 2] = base[2] * shade;
    }
    g.putImageData(data, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.85);
  }

  function remember(key, url) {
    try {
      // keep only the current wall's texture, so the floor's fits in storage too
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX) && k !== key) sessionStorage.removeItem(k);
      }
      sessionStorage.setItem(key, url);
    } catch (e) {}
  }

  function refresh() {
    const paint = paintColor();
    if (!/^[0-9a-f]{6}$/.test(paint)) return;
    const strength = relief();
    const key = `${CACHE_PREFIX}${paint}-${strength}`;

    let cached = null;
    try {
      cached = sessionStorage.getItem(key);
    } catch (e) {}
    if (cached) {
      apply(cached);
      return;
    }
    // until this color's plaster is ready, show the plain paint rather than the old wall
    root.style.removeProperty("--wall-tex");

    const paintNow = () => {
      if (paintColor() !== paint) return; // the theme changed again meanwhile
      let url;
      try {
        url = build(photo, paint, strength);
      } catch (e) {
        return; // e.g. opened straight from disk: the plain paint color stays
      }
      apply(url);
      remember(key, url);
    };

    if (photo) {
      paintNow();
      return;
    }
    const img = new Image();
    img.onload = () => {
      photo = img;
      paintNow();
    };
    img.src = SRC;
  }

  window.refreshWall = refresh;
  refresh();
})();
