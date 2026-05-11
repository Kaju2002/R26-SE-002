import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { POST_JOB } from './postJobTheme';

export default function PostJobDetectHint() {
  return (
    <View style={styles.banner}>
      <Ionicons name="information-circle-outline" size={20} color={POST_JOB.navy} />
      <Text style={styles.text}>
        Received a suspicious ad? Use{' '}
        <Text style={styles.emphasis}>Detect</Text> to analyze it before you trust or pay anyone.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: POST_JOB.hintBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: POST_JOB.navy,
    padding: 12,
    marginBottom: 16,
  },
  text: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: POST_JOB.deep,
  },
  emphasis: {
    fontFamily: 'Poppins_600SemiBold',
    color: POST_JOB.navy,
  },
});
