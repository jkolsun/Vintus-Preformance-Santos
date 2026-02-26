import type { DeviceConnection, ReadinessMetric } from "@prisma/client";
import type { DeviceAdapter } from "./types.js";
import { logger } from "../../lib/logger.js";

/**
 * Oura Ring Adapter — sleep, readiness, and activity data.
 *
 * Oura API v2: https://cloud.ouraring.com/v2/docs
 * OAuth2 flow: https://cloud.ouraring.com/docs/authentication
 *
 * Phase 2 implementation notes:
 * - OAuth2 authorization code flow
 * - Scopes needed: daily, heartrate, sleep, workout
 * - Pulls: readiness score, sleep score, HRV, resting HR, sleep stages,
 *   activity score, body temperature deviation
 * - Oura's readiness score is excellent for Vintus readiness tracking
 * - Maps to ReadinessMetric: hrvMs, restingHr, sleepScore (Oura sleep score),
 *   sleepDurationMin (total sleep), fatigueScore (100 - readiness score),
 *   bodyWeight (if entered in Oura), steps, caloriesBurned
 */
export class OuraAdapter implements DeviceAdapter {
  readonly provider = "OURA";
  readonly displayName = "Oura Ring";

  // TODO: Phase 2 — build OAuth2 URL
  // GET https://cloud.ouraring.com/oauth/authorize
  // ?client_id=...&redirect_uri=...&scope=daily+heartrate+sleep&response_type=code
  getAuthUrl(_userId: string): string {
    return "#not-implemented-yet";
  }

  // TODO: Phase 2 — exchange code for tokens
  // POST https://api.ouraring.com/oauth/token
  async handleCallback(_code: string, _userId: string): Promise<DeviceConnection> {
    throw new Error("Oura Ring integration not yet implemented. Coming in Phase 2.");
  }

  // TODO: Phase 2 — GET /v2/usercollection/daily_readiness, /daily_sleep, /heartrate
  // Map Oura readiness/sleep scores to ReadinessMetric
  async syncData(_connection: DeviceConnection): Promise<Partial<ReadinessMetric>> {
    logger.info({ provider: this.provider }, "Sync requested — returning manual entry stub");
    return {
      source: "OURA" as ReadinessMetric["source"],
      notes: "Oura Ring sync not yet available. Use daily check-in for now.",
    };
  }

  // TODO: Phase 2 — POST revoke token endpoint
  async revokeAccess(_connection: DeviceConnection): Promise<void> {
    logger.info({ provider: this.provider }, "Revoke requested — no-op for MVP");
  }
}
