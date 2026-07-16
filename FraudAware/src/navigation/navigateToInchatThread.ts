import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/**
 * Open an InChat thread from Jobs tab or a root stack screen (JobDetails, etc.).
 */
export function navigateToInchatThread(
  navigation: NavigationProp<ParamListBase>,
  threadId: string
): void {
  const state = navigation.getState();
  const routeNames = state?.routeNames ?? [];

  // Already inside the Chat stack
  if (routeNames.includes('InchatThread')) {
    navigation.navigate('InchatThread', { threadId });
    return;
  }

  // Inside MainTabs (e.g. Jobs tab)
  if (routeNames.includes('Chat')) {
    navigation.navigate('Chat', {
      screen: 'InchatThread',
      params: { threadId },
    });
    return;
  }

  // Root stack → MainTabs → Chat
  const parent = navigation.getParent();
  if (parent) {
    (parent as NavigationProp<ParamListBase>).navigate('MainTabs', {
      screen: 'Chat',
      params: {
        screen: 'InchatThread',
        params: { threadId },
      },
    });
    return;
  }

  navigation.navigate('MainTabs', {
    screen: 'Chat',
    params: {
      screen: 'InchatThread',
      params: { threadId },
    },
  });
}
