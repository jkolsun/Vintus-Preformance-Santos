import type { DeviceConnection, ReadinessMetric } from "@prisma/client";
import type { DeviceAdapter } from "./types.js";
import { logger } from "../../lib/logger.js";

/**
 * Apple Health Adapter — iOS-only health data aggregation.
 *
 * Apple HealthKit: https://developer.apple.com/documentation/healthkit
 *
 * Phase 2 implementation notes:
 * - Apple Health does NOT have a server-side API
 * - Data must be collected on-device via the iOS/watchOS app using HealthKit
 * - The mobile app reads HealthKit data and POSTs it to our API
 * - This adapter receives pre-formatted data from the mobile client
 * - No OAuth flow — uses app-level authorization on the device
 * - Pulls (from mobile client): HRV, resting HR, sleep analysis, steps,
 *   active calories, VO2max estimate, workout sessions
 * - Maps to ReadinessMetric: hrvMs, restingHr, sleepScore (computed from
 *   sleep analysis), sleepDurationMin, caloriesBurned, steps, vo2Estimate
 */
export class AppleHealthAdapter implements DeviceAdapter {
  readonly provider = "APPLE_HEALTH";
  readonly displayName = "Apple Health";

  // Apple Health has no OAuth — data comes from the mobile app
  // TODO: Phase 2 — return deep link to mobile app settings
  getAuthUrl(_userId: string): string {
    return "#not-implemented-yet";
  }

  // TODO: Phase 2 — receive device-side authorization confirmation from mobile app
  async handleCallback(_code: string, _userId: string): Promise<DeviceConnection> {
    throw new Error("Apple Health integration not yet implemented. Requires iOS app (Phase 2).");
  }

  // TODO: Phase 2 — process data payload from mobile client POST
  // Mobile app sends: { hrv, restingHr, sleepAnalysis, steps, calories, vo2max }
  async syncData(_connection: DeviceConnection): Promise<Partial<ReadinessMetric>> {
    logger.info({ provider: this.provider }, "Sync requested — returning manual entry stub");
    return {
      source: "APPLE_HEALTH" as ReadinessMetric["source"],
      notes: "Apple Health sync not yet available. Requires iOS app. Use daily check-in for now.",
    };
  }

  // TODO: Phase 2 — notify mobile app to revoke HealthKit permissions
  async revokeAccess(_connection: DeviceConnection): Promise<void> {
    logger.info({ provider: this.provider }, "Revoke requested — no-op for MVP");
  }
}
