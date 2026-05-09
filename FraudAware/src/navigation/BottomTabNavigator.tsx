import React from 'react';
import { Image, StyleSheet, View, Text } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import DetectNavigator from './DetectNavigator';
import MyNetworkScreen from '../screens/MyNetworkScreen';
import PostTabScreen from './PostTabScreen';
import ChatNavigator from './ChatNavigator';
import JobsScreen from '../screens/JobsScreen';
import ChatIcon from '../components/icons/ChatIcon';
import { InchatProvider } from '../context/InchatContext';

const Tab = createBottomTabNavigator();

/** Full-screen chat thread — hide tab bar like WhatsApp/iMessage. */
const HIDDEN_TAB_BAR = { display: 'none' as const, height: 0 };

const NotificationBadge = ({ count }: { count?: number }) => {
  if (!count || count === 0) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count}</Text>
    </View>
  );
};

export default function BottomTabNavigator() {
  const unreadChatCount = 4;

  return (
    <InchatProvider>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
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
        component={DetectNavigator}
        options={{
          tabBarLabel: 'Detect',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('../../assets/icons/mynetwork.png')}
              style={[
                styles.icon,
                { tintColor: color },
              ]}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Post"
        component={PostTabScreen}
        options={{
          tabBarLabel: 'Post',
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
            tabBarStyle: hideTabBar ? HIDDEN_TAB_BAR : styles.tabBar,
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
    </InchatProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopColor: '#E8E8E8',
    borderTopWidth: 1,
    height: 68,
    paddingBottom: 6,
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
    width: 20,
    height: 20,
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
