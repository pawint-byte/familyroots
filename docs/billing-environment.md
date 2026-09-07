# FamilyRoots billing environment names

Configure values through Replit Secrets or deployment environment configuration.
Never commit values to the repository.

## Application and Stripe

- `PUBLIC_APP_BASE_URL` (public, non-secret; defaults to `https://familyroots.family`)
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

`POST /api/stripe/create-checkout` and `POST /api/addons/stripe-checkout`
use inline USD `price_data`; no pre-created Stripe Price IDs are required.

Monthly subscriptions:

- Cultivator: 499 cents
- Heritage: 1299 cents
- Legacy: 2499 cents
- Explorer: free; no Checkout Session

One-time member-credit add-ons:

- `starter_10`: 799 cents
- `growth_25`: 1499 cents
- `family_50`: 2499 cents

## Crypto payment provider

- `CRYPTO_PAYMENT_PROVIDER`
- `CRYPTO_PAYMENT_WALLETS_JSON`
- `CRYPTO_PAYMENT_EXPIRY_MINUTES` (optional; defaults to 30)

`CRYPTO_PAYMENT_WALLETS_JSON` is a chain-keyed configuration object. Each chain
entry requires an address, asset, and positive `usdPerAsset` quote; an optional
destination tag may also be supplied. Crypto creation fails safely when the
provider, requested wallet, or conversion quote is unavailable.

## Existing runtime dependencies

- `DATABASE_URL`
- `REPLIT_DOMAINS`
- `REPLIT_CONNECTORS_HOSTNAME`
- `REPL_IDENTITY` or `WEB_REPL_RENEWAL`