import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import SwipeableNotificationRow from './SwipeableNotificationRow';
import NotificationsEmptyState from './NotificationsEmptyState';
import type { AppNotification } from '../../../data/notifications';

type Props = {
  items: AppNotification[];
  onItemPress?: (id: string) => void;
  onItemDelete?: (id: string) => void;
};

export default function NotificationsList({
  items,
  onItemPress,
  onItemDelete,
}: Props) {
  if (items.length === 0) {
    return <NotificationsEmptyState />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {items.map((item, idx) => (
        <SwipeableNotificationRow
          key={item.id}
          item={item}
          onPress={() => onItemPress?.(item.id)}
          onDelete={() => onItemDelete?.(item.id)}
          showDivider={idx < items.length - 1}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 4,
    paddingBottom: 36,
  },
});
