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

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  CodeSent: { email?: string } | undefined;
  Verification: { email?: string; flow: 'register' | 'reset' } | undefined;
  RegistrationSuccess: undefined;
  NewPassword: { email?: string } | undefined;
  PasswordUpdated: undefined;
  MainTabs: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
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
        </Stack.Navigator>
        <StatusBar style="auto" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
