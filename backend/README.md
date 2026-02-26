# Vintus Performance — Backend API

Node.js + Express + TypeScript + Prisma + PostgreSQL

## Local Setup

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Copy env file and fill in values
cp .env.example .env

# 3. Generate Prisma client
npx prisma generate

# 4. Run database migrations
npx prisma migrate dev

# 5. Seed the database (admin user + test client)
npm run db:seed

# 6. Start dev server (hot-reload)
npm run dev
```

Server starts at `http://localhost:4000`. Health check: `GET /health`.

## Required Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/vintus` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |
| `PORT` | Server port | `4000` |
| `JWT_SECRET` | Random 64-char string for signing tokens | (generate with `openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | Token expiry duration | `7d` |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_ or sk_live_) | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `STRIPE_PRICE_PRIVATE_COACHING` | Stripe Price ID for Private Coaching ($500/mo recurring) | `price_...` |
| `STRIPE_PRICE_TRAINING_30DAY` | Stripe Price ID for 30-Day Training ($99 one-time) | `price_...` |
| `STRIPE_PRICE_TRAINING_60DAY` | Stripe Price ID for 60-Day Training ($149 one-time) | `price_...` |
| `STRIPE_PRICE_TRAINING_90DAY` | Stripe Price ID for 90-Day Training ($199 one-time) | `price_...` |
| `STRIPE_PRICE_NUTRITION_4WEEK` | Stripe Price ID for 4-Week Nutrition ($229 one-time) | `price_...` |
| `STRIPE_PRICE_NUTRITION_8WEEK` | Stripe Price ID for 8-Week Nutrition ($399 one-time) | `price_...` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | (from Twilio console) |
| `TWILIO_PHONE_NUMBER` | Twilio sending phone number | `+1234567890` |
| `RESEND_API_KEY` | Resend API key | `re_...` |
| `RESEND_FROM_EMAIL` | Verified sender email | `coach@vintusperformance.org` |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI processing | `sk-ant-...` |
| `ENCRYPTION_KEY` | 32-byte hex string for device token encryption | (generate with `openssl rand -hex 32`) |

## Database

```bash
# Run migrations
npx prisma migrate dev

# Run migrations (production)
npx prisma migrate deploy

# Seed database
npm run db:seed

# Open Prisma Studio (visual DB browser)
npm run db:studio
```

## API Routes

All routes are prefixed with `/api/v1` unless noted otherwise.

### Public Routes (no auth)
```bash
# Health check
curl http://localhost:4000/health

# Register
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234","firstName":"Jane","lastName":"Doe"}'

# Login
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234"}'

# Submit intake (assessment)
curl -X POST http://localhost:4000/api/v1/intake/full \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Doe","email":"jane@example.com","primaryGoal":"build-muscle","trainingDaysPerWeek":4,"experienceLevel":"intermediate","equipmentAccess":"full-gym"}'

# Get results
curl http://localhost:4000/api/v1/intake/results/{profileId}

# Create checkout session (unauthenticated with profileId)
curl -X POST http://localhost:4000/api/v1/checkout/session \
  -H "Content-Type: application/json" \
  -d '{"tier":"TRAINING_30DAY","profileId":"{profileId}","successUrl":"http://localhost:3000/onboarding.html","cancelUrl":"http://localhost:3000/results.html"}'

# Verify checkout session
curl -X POST http://localhost:4000/api/v1/onboarding/verify-session \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"cs_test_..."}'

# Set password (requires sessionId for verification)
curl -X POST http://localhost:4000/api/v1/onboarding/set-password \
  -H "Content-Type: application/json" \
  -d '{"userId":"{userId}","sessionId":"cs_test_...","password":"NewPass123"}'
```

### Authenticated Routes (requires Bearer token)
```bash
TOKEN="your-jwt-token"

# Get current user
curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Dashboard overview
curl http://localhost:4000/api/v1/dashboard/overview \
  -H "Authorization: Bearer $TOKEN"

# Week view
curl http://localhost:4000/api/v1/dashboard/week/0 \
  -H "Authorization: Bearer $TOKEN"

# Workout detail
curl http://localhost:4000/api/v1/dashboard/workout/{sessionId} \
  -H "Authorization: Bearer $TOKEN"

# Submit readiness check-in
curl -X POST http://localhost:4000/api/v1/readiness/checkin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"perceivedEnergy":7,"perceivedSoreness":4,"perceivedMood":8,"sleepQualityManual":7}'

# Complete workout
curl -X POST http://localhost:4000/api/v1/workout/{sessionId}/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"actualDuration":55,"rpe":7,"athleteNotes":"Great session"}'

# Stripe customer portal
curl -X POST http://localhost:4000/api/v1/checkout/portal \
  -H "Authorization: Bearer $TOKEN"

# Logout
curl -X POST http://localhost:4000/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

### Admin Routes (requires ADMIN role)
```bash
# List clients
curl http://localhost:4000/api/v1/admin/clients \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Analytics
curl http://localhost:4000/api/v1/admin/analytics \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Health checks (external services)
curl http://localhost:4000/api/v1/admin/health \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Webhook (raw body, no auth)
```
POST /api/webhooks/stripe
```

## Build & Deploy

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

## Architecture

- 12 Prisma models, 8 enums
- 10 route groups mounted at `/api/v1/*`
- JWT auth with httpOnly cookie fallback
- Stripe subscription billing (3 tiers)
- AI-powered intake analysis (Anthropic Claude)
- SMS/Email messaging (Twilio + Resend)
- Timezone-aware daily cron (hourly tick)
- Wearable device adapter stubs (6 providers)
