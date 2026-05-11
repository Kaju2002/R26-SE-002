import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { POST_JOB } from './postJobTheme';

type Props = {
  title: string;
  children: React.ReactNode;
};

export default function PostJobSectionCard({ title, children }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: POST_JOB.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: POST_JOB.border,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: POST_JOB.navy,
    marginBottom: 12,
  },
});
