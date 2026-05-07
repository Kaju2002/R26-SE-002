import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { JOB_SEARCH_COLORS } from './jobSearchTheme';

export default function JobsEmptyState() {
  return (
    <View style={styles.container}>
      <Image
        source={require('../../../../assets/icons/undraw_void_-3-ggu.png')}
        style={styles.illustration}
        resizeMode="contain"
      />
      <Text style={styles.title}>Not found</Text>
      <Text style={styles.message}>
        Sorry, the keyword you entered could not be found. Please, try again
        with another keyword.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  illustration: {
    width: 180,
    height: 180,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    color: JOB_SEARCH_COLORS.primaryText,
    marginBottom: 4,
  },
  message: {
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    lineHeight: 22,
    color: JOB_SEARCH_COLORS.secondaryText,
  },
});
