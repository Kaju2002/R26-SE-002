import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export default function JobsLoadingState() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../../../assets/icons/Loader.png')}
        style={styles.loader}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    width: 64,
    height: 64,
  },
});
