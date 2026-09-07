# FamilyRoots billing environment names

Configure values through Replit Secrets or deployment environment configuration.
Never commit values to the repository.

## Application and Stripe

- `PUBLIC_APP_BASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_CULTIVATOR`
- `STRIPE_PRICE_HERITAGE`
- `STRIPE_PRICE_LEGACY`
- `STRIPE_PRICE_ADDON_STARTER_10`
- `STRIPE_PRICE_ADDON_GROWTH_25`
- `STRIPE_PRICE_ADDON_FAMILY_50`

`POST /api/stripe/create-checkout` and `POST /api/addons/stripe-checkout`
fail safely when their corresponding Stripe Price ID is not configured.
Legacy checkout routes retain their existing inline-price behavior.

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