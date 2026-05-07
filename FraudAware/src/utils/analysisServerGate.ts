import { Alert } from 'react-native';
import { fetchHealth } from '../api/fraudawareApi';

/** Shared health check before classify flows — alerts user when unreachable / cold model. */
export async function promptAnalysisServerReady(): Promise<boolean> {
  const h = await fetchHealth();
  if (!h.ok) {
    Alert.alert(
      'Server unavailable',
      'Could not reach the analysis server. Check your network and that the API is running.'
    );
    return false;
  }
  if (!h.modelLoaded) {
    Alert.alert(
      'Server unavailable',
      'The detection model is not loaded on the server yet. Try again in a moment.'
    );
    return false;
  }
  return true;
}
