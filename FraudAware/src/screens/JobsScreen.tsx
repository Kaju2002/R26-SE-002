import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function JobsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Jobs</Text>
      <Text style={styles.subtitle}>Find verified job opportunities</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#202871',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#798AA3',
  },
});
