import { useState, useEffect } from 'react';
import type { WorkoutLog, RecordingState, Workout } from '../types';
import { getAllLogs, deleteLog, saveLog, generateId, formatDate } from '../storage/logStorage';
import { useSpeechRecognition } from '../features/speech/useSpeechRecognition';
import { useWhisperRecording } from '../features/speech/useWhisperRecording';
import { normalizeText } from '../features/normalize/normalizeText';
import { parseWorkoutText } from '../features/parse/parseWorkoutText';
import { parseWithGPT } from '../features/parse/parseWithGPT';

type AddMode = 'web-speech' | 'ai';
type InputMode = 'voice' | 'text';

export const History = () => {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('voice');
  const [addMode, setAddMode] = useState<AddMode>('web-speech');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [textInput, setTextInput] = useState('');
  const [editableText, setEditableText] = useState('');
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  const webSpeech = useSpeechRecognition();
  const whisper = useWhisperRecording();

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = () => {
    const allLogs = getAllLogs();
    setLogs(allLogs);
  };

  const handleDelete = (id: string) => {
    if (confirm('이 기록을 삭제하시겠습니까?')) {
      try {
        deleteLog(id);
        loadLogs();
        if (selectedLog?.id === id) {
          setSelectedLog(null);
        }
        alert('삭제되었습니다.');
      } catch (err) {
        alert('삭제에 실패했습니다.');
      }
    }
  };

  const handleMicClick = async () => {
    console.log('[History] handleMicClick - State:', recordingState, 'Mode:', addMode);

    if (recordingState === 'idle') {
      webSpeech.resetTranscript();
      setRecordingState('listening');

      if (addMode === 'web-speech') {
        webSpeech.startListening();
      } else {
        webSpeech.startListening();
        await whisper.startRecording();
      }
    } else if (recordingState === 'listening') {
      setRecordingState('transcribing');

      if (addMode === 'web-speech') {
        webSpeech.stopListening();
        setTimeout(() => {
          const finalText = webSpeech.transcript.trim();
          console.log('[History] Web Speech final text:', finalText);
          setEditableText(finalText);
          handleParse(finalText, false);
        }, 500);
      } else {
        webSpeech.stopListening();
        const whisperResult = await whisper.stopRecording();
        console.log('[History] Whisper final text:', whisperResult);
        setEditableText(whisperResult);
        handleParse(whisperResult, true);
      }
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) {
      alert('운동 내용을 입력해주세요.');
      return;
    }
    setEditableText(textInput);
    handleParse(textInput, addMode === 'ai');
  };

  const handleParse = async (text: string, useAI: boolean) => {
    console.log('[History] handleParse - useAI:', useAI, 'text:', text);
    setRecordingState('parsing');

    try {
      if (useAI) {
        console.log('[History] Using AI mode (GPT parsing)');
        const parsed = await parseWithGPT(text);
        console.log('[History] GPT parsing result:', parsed);
        setWorkouts(parsed);
      } else {
        console.log('[History] Using rule-based parsing');
        setTimeout(() => {
          const normalized = normalizeText(text);
          console.log('[History] Normalized text:', normalized);
          const parsed = parseWorkoutText(normalized);
          console.log('[History] Rule-based parsing result:', parsed);
          setWorkouts(parsed);
          setRecordingState('review');
        }, 300);
        return;
      }
      setRecordingState('review');
    } catch (err) {
      console.error('[History] Parsing error:', err);
      alert(`파싱에 실패했습니다: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      setRecordingState('idle');
    }
  };

  const handleReparse = () => {
    handleParse(editableText, addMode === 'ai');
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
      normalizedText: addMode === 'ai' ? editableText : normalizeText(editableText),
      workouts,
      memo: null,
      createdAt: Date.now(),
    };

    try {
      saveLog(log);
      alert('저장되었습니다!');
      handleCancelAdding();
      loadLogs();
    } catch (err) {
      alert('저장에 실패했습니다.');
    }
  };

  const handleCancelAdding = () => {
    if (recordingState === 'listening') {
      webSpeech.stopListening();
      if (addMode === 'ai') {
        whisper.stopRecording();
      }
    }
    setIsAdding(false);
    setRecordingState('idle');
    setInputMode('voice');
    setTextInput('');
    setEditableText('');
    setWorkouts([]);
    webSpeech.resetTranscript();
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${year}년 ${month}월 ${day}일 (${weekday})`;
  };

  const groupByDate = (logs: WorkoutLog[]) => {
    const grouped: Record<string, WorkoutLog[]> = {};
    logs.forEach((log) => {
      if (!grouped[log.date]) {
        grouped[log.date] = [];
      }
      grouped[log.date].push(log);
    });
    return grouped;
  };

  const groupedLogs = groupByDate(logs);
  const dates = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

  // Adding Mode
  if (isAdding) {
    return (
      <div className="container">
        <div className="header">
          <h1>운동 추가</h1>
          <button className="cancel-button" onClick={handleCancelAdding}>
            취소
          </button>
        </div>

        {recordingState === 'idle' && (
          <>
            <div className="input-mode-selector">
              <button
                className={`input-mode-button ${inputMode === 'voice' ? 'active' : ''}`}
                onClick={() => setInputMode('voice')}
              >
                🎤 음성 입력
              </button>
              <button
                className={`input-mode-button ${inputMode === 'text' ? 'active' : ''}`}
                onClick={() => setInputMode('text')}
              >
                ✍️ 텍스트 입력
              </button>
            </div>

            <div className="mode-selector">
              <button
                className={`mode-button ${addMode === 'web-speech' ? 'active' : ''}`}
                onClick={() => setAddMode('web-speech')}
              >
                기본 (무료)
              </button>
              <button
                className={`mode-button ${addMode === 'ai' ? 'active' : ''}`}
                onClick={() => setAddMode('ai')}
              >
                AI (유료)
              </button>
            </div>
            <div className="mode-description">
              {addMode === 'web-speech' ? (
                <p>브라우저 내장 음성 인식 + 룰 기반 파싱</p>
              ) : (
                <p>Whisper 음성 인식 + GPT 스마트 파싱</p>
              )}
            </div>
          </>
        )}

        {inputMode === 'voice' && recordingState === 'idle' && (
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

        {inputMode === 'text' && recordingState === 'idle' && (
          <div className="text-input-section">
            <div className="status-text">운동 내용을 입력해주세요</div>
            <textarea
              className="text-input-area"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="예시: 벤치프레스 60kg 3세트 10회, 스쿼트 80kg 4세트 8회"
              rows={6}
            />
            <button className="primary-button" onClick={handleTextSubmit}>
              파싱하기
            </button>
            <div className="hint-text">자유롭게 입력하시면 AI가 정리해드립니다</div>
          </div>
        )}

        {recordingState === 'listening' && (
          <div className="recording-section">
            <div className="status-text listening">
              {addMode === 'ai' ? '🎤 AI 녹음 중...' : '듣는 중...'}
            </div>
            <button className="mic-button active" onClick={handleMicClick}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            </button>
            <div className="hint-text">탭하여 녹음 종료</div>

            {(webSpeech.transcript || webSpeech.interimTranscript) && (
              <div className="transcript-box">
                {addMode === 'ai' && (
                  <div className="ai-preview-label">
                    실시간 미리보기 (AI가 다시 처리합니다)
                  </div>
                )}
                <div className="transcript-final">{webSpeech.transcript}</div>
                {webSpeech.interimTranscript && (
                  <div className="transcript-interim">{webSpeech.interimTranscript}</div>
                )}
              </div>
            )}
          </div>
        )}

        {(recordingState === 'transcribing' || recordingState === 'parsing') && (
          <div className="recording-section">
            <div className="status-text">
              {recordingState === 'transcribing' ? '텍스트 처리 중...' : '운동 기록 분석 중...'}
            </div>
            <div className="spinner"></div>
          </div>
        )}

        {recordingState === 'review' && (
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
                        {workout.weight_kg && <span className="weight">{workout.weight_kg} kg</span>}
                        {workout.sets && <span>{workout.sets} 세트</span>}
                        {workout.reps && <span>{workout.reps} 회</span>}
                        {workout.duration_min && <span>{workout.duration_min} 분</span>}
                        {!workout.sets && !workout.reps && !workout.duration_min && !workout.weight_kg && (
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
              <button className="cancel-button" onClick={handleCancelAdding}>
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
  }

  // Detail View
  if (selectedLog) {
    return (
      <div className="container">
        <div className="header">
          <button className="back-button" onClick={() => setSelectedLog(null)}>
            ← 뒤로
          </button>
          <h2>운동 기록 상세</h2>
        </div>

        <div className="detail-section">
          <div className="detail-date">{formatDateDisplay(selectedLog.date)}</div>

          <div className="section">
            <h3>원문</h3>
            <div className="detail-text">{selectedLog.rawText}</div>
          </div>

          {selectedLog.workouts.length > 0 && (
            <div className="section">
              <h3>운동 기록 ({selectedLog.workouts.length}개)</h3>
              <div className="workout-cards">
                {selectedLog.workouts.map((workout, idx) => (
                  <div key={idx} className={`workout-card ${workout.type}`}>
                    <div className="workout-name">{workout.name}</div>
                    <div className="workout-details">
                      {workout.weight_kg && <span className="weight">{workout.weight_kg} kg</span>}
                      {workout.sets && <span>{workout.sets} 세트</span>}
                      {workout.reps && <span>{workout.reps} 회</span>}
                      {workout.duration_min && <span>{workout.duration_min} 분</span>}
                      {!workout.sets && !workout.reps && !workout.duration_min && !workout.weight_kg && (
                        <span className="no-details">상세 정보 없음</span>
                      )}
                    </div>
                    {workout.note && <div className="workout-note">{workout.note}</div>}
                    <div className="workout-type-badge">{workout.type}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="delete-button" onClick={() => handleDelete(selectedLog.id)}>
            삭제
          </button>
        </div>
      </div>
    );
  }

  // Main View - 운동 카드 중심
  return (
    <div className="container">
      <div className="header">
        <h1>히스토리</h1>
        <button className="add-button" onClick={() => setIsAdding(true)}>
          + 추가
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state">
          <p>아직 운동 기록이 없습니다.</p>
          <button className="primary-button" onClick={() => setIsAdding(true)}>
            운동 기록 추가하기
          </button>
        </div>
      ) : (
        <div className="history-workout-view">
          {dates.map((date) => (
            <div key={date} className="history-date-section">
              <div className="history-date-header">
                {formatDateDisplay(date)}
                <span className="session-count">{groupedLogs[date].length}회 기록</span>
              </div>

              {groupedLogs[date].map((log) => (
                <div key={log.id} className="history-session">
                  <div className="session-time">
                    {new Date(log.createdAt).toLocaleTimeString('ko-KR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="session-workouts">
                    {log.workouts.map((workout, idx) => (
                      <div key={idx} className={`history-workout-card ${workout.type}`}>
                        <div className="hw-name">{workout.name}</div>
                        <div className="hw-details">
                          {workout.weight_kg && (
                            <span className="hw-weight">{workout.weight_kg}kg</span>
                          )}
                          {workout.sets && workout.reps && (
                            <span>
                              {workout.sets}×{workout.reps}
                            </span>
                          )}
                          {!workout.sets && workout.reps && <span>{workout.reps}회</span>}
                          {workout.duration_min && <span>{workout.duration_min}분</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="session-detail-button"
                    onClick={() => setSelectedLog(log)}
                  >
                    상세보기
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
