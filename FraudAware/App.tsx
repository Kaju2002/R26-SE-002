import { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import OnboardingScreen from './src/user_screen/OnboardingScreen';
import LoginScreen from './src/user_screen/LoginScreen';
import RegisterScreen from './src/user_screen/RegisterScreen';
import VerificationScreen from './src/user_screen/VerificationScreen';
import RegistrationSuccessScreen from './src/user_screen/RegistrationSuccessScreen';
import ForgotPasswordScreen from './src/user_screen/ForgotPasswordScreen';
import CodeSentScreen from './src/user_screen/CodeSentScreen';
import NewPasswordScreen from './src/user_screen/NewPasswordScreen';
import PasswordUpdatedScreen from './src/user_screen/PasswordUpdatedScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import EditWorkExperienceScreen from './src/screens/EditWorkExperienceScreen';
import EditEducationScreen from './src/screens/EditEducationScreen';
import EditLanguageScreen from './src/screens/EditLanguageScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import JobDetailsScreen from './src/screens/JobDetailsScreen';
import RecruiterProfileScreen from './src/screens/RecruiterProfileScreen';
import ApplyJobScreen from './src/screens/ApplyJobScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import { BookmarksProvider } from './src/context/BookmarksContext';
import { UserProvider } from './src/context/UserContext';
import { ProfileProvider } from './src/context/ProfileContext';
import { InchatProvider, useInchat } from './src/context/InchatContext';
import InchatNotificationBanner from './src/components/inchat/InchatNotificationBanner';
import PushNotificationBootstrap from './src/notifications/PushNotificationBootstrap';

import type { RootStackParamList } from './src/navigation/rootStackParams';

import SafeJobRecommendationsScreen from './src/screens/screens/SafeJobRecommendationsScreen';

export type { RootStackParamList };

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function InchatBannerHost({
  activeThreadId,
}: {
  activeThreadId: string | undefined;
}) {
  const { incomingNotification, dismissIncomingNotification } = useInchat();

  useEffect(() => {
    if (
      incomingNotification &&
      activeThreadId === incomingNotification.threadId
    ) {
      dismissIncomingNotification();
    }
  }, [
    activeThreadId,
    dismissIncomingNotification,
    incomingNotification,
  ]);

  // The open thread already displays the incoming message in real time.
  if (
    !incomingNotification ||
    activeThreadId === incomingNotification.threadId
  ) {
    return null;
  }

  const openThread = () => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate(
      'MainTabs',
      {
        screen: 'Chat',
        params: {
          screen: 'InchatThread',
          params: { threadId: incomingNotification.threadId },
        },
      } as never
    );
  };

  return (
    <InchatNotificationBanner
      key={incomingNotification.id}
      notification={incomingNotification}
      onOpen={openThread}
      onDismiss={dismissIncomingNotification}
    />
  );
}

export default function App() {
  const [activeThreadId, setActiveThreadId] = useState<string>();

  const syncActiveThread = useCallback(() => {
    const route = navigationRef.getCurrentRoute();
    setActiveThreadId(
      String(route?.name) === 'InchatThread'
        ? (route?.params as { threadId?: string } | undefined)?.threadId
        : undefined
    );
  }, []);

  return (
    <SafeAreaProvider>
      <UserProvider>
        <ProfileProvider>
        <BookmarksProvider>
          <InchatProvider>
          <NavigationContainer
            ref={navigationRef}
            onReady={syncActiveThread}
            onStateChange={syncActiveThread}
          >
          <Stack.Navigator
            initialRouteName="Onboarding"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen
              name="Onboarding"
              options={{ gestureEnabled: false }}
            >
              {({ navigation }) => (
                <OnboardingScreen
                  onContinue={() => navigation.replace('Login')}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ gestureEnabled: false }}
            />

            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ gestureEnabled: false }}
            />

            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
            />

            <Stack.Screen
              name="CodeSent"
              component={CodeSentScreen}
              options={{
                gestureEnabled: false,
                animation: 'fade',
                contentStyle: { backgroundColor: '#FFFFFF' },
              }}
            />

            <Stack.Screen
              name="Verification"
              component={VerificationScreen}
              options={{ gestureEnabled: false }}
            />

            <Stack.Screen
              name="RegistrationSuccess"
              component={RegistrationSuccessScreen}
              options={{
                gestureEnabled: false,
                animation: 'fade',
                contentStyle: { backgroundColor: '#FFFFFF' },
              }}
            />

            <Stack.Screen
              name="NewPassword"
              component={NewPasswordScreen}
            />

            <Stack.Screen
              name="PasswordUpdated"
              component={PasswordUpdatedScreen}
              options={{
                gestureEnabled: false,
                animation: 'fade',
                contentStyle: { backgroundColor: '#FFFFFF' },
              }}
            />

            <Stack.Screen
              name="MainTabs"
              component={BottomTabNavigator}
            />

            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
            />

            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
            />

            <Stack.Screen
              name="EditWorkExperience"
              component={EditWorkExperienceScreen}
            />

            <Stack.Screen
              name="EditEducation"
              component={EditEducationScreen}
            />

            <Stack.Screen
              name="EditLanguage"
              component={EditLanguageScreen}
            />

            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
            />

            <Stack.Screen
              name="Bookmarks"
              component={BookmarksScreen}
              options={{ animation: 'slide_from_right' }}
            />

            <Stack.Screen
              name="JobDetails"
              component={JobDetailsScreen}
              options={{
                animation: 'slide_from_right',
                gestureEnabled: false,
              }}
            />

            <Stack.Screen
              name="RecruiterProfile"
              component={RecruiterProfileScreen}
              options={{ animation: 'slide_from_right' }}
            />

            <Stack.Screen
              name="ApplyJob"
              component={ApplyJobScreen}
              options={{ animation: 'slide_from_right' }}
            />

            {/* Chethya's screen */}
            <Stack.Screen
              name="SafeJobRecommendations"
              component={SafeJobRecommendationsScreen}
            />
          </Stack.Navigator>

          <StatusBar style="auto" />
          </NavigationContainer>
          <InchatBannerHost activeThreadId={activeThreadId} />
          <PushNotificationBootstrap navigationRef={navigationRef} />
          </InchatProvider>
        </BookmarksProvider>
        </ProfileProvider>
      </UserProvider>
    </SafeAreaProvider>
  );
}