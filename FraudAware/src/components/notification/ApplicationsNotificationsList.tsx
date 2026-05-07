import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import SwipeableApplicationRow from './SwipeableApplicationRow';
import NotificationsEmptyState from './NotificationsEmptyState';
import type { ApplicationListItem } from '../../../data/applicationNotifications';

type Props = {
  items: ApplicationListItem[];
  onItemPress?: (id: string) => void;
  onItemDelete?: (id: string) => void;
};

export default function ApplicationsNotificationsList({
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
        <SwipeableApplicationRow
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
