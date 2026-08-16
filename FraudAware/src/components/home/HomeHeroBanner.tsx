import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const NAVY = '#202871';
const NAVY_DEEP = '#12184A';
// 🔍 JOB document + magnifying glass + briefcase — job analysis & verification
const HERO_IMAGE_URL =
  'https://kimi-web-img.kimi.ai/img/cdn3d.iconscout.com/7dbc787727be521144d1d47b275847626733eb26.png';

type Props = {
  onPress: () => void;
  onDismiss?: () => void;
  visible?: boolean;
};

export default function HomeHeroBanner({
  onPress,
  onDismiss,
  visible = true,
}: Props) {
  // ── Animation values ──
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslateY = useRef(new Animated.Value(24)).current;
  const bannerScale = useRef(new Animated.Value(0.95)).current;

  const titleLine1 = useRef(new Animated.Value(0)).current;
  const titleLine2 = useRef(new Animated.Value(0)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const ctaOpacity = useRef(new Animated.Value(0)).current;
  const ctaTranslateY = useRef(new Animated.Value(12)).current;

  const imageScale = useRef(new Animated.Value(0.75)).current;
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const imageRotate = useRef(new Animated.Value(-5)).current;
  const imageFloatY = useRef(new Animated.Value(0)).current;

  const orb1X = useRef(new Animated.Value(0)).current;
  const orb1Y = useRef(new Animated.Value(0)).current;
  const orb2X = useRef(new Animated.Value(0)).current;
  const orb2Y = useRef(new Animated.Value(0)).current;

  const shimmerX = useRef(new Animated.Value(-350)).current;
  const dismissOpacity = useRef(new Animated.Value(0)).current;

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.35)).current;

  const dismissAnim = useRef(new Animated.Value(1)).current;
  const dismissTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Banner entrance
    Animated.parallel([
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(bannerTranslateY, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(bannerScale, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();

    // Title stagger
    Animated.sequence([
      Animated.delay(180),
      Animated.timing(titleLine1, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.delay(90),
      Animated.timing(titleLine2, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();

    Animated.timing(badgeOpacity, {
      toValue: 1,
      duration: 400,
      delay: 120,
      useNativeDriver: true,
    }).start();

    Animated.timing(ctaOpacity, {
      toValue: 1,
      duration: 450,
      delay: 550,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
    Animated.timing(ctaTranslateY, {
      toValue: 0,
      duration: 450,
      delay: 550,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();

    // Hero image spring entrance
    Animated.parallel([
      Animated.spring(imageScale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        delay: 250,
        useNativeDriver: true,
      }),
      Animated.spring(imageRotate, {
        toValue: 0,
        friction: 5,
        tension: 100,
        delay: 250,
        useNativeDriver: true,
      }),
      Animated.timing(imageOpacity, {
        toValue: 1,
        duration: 600,
        delay: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Gentle float
    Animated.loop(
      Animated.sequence([
        Animated.timing(imageFloatY, {
          toValue: -6,
          duration: 2200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(imageFloatY, {
          toValue: 6,
          duration: 2200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    ).start();

    Animated.timing(dismissOpacity, {
      toValue: 1,
      duration: 300,
      delay: 500,
      useNativeDriver: true,
    }).start();

    // Orbs
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1X, {
          toValue: -12,
          duration: 4500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(orb1X, {
          toValue: 6,
          duration: 4500,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Y, {
          toValue: 18,
          duration: 5200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(orb1Y, {
          toValue: -12,
          duration: 5200,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2X, {
          toValue: -18,
          duration: 6000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
        Animated.timing(orb2X, {
          toValue: 0,
          duration: 6000,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.sin),
        }),
      ])
    ).start();

    // Shimmer
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerX, {
          toValue: 450,
          duration: 2800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.cubic),
        }),
        Animated.timing(shimmerX, {
          toValue: -350,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(2200),
      ])
    ).start();

    // Pulse ring
    Animated.loop(
      Animated.parallel([
        Animated.timing(pulseScale, {
          toValue: 1.7,
          duration: 2400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
        Animated.timing(pulseOpacity, {
          toValue: 0,
          duration: 2400,
          useNativeDriver: true,
          easing: Easing.out(Easing.cubic),
        }),
      ])
    ).start();
  }, [visible]);

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(dismissAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
      Animated.timing(dismissTranslateY, {
        toValue: -20,
        duration: 400,
        useNativeDriver: true,
        easing: Easing.in(Easing.cubic),
      }),
    ]).start(() => onDismiss?.());
  }, [onDismiss]);

  const title1Y = titleLine1.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
  const title2Y = titleLine2.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: dismissAnim,
          transform: [
            { translateY: dismissTranslateY },
            { scale: dismissAnim },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.banner,
          {
            opacity: bannerOpacity,
            transform: [
              { translateY: bannerTranslateY },
              { scale: bannerScale },
            ],
          },
        ]}
      >
        {/* Background orbs */}
        <Animated.View
          style={[
            styles.orb,
            styles.orb1,
            { transform: [{ translateX: orb1X }, { translateY: orb1Y }] },
          ]}
        />
        <Animated.View
          style={[
            styles.orb,
            styles.orb2,
            { transform: [{ translateX: orb2X }, { translateY: orb2Y }] },
          ]}
        />
        <View style={styles.orb3} />

        {/* Shimmer */}
        <Animated.View
          style={[
            styles.shimmer,
            { transform: [{ translateX: shimmerX }, { skewX: '-20deg' }] },
          ]}
        />

        {/* Dismiss */}
        {onDismiss && (
          <Animated.View
            style={[styles.dismissWrap, { opacity: dismissOpacity }]}
          >
            <Pressable
              onPress={handleDismiss}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Dismiss banner"
              style={({ pressed }) => [
                styles.dismissBtn,
                pressed && styles.dismissBtnPressed,
              ]}
            >
              <Ionicons
                name="close"
                size={15}
                color="rgba(255,255,255,0.9)"
              />
            </Pressable>
          </Animated.View>
        )}

        {/* Left: Copy */}
        <View style={styles.copy}>
          <Animated.View style={[styles.badge, { opacity: badgeOpacity }]}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>AI Verified</Text>
          </Animated.View>

          <View style={styles.titleWrap}>
            <Animated.Text
              style={[
                styles.title,
                { opacity: titleLine1, transform: [{ translateY: title1Y }] },
              ]}
            >
              Find safer jobs
            </Animated.Text>
            <Animated.Text
              style={[
                styles.title,
                { opacity: titleLine2, transform: [{ translateY: title2Y }] },
              ]}
            >
              that fit you
            </Animated.Text>
          </View>

          <Animated.View
            style={[
              styles.ctaWrap,
              { opacity: ctaOpacity, transform: [{ translateY: ctaTranslateY }] },
            ]}
          >
            <Pressable
              onPress={onPress}
              accessibilityRole="button"
              accessibilityLabel="Browse safer jobs"
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
              ]}
            >
              <Text style={styles.ctaText}>Safer jobs</Text>
              <Ionicons name="arrow-forward" size={14} color={NAVY} />
            </Pressable>
          </Animated.View>
        </View>

        {/* Right: Full-height Job Search Image */}
        <View style={styles.imageSection}>
          <View style={styles.imageGlow} />

          <Animated.View
            style={[
              styles.imagePulse,
              {
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />

          <Animated.Image
            source={{ uri: HERO_IMAGE_URL }}
            style={[
              styles.heroImage,
              {
                opacity: imageOpacity,
                transform: [
                  { scale: imageScale },
                  {
                    rotate: imageRotate.interpolate({
                      inputRange: [-5, 0],
                      outputRange: ['-5deg', '0deg'],
                    }),
                  },
                  { translateY: imageFloatY },
                ],
              },
            ]}
            resizeMode="contain"
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  banner: {
    borderRadius: 20,
    height: 172,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 22,
    backgroundColor: NAVY,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 10,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 140,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    zIndex: 1,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    right: -30,
    top: -40,
    width: 170,
    height: 170,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  orb2: {
    right: 50,
    bottom: -50,
    width: 130,
    height: 130,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  orb3: {
    position: 'absolute',
    left: '25%',
    top: -25,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(45,212,191,0.06)',
  },
  dismissWrap: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 20,
  },
  dismissBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dismissBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ scale: 0.9 }],
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
    zIndex: 5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  badgeText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  titleWrap: {
    overflow: 'hidden',
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    lineHeight: 29,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  ctaWrap: {
    alignSelf: 'flex-start',
    marginTop: 14,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
  },
  ctaPressed: {
    transform: [{ scale: 0.96 }],
    shadowOpacity: 0.1,
  },
  ctaText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: NAVY,
    letterSpacing: 0.2,
  },

  /* ── Right image section — full height ── */
  imageSection: {
    width: 150,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginRight: -8,
  },
  imageGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(59,130,246,0.08)', // soft blue glow matching the image
  },
  imagePulse: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroImage: {
    width: 155,
    height: 155,
    marginRight: 15,
  },
});