import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { BirthdayEntry, Reminder, TaskEntry } from './types';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true
  })
});

export async function prepareNotifications() {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    await Notifications.requestPermissionsAsync();
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'AHM Notifications',
      importance: Notifications.AndroidImportance.HIGH
    });
    await Notifications.setNotificationChannelAsync('tasks', {
      name: 'Task reminders',
      importance: Notifications.AndroidImportance.HIGH
    });
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH
    });
    await Notifications.setNotificationChannelAsync('birthdays', {
      name: 'Birthday reminders',
      importance: Notifications.AndroidImportance.HIGH
    });
    await Notifications.setNotificationChannelAsync('daily', {
      name: 'Daily updates',
      importance: Notifications.AndroidImportance.HIGH
    });
  }
}

// ── IST helpers ────────────────────────────────────────────────────────────
// IST = UTC+5:30 → 9am IST = 03:30 UTC, 3pm IST = 09:30 UTC
function getNextNineAmIST(): Date {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(3, 30, 0, 0);
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
  return target;
}

function getNextThreePmIST(): Date {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(9, 30, 0, 0);
  if (target <= now) target.setUTCDate(target.getUTCDate() + 1);
  return target;
}

function getTodayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0];
}

// ── Dynamic morning notification (call on every app open) ──────────────────
export async function scheduleDynamicMorningNotification() {
  // Fetch today's task counts
  const today = getTodayIST();
  const [todayRes, overdueRes] = await Promise.all([
    supabase.from('tasks').select('id', { count: 'exact' }).eq('finish_date', today),
    supabase.from('tasks').select('id', { count: 'exact' }).lt('finish_date', today)
  ]);
  const todayCount = todayRes.count ?? 0;
  const overdueCount = overdueRes.count ?? 0;

  let body: string;
  if (todayCount === 0 && overdueCount === 0) {
    body = 'No tasks today — add something to work on!';
  } else if (overdueCount > 0) {
    body = `You have ${todayCount} task${todayCount !== 1 ? 's' : ''} due today and ${overdueCount} overdue. Open AHM to get started.`;
  } else {
    body = `You have ${todayCount} task${todayCount !== 1 ? 's' : ''} due today. Open AHM to get started.`;
  }

  // Cancel previous morning notification and reschedule with fresh content
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.find((n) => n.identifier === 'morning_9am');
  if (existing) await Notifications.cancelScheduledNotificationAsync('morning_9am');

  const target = getNextNineAmIST();
  await Notifications.scheduleNotificationAsync({
    identifier: 'morning_9am',
    content: {
      title: 'Good Morning Hadi 👋',
      body,
      sound: true,
      data: { screen: 'Tasks' }
    },
    trigger: { date: target } as Notifications.NotificationTriggerInput
  });
}

// ── Dynamic 3pm task check (call on every app open) ────────────────────────
export async function scheduleDynamic3pmNotification() {
  const today = getTodayIST();
  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact' })
    .eq('finish_date', today);
  const remaining = count ?? 0;

  const body =
    remaining > 0
      ? `You still have ${remaining} task${remaining !== 1 ? 's' : ''} to finish today — let's go!`
      : 'All tasks done today! 🎉';

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.find((n) => n.identifier === 'afternoon_3pm');
  if (existing) await Notifications.cancelScheduledNotificationAsync('afternoon_3pm');

  const target = getNextThreePmIST();
  await Notifications.scheduleNotificationAsync({
    identifier: 'afternoon_3pm',
    content: {
      title: 'AHM – Afternoon Check',
      body,
      sound: true,
      data: { screen: 'Tasks' }
    },
    trigger: { date: target } as Notifications.NotificationTriggerInput
  });
}

// ── Streak warning (call on app open if >24h gap) ──────────────────────────
export async function scheduleStreakWarningNotification() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.find((n) => n.identifier === 'streak_warning');
  if (existing) await Notifications.cancelScheduledNotificationAsync('streak_warning');

  const target = getNextNineAmIST();
  await Notifications.scheduleNotificationAsync({
    identifier: 'streak_warning',
    content: {
      title: "You haven't opened AHM in a day 🔥",
      body: "Your streak is at risk! Open AHM to stay on track.",
      sound: true,
      data: { screen: 'Home' }
    },
    trigger: { date: target } as Notifications.NotificationTriggerInput
  });
}

