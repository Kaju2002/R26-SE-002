import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import ChatIcon from '../components/icons/ChatIcon';

const NAVY = '#202871';
const MUTED = '#8A93B0';

export default function ChatScreen() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const titleFont = fontsLoaded ? 'Poppins_600SemiBold' : undefined;
  const bodyFont = fontsLoaded ? 'Poppins_400Regular' : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { fontFamily: titleFont }]}>
          Chat
        </Text>
      </View>

      <View style={styles.empty}>
        <View style={styles.iconWrap}>
          <ChatIcon size={56} color={NAVY} />
        </View>
        <Text style={[styles.emptyTitle, { fontFamily: titleFont }]}>
          No messages yet
        </Text>
        <Text style={[styles.emptyBody, { fontFamily: bodyFont }]}>
          When recruiters reach out about your applications, your conversations
          will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    color: NAVY,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#EEF0F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 16,
    color: NAVY,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 19,
  },
});
