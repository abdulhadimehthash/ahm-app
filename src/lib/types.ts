export type PasswordCategory = 'Personal' | 'Client' | 'Others';
export type FinanceCategory = 'Client' | 'Others';
export type CopyVaultCategory = 'Personal' | 'Work' | 'KSF' | 'Client';
export type ContactCategory = 'Family' | 'Friend' | 'Client' | 'Collaborator' | 'School' | 'KSF';

export type PasswordEntry = {
  id: string;
  category: PasswordCategory;
  username: string;
  password_value: string;
  created_at: string;
};

export type ProjectEntry = {
  id: string;
  name: string;
  domain: string;
  description: string;
  created_at: string;
};

export type FinanceEntry = {
  id: string;
  name: string;
  category: FinanceCategory;
  amount: number;
  created_at: string;
};

export type ExpenseEntry = {
  id: string;
  name: string;
  amount: number;
  date: string;
  created_at: string;
};

export type TaskEntry = {
  id: string;
  name: string;
  finish_date: string;
  notification_today_id: string | null;
  notification_tomorrow_id: string | null;
  created_at: string;
};

export type CalendarTodo = {
  id: string;
  name: string;
  due_date: string;
  completed: boolean;
  notification_id: string | null;
  created_at: string;
};

export type BirthdayEntry = {
  id: string;
  name: string;
  day: number;
  month: number;
  note: string | null;
  created_at: string;
};

export type ActionItem = {
  text: string;
  done: boolean;
};

export type MeetingNote = {
  id: string;
  client_name: string;
  date: string;
  discussion: string;
  action_items: ActionItem[];
  created_at: string;
};

export type Reminder = {
  id: string;
  description: string;
  remind_at: string;
  fired: boolean;
  notification_id: string | null;
  notification_early_id: string | null;
  created_at: string;
};

export type TomorrowPrep = {
  id: string;
  item1: string | null;
  item2: string | null;
  item3: string | null;
  date: string;
  created_at: string;
};

export type CopyVaultItem = {
  id: string;
  label: string;
  content: string;
  category: CopyVaultCategory;
  created_at: string;
};

export type ContactEntry = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  category: ContactCategory;
  notes: string | null;
  created_at: string;
};

export type RootStackParamList = {
  Lock: undefined;
  Home: undefined;
  Passwords: undefined;
  Projects: undefined;
  Money: undefined;
  Finance: undefined;
  Tasks: undefined;
  Calendar: undefined;
  Daily: undefined;
  Reminders: undefined;
  Notes: undefined;
  Documents: undefined;
  Proposals: undefined;
  AI: undefined;
  AIChat: undefined;
  Settings: undefined;
  Search: undefined;
  CopyVault: undefined;
  Contacts: undefined;
};
