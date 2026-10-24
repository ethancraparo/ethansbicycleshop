/*
  Your collection. Everything on the wall and on each piece page comes from here.

  To add or swap a piece:
    - drop the image in assets/art/
    - add (or edit) an entry below

  edition         "1/1" for a one-off; "2/6" for print number 2 of an edition of 6
                  (shown on the site as 001/001 and 002/006);
                  or "Edition of 5" when you're selling several prints of one edition
  price           in SHOP.currency, whole units (e.g. 850). Leave out for "price on request"
  available       copies left to sell: 1 for an unsold original, 0 when sold,
                  or e.g. 2 for an edition with two prints left
  size            the art's size as shown on its page, e.g. "20 × 16 in"
  framed          optional: the whole framed size, e.g. "25 × 21 in"
  width / height  real-world size of the image area in cm (sets how big it hangs)
  frame           "walnut" | "black" | "oak" | "white" | "gold" | "pink"
  mat             true adds a cream mat board around the image
  foil            optional: an image the same size as `image`, opaque wherever the
                  piece has metallic foil; that area shimmers silver as it tilts

  The wall arranges itself salon-style from this list, so there's no layout to
  maintain. Change HANG_SEED to any other number to reshuffle the arrangement.
*/
window.HANG_SEED = 7;

// The pieces hang across several walls of about this many each; visitors walk
// from wall to wall. Give pieces the same `wall: "Name"` to hang them together.
window.WALL_SIZE = 8;

// Shop settings. Card checkout runs through Stripe (see api/checkout.js); until a
// Stripe key is set, Checkout falls back to emailing the order to `email`.
window.SHOP = {
  currency: "USD",
  email: "ethancraparo@icloud.com",
  // one flat shipping charge per order, in SHOP.currency (0 shows as free)
  shipping: { label: "Insured shipping", amount: 0 },
  // countries you'll ship to (two-letter codes)
  shipTo: ["US", "CA", "GB", "IE", "AU", "NZ", "FR", "DE", "NL", "IT", "ES", "SE", "DK", "NO", "JP"],
};

// Details still to fill in are left blank (""), and the site skips them.
window.ARTWORKS = [
  {
    id: "luck-of-the-draw",
    title: "Luck of the Draw",
    year: "",
    medium: "",
    size: "20 × 16 in",
    framed: "25 × 21 in",
    edition: "1/1",
    price: 1000,
    available: 1,
    image: "assets/art/luck-of-the-draw.jpg",
    width: 50.8,
    height: 40.6,
    frame: "oak",
    mat: true,
    description:
      "Two figures face off across a field of red playing-card backs, cut from the same deck in blue. Signed by the artist.",
  },
  {
    id: "horse-play-red",
    title: "Horse Play",
    year: "",
    medium: "",
    size: "24 × 18 in",
    framed: "32 × 26 in",
    edition: "2/2",
    price: 900,
    available: 0,
    image: "assets/art/horse-play-red.jpg",
    width: 61,
    height: 45.7,
    frame: "oak",
    mat: true,
    description:
      "A bucking bronco and rider in blue card backs, thrown against a grid of red. Its pair hangs on the wall in reverse.",
  },
  {
    id: "horse-play-blue",
    title: "Horse Play",
    year: "",
    medium: "",
    size: "24 × 18 in",
    framed: "32 × 26 in",
    edition: "1/2",
    price: 900,
    available: 1,
    image: "assets/art/horse-play-blue.jpg",
    width: 61,
    height: 45.7,
    frame: "oak",
    mat: true,
    description:
      "The same ride in reverse: a red bronco and rider on a grid of blue card backs.",
  },
  {
    id: "six-shooter-red",
    title: "Six Shooter",
    year: "",
    medium: "",
    size: "11 × 17 in",
    edition: "1/6",
    price: 600,
    available: 0,
    image: "assets/art/six-shooter-red.jpg",
    foil: "assets/art/six-shooter-foil.png",
    width: 43.2,
    height: 28,
    frame: "oak",
    mat: true,
    description:
      "A six-shooter drawn out of a field of red playing-card backs.",
  },
  {
    id: "six-shooter",
    title: "Six Shooter",
    year: "",
    medium: "",
    size: "11 × 17 in",
    edition: "2/6",
    price: 600,
    available: 1,
    image: "assets/art/six-shooter.jpg",
    foil: "assets/art/six-shooter-foil.png",
    width: 43.2,
    height: 28,
    frame: "oak",
    mat: true,
    description:
      "A six-shooter drawn out of a field of blue playing-card backs.",
  },
];
