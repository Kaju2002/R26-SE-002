import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
} from '@expo-google-fonts/poppins';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { PROFILE } from '../../data/profile';
import EditProfileAvatarPicker from '../components/profile/EditProfileAvatarPicker';
import EditProfileField from '../components/profile/EditProfileField';

const NAVY = '#202871';

export default function EditProfileScreen() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
  });

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [fullName, setFullName] = useState(PROFILE.fullName);
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [currentPosition, setCurrentPosition] = useState(PROFILE.role);
  const [company, setCompany] = useState('');

  if (!fontsLoaded) {
    return (
      <View style={styles.fontSplash}>
        <ActivityIndicator color={NAVY} size="large" />
      </View>
    );
  }

  const onSave = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [
            styles.backBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons name="chevron-back" size={26} color={NAVY} />
        </Pressable>
        <Text style={styles.title}>Edit profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarBlock}>
            <EditProfileAvatarPicker avatar={PROFILE.avatar} />
          </View>

          <EditProfileField
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="John Doe"
            autoCapitalize="words"
          />
          <EditProfileField
            label="Date of Birth"
            value={dob}
            onChangeText={setDob}
            placeholder="02/02/2000"
            keyboardType="numbers-and-punctuation"
            trailingIcon="calendar"
          />
          <EditProfileField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <EditProfileField
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="020 242 3434"
            keyboardType="phone-pad"
          />
          <EditProfileField
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="Accra"
            autoCapitalize="words"
          />
          <EditProfileField
            label="Current Position"
            value={currentPosition}
            onChangeText={setCurrentPosition}
            placeholder="UI/UX Designer"
            autoCapitalize="words"
          />
          <EditProfileField
            label="Company"
            value={company}
            onChangeText={setCompany}
            placeholder="Google LLC"
            autoCapitalize="words"
          />

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={onSave}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fontSplash: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** "Edit profile" — Poppins Medium 18 · #202871 */
  title: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    color: NAVY,
    flex: 1,
    textAlign: 'left',
    marginLeft: 4,
  },
  headerSpacer: {
    width: 32,
    height: 32,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 36,
  },
  avatarBlock: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 26,
  },
  saveBtn: {
    marginTop: 14,
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  /** Save — Poppins Regular 16 · white */
  saveBtnText: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
