# Gutsy Cleaner — independent deployment

This is the recovered shop, adapted for a Cloudflare Worker with D1 and Square-hosted checkout. It is **not a static Cloudflare Pages site**. The original ChatGPT-hosted site has not been changed.

## Validation and remaining launch gates

The production build and local security/inventory tests must pass. These tests use simulated Square responses; they do not replace a Square Sandbox purchase and webhook delivery test. Keep customer checkout disabled until the environment, tax setting, owner access and payment lifecycle have been verified.

The initial pickup is October 3, 2026, 8:30 AM–1:00 PM at Senoia Farmers Market, Stall 33, 40 Travis St, Senoia, GA 30276-1811. The cutoff is October 1 at 6:00 PM Eastern. The initial shared capacity is 12 items. Weekly dates and capacity remain editable in `/orders`.

## Deployment target

Use Cloudflare **Workers**, with this repository, build command `npm run build`, and deploy command `npx wrangler deploy`. The Vite plugin writes the built Worker configuration; Wrangler follows that output. `wrangler.jsonc` requests a D1 binding named `DB` and a five-minute scheduled reconciliation job. Initial D1 automatic provisioning is supported by the pinned Wrangler version. After provisioning, retain the actual database ID in the configuration before subsequent deployments to make the resource identity explicit. `keep_vars` preserves values entered through the dashboard.

Apply all three SQL migrations in `drizzle/`, in numeric order, to the independent database. Never apply them to an unrelated database. If using the CLI, resolve the provisioned D1 ID first, then run `npx wrangler d1 migrations apply DB --remote`. A site with unapplied migrations is not ready for checkout.

`.openai/hosting.json` retains the recovered Site identity for provenance and build metadata. It does not provision the independent database or authorize Cloudflare access. This migration must not be published back over the original Site.

## Runtime settings

Set these in the independent Worker's variables/secrets panel. Do not paste secrets into chat or GitHub.

| Name | Value |
|---|---|
| `APP_ORIGIN` | Exact HTTPS origin, with no trailing slash, of the independent shop |
| `CHECKOUT_ENABLED` | `false` until the tests below are ready; then `true` for controlled Sandbox testing |
| `SQUARE_ENVIRONMENT` | `sandbox` for tests; `production` only after tests pass |
| `SQUARE_LOCATION_ID` | Matching Sandbox ID for tests. Confirmed production ID: `F2GWTHNRJ0XQG` |
| `SQUARE_ACCESS_TOKEN` | **Secret**, matching the selected environment |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | **Secret**, from that environment's webhook subscription |
| `SALES_TAX_PERCENT` | Explicitly confirmed applicable rate. No production rate is assumed. Sandbox may use a deliberate test rate |
| `ADMIN_EMAIL` | Owner's sign-in email |
| `ACCESS_TEAM_DOMAIN` | Cloudflare Access team hostname, such as `your-team.cloudflareaccess.com`, without `https://` |
| `ACCESS_AUD` | Audience tag for the Access application protecting this shop's owner routes |

Cloudflare Access must protect `/orders` and `/api/admin/*` on the shop hostname, restricted to the owner's email. Leave storefront and `/api/square/webhook` public. The Worker cryptographically verifies the Access JWT, issuer, audience, expiration and owner email; raw identity headers do not grant access. Missing configuration denies owner access.

Create the Square webhook subscription for `payment.created` and `payment.updated` at exactly `APP_ORIGIN/api/square/webhook`, using the same Square API version as the code (`2026-08-19`). Signature verification covers that exact URL and the raw request body. Each API-created checkout link is single-use. The shop's owner dashboard manages pickup records; do not expect these links to appear in Square's reusable Payment Links list.

## Sandbox verification before opening sales

1. Confirm missing/wrong owner credentials cannot read the order dashboard or change batches, and the authorized owner can.
2. Confirm an unpaid checkout creates the expected order, quantities, tax and pickup information; complete it with a Square Sandbox test card.
3. Confirm Square's completed payment marks the local order paid even if the customer does not return to the confirmation page.
4. Confirm the confirmation page uses the actual batch pickup date.
5. Let an unpaid checkout expire. Confirm the scheduled job cancels its Square link, verifies cancellation, and releases its stock exactly once.
6. Confirm a paid order remains reserved after expiry, an over-capacity bag is rejected, and retries reuse the same Square checkout.
7. Confirm the Thursday cutoff and two concurrent buyers competing for the last item.
8. Disable checkout, switch all Square values and the webhook subscription together to Production, confirm the real tax rate, verify the owner and the empty production batch, then enable production checkout deliberately.

Sandbox and production batch IDs are separated in D1. Switching environments does not turn test purchases into real reservations. Never mix a Sandbox token with the production location ID. A Square/network failure keeps uncertain reservations held; resolve the connection and allow reconciliation to retry. Do not manually release stock while its payment status is uncertain.

## Developer checks

- `npm run install:ci`
- `npm run build`
- `node --test tests/security.test.mjs tests/reconcile.test.mjs`
- `python tests/inventory_test.py`
- `npx wrangler deploy --dry-run`

The build/install script fixes intentionally tolerate the executable-bit loss caused by GitHub browser uploads. No customer payment or live deployment was made while preparing this package.
