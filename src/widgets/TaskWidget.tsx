/**
 * Android home screen widget — shows the most urgent task.
 *
 * Requirements (run BEFORE using this widget):
 *   npx expo install react-native-android-widget
 *   Then add the plugin to app.json (see app.json "plugins" array).
 *   Build with EAS: eas build -p android --profile preview
 *   This widget does NOT work in Expo Go.
 */

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface TaskWidgetProps {
  taskName?: string;
  taskDate?: string;
}

export function TaskWidget({ taskName, taskDate }: TaskWidgetProps) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: 20,
        backgroundColor: '#0A0A0A',
        borderRadius: 20,
      }}
    >
      {/* AHM label */}
      <TextWidget
        text="AHM"
        style={{
          color: '#5A5A5A',
          fontSize: 11,
          fontWeight: 'bold',
          letterSpacing: 4,
          marginBottom: 10,
        }}
      />

      {/* Task name */}
      <TextWidget
        text={taskName ?? 'No tasks today'}
        style={{
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: 'bold',
          marginBottom: taskDate ? 6 : 0,
        }}
      />

      {/* Due date */}
      {taskDate ? (
        <TextWidget
          text={`Due ${taskDate}`}
          style={{
            color: '#5A5A5A',
            fontSize: 12,
          }}
        />
      ) : null}
    </FlexWidget>
  );
}
