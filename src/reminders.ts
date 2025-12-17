// src/reminders.ts
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications"; // enum value import
import * as IntentLauncher from "expo-intent-launcher";
import { Platform } from "react-native";

// Type-only imports (avoid "Cannot use namespace 'Notifications' as a type")
import type {
  NotificationHandler,
  NotificationBehavior,
  DateTriggerInput,
} from "expo-notifications";

export async function ensureNotifPerms() {
  if (!Device.isDevice) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }

  // Match your SDK's NotificationBehavior shape
  const handler: NotificationHandler = {
    handleNotification: async (): Promise<NotificationBehavior> => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      // Newer Expo d.ts expects these as well:
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  };
  Notifications.setNotificationHandler(handler);
}

// Cross-platform local reminder
export async function scheduleReminder(title: string, at: Date, body?: string) {
  await ensureNotifPerms();

  // Typed date trigger (enum, not string)
  const trigger: DateTriggerInput = {
    type: SchedulableTriggerInputTypes.DATE,
    date: at,
  };

  return Notifications.scheduleNotificationAsync({
    content: { title, body: body ?? "" },
    trigger,
  });
}

// Android-only: open Clock UI to set an alarm (iOS will fallback to a local notif in caller)
export async function openAlarmClock(
  hour: number,
  minutes: number,
  message = "AI Friend alarm"
) {
  if (Platform.OS !== "android") return false;
  try {
    await IntentLauncher.startActivityAsync("android.intent.action.SET_ALARM", {
      extra: {
        "android.intent.extra.alarm.MESSAGE": message,
        "android.intent.extra.alarm.HOUR": hour,
        "android.intent.extra.alarm.MINUTES": minutes,
        "android.intent.extra.alarm.SKIP_UI": false,
      },
    });
    return true;
  } catch {
    return false;
  }
}
