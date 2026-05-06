import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { TaskEntry } from './types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true
  })
});

const morningHour = 9;

export async function prepareNotifications() {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    await Notifications.requestPermissionsAsync();
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('tasks', {
      name: 'Task reminders',
      importance: Notifications.AndroidImportance.HIGH
    });
  }
}

export async function cancelTaskNotifications(task: Pick<TaskEntry, 'notification_today_id' | 'notification_tomorrow_id'>) {
  const ids = [task.notification_today_id, task.notification_tomorrow_id].filter(Boolean) as string[];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function scheduleTaskNotifications(taskName: string, finishDate: string) {
  const dueDate = dateFromIso(finishDate);
  const tomorrowReminder = reminderDate(dueDate, -1);
  const todayReminder = reminderDate(dueDate, 0);

  const notification_tomorrow_id = await scheduleIfRelevant({
    date: tomorrowReminder,
    title: 'Task due tomorrow',
    body: taskName
  });
  const notification_today_id = await scheduleIfRelevant({
    date: todayReminder,
    title: 'Task due today',
    body: taskName
  });

  return { notification_today_id, notification_tomorrow_id };
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function reminderDate(date: Date, offsetDays: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + offsetDays);
  next.setHours(morningHour, 0, 0, 0);
  return next;
}

async function scheduleIfRelevant(input: { date: Date; title: string; body: string }) {
  const now = new Date();
  const trigger = input.date > now ? input.date : soonIfSameDay(input.date, now);
  if (!trigger) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: true,
      channelId: 'tasks'
    },
    trigger: {
      date: trigger
    } as Notifications.NotificationTriggerInput
  });
}

function soonIfSameDay(date: Date, now: Date) {
  if (
    date.getFullYear() !== now.getFullYear() ||
    date.getMonth() !== now.getMonth() ||
    date.getDate() !== now.getDate()
  ) {
    return null;
  }

  return new Date(now.getTime() + 5000);
}
