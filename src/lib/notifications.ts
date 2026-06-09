import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

const IST_TIMEZONE = 'Asia/Kolkata'

// Configure how notifications appear
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

// Request permissions
export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') return false
  
  const { status: existingStatus } = 
    await Notifications.getPermissionsAsync()
  
  let finalStatus = existingStatus
  
  if (existingStatus !== 'granted') {
    const { status } = 
      await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  
  if (finalStatus !== 'granted') return false
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      'default', {
        name: 'AHM Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFFFFF',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      }
    )
  }
  
  return true
}

// Schedule a notification at exact date and time (absolute UTC Date)
export async function scheduleNotification({
  id,
  title,
  body,
  dateIST,
  screen,
}: {
  id: string
  title: string
  body: string
  dateIST: Date
  screen?: string
}): Promise<string> {
  // Cancel existing notification with same id
  await cancelNotification(id)
  
  // Don't schedule if time is in the past
  if (dateIST <= new Date()) return ''
  
  const notificationId = 
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 250, 250, 250],
        data: { id, screen },
      },
      trigger: {
        date: dateIST,
        channelId: 'default',
      },
    })
  
  return notificationId
}

// Schedule notification X minutes before a time
export async function scheduleEarlyNotification({
  id,
  title,
  body,
  dateIST,
  minutesBefore,
  screen,
}: {
  id: string
  title: string
  body: string
  dateIST: Date
  minutesBefore: number
  screen?: string
}): Promise<string> {
  const earlyDate = new Date(
    dateIST.getTime() - minutesBefore * 60 * 1000
  )
  
  return scheduleNotification({
    id: `${id}_early`,
    title,
    body,
    dateIST: earlyDate,
    screen,
  })
}

// Cancel a notification
export async function cancelNotification(id: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
    await Notifications.cancelScheduledNotificationAsync(
      `${id}_early`
    )
  } catch (e) {}
}

// Schedule daily morning notification (9 AM IST)
export async function scheduleDailyMorning() {
  await Notifications.cancelScheduledNotificationAsync(
    'daily_morning'
  )
  
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily_morning',
    content: {
      title: 'Good Morning Hadi 👋',
      body: 'Open AHM to see your plans for today',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { id: 'daily_morning', screen: 'Calendar' },
    },
    trigger: {
      hour: 9,
      minute: 0,
      repeats: true,
      timezone: IST_TIMEZONE,
      channelId: 'default',
    } as any,
  })
}

// Schedule daily 3pm check (3 PM IST)
export async function scheduleDailyAfternoon() {
  await Notifications.cancelScheduledNotificationAsync(
    'daily_afternoon'
  )
  
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily_afternoon',
    content: {
      title: 'AHM Check In ⚡',
      body: 'How is your day going?',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { id: 'daily_afternoon', screen: 'Calendar' },
    },
    trigger: {
      hour: 15,
      minute: 0,
      repeats: true,
      timezone: IST_TIMEZONE,
      channelId: 'default',
    } as any,
  })
}

// ── Shared Domain-Specific Scheduling & Cancellation Helpers ──

// Tasks (Obsolete but kept for signature compatibility)
export async function scheduleAllTaskNotifications(task: { id: string; name: string; finish_date: string }) {
  // Obsolete - Tasks screen deleted
}

export async function cancelTaskNotifications(taskId: string) {
  // Obsolete
}

