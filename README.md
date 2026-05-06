# AHM

AHM is a minimal black-and-white Expo mobile app for Android and iOS with a PIN lock, Supabase-backed passwords, projects, finance entries, and tasks.

## Requirements

- Node.js
- npm
- Expo tooling through `npx expo`
- Android Studio or Xcode for native builds

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from the example:

```bash
cp .env.example .env
```

3. Set up Supabase tables:

```bash
npm run setup:db
```

The same setup script is also attached to `postinstall`; if `DATABASE_URL` is present, it creates or updates the required Supabase tables automatically.

4. Start the app:

```bash
npm start
```

5. Build/run on devices:

```bash
npm run android
npm run ios
```

## App PIN

The app unlock PIN is:

```text
982010
```

## Supabase

The schema is in `supabase/migrations/001_initial_schema.sql`. It creates:

- `password_entries`
- `projects`
- `finance_entries`
- `tasks`

Because this app has a PIN lock rather than per-user authentication, the migration enables RLS and adds anonymous policies for the app tables so the publishable key can read and write data.

## Notifications

Task reminders are local notifications. When a task is saved, AHM schedules reminders for the day before and the day of the finish date. Scheduled local notifications can fire while the app is closed, subject to iOS/Android notification permissions and platform delivery behavior.
