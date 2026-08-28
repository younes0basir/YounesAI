import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { api } from './api';

export { useAudioRecorder, RecordingPresets };

export async function ensureMicPermission(): Promise<boolean> {
  const { granted } = await requestRecordingPermissionsAsync();
  if (granted) {
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  }
  return granted;
}

export async function releaseAudioMode(): Promise<void> {
  await setAudioModeAsync({ allowsRecording: false });
}

/**
 * Upload a recorded audio file to the orchestrator voice pipeline.
 * The backend expects multipart/form-data with the file under the `audio` field.
 */
export async function processVoice(uri: string) {
  const form = new FormData();
  form.append('audio', {
    uri,
    name: 'voice.m4a',
    type: 'audio/m4a',
  } as unknown as Blob);
  try {
    const { mmkvGet } = await import('./mmkv');
    const sid = mmkvGet<string>('chat-session-id');
    if (sid) form.append('sessionId', sid);
  } catch {}

  const { data: raw } = await api.post('/api/agents/voice/process', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  const data =
    raw?.agentResponse != null
      ? {
          ...raw.agentResponse,
          transcription: raw.transcription,
          sessionId: raw.agentResponse.sessionId || raw.sessionId,
        }
      : raw;
  try {
    const { mmkvSet } = await import('./mmkv');
    if (data?.sessionId) mmkvSet('chat-session-id', data.sessionId);
  } catch {}
  return data;
}
