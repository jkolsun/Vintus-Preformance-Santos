import type { DeviceConnection, ReadinessMetric } from "@prisma/client";
import type { DeviceAdapter } from "./types.js";
import { logger } from "../../lib/logger.js";

/**
 * Garmin Adapter — comprehensive health and training metrics.
 *
 * Garmin Health API: https://developer.garmin.com/health-api/overview/
 * OAuth1.0a flow (Garmin uses OAuth 1.0a, not OAuth 2.0)
 *
 * Phase 2 implementation notes:
 * - OAuth 1.0a consumer flow (request token → authorize → access token)
 * - Push-based: Garmin sends data to a webhook endpoint (ping notifications)
 * - Pulls: daily summaries, sleep, stress, HRV, body composition, activities
 * - Maps to ReadinessMetric: hrvMs, restingHr, sleepScore, sleepDurationMin,
 *   fatigueScore (from stress), stressScore, caloriesBurned, steps,
 *   bodyWeight, trainingLoad (Training Status Score)
 */
export class GarminAdapter implements DeviceAdapter {
  readonly provider = "GARMIN";
  readonly displayName = "Garmin Connect";

  // TODO: Phase 2 — build OAuth 1.0a request token URL
  // Garmin uses OAuth 1.0a which requires a different flow than standard OAuth2
  getAuthUrl(_userId: string): string {
    return "#not-implemented-yet";
  }

  // TODO: Phase 2 — exchange OAuth 1.0a verifier for access token
  // Store consumer key + token encrypted in DeviceConnection
  async handleCallback(_code: string, _userId: string): Promise<DeviceConnection> {
    throw new Error("Garmin integration not yet implemented. Coming in Phase 2.");
  }

  // TODO: Phase 2 — GET /wellness-api/rest/dailies, /sleep, /hrv
  // Map Garmin's daily summary to ReadinessMetric fields
  async syncData(_connection: DeviceConnection): Promise<Partial<ReadinessMetric>> {
    logger.info({ provider: this.provider }, "Sync requested — returning manual entry stub");
    return {
      source: "GARMIN" as ReadinessMetric["source"],
      notes: "Garmin sync not yet available. Use daily check-in for now.",
    };
  }

  // TODO: Phase 2 — DELETE user access token from Garmin
  async revokeAccess(_connection: DeviceConnection): Promise<void> {
    logger.info({ provider: this.provider }, "Revoke requested — no-op for MVP");
  }
}
