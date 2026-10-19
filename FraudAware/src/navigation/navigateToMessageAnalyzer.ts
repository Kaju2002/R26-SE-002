import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/**
 * Open Message Analyzer from the Detect stack, or from Chat via the root DetectTools screen.
 */
export function navigateToMessageAnalyzer(navigation: NavigationProp<ParamListBase>): void {
  let current: NavigationProp<ParamListBase> | undefined = navigation;
  while (current) {
    const routeNames = current.getState()?.routeNames ?? [];
    if (routeNames.includes('MessageAnalyzer')) {
      current.navigate('MessageAnalyzer');
      return;
    }
    if (routeNames.includes('DetectTools')) {
      current.navigate('DetectTools', { screen: 'MessageAnalyzer' });
      return;
    }
    current = current.getParent();
  }
}
