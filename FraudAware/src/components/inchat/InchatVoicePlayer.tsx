import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { INCHAT_MUTED, INCHAT_NAVY } from './inchatStyles';

type Props = {
  url: string;
  durationMs?: number;
  mine?: boolean;
  /** Real profile / company image for the sender of this voice note. */
  avatarUrl?: string | null;
  /** Initials fallback when no photo is available. */
  initials?: string;
};

/** Decorative bar heights for a WhatsApp-like waveform (stable per render). */
const WAVE_HEIGHTS = [
  6, 11, 8, 14, 9, 16, 7, 12, 15, 8, 17, 10, 13, 6, 15, 11, 14, 8, 16, 9, 13, 7, 12, 10, 15, 8, 16,
  10, 12, 11,
];

function formatMmSs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function iosFriendlyPlaybackUrls(rawUrl: string): string[] {
  const urls: string[] = [];
  const push = (value: string) => {
    if (value && !urls.includes(value)) urls.push(value);
  };

  const isCloudinary =
    /res\.cloudinary\.com\//i.test(rawUrl) && /\/upload\//i.test(rawUrl);

  if (isCloudinary) {
    push(rawUrl.replace(/\/upload\//i, '/upload/f_mp3/'));
    push(rawUrl.replace(/\/upload\//i, '/upload/f_m4a/'));
    push(rawUrl.replace(/\.(webm|ogg|wav)(\?.*)?$/i, '.mp3$2'));
    push(rawUrl.replace(/\.(webm|ogg|wav)(\?.*)?$/i, '.m4a$2'));
  }

  push(rawUrl);
  return urls;
}

export default function InchatVoicePlayer({
  url,
  durationMs = 0,
  mine = false,
  avatarUrl,
  initials,
}: Props) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [knownDuration, setKnownDuration] = useState(durationMs);
  const candidates = useMemo(() => iosFriendlyPlaybackUrls(url), [url]);
  const label = (initials || '?').slice(0, 2).toUpperCase();

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync().catch(() => undefined);
      soundRef.current = null;
    };
  }, []);

  useEffect(() => {
    void soundRef.current?.unloadAsync().catch(() => undefined);
    soundRef.current = null;
    setPlaying(false);
    setPositionMs(0);
    setKnownDuration(durationMs);
  }, [url, durationMs]);

  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPlaying(status.isPlaying);
    setPositionMs(status.positionMillis || 0);
    if (status.durationMillis) {
      setKnownDuration(status.durationMillis);
    }
    if (status.didJustFinish) {
      setPlaying(false);
      setPositionMs(0);
      void soundRef.current?.setPositionAsync(0);
    }
  }, []);

  const loadAndPlay = useCallback(async () => {
    setLoading(true);
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: candidate },
          { shouldPlay: true, progressUpdateIntervalMillis: 200 },
          onStatus
        );
        soundRef.current = sound;
        setPlaying(true);
        setLoading(false);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    setLoading(false);
    setPlaying(false);
    const detail =
      lastError instanceof Error ? lastError.message : 'Unsupported audio format on this device.';
    Alert.alert(
      'Could not play voice',
      Platform.OS === 'ios' ? `iPhone needs MP3/M4A. ${detail}` : detail
    );
  }, [candidates, onStatus]);

  const toggle = useCallback(async () => {
    try {
      if (!soundRef.current) {
        await loadAndPlay();
        return;
      }
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        soundRef.current = null;
        await loadAndPlay();
        return;
      }
      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        if ((status.positionMillis || 0) >= (status.durationMillis || 0) - 200) {
          await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
      }
    } catch (error) {
      setLoading(false);
      setPlaying(false);
      soundRef.current = null;
      Alert.alert(
        'Could not play voice',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  }, [loadAndPlay]);

  const labelMs =
    playing || positionMs > 0
      ? knownDuration > 0
        ? Math.max(0, knownDuration - positionMs)
        : positionMs
      : knownDuration;
  const progress =
    knownDuration > 0 ? Math.min(1, Math.max(0, positionMs / knownDuration)) : 0;
  const activeBars = Math.round(progress * WAVE_HEIGHTS.length);

  const avatarBg = mine ? 'rgba(255,255,255,0.22)' : '#DDE3F5';
  const iconColor = mine ? '#fff' : INCHAT_NAVY;
  const barIdle = mine ? 'rgba(255,255,255,0.35)' : '#C5CAD8';
  const barActive = mine ? '#fff' : INCHAT_NAVY;
  const durationColor = mine ? 'rgba(255,255,255,0.88)' : INCHAT_MUTED;
  const initialsColor = mine ? '#fff' : INCHAT_NAVY;

  return (
    <View style={styles.wrap}>
      <View style={styles.avatarCol}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarInitials, { color: initialsColor }]}>{label}</Text>
          )}
        </View>
        <View style={[styles.micBadge, mine ? styles.micBadgeMine : styles.micBadgeTheirs]}>
          <MaterialCommunityIcons name="microphone" size={9} color="#fff" />
        </View>
      </View>

      <Pressable
        style={styles.playBtn}
        onPress={() => void toggle()}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause voice message' : 'Play voice message'}
        hitSlop={8}
      >
        {loading ? (
          <ActivityIndicator color={iconColor} size="small" />
        ) : (
          <MaterialCommunityIcons
            name={playing ? 'pause' : 'play'}
            size={24}
            color={iconColor}
          />
        )}
      </Pressable>

      <View style={styles.waveCol}>
        <View style={styles.waveRow}>
          {WAVE_HEIGHTS.map((height, index) => {
            const active = index <= activeBars;
            return (
              <View
                key={`w-${index}`}
                style={[
                  styles.waveBar,
                  {
                    height,
                    backgroundColor: active ? barActive : barIdle,
                  },
                ]}
              />
            );
          })}
          <View
            style={[
              styles.scrubber,
              mine ? styles.scrubberMine : styles.scrubberTheirs,
              {
                left: `${Math.min(96, Math.max(0, progress * 100))}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.duration, { color: durationColor }]}>{formatMmSs(labelMs)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 210,
    maxWidth: 250,
    paddingVertical: 0,
    paddingHorizontal: 2,
  },
  avatarCol: {
    width: 36,
    height: 36,
    marginRight: 2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 36,
    height: 36,
  },
  avatarInitials: {
    fontSize: 12,
    fontWeight: '700',
  },
  micBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  micBadgeMine: {
    backgroundColor: '#5B6CFF',
    borderColor: INCHAT_NAVY,
  },
  micBadgeTheirs: {
    backgroundColor: '#667085',
  },
  playBtn: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2,
  },
  waveRow: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
    position: 'relative',
  },
  waveBar: {
    width: 2,
    borderRadius: 1,
  },
  scrubber: {
    position: 'absolute',
    top: 5,
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scrubberMine: {
    backgroundColor: '#fff',
  },
  scrubberTheirs: {
    backgroundColor: '#1F2937',
  },
  duration: {
    marginTop: 0,
    fontSize: 11,
    fontWeight: '600',
  },
});
