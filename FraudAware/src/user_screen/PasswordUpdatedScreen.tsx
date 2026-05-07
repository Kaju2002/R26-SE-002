import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
} from '@expo-google-fonts/poppins';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const TITLE_GREEN = '#235C04';
const SUBTITLE_GREEN = '#449C0A';
const RING_LIGHT = '#D6FC92';
const RING_MID = '#A8E26B';
const DISC_GREEN = '#5BB417';
const CONTINUE_NAVY = '#202871';

const FONT = {
  poppinsReg: 'Poppins_400Regular',
  poppinsMed: 'Poppins_500Medium',
} as const;

const ANIM_IN_MS = 320;
const ANIM_OUT_MS = 220;

type RootParamList = {
  PasswordUpdated: undefined;
  Login: undefined;
};

type Props = NativeStackScreenProps<RootParamList, 'PasswordUpdated'>;

export default function PasswordUpdatedScreen({ navigation }: Props) {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const translateY = useRef(new Animated.Value(600)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: ANIM_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: ANIM_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [translateY, backdropOpacity]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const onContinue = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 600,
        duration: ANIM_OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: ANIM_OUT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' as const }],
        })
      );
    });
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.fontSplash}>
        <ActivityIndicator color={CONTINUE_NAVY} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View
        pointerEvents="auto"
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} />
      </Animated.View>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <SafeAreaView edges={['bottom']} style={styles.sheetSafe}>
          <View style={styles.handle} />

          <View style={styles.iconWrap}>
            <View style={styles.ringOuter}>
              <View style={styles.ringMid}>
                <View style={styles.discInner}>
                  <View style={styles.checkBubble}>
                    <Image
                      source={require('../../assets/icons/Vector.png')}
                      style={styles.checkIcon}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                  </View>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.title}>Password Updated</Text>
          <Text style={styles.subtitle}>
            Your password has been reset.{'\n'}You can sign in with your new password.
          </Text>

          <TouchableOpacity
            style={styles.continueBtn}
            onPress={onContinue}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Text style={styles.continueBtnText}>Continue</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const RING_OUTER_SIZE = 152;
const RING_MID_SIZE = 116;
const DISC_INNER_SIZE = 86;
const CHECK_BUBBLE_SIZE = 50;

const styles = StyleSheet.create({
  fontSplash: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#FFFFFF',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 15, 30, 0.18)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 18,
    elevation: 24,
  },
  sheetSafe: {
    paddingBottom: 8,
    alignItems: 'center',
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D9DBE3',
    marginBottom: 18,
  },
  iconWrap: {
    marginTop: 4,
    marginBottom: 22,
  },
  ringOuter: {
    width: RING_OUTER_SIZE,
    height: RING_OUTER_SIZE,
    borderRadius: RING_OUTER_SIZE / 2,
    backgroundColor: RING_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringMid: {
    width: RING_MID_SIZE,
    height: RING_MID_SIZE,
    borderRadius: RING_MID_SIZE / 2,
    backgroundColor: RING_MID,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discInner: {
    width: DISC_INNER_SIZE,
    height: DISC_INNER_SIZE,
    borderRadius: DISC_INNER_SIZE / 2,
    backgroundColor: DISC_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBubble: {
    width: CHECK_BUBBLE_SIZE,
    height: CHECK_BUBBLE_SIZE,
    borderRadius: CHECK_BUBBLE_SIZE / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    width: 24,
    height: 24,
    tintColor: DISC_GREEN,
  },
  title: {
    fontFamily: FONT.poppinsMed,
    fontSize: 20,
    color: TITLE_GREEN,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: FONT.poppinsReg,
    fontSize: 14,
    lineHeight: 20,
    color: SUBTITLE_GREEN,
    textAlign: 'center',
    marginBottom: 26,
  },
  continueBtn: {
    alignSelf: 'stretch',
    backgroundColor: CONTINUE_NAVY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  continueBtnText: {
    fontFamily: FONT.poppinsMed,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
