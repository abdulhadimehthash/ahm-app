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

// Helper to convert local JavaScript Date values to IST zoned UTC Date
function getISTDateInUTC(dateIST: Date): Date {
  const year = dateIST.getFullYear();
  const month = String(dateIST.getMonth() + 1).padStart(2, '0');
  const day = String(dateIST.getDate()).padStart(2, '0');
  const hours = String(dateIST.getHours()).padStart(2, '0');
  const minutes = String(dateIST.getMinutes()).padStart(2, '0');
  const seconds = String(dateIST.getSeconds()).padStart(2, '0');
  const dateString = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  return fromZonedTime(dateString, IST_TIMEZONE);
}

// Request permissions
export async function requestNotificationPermissions() {
  if (!Device.isDevice) return false
  
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

// Schedule a notification at exact date and time in IST
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
  
  // Convert IST time to UTC for scheduling
  const utcDate = getISTDateInUTC(dateIST)
  
  // Don't schedule if time is in the past
  if (utcDate <= new Date()) return ''
  
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
        date: utcDate,
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
  
  // Calculate next 9am IST in UTC
  const now = new Date()
  const zonedNow = toZonedTime(now, IST_TIMEZONE)
  const target = new Date(zonedNow)
  target.setHours(9, 0, 0, 0)
  if (target <= zonedNow) {
    target.setDate(target.getDate() + 1)
  }
  const utcTarget = fromZonedTime(target, IST_TIMEZONE)

  await Notifications.scheduleNotificationAsync({
    identifier: 'daily_morning',
    content: {
      title: 'Good Morning Hadi 👋',
      body: 'Open AHM to see your tasks and plans for today',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { id: 'daily_morning', screen: 'Tasks' },
    },
    trigger: {
      date: utcTarget,
      channelId: 'default',
    },
  })
}

// Schedule daily 3pm check (3 PM IST)
export async function scheduleDailyAfternoon() {
  await Notifications.cancelScheduledNotificationAsync(
    'daily_afternoon'
  )
  
  // Calculate next 3pm IST in UTC
  const now = new Date()
  const zonedNow = toZonedTime(now, IST_TIMEZONE)
  const target = new Date(zonedNow)
  target.setHours(15, 0, 0, 0)
  if (target <= zonedNow) {
    target.setDate(target.getDate() + 1)
  }
  const utcTarget = fromZonedTime(target, IST_TIMEZONE)

  await Notifications.scheduleNotificationAsync({
    identifier: 'daily_afternoon',
    content: {
      title: 'AHM Check In ⚡',
      body: 'How are your tasks going today?',
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { id: 'daily_afternoon', screen: 'Tasks' },
    },
    trigger: {
      date: utcTarget,
      channelId: 'default',
    },
  })
}

// ── Backward compatibility helpers for other parts of the app ──
export async function prepareNotifications() {
  await requestNotificationPermissions()
}

export async function cancelCalendarTodoNotification(notificationId: string | null) {
  if (notificationId) {
    await cancelNotification(notificationId)
  }
}

export async function scheduleCalendarTodoNotification(todo: { name: string; due_date: string }) {
  const [year, month, day] = todo.due_date.split('-').map(Number);
  const dueDate = new Date(year, month - 1, day, 9, 0, 0);
  dueDate.setDate(dueDate.getDate() - 3);
  
  return scheduleNotification({
    id: `calendartodo_${todo.due_date}_${todo.name}`,
    title: 'Calendar Reminder',
    body: `Reminder: ${todo.name} is due in 3 days`,
    dateIST: dueDate,
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
  const [year, month, day] = plan_date.split('-').map(Number);
  const time24 = convertTo24hr(plan_time);
  const [hours, minutes, seconds] = time24.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

