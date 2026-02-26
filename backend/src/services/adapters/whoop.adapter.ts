import type { DeviceConnection, ReadinessMetric } from "@prisma/client";
import type { DeviceAdapter } from "./types.js";
import { logger } from "../../lib/logger.js";

/**
 * WHOOP Adapter — recovery, strain, and sleep metrics.
 *
 * WHOOP API docs: https://developer.whoop.com/docs/developing/getting-started
 * OAuth2 flow: https://developer.whoop.com/docs/developing/oauth2
 *
 * Phase 2 implementation notes:
 * - OAuth2 authorization code flow
 * - Scopes needed: read:recovery, read:sleep, read:workout, read:cycles
 * - Pulls: recovery score, HRV, resting HR, sleep performance, strain
 * - WHOOP is ideal for Vintus — recovery score maps directly to readiness
 * - Maps to ReadinessMetric: hrvMs (HRV), restingHr, sleepScore (sleep
 *   performance %), sleepDurationMin, fatigueScore (100 - recovery score),
 *   stressScore (from strain), trainingLoad (strain score)
 */
export class WhoopAdapter implements DeviceAdapter {
  readonly provider = "WHOOP";
  readonly displayName = "WHOOP";

  // TODO: Phase 2 — build OAuth2 URL
  // GET https://api.prod.whoop.com/oauth/oauth2/auth
  // ?client_id=...&redirect_uri=...&scope=read:recovery,read:sleep,read:workout
  getAuthUrl(_userId: string): string {
    return "#not-implemented-yet";
  }

  // TODO: Phase 2 — exchange code for tokens
  // POST https://api.prod.whoop.com/oauth/oauth2/token
  async handleCallback(_code: string, _userId: string): Promise<DeviceConnection> {
    throw new Error("WHOOP integration not yet implemented. Coming in Phase 2.");
  }

  // TODO: Phase 2 — GET /v1/recovery, /v1/sleep, /v1/cycle
  // Map recovery score to readiness, strain to training load
  async syncData(_connection: DeviceConnection): Promise<Partial<ReadinessMetric>> {
    logger.info({ provider: this.provider }, "Sync requested — returning manual entry stub");
    return {
      source: "WHOOP" as ReadinessMetric["source"],
      notes: "WHOOP sync not yet available. Use daily check-in for now.",
    };
  }

  // TODO: Phase 2 — revoke OAuth2 tokens
  async revokeAccess(_connection: DeviceConnection): Promise<void> {
    logger.info({ provider: this.provider }, "Revoke requested — no-op for MVP");
  }
}
