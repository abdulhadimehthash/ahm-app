/**
 * Widget task handler — runs in the background to update the TaskWidget
 * with fresh data from Supabase every 30 minutes via WorkManager.
 *
 * Register this in your app entry (index.js) BEFORE the React app mounts:
 *   import { registerWidgetTaskHandler } from 'react-native-android-widget';
 *   import { widgetTaskHandler } from './src/widgets/widgetTaskHandler';
 *   registerWidgetTaskHandler(widgetTaskHandler);
 */

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { supabase } from '../lib/supabase';
import { TaskWidget } from './TaskWidget';

function getTodayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0];
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { renderWidget } = props;

  try {
    const today = getTodayIST();

    // Fetch the single most urgent task (earliest due date, today or future)
    const { data } = await supabase
      .from('tasks')
      .select('name, finish_date')
      .gte('finish_date', today)
      .order('finish_date', { ascending: true })
      .limit(1);

    const task = data?.[0];

    renderWidget(
      React.createElement(TaskWidget, {
        taskName: task?.name,
        taskDate: task ? formatShortDate(task.finish_date) : undefined,
      })
    );
  } catch {
    // On error, show a fallback widget
    renderWidget(
      React.createElement(TaskWidget, {
        taskName: 'Open AHM to view tasks',
      })
    );
  }
}
