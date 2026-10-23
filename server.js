/*
  Local preview: serves the site and runs the Stripe checkout function, like
  Vercel does once it's deployed.

    node server.js        (or: npm run dev)

  Put your Stripe test key in a file named .env.local next to this one:
    STRIPE_SECRET_KEY=sk_test_...
*/
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8123;

// load .env.local / .env without overriding anything already set
for (const name of [".env.local", ".env"]) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const checkout = require("./api/checkout");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// only the pages and assets are public: never .env files, the server or the api source
function publicFile(urlPath) {
  const clean = path.posix.normalize(decodeURIComponent(urlPath)).replace(/^\/+/, "");
  const rel = clean === "" ? "index.html" : clean;
  const isPage = /^[\w-]+\.html$/.test(rel);
  const isAsset = rel.startsWith("assets/") && !rel.split("/").some((part) => part.startsWith("."));
  return isPage || isAsset ? path.join(ROOT, rel) : null;
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (url.pathname === "/api/checkout") {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
        if (raw.length > 100000) req.destroy();
      });
      req.on("end", () => {
        req.body = raw;
        checkout(req, res).catch((e) => {
          console.error(e);
          res.statusCode = 500;
          res.end("{}");
        });
      });
      return;
    }

    const file = publicFile(url.pathname);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    res.setHeader("Content-Type", TYPES[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => {
    const key = process.env.STRIPE_SECRET_KEY;
    const stripe = !key || !process.env.STRIPE_PUBLISHABLE_KEY
      ? "Stripe keys not set: checkout offers an email order instead"
      : key.startsWith("sk_live_")
        ? "LIVE Stripe keys (real charges!)"
        : "Stripe test keys";
    console.log(`Site running at http://localhost:${PORT}  (${stripe})`);
  });
