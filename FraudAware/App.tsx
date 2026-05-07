import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
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
import NotificationsScreen from './src/screens/NotificationsScreen';
import JobDetailsScreen from './src/screens/JobDetailsScreen';
import ApplyJobScreen from './src/screens/ApplyJobScreen';
import BookmarksScreen from './src/screens/BookmarksScreen';
import { BookmarksProvider } from './src/context/BookmarksContext';

import type { RootStackParamList } from './src/navigation/rootStackParams';

export type { RootStackParamList };

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <BookmarksProvider>
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Onboarding"
            screenOptions={{ headerShown: false }}
          >
          <Stack.Screen
            name="Onboarding"
            options={{ gestureEnabled: false }}
          >
            {({ navigation }) => (
              <OnboardingScreen onContinue={() => navigation.replace('Login')} />
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
          <Stack.Screen name="NewPassword" component={NewPasswordScreen} />
          <Stack.Screen
            name="PasswordUpdated"
            component={PasswordUpdatedScreen}
            options={{
              gestureEnabled: false,
              animation: 'fade',
              contentStyle: { backgroundColor: '#FFFFFF' },
            }}
          />
          <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
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
              options={{ animation: 'slide_from_right', gestureEnabled: false }}
            />
            <Stack.Screen
              name="ApplyJob"
              component={ApplyJobScreen}
              options={{ animation: 'slide_from_right' }}
            />
          </Stack.Navigator>
          <StatusBar style="auto" />
        </NavigationContainer>
      </BookmarksProvider>
    </SafeAreaProvider>
  );
}
