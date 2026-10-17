import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const NAVY = '#202871';
const MUTED = '#5B6473';

const POINTS = [
  'Your messages are analysed by an automated AI service (Google Gemini) and by FraudAware\'s scam detection models.',
  'Personal details such as phone numbers, emails and NIC numbers are hidden before anything reaches Gemini. Screenshots are never sent to Gemini.',
  'Conversations are deleted from our server 24 hours after your last message. Recruiter messages you check are also kept in your own scan history, like a normal scan. Your recent results are saved only on this phone.',
  'Never share passwords, OTP codes or bank PINs here.',
];

type Props = {
  onAccept: () => void;
  onDecline: () => void;
};

/** Shown before the first conversation; the chat starts only after "I understand". */
export default function AssistantPrivacyNotice({ onAccept, onDecline }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.icon}>
        <MaterialCommunityIcons name="shield-lock-outline" size={30} color={NAVY} />
      </View>
      <Text style={styles.title}>Before you start</Text>
      {POINTS.map((point) => (
        <View key={point} style={styles.point}>
          <View style={styles.dot} />
          <Text style={styles.pointText}>{point}</Text>
        </View>
      ))}
      <Text style={styles.small}>
        The results are guidance, not a final decision. Always confirm a job with the company directly.
      </Text>

      <Pressable
        onPress={onAccept}
        accessibilityRole="button"
        style={({ pressed }) => [styles.primary, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.primaryText}>I understand</Text>
      </Pressable>
      <Pressable onPress={onDecline} accessibilityRole="button" hitSlop={8} style={styles.secondary}>
        <Text style={styles.secondaryText}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#EEF0FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: NAVY,
    marginBottom: 14,
  },
  point: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: NAVY,
    marginTop: 8,
  },
  pointText: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#111827',
  },
  small: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: MUTED,
    marginTop: 4,
  },
  primary: {
    marginTop: 24,
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondary: {
    marginTop: 14,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: MUTED,
  },
});
