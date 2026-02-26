import { z } from "zod";

/** Valid device provider values (matches DataSource enum minus MANUAL and TRAININGPEAKS) */
export const deviceProviderEnum = z.enum([
  "STRAVA",
  "GARMIN",
  "APPLE_HEALTH",
  "WHOOP",
  "OURA",
  "FITBIT",
]);

export type DeviceProvider = z.infer<typeof deviceProviderEnum>;
