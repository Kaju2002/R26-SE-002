import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/**
 * Open Message Analyzer from either Detect stack (same navigator) or Chat tab (switch to Detect tab).
 */
export function navigateToMessageAnalyzer(navigation: NavigationProp<ParamListBase>): void {
  const routeNames = navigation.getState()?.routeNames ?? [];
  if (routeNames.includes('MessageAnalyzer')) {
    navigation.navigate('MessageAnalyzer');
    return;
  }
  const tabNav = navigation.getParent();
  if (tabNav) {
    (tabNav as NavigationProp<ParamListBase>).navigate(
      'Detect',
      { screen: 'MessageAnalyzer' },
    );
  }
}