// Day Plans
export async function scheduleAllDayPlanNotifications(plan: { id: string; title: string; plan_date: string; plan_time: string; details: string | null }) {
  await cancelAllDayPlanNotifications(plan.id);
  
  const planDateTime = parsePlanDateTime(plan.plan_date, plan.plan_time);
  
  // 1. Exact plan time
  await scheduleNotification({
    id: `dayplan_${plan.id}`,
    title: '📅 Planned: ' + plan.title,
    body: plan.details || 'Time for your planned activity',
    dateIST: planDateTime,
    screen: 'Calendar',
  });
  
  // 2. 10 minutes early
  await scheduleEarlyNotification({
    id: `dayplan_${plan.id}`,
    title: '⏰ Starting in 10 mins',
    body: plan.title,
    dateIST: planDateTime,
    minutesBefore: 10,
    screen: 'Calendar',
  });
  
  // 3. 8am on the day
  const morningReminder = fromZonedTime(`${plan.plan_date} 08:00:00`, IST_TIMEZONE);
  await scheduleNotification({
    id: `dayplan_morning_${plan.id}`,
    title: '🌅 Today: ' + plan.title,
    body: `Planned for ${plan.plan_time}`,
    dateIST: morningReminder,
    screen: 'Calendar',
  });
}

export async function cancelAllDayPlanNotifications(planId: string) {
  await cancelNotification(`dayplan_${planId}`);
  await cancelNotification(`dayplan_morning_${planId}`);
}

// Birthdays
export async function scheduleAllBirthdayNotifications(bd: { id: string; name: string; day: number; month: number }) {
  await cancelAllBirthdayNotifications(bd.id);
  
  const currentYear = new Date().getFullYear();
  const monthStr = String(bd.month).padStart(2, '0');
  const dayStr = String(bd.day).padStart(2, '0');
  
  for (const year of [currentYear, currentYear + 1]) {
    const birthdayDate = fromZonedTime(`${year}-${monthStr}-${dayStr} 08:00:00`, IST_TIMEZONE);
    
    // On the day
    await scheduleNotification({
      id: `birthday_${bd.id}_${year}`,
      title: '🎂 Birthday Today!',
      body: `Today is ${bd.name}'s birthday!`,
      dateIST: birthdayDate,
      screen: 'Contacts',
    });
    
    // 1 day before
    const dayBefore = new Date(birthdayDate.getTime() - 24 * 60 * 60 * 1000);
    await scheduleNotification({
      id: `birthday_before_${bd.id}_${year}`,
      title: '🎁 Birthday Tomorrow',
      body: `Tomorrow is ${bd.name}'s birthday!`,
      dateIST: dayBefore,
      screen: 'Contacts',
    });
  }
}

export async function cancelAllBirthdayNotifications(bdId: string) {
  const currentYear = new Date().getFullYear();
  for (const year of [currentYear, currentYear + 1]) {
    await cancelNotification(`birthday_${bdId}_${year}`);
    await cancelNotification(`birthday_before_${bdId}_${year}`);
  }
}

// ── Backward compatibility helpers ──
export async function prepareNotifications() {
  await requestNotificationPermissions()
}

export async function cancelCalendarTodoNotification(notificationId: string | null) {
  if (notificationId) {
    await cancelNotification(notificationId)
  }
}

export async function scheduleCalendarTodoNotification(todo: { name: string; due_date: string }) {
  const notifyDate = fromZonedTime(`${todo.due_date} 09:00:00`, IST_TIMEZONE);
  const reminderDate = new Date(notifyDate.getTime() - 3 * 24 * 60 * 60 * 1000);
  
  return scheduleNotification({
    id: `calendartodo_${todo.due_date}_${todo.name}`,
    title: 'Calendar Reminder',
    body: `Reminder: ${todo.name} is due in 3 days`,
    dateIST: reminderDate,
    screen: 'Calendar',
  });
}

// ── Time parsing and format conversion helpers ──
export function convertTo24hr(time12hr: string): string {
  const [time, modifier] = time12hr.split(' ')
  let [hours, minutes] = time.split(':')
  
  if (hours === '12') hours = '00'
  if (modifier === 'PM') {
    hours = String(parseInt(hours, 10) + 12)
  }
  
  return `${hours.padStart(2, '0')}:${minutes}:00`
}

export function parsePlanDateTime(plan_date: string, plan_time: string): Date {
  const time24 = convertTo24hr(plan_time);
  return fromZonedTime(`${plan_date} ${time24}`, IST_TIMEZONE);
}
