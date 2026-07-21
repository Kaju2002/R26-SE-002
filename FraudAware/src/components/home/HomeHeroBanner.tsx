import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const NAVY = '#202871';
const NAVY_DEEP = '#12184A';

type Props = {
  onPress: () => void;
  onDismiss?: () => void;
};

/** Compact navy hero — real Safer jobs CTA, no stock photo. */
export default function HomeHeroBanner({ onPress, onDismiss }: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[NAVY, NAVY_DEEP]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.wave} />
        <View style={styles.waveSoft} />

        {onDismiss && (
          <Pressable
            onPress={onDismiss}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Dismiss banner"
            style={({ pressed }) => [
              styles.dismissBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="close" size={16} color="rgba(255,255,255,0.85)" />
          </Pressable>
        )}

        <View style={styles.copy}>
          <Text style={styles.title}>
            Find safer jobs{'\n'}that fit you
          </Text>
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Browse safer jobs"
            style={({ pressed }) => [
              styles.cta,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.ctaText}>Safer jobs</Text>
          </Pressable>
        </View>

        <View style={styles.logoWrap}>
          <Image
            source={require('../../../assets/icons/Group1.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  banner: {
    borderRadius: 16,
    minHeight: 132,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 12,
    paddingVertical: 16,
  },
  dismissBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wave: {
    position: 'absolute',
    right: -30,
    top: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  waveSoft: {
    position: 'absolute',
    right: 40,
    bottom: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
    zIndex: 1,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 17,
    lineHeight: 24,
    color: '#FFFFFF',
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: NAVY,
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logo: {
    width: 44,
    height: 44,
  },
});
