import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Poppins_500Medium, Poppins_600SemiBold } from '@expo-google-fonts/poppins';
import { useUser } from '../context/UserContext';
import { getOnboardingSeen } from '../utils/onboardingStorage';

const LAUNCH_BG = '#060C36';
const MIN_ANIM_MS = 1600;

export type LaunchDestination = 'MainTabs' | 'Onboarding' | 'Login';

type Props = {
  onFinish: (destination: LaunchDestination) => void;
};

export default function LaunchScreen({ onFinish }: Props) {
  const { isInitializing, isAuthenticated } = useUser();
  const [fontsLoaded] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.7)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(12)).current;
  const finishedRef = useRef(false);

  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const reduceMotion = await AccessibilityInfo.isReduceMotionEnabled();
      if (cancelled) return;

      if (reduceMotion) {
        logoOpacity.setValue(1);
        logoScale.setValue(1);
        ringOpacity.setValue(0.35);
        ringScale.setValue(1);
        textOpacity.setValue(1);
        textTranslate.setValue(0);
        return;
      }

      Animated.sequence([
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 520,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            friction: 7,
            tension: 60,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.45,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(ringScale, {
            toValue: 1,
            duration: 700,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(textTranslate, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(ringOpacity, {
            toValue: 0.2,
            duration: 420,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0.4,
            duration: 420,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [logoOpacity, logoScale, ringOpacity, ringScale, textOpacity, textTranslate]);

  useEffect(() => {
    if (!fontsLoaded || isInitializing || finishedRef.current) return;

    let cancelled = false;

    const finish = async () => {
      await new Promise((resolve) => setTimeout(resolve, MIN_ANIM_MS));
      if (cancelled || finishedRef.current) return;
      finishedRef.current = true;

      if (isAuthenticated) {
        onFinish('MainTabs');
        return;
      }

      const seen = await getOnboardingSeen();
      if (cancelled) return;
      onFinish(seen ? 'Login' : 'Onboarding');
    };

    void finish();
    return () => {
      cancelled = true;
    };
  }, [fontsLoaded, isAuthenticated, isInitializing, onFinish]);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          styles.ring,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
          alignItems: 'center',
        }}
      >
        <Image
          source={require('../../assets/icons/Group1.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="CareerNet logo"
        />
      </Animated.View>
      <Animated.View
        style={{
          opacity: textOpacity,
          transform: [{ translateY: textTranslate }],
          alignItems: 'center',
          marginTop: 20,
        }}
      >
        <Text style={styles.title}>CareerNet</Text>
        <Text style={styles.tagline}>Safer careers. Smarter checks.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LAUNCH_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    borderWidth: 2,
    borderColor: 'rgba(131, 139, 210, 0.55)',
  },
  logo: {
    width: 96,
    height: 96,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 26,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  tagline: {
    marginTop: 8,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
  },
});
