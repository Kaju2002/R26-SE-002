import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ApplicationStatus } from '../../../data/applicationNotifications';

const LABELS: Record<ApplicationStatus, string> = {
  sent: 'Application Sent',
  pending: 'Application Pending',
  accepted: 'Application Accepted',
  rejected: 'Application Rejected',
};

const STYLES: Record<
  ApplicationStatus,
  { bg: string; text: string; border: string }
> = {
  sent: {
    bg: '#E8EBFA',
    text: '#42498A',
    border: '#C5CBE8',
  },
  pending: {
    bg: '#FFF5E6',
    text: '#C47F08',
    border: '#FFD699',
  },
  accepted: {
    bg: '#E8F6EE',
    text: '#1B7A3D',
    border: '#B8E0C8',
  },
  rejected: {
    bg: '#FDEDEE',
    text: '#C62828',
    border: '#F5C6CA',
  },
};

type Props = {
  status: ApplicationStatus;
};

export default function ApplicationStatusBadge({ status }: Props) {
  const c = STYLES[status];
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.text }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  /** Status — Poppins Regular 12 */
  label: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    letterSpacing: 0.1,
  },
});
