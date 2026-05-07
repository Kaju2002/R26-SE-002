import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const MUTED = '#858BBD';

export default function HomeTrustTagline() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.line}>
        AI checks jobs, employers, and messages before you trust them.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 2,
  },
  line: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: MUTED,
    textAlign: 'center',
  },
});
