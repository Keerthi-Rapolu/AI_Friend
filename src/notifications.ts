// src/notifications.ts
import * as Notifications from "expo-notifications";

export async function prepareNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
      // iOS 17+/new typings prefer these:
      shouldShowBanner: true,
      shouldShowList: true,
      // still fine to keep for Android/BC:
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
}

export async function scheduleAlarm(title: string, body: string, when: Date) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    // Your version expects a string-discriminated union:
    trigger: { type: "date", date: when } as Notifications.DateTriggerInput,
  });
}
