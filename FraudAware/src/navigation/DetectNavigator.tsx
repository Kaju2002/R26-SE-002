import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DetectHomeScreen from '../screens/DetectHomeScreen';
import MessageAnalyzerScreen from '../screens/MessageAnalyzerScreen';
import JobPostScreen from '../screens/JobPostScreen';
import EmployerCheckScreen from '../screens/EmployerCheckScreen';
import ResultScreen from '../screens/ResultScreen';
import type { DetectStackParamList } from './detectStackTypes';

const Stack = createNativeStackNavigator<DetectStackParamList>();

export default function DetectNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="DetectHome" component={DetectHomeScreen} />
      <Stack.Screen
        name="MessageAnalyzer"
        component={MessageAnalyzerScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen name="JobPost" component={JobPostScreen} />
      <Stack.Screen name="EmployerCheckScreen" component={EmployerCheckScreen} />
      <Stack.Screen name="ResultScreen" component={ResultScreen} />
    </Stack.Navigator>
  );
}
