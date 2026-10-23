# Ethan's Bicycle Shop

Ethan Craparo's art site: the work hangs salon-style on a gallery wall, in real
oak frames, on a charcoal (or cream) plaster wall above an oak floor. Each piece
opens its own page, and pieces can be bought right on the site through Stripe.

## Run it locally

```bash
npm run dev
```

Then open http://localhost:8123. Requires Node 18 or newer; there's nothing to install.

## Adding or editing art

Everything about the pieces lives in `assets/js/artworks.js`: title, edition,
size, price, how many are still available (0 = sold), frame and mat, and the
image in `assets/art/`. The wall arranges itself from that list, splitting into
several walls of about `WALL_SIZE` pieces as the collection grows.

## Card payments (Stripe)

Copy `.env.example` to `.env.local` and add your Stripe keys. Without them,
checkout falls back to an emailed order. When deploying (built for Vercel), set
`STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` as environment variables.
Never commit `.env.local`.

## Credits

Oak floor and plaster wall textures from [Poly Haven](https://polyhaven.com) (CC0).
