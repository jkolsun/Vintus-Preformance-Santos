import type { DeviceConnection, ReadinessMetric } from "@prisma/client";
import type { DeviceAdapter } from "./types.js";
import { logger } from "../../lib/logger.js";

/**
 * Fitbit Adapter — activity, sleep, and heart rate data.
 *
 * Fitbit Web API: https://dev.fitbit.com/build/reference/web-api/
 * OAuth2 flow: https://dev.fitbit.com/build/reference/web-api/authorization/
 *
 * Phase 2 implementation notes:
 * - OAuth2 authorization code flow with PKCE (required by Fitbit)
 * - Scopes needed: activity, heartrate, sleep, profile
 * - Subscription API for real-time push notifications
 * - Pulls: daily activity summary, sleep log, heart rate (intraday),
 *   SpO2, breathing rate, HRV (Fitbit Premium)
 * - Maps to ReadinessMetric: hrvMs (if Premium), restingHr, sleepScore
 *   (Fitbit sleep score), sleepDurationMin, caloriesBurned, steps,
 *   fatigueScore (derived from resting HR trend)
 */
export class FitbitAdapter implements DeviceAdapter {
  readonly provider = "FITBIT";
  readonly displayName = "Fitbit";

  // TODO: Phase 2 — build OAuth2 URL with PKCE
  // GET https://www.fitbit.com/oauth2/authorize
  // ?client_id=...&redirect_uri=...&scope=activity+heartrate+sleep&code_challenge=...
  getAuthUrl(_userId: string): string {
    return "#not-implemented-yet";
  }

  // TODO: Phase 2 — exchange code for tokens (with code_verifier for PKCE)
  // POST https://api.fitbit.com/oauth2/token
  async handleCallback(_code: string, _userId: string): Promise<DeviceConnection> {
    throw new Error("Fitbit integration not yet implemented. Coming in Phase 2.");
  }

  // TODO: Phase 2 — GET /1/user/-/activities/date/{date}.json, /sleep/date/{date}.json
  // Map Fitbit daily summary to ReadinessMetric
  async syncData(_connection: DeviceConnection): Promise<Partial<ReadinessMetric>> {
    logger.info({ provider: this.provider }, "Sync requested — returning manual entry stub");
    return {
      source: "FITBIT" as ReadinessMetric["source"],
      notes: "Fitbit sync not yet available. Use daily check-in for now.",
    };
  }

  // TODO: Phase 2 — POST https://api.fitbit.com/oauth2/revoke
  async revokeAccess(_connection: DeviceConnection): Promise<void> {
    logger.info({ provider: this.provider }, "Revoke requested — no-op for MVP");
  }
}
