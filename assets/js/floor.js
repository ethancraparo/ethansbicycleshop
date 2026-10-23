/*
  Lays a real oak floor photo on the 3D floor plane, and cuts the baseboard
  from the same oak.

  The photo (assets/floor/oak-floor.jpg) is "Oak Wood Planks" by Dimitrios Savva
  from Poly Haven, CC0. It's toned here to a darker warm brown, and
  a second copy is set beside it shifted half a length, so the pattern doesn't
  visibly repeat and the board ends stagger like a real floor. The result is
  cached for the visit so page changes are instant.
*/
(function () {
  const SRC = "assets/floor/oak-floor.jpg";
  const TILE = 680; // on-screen size of one 1.2 m square of floor, in floor-plane px
  const PIXELS = 1360; // texture resolution per tile (2x for retina)
  const TARGET = [151, 116, 72]; // average color: the frames' oak, a shade darker
  const CACHE_KEY = "floor-photo-v5";

  function apply(url) {
    document.querySelectorAll(".floor-plane").forEach((plane) => {
      plane.style.backgroundImage = `url(${url})`;
      plane.style.backgroundSize = `${TILE * 2}px ${TILE}px`;
      plane.style.backgroundRepeat = "repeat";
    });
  }

  function build(img) {
    const canvas = document.createElement("canvas");
    canvas.width = PIXELS * 2;
    canvas.height = PIXELS;
    const g = canvas.getContext("2d");

    // left: the photo as is; right: the same photo, shifted half a length
    g.drawImage(img, 0, 0, PIXELS, PIXELS);
    const half = PIXELS / 2;
    g.drawImage(img, PIXELS, half, PIXELS, PIXELS);
    g.drawImage(img, PIXELS, half - PIXELS, PIXELS, PIXELS);

    // match the reference photo's tone, keeping the real grain contrast
    const data = g.getImageData(0, 0, canvas.width, canvas.height);
    const d = data.data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      sum[0] += d[i];
      sum[1] += d[i + 1];
      sum[2] += d[i + 2];
    }
    const n = d.length / 4;
    const gain = TARGET.map((t, k) => t / (sum[k] / n));
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i] * gain[0];
      d[i + 1] = d[i + 1] * gain[1];
      d[i + 2] = d[i + 2] * gain[2];
    }
    g.putImageData(data, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.86);
  }

  /* ---------- Baseboard: one continuous oak board, grain running along it ---------- */

  const TRIM_KEY = "trim-wood-v5";
  const TRIM_H = 100; // texture height in px (one baseboard's height)
  const SLICE = 200; // width of the strip taken across a board in the photo
  const SLICE_X = 560; // where in the photo that strip is taken (inside a single board)

  function applyTrim(url) {
    document.documentElement.style.setProperty("--trim-wood", `url(${url})`);
  }

  function buildTrim(img) {
    // the strip runs twice the photo's length; it's followed by its own mirror
    // image, so the grain flows on with no seam anywhere along the wall
    const segment = ((img.height * TRIM_H) / SLICE) * 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(segment * 2);
    canvas.height = TRIM_H;
    const g = canvas.getContext("2d");

    [false, true].forEach((mirrored) => {
      g.save();
      if (mirrored) {
        g.translate(segment * 2, TRIM_H);
        g.scale(-1, 1);
      } else {
        g.translate(0, TRIM_H);
      }
      g.rotate(-Math.PI / 2);
      g.drawImage(img, SLICE_X, 0, SLICE, img.height, 0, 0, TRIM_H, segment);
      g.restore();
    });

    // same oak as the floor and the frames
    const data = g.getImageData(0, 0, canvas.width, canvas.height);
    const d = data.data;
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      sum[0] += d[i];
      sum[1] += d[i + 1];
      sum[2] += d[i + 2];
    }
    const n = d.length / 4;
    const gain = TARGET.map((t, k) => t / (sum[k] / n));
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i] * gain[0];
      d[i + 1] = d[i + 1] * gain[1];
      d[i + 2] = d[i + 2] * gain[2];
    }
    g.putImageData(data, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.88);
  }

  let cached = null;
  let cachedTrim = null;
  try {
    cached = sessionStorage.getItem(CACHE_KEY);
    cachedTrim = sessionStorage.getItem(TRIM_KEY);
  } catch (e) {}
  if (cached) apply(cached);
  if (cachedTrim) applyTrim(cachedTrim);
  if (cached && cachedTrim) return;

  const img = new Image();
  img.onload = () => {
    let url, trim;
    try {
      url = build(img);
      trim = buildTrim(img);
    } catch (e) {
      // e.g. opened straight from disk, where the canvas can't read the photo
      apply(SRC);
      return;
    }
    apply(url);
    applyTrim(trim);
    try {
      sessionStorage.setItem(CACHE_KEY, url);
      sessionStorage.setItem(TRIM_KEY, trim);
    } catch (e) {}
  };
  img.src = SRC;
})();
