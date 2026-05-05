import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

type OnboardingScreenProps = {
  onContinue: () => void;
};

export default function OnboardingScreen({ onContinue }: OnboardingScreenProps) {
  return (
    <Pressable style={styles.container} onPress={onContinue}>
      <StatusBar hidden />
      <Image
        source={require('../../assets/icons/Onboarding.png')}
        style={styles.image}
        resizeMode="stretch"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060C36',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
