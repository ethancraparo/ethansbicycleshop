/*
  POST /api/checkout  { items: [{ id, qty }] }
    ->  { clientSecret, publishableKey, currency, lines, subtotal, shipping, total }

  Sets up a Stripe payment for the cart so the checkout page on the site can take
  the card itself (Stripe's Payment Element). Prices, titles and what's still
  available are read from assets/js/artworks.js here on the server, so nothing
  the browser sends can change what a piece costs; the total is fixed on the
  payment before the buyer ever sees the card form.

  Needs two environment variables:
    STRIPE_SECRET_KEY       sk_test_... while testing, sk_live_... for real payments
    STRIPE_PUBLISHABLE_KEY  pk_test_... / pk_live_... (safe to show in the browser)
  Without them this answers 503 and the checkout page offers an email order instead.
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// currencies Stripe counts in whole units rather than cents
const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);

function loadCatalog() {
  const src = fs.readFileSync(path.join(process.cwd(), "assets/js/artworks.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { timeout: 1000 });
  return { works: sandbox.window.ARTWORKS || [], shop: sandbox.window.SHOP || {} };
}

// titles are always shown in quotation marks: “Six Shooter”
const quote = (title) => `\u201c${title}\u201d`;

// numbered editions always show three digits each side: "2/6" -> "002/006"
const pad3 = (n) => String(n).padStart(3, "0");
function editionLabel(ed) {
  const m = String(ed || "1/1").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  return m ? `${pad3(m[1])}/${pad3(m[2])}` : String(ed);
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });

  const secret = process.env.STRIPE_SECRET_KEY;
  const publishable = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!secret || !publishable) return send(res, 503, { error: "Card payments aren't set up yet.", fallback: "email" });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = null;
    }
  }
  const items = Array.isArray(body && body.items) ? body.items : [];
  if (!items.length || items.length > 50) return send(res, 400, { error: "Your cart is empty." });

  const { works, shop } = loadCatalog();
  const currency = String(shop.currency || "USD").toLowerCase();
  const unit = ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;

  const seen = new Set();
  const lines = [];
  for (const item of items) {
    const a = works.find((w) => w.id === item.id);
    const qty = Number(item.qty);
    if (!a || seen.has(a.id)) return send(res, 400, { error: "Something in your cart isn't on the wall anymore." });
    seen.add(a.id);
    if (a.price == null || !(a.available > 0)) return send(res, 409, { error: `${quote(a.title)} is no longer available.` });
    if (!Number.isInteger(qty) || qty < 1 || qty > a.available) {
      return send(res, 409, { error: `Only ${a.available} of ${quote(a.title)} ${a.available === 1 ? "is" : "are"} available.` });
    }
    lines.push({ id: a.id, title: a.title, edition: editionLabel(a.edition), price: a.price, qty });
  }

  const subtotal = lines.reduce((n, l) => n + l.price * l.qty, 0);
  const shipping = { label: (shop.shipping && shop.shipping.label) || "Shipping", amount: (shop.shipping && shop.shipping.amount) || 0 };
  const total = subtotal + shipping.amount;
  const order = lines.map((l) => `${quote(l.title)} (${l.edition})${l.qty > 1 ? ` x${l.qty}` : ""}`).join(", ");

  const params = new URLSearchParams();
  params.append("amount", String(Math.round(total * unit)));
  params.append("currency", currency);
  params.append("automatic_payment_methods[enabled]", "true");
  params.append("description", `Ethan Craparo: ${order}`.slice(0, 1000));
  params.append("metadata[order]", lines.map((l) => `${l.id} x${l.qty}`).join(", ").slice(0, 500));
  params.append("metadata[shipping]", `${shipping.label}: ${shipping.amount}`);

  let intent;
  try {
    const r = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    intent = await r.json();
    if (!r.ok) throw new Error((intent.error && intent.error.message) || `Stripe answered ${r.status}`);
  } catch (e) {
    console.error("Stripe payment setup failed:", e.message);
    return send(res, 502, { error: "Checkout couldn't be started. Please try again in a moment." });
  }

  return send(res, 200, {
    clientSecret: intent.client_secret,
    publishableKey: publishable,
    currency: currency.toUpperCase(),
    lines,
    subtotal,
    shipping,
    total,
  });
};
