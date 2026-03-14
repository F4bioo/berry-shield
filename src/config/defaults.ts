import type { BerryShieldPluginConfig } from "../types/config.js";
import { createBerryShieldDefaultConfig } from "./catalog.js";

/**
 * Runtime defaults derived from the central config catalog.
 */
export const DEFAULT_CONFIG: BerryShieldPluginConfig = createBerryShieldDefaultConfig();
