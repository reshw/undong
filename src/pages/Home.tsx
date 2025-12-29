import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RecordingState, Workout } from '../types';
import { useSpeechRecognition } from '../features/speech/useSpeechRecognition';
import { useWhisperRecording } from '../features/speech/useWhisperRecording';
import { normalizeText } from '../features/normalize/normalizeText';
import { parseWorkoutText } from '../features/parse/parseWorkoutText';
import { parseWithGPT } from '../features/parse/parseWithGPT';
import { saveLog, generateId, formatDate } from '../storage/logStorage';

type RecordingMode = 'web-speech' | 'ai';

export const Home = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<RecordingMode>('web-speech');
  const [state, setState] = useState<RecordingState>('idle');
  const [editableText, setEditableText] = useState('');
  const [normalizedText, setNormalizedText] = useState('');
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  const webSpeech = useSpeechRecognition();
  const whisper = useWhisperRecording();

  const currentMode = mode === 'web-speech' ? webSpeech : whisper;
  const error = currentMode.error;
  const transcript = 'transcript' in currentMode ? currentMode.transcript : '';
  const interimTranscript = 'interimTranscript' in currentMode ? currentMode.interimTranscript : '';

  const handleMicClick = async () => {
    if (state === 'idle') {
      currentMode.resetTranscript();
      setEditableText('');
      setNormalizedText('');
      setWorkouts([]);

      if (mode === 'web-speech') {
        webSpeech.startListening();
      } else {
        await whisper.startRecording();
      }
      setState('listening');
    } else if (state === 'listening') {
      setState('transcribing');

      if (mode === 'web-speech') {
        webSpeech.stopListening();
        setTimeout(() => {
          const finalText = transcript.trim();
          setEditableText(finalText);
          handleParse(finalText, false);
        }, 500);
      } else {
        await whisper.stopRecording();
        setTimeout(() => {
          const finalText = whisper.transcript.trim();
          setEditableText(finalText);
          handleParse(finalText, true);
        }, 1000);
      }
    }
  };

  const handleParse = async (text: string, useAI: boolean) => {
    setState('parsing');

    try {
      if (useAI) {
        const parsed = await parseWithGPT(text);
        setNormalizedText(text);
        setWorkouts(parsed);
      } else {
        setTimeout(() => {
          const normalized = normalizeText(text);
          setNormalizedText(normalized);
          const parsed = parseWorkoutText(normalized);
          setWorkouts(parsed);
          setState('review');
        }, 300);
        return;
      }
      setState('review');
    } catch (err) {
      console.error('Parsing error:', err);
      alert('파싱에 실패했습니다. 다시 시도해주세요.');
      setState('idle');
    }
  };

  const handleReparse = () => {
    handleParse(editableText, mode === 'ai');
  };

  const handleSave = () => {
    if (!editableText.trim()) {
      alert('저장할 내용이 없습니다.');
      return;
    }

    const log = {
      id: generateId(),
      date: formatDate(),
      rawText: editableText,
      normalizedText,
      workouts,
      memo: null,
      createdAt: Date.now(),
    };

    try {
      saveLog(log);
      alert('저장되었습니다!');
      setState('idle');
      setEditableText('');
      setNormalizedText('');
      setWorkouts([]);
      currentMode.resetTranscript();
    } catch (err) {
      alert('저장에 실패했습니다.');
    }
  };

  const handleCancel = () => {
    if (confirm('작성 중인 내용을 취소하시겠습니까?')) {
      setState('idle');
      setEditableText('');
      setNormalizedText('');
      setWorkouts([]);
      currentMode.resetTranscript();
    }
  };

  if (mode === 'web-speech' && !webSpeech.isSupported) {
    return (
      <div className="container">
        <div className="error-message">
          <h2>음성 인식 미지원</h2>
          <p>이 브라우저는 Web Speech API를 지원하지 않습니다.</p>
          <p>Chrome 또는 Edge 브라우저를 사용하거나 AI 모드를 사용해주세요.</p>
          <button onClick={() => setMode('ai')}>AI 모드로 전환</button>
        </div>
      </div>
    );
  }

  if (error && state === 'idle') {
    return (
      <div className="container">
        <div className="error-message">
          <h2>오류</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Voice Workout Log</h1>
        <button className="nav-button" onClick={() => navigate('/history')}>
          히스토리
        </button>
      </div>

      {state === 'idle' && (
        <>
          <div className="mode-selector">
            <button
              className={`mode-button ${mode === 'web-speech' ? 'active' : ''}`}
              onClick={() => setMode('web-speech')}
            >
              기본 (무료)
            </button>
            <button
              className={`mode-button ${mode === 'ai' ? 'active' : ''}`}
              onClick={() => setMode('ai')}
            >
              AI (유료)
            </button>
          </div>
          <div className="mode-description">
            {mode === 'web-speech' ? (
              <p>브라우저 내장 음성 인식 + 룰 기반 파싱</p>
            ) : (
              <p>Whisper 음성 인식 + GPT 스마트 파싱</p>
            )}
          </div>
        </>
      )}

      {state === 'idle' && (
        <div className="recording-section">
          <div className="status-text">운동 기록을 말씀해주세요</div>
          <button className="mic-button" onClick={handleMicClick}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
          <div className="hint-text">탭하여 녹음 시작</div>
        </div>
      )}

      {state === 'listening' && (
        <div className="recording-section">
          <div className="status-text listening">듣는 중...</div>
          <button className="mic-button active" onClick={handleMicClick}>
            <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          </button>
          <div className="hint-text">탭하여 녹음 종료</div>

          {(transcript || interimTranscript) && (
            <div className="transcript-box">
              <div className="transcript-final">{transcript}</div>
              {interimTranscript && (
                <div className="transcript-interim">{interimTranscript}</div>
              )}
            </div>
          )}
        </div>
      )}

      {(state === 'transcribing' || state === 'parsing') && (
        <div className="recording-section">
          <div className="status-text">
            {state === 'transcribing' ? '텍스트 처리 중...' : '운동 기록 분석 중...'}
          </div>
          <div className="spinner"></div>
        </div>
      )}

      {state === 'review' && (
        <div className="review-section">
          <h2>기록 확인</h2>

          <div className="section">
            <h3>원문 (편집 가능)</h3>
            <textarea
              className="edit-textarea"
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              rows={5}
            />
            <button className="secondary-button" onClick={handleReparse}>
              재정리
            </button>
          </div>

          <div className="section">
            <h3>운동 기록 ({workouts.length}개)</h3>
            {workouts.length === 0 ? (
              <p className="empty-message">운동 기록을 찾을 수 없습니다.</p>
            ) : (
              <div className="workout-cards">
                {workouts.map((workout, idx) => (
                  <div key={idx} className={`workout-card ${workout.type}`}>
                    <div className="workout-name">{workout.name}</div>
                    <div className="workout-details">
                      {workout.sets && <span>{workout.sets} 세트</span>}
                      {workout.reps && <span>{workout.reps} 회</span>}
                      {workout.duration_min && <span>{workout.duration_min} 분</span>}
                      {!workout.sets && !workout.reps && !workout.duration_min && (
                        <span className="no-details">상세 정보 없음</span>
                      )}
                    </div>
                    {workout.note && <div className="workout-note">{workout.note}</div>}
                    <div className="workout-type-badge">{workout.type}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="action-buttons">
            <button className="cancel-button" onClick={handleCancel}>
              취소
            </button>
            <button className="primary-button" onClick={handleSave}>
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