// ── Tasks ──────────────────────────────────────────────────────────────────
export async function cancelTaskNotifications(
  task: Pick<TaskEntry, 'notification_today_id' | 'notification_tomorrow_id'>
) {
  const ids = [task.notification_today_id, task.notification_tomorrow_id].filter(Boolean) as string[];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export async function scheduleTaskNotifications(taskName: string, finishDate: string) {
  const dueDate = dateFromIso(finishDate);
  const tomorrowReminder = reminderDate(dueDate, -1, 9);
  const todayReminder = reminderDate(dueDate, 0, 9);

  const notification_tomorrow_id = await scheduleIfFuture({
    date: tomorrowReminder,
    title: 'Task due tomorrow',
    body: taskName,
    channelId: 'tasks',
    data: { screen: 'Tasks' }
  });
  const notification_today_id = await scheduleIfFuture({
    date: todayReminder,
    title: 'Task due today',
    body: taskName,
    channelId: 'tasks',
    data: { screen: 'Tasks' }
  });

  return { notification_today_id, notification_tomorrow_id };
}

// ── Calendar Todos ─────────────────────────────────────────────────────────
export async function scheduleCalendarTodoNotification(todo: { name: string; due_date: string }) {
  const dueDate = dateFromIso(todo.due_date);
  const reminderAt = reminderDate(dueDate, -3, 9);
  return scheduleIfFuture({
    date: reminderAt,
    title: 'Calendar Reminder',
    body: `Reminder: ${todo.name} is due in 3 days`,
    channelId: 'default'
  });
}

export async function cancelCalendarTodoNotification(notificationId: string | null) {
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }
}

// ── Birthdays ──────────────────────────────────────────────────────────────
export async function scheduleBirthdayNotifications(birthday: Pick<BirthdayEntry, 'name' | 'day' | 'month'>) {
  const today = new Date();
  const thisYear = today.getFullYear();

  let birthdayDate = new Date(thisYear, birthday.month - 1, birthday.day);
  if (birthdayDate <= today) {
    birthdayDate = new Date(thisYear + 1, birthday.month - 1, birthday.day);
  }

  const onDayDate = new Date(birthdayDate);
  onDayDate.setHours(8, 0, 0, 0);

  const dayBefore = new Date(birthdayDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(8, 0, 0, 0);

  const id_on_day = await scheduleIfFuture({
    date: onDayDate,
    title: '🎂 Birthday Today!',
    body: `Today is ${birthday.name}'s birthday!`,
    channelId: 'birthdays'
  });

  const id_day_before = await scheduleIfFuture({
    date: dayBefore,
    title: '🎂 Birthday Tomorrow',
    body: `Tomorrow is ${birthday.name}'s birthday!`,
    channelId: 'birthdays'
  });

  return { id_on_day, id_day_before };
}

// ── Reminders (with 10-min-early notification) ────────────────────────────
export async function scheduleReminderNotification(reminder: {
  description: string;
  remind_at: string;
}): Promise<{ notification_id: string | null; notification_early_id: string | null }> {
  const date = new Date(reminder.remind_at);
  const now = new Date();
  if (date <= now) return { notification_id: null, notification_early_id: null };

  // Exact-time notification
  const notification_id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Reminder',
      body: reminder.description,
      sound: true,
      data: { screen: 'Reminders' }
    },
    trigger: { date } as Notifications.NotificationTriggerInput
  });

  // 10-minute-early notification
  const earlyDate = new Date(date.getTime() - 10 * 60 * 1000);
  let notification_early_id: string | null = null;
  if (earlyDate > now) {
    notification_early_id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Reminder in 10 mins',
        body: `Reminder in 10 mins: ${reminder.description}`,
        sound: true,
        data: { screen: 'Reminders' }
      },
      trigger: { date: earlyDate } as Notifications.NotificationTriggerInput
    });
  }

  return { notification_id, notification_early_id };
}

