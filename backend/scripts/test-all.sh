#!/usr/bin/env bash
# ============================================================
# Vintus Performance — End-to-End API Test Script
# Usage: ./test-all.sh [BASE_URL]
# Default: http://localhost:4000
# ============================================================

set -euo pipefail

BASE="${1:-http://localhost:4000}"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# Random suffix for test data uniqueness
RAND=$(date +%s)
TEST_EMAIL="testuser_${RAND}@vintustest.com"
TEST_PASSWORD="TestPass123"

echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}Vintus Performance API Tests${NC}"
echo -e "${CYAN}Target: ${BASE}${NC}"
echo -e "${CYAN}================================${NC}"
echo ""

check() {
  local name="$1"
  local expected_status="$2"
  local actual_status="$3"
  local body="$4"
  TOTAL=$((TOTAL + 1))

  if [ "$actual_status" -eq "$expected_status" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} ${name} (${actual_status})"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}FAIL${NC} ${name} — expected ${expected_status}, got ${actual_status}"
    echo "       Response: $(echo "$body" | head -c 200)"
  fi
}

# Helper: make request, capture status + body
request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local token="${4:-}"
  local extra_args=()

  if [ -n "$token" ]; then
    extra_args+=(-H "Authorization: Bearer ${token}")
  fi

  if [ -n "$data" ]; then
    extra_args+=(-H "Content-Type: application/json" -d "$data")
  fi

  local response
  response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE}${path}" "${extra_args[@]}" 2>/dev/null)

  local status
  status=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | sed '$d')

  echo "${status}|${body}"
}

# ============================================================
# Test 1: Health Check
# ============================================================
echo "1. Health Check"
result=$(request GET /health)
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)
check "GET /health" 200 "$status" "$body"
echo ""

# ============================================================
# Test 2: Register a test user
# ============================================================
echo "2. Registration"
result=$(request POST /api/v1/auth/register "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"firstName\":\"Test\",\"lastName\":\"User\"}")
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)
check "POST /auth/register" 201 "$status" "$body"
REG_TOKEN=$(echo "$body" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# ============================================================
# Test 3: Login
# ============================================================
echo "3. Login"
result=$(request POST /api/v1/auth/login "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)
check "POST /auth/login" 200 "$status" "$body"
TOKEN=$(echo "$body" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
USER_ID=$(echo "$body" | grep -o '"userId":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# ============================================================
# Test 4: Get current user (auth check)
# ============================================================
echo "4. Auth Check"
result=$(request GET /api/v1/auth/me "" "$TOKEN")
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)
check "GET /auth/me" 200 "$status" "$body"
echo ""

# ============================================================
# Test 5: Submit intake (assessment)
# ============================================================
echo "5. Intake Submission"
INTAKE_DATA="{\"firstName\":\"Test\",\"lastName\":\"User\",\"email\":\"${TEST_EMAIL}\",\"primaryGoal\":\"build-muscle\",\"trainingDaysPerWeek\":4,\"experienceLevel\":\"intermediate\",\"equipmentAccess\":\"full-gym\"}"
result=$(request POST /api/v1/intake/full "$INTAKE_DATA")
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)
check "POST /intake/full" 201 "$status" "$body"
PROFILE_ID=$(echo "$body" | grep -o '"profileId":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# ============================================================
# Test 6: Get results
# ============================================================
echo "6. Intake Results"
if [ -n "$PROFILE_ID" ]; then
  result=$(request GET "/api/v1/intake/results/${PROFILE_ID}")
  status=$(echo "$result" | cut -d'|' -f1)
  body=$(echo "$result" | cut -d'|' -f2-)
  check "GET /intake/results/:id" 200 "$status" "$body"
else
  TOTAL=$((TOTAL + 1))
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}FAIL${NC} GET /intake/results — no profileId from intake"
fi
echo ""

# ============================================================
# Test 7: Create checkout session (verifies Stripe connection)
# ============================================================
echo "7. Checkout Session (Stripe connection test)"
if [ -n "$PROFILE_ID" ]; then
  CHECKOUT_DATA="{\"tier\":\"TRAINING_30DAY\",\"profileId\":\"${PROFILE_ID}\",\"successUrl\":\"http://localhost:3000/onboarding.html\",\"cancelUrl\":\"http://localhost:3000/results.html\"}"
  result=$(request POST /api/v1/checkout/session "$CHECKOUT_DATA")
  status=$(echo "$result" | cut -d'|' -f1)
  body=$(echo "$result" | cut -d'|' -f2-)
  check "POST /checkout/session" 200 "$status" "$body"
else
  TOTAL=$((TOTAL + 1))
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}FAIL${NC} POST /checkout/session — no profileId"
fi
echo ""

# ============================================================
# Test 8: Submit readiness check-in (using registered user's token)
# ============================================================
echo "8. Readiness Check-in"
CHECKIN_DATA='{"perceivedEnergy":7,"perceivedSoreness":4,"perceivedMood":8,"sleepQualityManual":7}'
result=$(request POST /api/v1/readiness/checkin "$CHECKIN_DATA" "$TOKEN")
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)
# May 404 if no athlete profile linked to registered user (intake creates a separate user)
# 201 = success, 404 = no profile (expected for fresh registered user without intake link)
if [ "$status" -eq 201 ] || [ "$status" -eq 404 ]; then
  TOTAL=$((TOTAL + 1))
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} POST /readiness/checkin (${status})"
else
  check "POST /readiness/checkin" 201 "$status" "$body"
fi
echo ""

# ============================================================
# Test 9: Dashboard overview (seeded user)
# ============================================================
echo "9. Dashboard Overview"
result=$(request GET /api/v1/dashboard/overview "" "$TOKEN")
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)
# 200 = success, 404 = no profile (expected for fresh registered user)
if [ "$status" -eq 200 ] || [ "$status" -eq 404 ]; then
  TOTAL=$((TOTAL + 1))
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} GET /dashboard/overview (${status})"
else
  check "GET /dashboard/overview" 200 "$status" "$body"
fi
echo ""

# ============================================================
# Test 10: Admin login (seeded admin user)
# ============================================================
echo "10. Admin Login"
result=$(request POST /api/v1/auth/login '{"email":"admin@vintusperformance.org","password":"changeme123"}')
status=$(echo "$result" | cut -d'|' -f1)
body=$(echo "$result" | cut -d'|' -f2-)
check "POST /auth/login (admin)" 200 "$status" "$body"
ADMIN_TOKEN=$(echo "$body" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
echo ""

# ============================================================
# Test 11: Admin clients list
# ============================================================
echo "11. Admin Clients"
if [ -n "$ADMIN_TOKEN" ]; then
  result=$(request GET /api/v1/admin/clients "" "$ADMIN_TOKEN")
  status=$(echo "$result" | cut -d'|' -f1)
  body=$(echo "$result" | cut -d'|' -f2-)
  check "GET /admin/clients" 200 "$status" "$body"
else
  TOTAL=$((TOTAL + 1))
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}FAIL${NC} GET /admin/clients — no admin token"
fi
echo ""

# ============================================================
# Summary
# ============================================================
echo -e "${CYAN}================================${NC}"
echo -e "${CYAN}Results: ${PASS}/${TOTAL} passed${NC}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}${FAIL} test(s) FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
