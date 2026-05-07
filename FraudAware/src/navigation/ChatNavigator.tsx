import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { ChatStackParamList } from './chatStackTypes';
import InchatInboxScreen from '../screens/InchatInboxScreen';
import InchatThreadScreen from '../screens/InchatThreadScreen';

export type { ChatStackParamList };

const Stack = createNativeStackNavigator<ChatStackParamList>();

export default function ChatNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InchatInbox" component={InchatInboxScreen} />
      <Stack.Screen name="InchatThread" component={InchatThreadScreen} />
    </Stack.Navigator>
  );
}