export async function cancelReminderNotifications(
  reminder: Pick<Reminder, 'notification_id' | 'notification_early_id'>
) {
  const ids = [reminder.notification_id, reminder.notification_early_id].filter(Boolean) as string[];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

// Keep for backward compat
export async function cancelNotificationById(id: string | null) {
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
}

// ── Legacy recurring (kept for non-dynamic notifications) ──────────────────
export async function scheduleRecurringNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  const hasTomorrowPrep = scheduled.some((n) => n.identifier.startsWith('tomorrow_prep_'));
  const hasWeekKickoff = scheduled.some((n) => n.identifier.startsWith('week_kickoff_'));

  if (!hasTomorrowPrep) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'tomorrow_prep_9pm',
      content: {
        title: 'AHM – Tomorrow Prep',
        body: 'Plan your 3 priorities for tomorrow',
        sound: true,
        data: { screen: 'Daily' }
      },
      trigger: { hour: 21, minute: 0, repeats: true } as Notifications.NotificationTriggerInput
    });
  }

  if (!hasWeekKickoff) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'week_kickoff_monday',
      content: {
        title: 'AHM – Week Kickoff',
        body: 'New week! Check your tasks and set priorities',
        sound: true,
        data: { screen: 'Tasks' }
      },
      trigger: {
        weekday: 2,
        hour: 8,
        minute: 0,
        repeats: true
      } as Notifications.NotificationTriggerInput
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function dateFromIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function reminderDate(date: Date, offsetDays: number, hour: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + offsetDays);
  next.setHours(hour, 0, 0, 0);
  return next;
}

async function scheduleIfFuture(input: {
  date: Date;
  title: string;
  body: string;
  channelId?: string;
  data?: Record<string, string>;
}) {
  if (input.date <= new Date()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: true,
      ...(input.data ? { data: input.data } : {})
    },
    trigger: { date: input.date } as Notifications.NotificationTriggerInput
  });
}

// ── Day Plans (IST Time Zone UTC+5:30) ──────────────────────────────────────
function parseIstDateTime(plan_date: string, plan_time: string): Date {
  // plan_date: YYYY-MM-DD
  // plan_time: hh:mm AM/PM (e.g., "09:00 AM", "12:15 PM")
  const [year, monthStr, day] = plan_date.split('-').map(Number);
  const month = monthStr - 1; // 0-indexed month

  const match = plan_time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    throw new Error('Invalid time format. Expected "hh:mm AM/PM"');
  }

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (ampm === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }

  const utcTime = Date.UTC(year, month, day, hours, minutes, 0, 0);
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  return new Date(utcTime - istOffsetMs);
}

export async function scheduleDayPlanNotifications(plan: {
  title: string;
  plan_date: string;
  plan_time: string;
}) {
  try {
    const targetDate = parseIstDateTime(plan.plan_date, plan.plan_time);
    const now = new Date();

    let notification_id: string | null = null;
    let notification_early_id: string | null = null;

    // 1. Exact-time notification
    if (targetDate > now) {
      notification_id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Plan Now',
          body: `Now: ${plan.title}`,
          sound: true,
          data: { screen: 'Day' }
        },
        trigger: { date: targetDate } as Notifications.NotificationTriggerInput
      });
    }

    // 2. 10-minute early notification
    const earlyDate = new Date(targetDate.getTime() - 10 * 60 * 1000);
    if (earlyDate > now) {
      notification_early_id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Upcoming Plan',
          body: `In 10 mins: ${plan.title}`,
          sound: true,
          data: { screen: 'Day' }
        },
        trigger: { date: earlyDate } as Notifications.NotificationTriggerInput
      });
    }

    return { notification_id, notification_early_id };
  } catch (error) {
    console.error('Failed to schedule day plan notifications:', error);
    return { notification_id: null, notification_early_id: null };
  }
}

export async function cancelDayPlanNotifications(plan: {
  notification_id: string | null;
  notification_early_id: string | null;
}) {
  const ids = [plan.notification_id, plan.notification_early_id].filter(Boolean) as string[];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

