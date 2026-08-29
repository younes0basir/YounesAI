import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { AppLogo } from '@/components/ui/AppLogo';
import { useAuthStore } from '@/stores/useAuthStore';
import { API_BASE_URL } from '@/lib/apiUrl';
import { getApiErrorMessage } from '@/lib/apiErrors';

export default function RegisterScreen() {
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await register(email.trim(), password, name.trim() || undefined);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-canvas">
      <View className="flex-1 justify-center px-8">
        <View className="mb-8 items-center">
          <AppLogo size={80} rounded={28} />
          <Text className="mt-4 text-3xl font-bold text-ink">Create account</Text>
          <Text className="mt-1 text-ink-soft">Set up your AI workspace</Text>
        </View>

        <View className="gap-3">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Display name"
            placeholderTextColor="#94A3B8"
            className="rounded-2xl border border-glass-border bg-white px-4 py-3.5 text-ink"
          />
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
            placeholder="Password (min 6 chars)"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            className="rounded-2xl border border-glass-border bg-white px-4 py-3.5 text-ink"
          />
        </View>

        {error ? <Text className="mt-3 text-center text-sm text-accent-rose">{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={busy || !email || password.length < 6}
          className={`mt-6 items-center rounded-2xl py-4 ${
            busy || !email || password.length < 6 ? 'bg-accent/40' : 'bg-accent'
          }`}
        >
          <Text className="text-base font-semibold text-white">
            {busy ? 'Creating…' : 'Create account'}
          </Text>
        </Pressable>

        <View className="mt-5 flex-row justify-center">
          <Text className="text-ink-soft">Already have an account? </Text>
          <Link href="/(auth)/login" className="font-semibold text-accent">
            Sign in
          </Link>
        </View>

        <Text className="mt-6 text-center text-[11px] text-ink-faint" numberOfLines={2}>
          Server: {API_BASE_URL}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
