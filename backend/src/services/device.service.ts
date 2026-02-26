import type { DataSource, DeviceConnection, ReadinessMetric } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

import type { DeviceAdapter } from "./adapters/types.js";
import { StravaAdapter } from "./adapters/strava.adapter.js";
import { GarminAdapter } from "./adapters/garmin.adapter.js";
import { AppleHealthAdapter } from "./adapters/apple-health.adapter.js";
import { WhoopAdapter } from "./adapters/whoop.adapter.js";
import { OuraAdapter } from "./adapters/oura.adapter.js";
import { FitbitAdapter } from "./adapters/fitbit.adapter.js";

// ============================================================
// Adapter Registry (singleton instances)
// ============================================================

const adapters: Record<string, DeviceAdapter> = {
  STRAVA: new StravaAdapter(),
  GARMIN: new GarminAdapter(),
  APPLE_HEALTH: new AppleHealthAdapter(),
  WHOOP: new WhoopAdapter(),
  OURA: new OuraAdapter(),
  FITBIT: new FitbitAdapter(),
};

/**
 * Factory — returns the adapter for a given DataSource provider.
 * Throws if the provider is not supported (e.g. MANUAL, TRAININGPEAKS).
 */
export function getAdapter(provider: DataSource): DeviceAdapter {
  const adapter = adapters[provider];
  if (!adapter) {
    const err = new Error(`Unsupported device provider: ${provider}`) as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  return adapter;
}

// ============================================================
// getProviders — return all supported providers with connection status
// ============================================================

interface ProviderInfo {
  provider: string;
  displayName: string;
  status: "connected" | "pending" | "not_connected";
  lastSyncAt: Date | null;
}

export async function getProviders(userId: string): Promise<ProviderInfo[]> {
  // Fetch all existing connections for this user
  const connections = await prisma.deviceConnection.findMany({
    where: { userId },
  });

  const connectionMap = new Map<string, DeviceConnection>();
  for (const conn of connections) {
    connectionMap.set(conn.provider, conn);
  }

  // Build the provider list from registered adapters
  const providers: ProviderInfo[] = Object.values(adapters).map((adapter) => {
    const conn = connectionMap.get(adapter.provider);

    let status: ProviderInfo["status"] = "not_connected";
    if (conn?.isActive) {
      status = "connected";
    } else if (conn) {
      status = "pending";
    }

    return {
      provider: adapter.provider,
      displayName: adapter.displayName,
      status,
      lastSyncAt: conn?.lastSyncAt ?? null,
    };
  });

  return providers;
}

// ============================================================
// connect — initiate device connection (MVP: returns coming_soon)
// ============================================================

interface ConnectResult {
  provider: string;
  authUrl: string;
  status: string;
}

export async function connect(
  userId: string,
  provider: DataSource
): Promise<ConnectResult> {
  const adapter = getAdapter(provider);

  // Upsert a pending DeviceConnection record
  await prisma.deviceConnection.upsert({
    where: {
      userId_provider: { userId, provider },
    },
    create: {
      userId,
      provider,
      isActive: false,
      scopes: [],
    },
    update: {
      // Ensure record exists — no-op if already present
    },
  });

  const authUrl = adapter.getAuthUrl(userId);

  logger.info({ userId, provider }, "Device connection initiated");

  return {
    provider: adapter.provider,
    authUrl,
    status: "coming_soon",
  };
}

// ============================================================
// handleCallback — exchange auth code for tokens (Phase 2)
// ============================================================

export async function handleCallback(
  provider: DataSource,
  code: string,
  userId: string
): Promise<DeviceConnection> {
  const adapter = getAdapter(provider);

  // Phase 2: adapter.handleCallback will exchange the code for tokens
  // and update the DeviceConnection record with access/refresh tokens
  const connection = await adapter.handleCallback(code, userId);

  logger.info({ userId, provider }, "OAuth callback handled");

  return connection;
}

// ============================================================
// syncDevice — trigger manual data sync (MVP: manual_entry_required)
// ============================================================

interface SyncResult {
  provider: string;
  status: string;
  message: string;
  data: Partial<ReadinessMetric> | null;
}

export async function syncDevice(
  userId: string,
  provider: DataSource
): Promise<SyncResult> {
  const adapter = getAdapter(provider);

  // Look up the connection
  const connection = await prisma.deviceConnection.findUnique({
    where: {
      userId_provider: { userId, provider },
    },
  });

  if (!connection) {
    const err = new Error(`No ${adapter.displayName} connection found. Connect first.`) as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // MVP: adapters return stub data
  const data = await adapter.syncData(connection);

  // Phase 2: update lastSyncAt when real data is returned
  if (connection.isActive) {
    await prisma.deviceConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });
  }

  logger.info({ userId, provider }, "Device sync requested");

  return {
    provider: adapter.provider,
    status: connection.isActive ? "synced" : "manual_entry_required",
    message: connection.isActive
      ? "Data synced successfully."
      : `${adapter.displayName} sync coming soon. Use daily check-in for now.`,
    data: connection.isActive ? data : null,
  };
}

// ============================================================
// disconnect — revoke access and deactivate connection
// ============================================================

export async function disconnect(
  userId: string,
  provider: DataSource
): Promise<{ provider: string; status: string }> {
  const adapter = getAdapter(provider);

  const connection = await prisma.deviceConnection.findUnique({
    where: {
      userId_provider: { userId, provider },
    },
  });

  if (!connection) {
    const err = new Error(`No ${adapter.displayName} connection found.`) as Error & { statusCode?: number };
    err.statusCode = 404;
    throw err;
  }

  // Phase 2: adapter will revoke tokens with the provider
  await adapter.revokeAccess(connection);

  // Deactivate and clear tokens
  await prisma.deviceConnection.update({
    where: { id: connection.id },
    data: {
      isActive: false,
      accessToken: null,
      refreshToken: null,
      syncErrors: 0,
    },
  });

  logger.info({ userId, provider }, "Device disconnected");

  return {
    provider: adapter.provider,
    status: "disconnected",
  };
}
