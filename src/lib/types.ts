export type PasswordCategory = 'Personal' | 'Client' | 'Others';
export type FinanceCategory = 'Client' | 'Others';

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

export type TaskEntry = {
  id: string;
  name: string;
  finish_date: string;
  notification_today_id: string | null;
  notification_tomorrow_id: string | null;
  created_at: string;
};

export type RootStackParamList = {
  Lock: undefined;
  Home: undefined;
  Passwords: undefined;
  Projects: undefined;
  Finance: undefined;
  Tasks: undefined;
};
