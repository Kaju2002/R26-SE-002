import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useNavigation,
  type NavigationProp,
} from '@react-navigation/native';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
} from '@expo-google-fonts/poppins';
import NotificationsHeader from '../components/notification/NotificationsHeader';
import { createSupportTicket } from '../api/supportApi';
import { useUser } from '../context/UserContext';
import type { RootStackParamList } from '../navigation/rootStackParams';

const NAVY = '#202871';
const MUTED = '#5B6473';
const BORDER = '#E5E7EE';

export default function SupportCreateTicketScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { token } = useUser();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
  });

  const handleSubmit = async () => {
    const trimmedSubject = subject.trim();
    const trimmedDescription = description.trim();

    if (!trimmedSubject || !trimmedDescription) {
      Alert.alert('Missing details', 'Subject and description are required.');
      return;
    }

    if (!token) {
      Alert.alert('Sign in required', 'Please sign in to contact support.');
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await createSupportTicket(token, {
        subject: trimmedSubject,
        description: trimmedDescription,
      });
      navigation.replace('SupportTicketDetail', { ticketId: ticket.id });
    } catch (err) {
      Alert.alert(
        'Could not create ticket',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <NotificationsHeader
        title="New ticket"
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Subject</Text>
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder="Brief summary of your issue"
            placeholderTextColor="#9CA3AF"
            maxLength={200}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tell us what happened and how we can help"
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
            maxLength={8000}
          />

          <Text style={styles.hint}>
            Our support team usually replies within one business day.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              (pressed || submitting) && { opacity: 0.85 },
            ]}
            onPress={() => void handleSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitText}>Submit ticket</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: NAVY,
  },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 140,
  },
  hint: {
    marginTop: 12,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: MUTED,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  submitBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
