import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Fingerprint, ScanFace } from 'lucide-react-native';
import { AppLogo } from '@/components/ui/AppLogo';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  authenticate,
  biometricsEnabled,
  getBiometricKind,
  setBiometricsEnabled,
  type BiometricKind,
} from '@/services/biometrics';
import { hapticTap } from '@/lib/haptics';
import { API_BASE_URL } from '@/lib/apiUrl';
import { getApiErrorMessage } from '@/lib/apiErrors';

export default function LoginScreen() {
  const { login, biometricLocked, unlockWithBiometrics } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bioKind, setBioKind] = useState<BiometricKind>(null);

  useEffect(() => {
    void getBiometricKind().then(setBioKind);
  }, []);

  // A stored session gated by biometrics lands here — prompt immediately.
  useEffect(() => {
    if (biometricLocked) void unlockWithBiometrics();
  }, [biometricLocked, unlockWithBiometrics]);

  const maybeOfferBiometrics = () => {
    if (!bioKind || biometricsEnabled()) return;
    const label = bioKind === 'face' ? 'Face ID' : 'fingerprint';
    Alert.alert(`Enable ${label}?`, `Unlock YounesAI instantly with your ${label} next time.`, [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Enable',
        onPress: () => {
          void authenticate(`Confirm your ${label}`).then((ok) => {
            if (ok) setBiometricsEnabled(true);
          });
        },
      },
    ]);
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      maybeOfferBiometrics();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Sign in failed.'));
    } finally {
      setBusy(false);
    }
  };

  const BioIcon = bioKind === 'face' ? ScanFace : Fingerprint;
  const bioLabel = bioKind === 'face' ? 'Face ID' : 'fingerprint';

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-canvas">
      <View className="flex-1 justify-center px-8">
        <Animated.View entering={FadeInDown.duration(400)} className="mb-8 items-center">
          <AppLogo size={80} rounded={28} />
          <Text className="mt-4 text-3xl font-bold text-ink">Welcome back</Text>
          <Text className="mt-1 text-ink-soft">Your AI productivity hub awaits</Text>
        </Animated.View>

        {biometricLocked && bioKind ? (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="items-center">
            <Pressable
              onPress={() => {
                hapticTap();
                void unlockWithBiometrics();
              }}
              className="h-20 w-20 items-center justify-center rounded-full bg-accent-soft"
              accessibilityLabel={`Unlock with ${bioLabel}`}
            >
              <BioIcon size={36} color="#6366F1" />
            </Pressable>
            <Text className="mt-3 text-sm font-medium text-ink-soft">
              Tap to unlock with {bioLabel}
            </Text>
            <View className="my-6 w-full flex-row items-center gap-3">
              <View className="h-px flex-1 bg-glass-border" />
              <Text className="text-xs text-ink-faint">or sign in with password</Text>
              <View className="h-px flex-1 bg-glass-border" />
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(150).duration(400)} className="gap-3">
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            keyboardType="email-address"
            className="rounded-2xl border border-glass-border bg-white px-4 py-3.5 text-ink"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            className="rounded-2xl border border-glass-border bg-white px-4 py-3.5 text-ink"
          />
        </Animated.View>

        {error ? <Text className="mt-3 text-center text-sm text-accent-rose">{error}</Text> : null}

        <Animated.View entering={FadeInDown.delay(250).duration(400)}>
          <Pressable
            onPress={submit}
            disabled={busy || !email || !password}
            className={`mt-6 items-center rounded-2xl py-4 ${
              busy || !email || !password ? 'bg-accent/40' : 'bg-accent'
            }`}
          >
            <Text className="text-base font-semibold text-white">
              {busy ? 'Signing in…' : 'Sign in'}
            </Text>
          </Pressable>
        </Animated.View>

        <View className="mt-5 flex-row justify-center">
          <Text className="text-ink-soft">New here? </Text>
          <Link href="/(auth)/register" className="font-semibold text-accent">
            Create an account
          </Link>
        </View>

        <Text className="mt-6 text-center text-[11px] text-ink-faint" numberOfLines={2}>
          Server: {API_BASE_URL}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
