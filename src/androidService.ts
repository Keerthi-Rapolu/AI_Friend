// src/androidService.ts
import { Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

// Opens the "Display over other apps" screen for this package.
// NOTE: This does NOT start a Service (Expo cannot start a native Service without a module).
async function openOverlayPermissionScreen() {
  try {
    // Works on most Android builds
    await IntentLauncher.startActivityAsync(
      // raw action string (not all actions are in IntentLauncher.ActivityAction enum)
      "android.settings.action.MANAGE_OVERLAY_PERMISSION",
      {
        // direct to our app package page
        data: "package:com.anonymous.aifriend",
      }
    );
  } catch {
    // Fallback: open app details if overlay screen isn't available
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: "package:com.anonymous.aifriend" }
    );
  }
}

/**
 * Best-effort "start" that (for now) ensures the user can grant overlay permission.
 * When you add a native module, replace the TODO with a call that starts your Foreground Service.
 */
export async function startAssistantService() {
  if (Platform.OS !== "android") return;
  try {
    // 1) Make sure the user can grant the overlay permission
    await openOverlayPermissionScreen();

    // 2) TODO (when you add native code):
    //    NativeModules.AIFriend?.startForegroundService?.();
    //    For now we just log to avoid crashes.
    console.log("[AssistantService] Native service start is not wired yet (Expo).");
  } catch (e) {
    console.warn("[AssistantService] start failed", e);
  }
}
