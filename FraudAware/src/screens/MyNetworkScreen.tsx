import React from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';

export default function MyNetworkScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <Header />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Add your My Network content here */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
});
