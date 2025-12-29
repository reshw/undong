import { useState, useRef, useCallback } from 'react';

interface WhisperRecordingResult {
  isRecording: boolean;
  transcript: string;
  error: string | null;
  startRecording: () => void;
  stopRecording: () => Promise<void>;
  resetTranscript: () => void;
}

export const useWhisperRecording = (): WhisperRecordingResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('마이크 권한이 필요합니다.');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const transcribeAudio = async (audioBlob: Blob) => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    console.log('[Whisper] API Key exists:', !!apiKey);
    console.log('[Whisper] API Key prefix:', apiKey?.substring(0, 10));
    console.log('[Whisper] Audio blob size:', audioBlob.size);

    if (!apiKey) {
      console.error('[Whisper] No API key found');
      setError('OpenAI API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', 'ko');

      console.log('[Whisper] Sending request to OpenAI...');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });

      console.log('[Whisper] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Whisper] API Error:', errorData);
        throw new Error(`Whisper API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      console.log('[Whisper] Transcription result:', data.text);
      setTranscript(data.text);
    } catch (err) {
      console.error('[Whisper] Transcription error:', err);
      setError(`음성 인식 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    }
  };

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return {
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording,
    resetTranscript,
  };
};
