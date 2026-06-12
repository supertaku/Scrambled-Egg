import type { GgufDownloadConfig } from "./modelDownloadConfig";
import type { DeviceHardwareProfile } from "./localModelMetadata";

function gb(value: number): string {
  return `${Math.round(value * 10) / 10} GB`;
}

export interface StorageForecast {
  /** Free storage after install, in GB (null when storage is unreadable). */
  freeAfterInstallGB: number | null;
  /** Free storage right now, in GB. */
  freeNowGB: number | null;
  /** Human summary for the download card. */
  summary: string | null;
}

/** What installing this model would leave on the phone. */
export function forecastStorageForModel(
  model: Pick<GgufDownloadConfig, "sizeMB">,
  hardware: DeviceHardwareProfile
): StorageForecast {
  if (hardware.freeStorageGB === null) {
    return { freeAfterInstallGB: null, freeNowGB: null, summary: null };
  }
  const downloadGB = model.sizeMB / 1024;
  const freeAfter = Math.max(0, hardware.freeStorageGB - downloadGB);
  return {
    freeAfterInstallGB: freeAfter,
    freeNowGB: hardware.freeStorageGB,
    summary: `Uses ${gb(downloadGB)} of storage — about ${gb(freeAfter)} would stay free.`
  };
}
