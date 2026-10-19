import React from 'react';
import { Image, StyleSheet, View, Text } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import AssistantScreen from '../screens/AssistantScreen';
import ApplicationsScreen from '../screens/ApplicationsScreen';
import ChatNavigator from './ChatNavigator';
import JobsScreen from '../screens/JobsScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ChatIcon from '../components/icons/ChatIcon';
import { useInchat } from '../context/InchatContext';

const Tab = createBottomTabNavigator();

/** Icon row height. The phone's bottom inset is added under this, not inside it. */
const TAB_CONTENT_HEIGHT = 62;

/** Full-screen chat thread — hide tab bar like WhatsApp/iMessage. */
const HIDDEN_TAB_BAR = { display: 'none' as const, height: 0 };

const NotificationBadge = ({ count }: { count?: number }) => {
  if (!count || count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const { threadsForList } = useInchat();
  const unreadChatCount = threadsForList.reduce(
    (total, thread) => total + thread.unreadCount,
    0
  );
  const tabBarStyle = [
    styles.tabBar,
    { height: TAB_CONTENT_HEIGHT + insets.bottom, paddingBottom: insets.bottom },
  ];

  return (
      <Tab.Navigator
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          headerShown: false,
          tabBarStyle,
          tabBarActiveTintColor: '#202871',
          tabBarInactiveTintColor: '#798AA3',
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarIconStyle: styles.tabBarIcon,
        }}
      >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('../../assets/icons/home.png')}
              style={[
                styles.icon,
                { tintColor: color },
              ]}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Detect"
        component={AssistantScreen}
        options={{
          // Detect screens stay in DetectNavigator. Restore this tab by setting
          // component back to DetectNavigator and the label to Detect.
          tabBarLabel: 'Check',
          tabBarIconStyle: styles.checkIconSlot,
          tabBarIcon: ({ color }) => (
            <Image
              source={require('../../assets/icons/robot-happy-outline.png')}
              style={[styles.checkIcon, { tintColor: color }]}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Applications"
        component={ApplicationsScreen}
        options={{
          tabBarLabel: 'Applied',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('../../assets/icons/plus.png')}
              style={[
                styles.icon,
                { tintColor: color },
              ]}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatNavigator}
        options={({ route }) => {
          const nested = getFocusedRouteNameFromRoute(route) ?? 'InchatInbox';
          const hideTabBar = nested === 'InchatThread';
          return {
            tabBarLabel: 'Chat',
            tabBarIcon: ({ color }) => (
              <View style={styles.iconContainer}>
                <ChatIcon size={24} color={color} />
                <NotificationBadge count={unreadChatCount} />
              </View>
            ),
            tabBarStyle: hideTabBar ? HIDDEN_TAB_BAR : tabBarStyle,
          };
        }}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsScreen}
        options={{
          tabBarLabel: 'Jobs',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('../../assets/icons/jobs.png')}
              style={[
                styles.icon,
                { tintColor: color },
              ]}
            />
          ),
        }}
      />
      </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#E8E8E8',
    borderTopWidth: 1,
    paddingTop: 4,
    paddingHorizontal: 0,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    color: '#798AA3',
  },
  tabBarIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  checkIconSlot: {
    width: 26,
    height: 26,
    paddingVertical: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
  },
  iconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E63946',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
