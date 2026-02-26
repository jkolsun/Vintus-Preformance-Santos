import type { DeviceConnection, ReadinessMetric } from "@prisma/client";
import type { DeviceAdapter } from "./types.js";
import { logger } from "../../lib/logger.js";

/**
 * Strava Adapter — cycling, running, and general activity data.
 *
 * Strava API docs: https://developers.strava.com/docs/reference/
 * OAuth2 flow: https://developers.strava.com/docs/authentication/
 *
 * Phase 2 implementation notes:
 * - OAuth2 authorization code flow with PKCE
 * - Scopes needed: read,activity:read_all
 * - Webhook subscription for real-time activity updates
 * - Pulls: activities (TSS, duration, distance), athlete stats
 * - Maps to ReadinessMetric: caloriesBurned, trainingLoad, steps (estimated)
 */
export class StravaAdapter implements DeviceAdapter {
  readonly provider = "STRAVA";
  readonly displayName = "Strava";

  // TODO: Phase 2 — build OAuth2 URL with client_id, redirect_uri, scope
  getAuthUrl(_userId: string): string {
    return "#not-implemented-yet";
  }

  // TODO: Phase 2 — exchange authorization code for access_token + refresh_token
  // POST https://www.strava.com/oauth/token
  // Store tokens encrypted in DeviceConnection
  async handleCallback(_code: string, _userId: string): Promise<DeviceConnection> {
    throw new Error("Strava integration not yet implemented. Coming in Phase 2.");
  }

  // TODO: Phase 2 — GET /api/v3/athlete/activities, compute TSS, map to ReadinessMetric
  async syncData(_connection: DeviceConnection): Promise<Partial<ReadinessMetric>> {
    logger.info({ provider: this.provider }, "Sync requested — returning manual entry stub");
    return {
      source: "STRAVA" as ReadinessMetric["source"],
      notes: "Strava sync not yet available. Use daily check-in for now.",
    };
  }

  // TODO: Phase 2 — POST https://www.strava.com/oauth/deauthorize
  async revokeAccess(_connection: DeviceConnection): Promise<void> {
    logger.info({ provider: this.provider }, "Revoke requested — no-op for MVP");
  }
}
