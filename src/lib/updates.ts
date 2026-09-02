import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export interface OtaState {
  checking: boolean;
  downloaded: boolean;
  error?: string;
}

/**
 * Checks the EAS Update channel for a newer JS bundle and downloads it if one
 * is available. Returns true when an update was fetched and is ready to apply.
 * No-ops in development / Expo Go.
 */
export async function checkForOta(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    const fetched = await Updates.fetchUpdateAsync();
    return fetched.isNew;
  } catch {
    return false;
  }
}

export async function applyOta(): Promise<void> {
  await Updates.reloadAsync();
}

export const currentUpdateId = Updates.updateId ?? 'embedded';
export const runtimeVersion =
  Constants.expoConfig?.version ?? Updates.runtimeVersion ?? '1.0.0';
