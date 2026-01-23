# FamilyRoots - Accounts & Integration Reference

This document contains reference information for all external accounts and integrations used by FamilyRoots. Keep this updated as accounts are added or changed.

---

## Payment Processing

### Stripe
- **Dashboard URL**: https://dashboard.stripe.com
- **Account Email**: pawint@me.com
- **Business Name**: Wint Ent
- **Account Type**: [x] Standard  [ ] Express  [ ] Custom
- **Current Mode**: Sandbox/Test Mode (development)
- **Live Mode Setup**: Required before publishing for real payments

**How to verify:**
1. Go to https://dashboard.stripe.com
2. Sign in with your Stripe account
3. Check account name in top-left corner
4. Go to Settings → Business Details for full info
5. For API keys: Developers → API Keys

**Keys stored in Replit:**
- STRIPE_SECRET_KEY (secret)
- STRIPE_PUBLISHABLE_KEY (secret)

---

## Affiliate Programs

### Amazon Associates
- **Dashboard URL**: https://affiliate-program.amazon.com
- **Associate ID**: `pawint-20`
- **Account Email**: ___________________
- **Store ID**: ___________________

**How to verify:**
1. Go to https://affiliate-program.amazon.com
2. Sign in with your Amazon account
3. Check "Account Settings" for your tracking IDs
4. View "Reports" for commission earnings

### Etsy via Awin
- **Awin Dashboard**: https://www.awin.com/us
- **Publisher ID**: `2735710`
- **Merchant ID (Etsy)**: `6220`
- **Account Email**: ___________________

**How to verify:**
1. Go to https://www.awin.com/us
2. Sign in to your publisher account
3. Check "Account" section for publisher details
4. View "Reports" for commission tracking

---

## Email Service

### Resend
- **Dashboard URL**: https://resend.com/overview
- **Account Email**: ___________________
- **API Key**: Stored as secret in Replit

**How to verify:**
1. Go to https://resend.com
2. Sign in with your account
3. Check "API Keys" section
4. View "Emails" for delivery logs

---

## AI Video Generation

### HeyGen
- **Dashboard URL**: https://www.heygen.com
- **Account Email**: ___________________
- **API Key**: Stored as `HEYGEN_API_KEY` secret

**How to verify:**
1. Go to https://www.heygen.com
2. Sign in to your account
3. Go to Settings → API
4. Check API key status and credits

---

## Social Media

### Bluesky
- **URL**: https://bsky.app
- **Handle**: Stored as `BLUESKY_HANDLE` secret
- **App Password**: Stored as `BLUESKY_APP_PASSWORD` secret

**How to verify:**
1. Go to https://bsky.app
2. Sign in with your account
3. Settings → App Passwords to manage API access

---

## Print-on-Demand

### Printful
- **Dashboard URL**: https://www.printful.com/dashboard
- **Account Email**: ___________________
- **API Key**: Stored as `PRINTFUL_API_KEY` secret

**How to verify:**
1. Go to https://www.printful.com
2. Sign in to your account
3. Settings → Stores → API Access
4. View "Orders" for fulfillment tracking

---

## Analytics

### Google Analytics
- **Dashboard URL**: https://analytics.google.com
- **Measurement ID**: `G-WHS17V1WFW`
- **Account Email**: ___________________
- **Property Name**: ___________________

**How to verify:**
1. Go to https://analytics.google.com
2. Sign in with your Google account
3. Select the property matching your Measurement ID
4. View "Realtime" to see live traffic

---

## Database

### PostgreSQL (Replit Managed)
- **Provider**: Neon (via Replit)
- **Connection**: Managed automatically by Replit
- **Environment Variables**: DATABASE_URL, PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE

---

## Object Storage

### Replit Object Storage
- **Provider**: Replit (GCS-backed)
- **Bucket ID**: Stored as `DEFAULT_OBJECT_STORAGE_BUCKET_ID`
- **Public Path**: Stored as `PUBLIC_OBJECT_SEARCH_PATHS`
- **Private Path**: Stored as `PRIVATE_OBJECT_DIR`

---

## Authentication

### Replit Auth (OpenID Connect)
- **Provider**: Replit
- **Method**: OpenID Connect with Passport.js
- **Sessions**: Stored in PostgreSQL

---

## Genealogy Research (Optional)

### FamilySearch
- **Developer Portal**: https://developers.familysearch.org
- **App Key**: Not yet configured (requires `FAMILYSEARCH_APP_KEY`)
- **Account Email**: ___________________

**To set up:**
1. Go to https://developers.familysearch.org
2. Register a new application
3. Get your App Key
4. Add as environment variable

---

## App Owner Information

- **Owner Name**: Andrew A Wint
- **Owner Email**: pawint@me.com
- **Replit User ID**: 52852375

---

## Quick Checklist for Verification

- [ ] Stripe - Check dashboard for connected account
- [ ] Amazon Associates - Verify pawint-20 tracking ID is active
- [ ] Awin/Etsy - Confirm publisher ID 2735710 is approved
- [ ] Resend - Verify sending domain is configured
- [ ] HeyGen - Check API credits remaining
- [ ] Printful - Verify store connection
- [ ] Google Analytics - Confirm data is being received

---

*Last Updated: January 2026*
*Document Location: /ACCOUNTS_REFERENCE.md*
