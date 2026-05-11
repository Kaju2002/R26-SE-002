import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import PostJobForm from '../components/post/PostJobForm';
import { POST_JOB } from '../components/post/postJobTheme';

export default function PostTabScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Header />
      <View style={styles.body}>
        <PostJobForm />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: POST_JOB.pageBg,
  },
  body: {
    flex: 1,
  },
});
