import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DetectHomeScreen from '../screens/DetectHomeScreen';
import MessageAnalyzerScreen from '../screens/MessageAnalyzerScreen';
import JobPostScreen from '../screens/JobPostScreen';
import EmployerCheckScreen from '../screens/EmployerCheckScreen';

const Stack = createNativeStackNavigator();

export default function DetectNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="DetectHome" component={DetectHomeScreen} />
      <Stack.Screen name="MessageAnalyzer" component={MessageAnalyzerScreen} />
      <Stack.Screen name="JobPost" component={JobPostScreen} />
      <Stack.Screen name="EmployerCheckScreen" component={EmployerCheckScreen} />
    </Stack.Navigator>
  );
}
