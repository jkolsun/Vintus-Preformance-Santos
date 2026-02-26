import type { DeviceConnection, ReadinessMetric } from "@prisma/client";

/**
 * DeviceAdapter — standard interface for all wearable/device integrations.
 * Each provider implements this interface. For MVP, all methods return stubs.
 * Phase 2 will wire each adapter to the provider's real OAuth2 + REST API.
 */
export interface DeviceAdapter {
  /** Provider name (matches DataSource enum) */
  readonly provider: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Build the OAuth2 authorization URL for the user to grant access. */
  getAuthUrl(userId: string): string;

  /** Handle the OAuth2 callback — exchange code for tokens, create/update DeviceConnection. */
  handleCallback(code: string, userId: string): Promise<DeviceConnection>;

  /** Pull latest data from the provider and return a ReadinessMetric. */
  syncData(connection: DeviceConnection): Promise<Partial<ReadinessMetric>>;

  /** Revoke access tokens and deactivate the connection. */
  revokeAccess(connection: DeviceConnection): Promise<void>;
}
