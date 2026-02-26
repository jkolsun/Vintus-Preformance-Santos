# Vintus Performance — Deployment Guide

Step-by-step instructions to deploy the full stack: Railway (backend) + Vercel (frontend) + Stripe + Twilio + Resend + Anthropic.

---

## 1. Railway Backend Setup

### Create Project

1. Go to [railway.app](https://railway.app) and create a new project
2. Add a **PostgreSQL** service — Railway provisions the database automatically
3. Copy the `DATABASE_URL` from the PostgreSQL service's Variables tab

### Connect GitHub Repo

1. Add a new service → **Deploy from GitHub repo**
2. Select the `vintus-performance` repository
3. Set **Root Directory** to `/backend`
4. Railway will detect the `railway.toml` and use it for build/deploy config

### Set Environment Variables

In the backend service's Variables tab, set all of these:

```
DATABASE_URL=<from PostgreSQL service — Railway auto-links this>
FRONTEND_URL=https://your-site.vercel.app
PORT=4000
JWT_SECRET=<generate: openssl rand -hex 32>
JWT_EXPIRES_IN=7d
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRIVATE_COACHING=price_...
STRIPE_PRICE_TRAINING_30DAY=price_...
STRIPE_PRICE_TRAINING_60DAY=price_...
STRIPE_PRICE_TRAINING_90DAY=price_...
STRIPE_PRICE_NUTRITION_4WEEK=price_...
STRIPE_PRICE_NUTRITION_8WEEK=price_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=coach@vintusperformance.org
ANTHROPIC_API_KEY=sk-ant-...
ENCRYPTION_KEY=<generate: openssl rand -hex 32>
```

### Deploy & Migrate

Railway will auto-deploy on push. The `railway.toml` start command runs migrations automatically:

```
npx prisma migrate deploy && npm start
```

To seed the database with test data:

```bash
railway run npx prisma db seed
```

### Verify

```bash
curl https://your-app.up.railway.app/health
# Expected: { "status": "ok", ... }
```

---

## 2. Stripe Setup

### Create Products & Prices

1. Go to [Stripe Dashboard → Products](https://dashboard.stripe.com/products)
2. Create 6 products (1 recurring subscription + 5 one-time payments):

| Product | Price | Type | Env Var |
|---|---|---|---|
| Private Coaching | $500/month | Recurring | `STRIPE_PRICE_PRIVATE_COACHING` |
| 30-Day Training Plan | $99 | One-time | `STRIPE_PRICE_TRAINING_30DAY` |
| 60-Day Training Plan | $149 | One-time | `STRIPE_PRICE_TRAINING_60DAY` |
| 90-Day Training Plan | $199 | One-time | `STRIPE_PRICE_TRAINING_90DAY` |
| 4-Week Nutrition Plan | $229 | One-time | `STRIPE_PRICE_NUTRITION_4WEEK` |
| 8-Week Nutrition Plan | $399 | One-time | `STRIPE_PRICE_NUTRITION_8WEEK` |

3. Copy each Price ID (starts with `price_`) into Railway env vars

### Set Up Webhook

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-app.up.railway.app/api/webhooks/stripe`
3. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the **Signing Secret** (starts with `whsec_`) into Railway env var `STRIPE_WEBHOOK_SECRET`

### Test Webhook

Use Stripe CLI to forward test events locally:

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

---

## 3. Twilio Setup (SMS)

1. Go to [Twilio Console](https://console.twilio.com)
2. Get your **Account SID** and **Auth Token** from the dashboard
3. Buy or use a phone number from **Phone Numbers → Manage → Buy a Number**
4. Set in Railway env vars:
   - `TWILIO_ACCOUNT_SID` = Account SID
   - `TWILIO_AUTH_TOKEN` = Auth Token
   - `TWILIO_PHONE_NUMBER` = Your Twilio number (e.g., `+14155551234`)

---

## 4. Resend Setup (Email)

1. Go to [Resend Dashboard](https://resend.com)
2. **Verify your domain** under Settings → Domains (add DNS records)
3. Create an **API Key** under Settings → API Keys
4. Set in Railway env vars:
   - `RESEND_API_KEY` = Your API key
   - `RESEND_FROM_EMAIL` = Verified sender (e.g., `coach@vintusperformance.org`)

---

## 5. Anthropic Setup (AI)

1. Go to [Anthropic Console](https://console.anthropic.com)
2. Create an API key under **API Keys**
3. Set in Railway env var:
   - `ANTHROPIC_API_KEY` = Your API key

---

## 6. Vercel Frontend Setup

### Deploy

1. Go to [vercel.com](https://vercel.com) and import the `vintus-performance` repository
2. Vercel will detect the root as a static site (no framework)
3. Deploy

### Set Environment Variables

In Vercel dashboard → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `VINTUS_API_URL` | `https://your-app.up.railway.app` (Railway backend URL, no trailing slash) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_...` or `pk_live_...` |

### Update Frontend Config

The frontend reads the API URL from `js/config.js`. For production, update this value or use Vercel's environment variable injection. The simplest approach:

1. After deploying to Vercel, update `js/config.js`:
   ```js
   API_URL: 'https://your-app.up.railway.app'
   ```
2. Push and redeploy

### Update Backend CORS

After deploying the frontend, update the Railway backend's `FRONTEND_URL` env var to match your Vercel URL:

```
FRONTEND_URL=https://your-site.vercel.app
```

---

## 7. Post-Deploy Verification Checklist

- [ ] `GET /health` returns 200 on Railway
- [ ] Database migrations ran (check Railway deploy logs)
- [ ] Register a test user via the frontend assessment flow
- [ ] Stripe checkout redirects correctly
- [ ] Stripe webhook receives `checkout.session.completed` event
- [ ] Onboarding flow: set password → device → routine → dashboard
- [ ] Dashboard loads with greeting, workout, and week view
- [ ] Readiness check-in submits successfully
- [ ] Workout completion flow works
- [ ] Admin login works (`admin@vintusperformance.org` / `changeme123`)
- [ ] Admin dashboard shows client data

---

## 8. Running the Test Script

After deployment, run the end-to-end test script against your live backend:

```bash
cd backend/scripts
chmod +x test-all.sh
./test-all.sh https://your-app.up.railway.app
```

This tests all major API flows and reports PASS/FAIL for each step.

---

## Troubleshooting

**Backend won't start on Railway:**
- Check Railway deploy logs for errors
- Ensure all env vars are set (missing vars cause startup crash due to Zod validation)
- Ensure PostgreSQL service is linked and `DATABASE_URL` is set

**CORS errors on frontend:**
- Verify `FRONTEND_URL` in Railway matches your Vercel domain exactly (including `https://`)
- Check browser console for the actual origin being blocked

**Stripe webhook fails:**
- Verify the webhook URL matches your Railway domain
- Check `STRIPE_WEBHOOK_SECRET` matches the signing secret from Stripe dashboard
- Webhook must be mounted before `express.json()` middleware (already handled in code)

**Database migration errors:**
- Run `railway run npx prisma migrate status` to check migration state
- If stuck, `railway run npx prisma migrate reset` (CAUTION: drops all data)
