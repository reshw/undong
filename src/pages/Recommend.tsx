import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllLogs, getUserProfile, saveUserProfile, deleteUserProfile, saveTodo, getTodayTodo, generateId, formatDate } from '../storage/logStorage';
import type { WorkoutLog, UserProfile, DailyTodo, TodoWorkout } from '../types';

type ViewMode = 'setup' | 'ready' | 'loading' | 'result';

export const Recommend = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('ready');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userInput, setUserInput] = useState('');
  const [todayFeeling, setTodayFeeling] = useState('');
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [recommendation, setRecommendation] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    const savedProfile = getUserProfile();
    setProfile(savedProfile);
    if (!savedProfile) {
      setViewMode('setup');
    } else {
      setViewMode('ready');
    }
  };

  const handleGenerateProfile = async () => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      setError('OpenAI API 키가 설정되지 않았습니다.');
      return;
    }

    if (!userInput.trim()) {
      setError('운동 목표를 입력해주세요.');
      return;
    }

    setIsGeneratingProfile(true);
    setError(null);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `당신은 사용자의 운동 목표와 배경을 전문적으로 정리하는 피트니스 전문가입니다.

사용자가 자유롭게 입력한 운동 관련 정보를 받아서, 다음 항목들을 명확하게 정리해주세요:

1. 주요 스포츠/활동 (예: 스노보드, 러닝, 등산 등)
2. 운동 목표 (예: 피지컬 향상, 입문, 체력 유지 등)
3. 운동 스케줄/패턴 (예: 주말마다, 평일 저녁, 비시즌에만 등)
4. 특이사항이나 제약사항

출력 형식은 간결하고 명확하게, 3-5문장으로 정리해주세요. 이 내용은 AI 운동 추천 시스템에 배경 정보로 제공됩니다.`,
            },
            {
              role: 'user',
              content: userInput,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const generatedGoals = data.choices[0]?.message?.content;

      if (generatedGoals) {
        const newProfile: UserProfile = {
          goals: generatedGoals,
          rawInput: userInput,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        saveUserProfile(newProfile);
        setProfile(newProfile);
        setViewMode('ready');
        setUserInput('');
      } else {
        throw new Error('프로필 생성 결과를 받지 못했습니다.');
      }
    } catch (err) {
      console.error('Profile generation error:', err);
      setError(`프로필 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const handleEditProfile = () => {
    if (profile?.rawInput) {
      setUserInput(profile.rawInput);
    }
    setViewMode('setup');
  };

  const handleDeleteProfile = () => {
    if (confirm('프로필을 삭제하시겠습니까? 운동 기록은 유지됩니다.')) {
      deleteUserProfile();
      setProfile(null);
      setUserInput('');
      setViewMode('setup');
    }
  };

  const parseRecommendationToWorkouts = (recommendationText: string): TodoWorkout[] => {
    const workouts: TodoWorkout[] = [];
    const lines = recommendationText.split('\n');

    for (const line of lines) {
      // 운동명, 세트, 횟수, 무게 등을 추출하는 간단한 파싱
      // 예: "스쿼트 80kg 4세트 8회" or "벤치프레스: 60kg, 3세트 10회"
      const workoutMatch = line.match(/([가-힣a-zA-Z\s]+)\s*:?\s*(\d+(?:\.\d+)?)\s*kg/i);
      const setsRepsMatch = line.match(/(\d+)\s*세트\s*[×x]?\s*(\d+)\s*회/i);
      const durationMatch = line.match(/(\d+)\s*분/i);

      if (workoutMatch || setsRepsMatch || durationMatch) {
        const name = workoutMatch ? workoutMatch[1].trim() : line.trim().split(/[:\-,]/)[0].trim();
        const weight_kg = workoutMatch ? parseFloat(workoutMatch[2]) : undefined;
        const sets = setsRepsMatch ? parseInt(setsRepsMatch[1]) : undefined;
        const reps = setsRepsMatch ? parseInt(setsRepsMatch[2]) : undefined;
        const duration_min = durationMatch ? parseInt(durationMatch[1]) : undefined;

        if (name && name.length > 0 && name.length < 50) {
          workouts.push({
            name,
            sets,
            reps,
            weight_kg,
            duration_min,
            completed: false,
          });
        }
      }
    }

    return workouts;
  };

  const handleSaveAsTodo = async () => {
    const existingTodo = getTodayTodo();

    if (existingTodo) {
      if (!confirm('오늘의 Todo가 이미 존재합니다. 덮어쓰시겠습니까?')) {
        return;
      }
    }

    // AI 추천 텍스트에서 운동 파싱
    const parsedWorkouts = parseRecommendationToWorkouts(recommendation);

    if (parsedWorkouts.length === 0) {
      // 파싱 실패 시 GPT에게 구조화된 운동 목록 요청
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        setError('운동 목록을 추출할 수 없습니다.');
        return;
      }

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `다음 운동 추천 텍스트에서 구체적인 운동 목록만 추출해주세요.
각 줄마다 하나의 운동을 다음 형식으로 작성:
운동명 무게kg 세트수세트 횟수회

예:
스쿼트 80kg 4세트 8회
벤치프레스 60kg 3세트 10회
러닝 20분`,
              },
              {
                role: 'user',
                content: recommendation,
              },
            ],
            temperature: 0.3,
            max_tokens: 500,
          }),
        });

        if (!response.ok) {
          throw new Error('운동 목록 추출 실패');
        }

        const data = await response.json();
        const structuredWorkouts = data.choices[0]?.message?.content || '';
        const extractedWorkouts = parseRecommendationToWorkouts(structuredWorkouts);

        if (extractedWorkouts.length > 0) {
          saveTodoWithWorkouts(extractedWorkouts);
        } else {
          setError('운동 목록을 추출할 수 없습니다. 추천 내용을 확인해주세요.');
        }
      } catch (err) {
        console.error('Extract workouts error:', err);
        setError('운동 목록 추출 중 오류가 발생했습니다.');
      }
    } else {
      saveTodoWithWorkouts(parsedWorkouts);
    }
  };

  const saveTodoWithWorkouts = (workouts: TodoWorkout[]) => {
    const todo: DailyTodo = {
      id: generateId(),
      date: formatDate(),
      source: 'ai_recommendation',
      aiRecommendation: recommendation,
      workouts,
      createdAt: Date.now(),
    };

    try {
      saveTodo(todo);
      alert('오늘의 Todo로 저장되었습니다!');
      navigate('/todo');
    } catch (err) {
      setError('Todo 저장에 실패했습니다.');
    }
  };

  const generateRecommendation = async () => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
      setError('OpenAI API 키가 설정되지 않았습니다.');
      return;
    }

    setViewMode('loading');
    setError(null);

    try {
      const logs = getAllLogs();

      if (logs.length === 0) {
        setError('운동 기록이 없습니다. 먼저 운동을 기록해주세요.');
        setViewMode('ready');
        return;
      }

      const recentLogs = logs.slice(0, 7);
      const workoutSummary = analyzeWorkouts(recentLogs);

      const feelingContext = todayFeeling.trim()
        ? `\n\n**오늘의 컨디션:**\n${todayFeeling}\n`
        : '';

      const systemPrompt = profile
        ? `당신은 전문 피트니스 코치입니다. 사용자의 운동 기록을 분석하고 다음 운동을 추천해주세요.

**사용자 배경:**
${profile.goals}${feelingContext}

위 배경과 오늘의 컨디션을 고려하여 추천해주세요.

추천 형식:
1. 최근 운동 분석 요약 (어떤 운동을 주로 했는지, 사용자 목표와의 연관성)
2. 오늘의 컨디션 고려 (컨디션에 따른 강도 조절, 주의사항)
3. 밸런스 평가 (목표 달성을 위해 부족한 부분, 카디오/근력 비율 등)
4. 오늘 추천 운동 (사용자 목표와 컨디션에 맞는 구체적인 운동명, 세트, 횟수, 무게 포함)
   - 각 운동을 명확하게 나열 (예: "스쿼트 80kg 4세트 8회")
5. 주의사항 (휴식 필요 여부, 부상 위험, 목표 달성 팁 등)

친근하고 격려하는 톤으로 작성해주세요.`
        : `당신은 전문 피트니스 코치입니다. 사용자의 운동 기록을 분석하고 다음 운동을 추천해주세요.${feelingContext}

추천 형식:
1. 최근 운동 분석 요약 (어떤 운동을 주로 했는지, 강도는 어땠는지)
2. 오늘의 컨디션 고려 (컨디션에 따른 강도 조절, 주의사항)
3. 밸런스 평가 (어떤 부위가 부족한지, 카디오/근력 비율 등)
4. 오늘 추천 운동 (구체적인 운동명, 세트, 횟수, 무게 포함)
   - 각 운동을 명확하게 나열 (예: "벤치프레스 60kg 3세트 10회")
5. 주의사항 (휴식 필요 여부, 부상 위험 등)

친근하고 격려하는 톤으로 작성해주세요.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `최근 7일 운동 기록:\n\n${workoutSummary}\n\n이 기록을 바탕으로 오늘 할 운동을 추천해주세요.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const recommendationText = data.choices[0]?.message?.content;

      if (recommendationText) {
        setRecommendation(recommendationText);
        setViewMode('result');
      } else {
        throw new Error('추천 결과를 받지 못했습니다.');
      }
    } catch (err) {
      console.error('Recommendation error:', err);
      setError(`추천 생성 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
      setViewMode('ready');
    }
  };

  const analyzeWorkouts = (logs: WorkoutLog[]): string => {
    let summary = '';

    logs.forEach((log, index) => {
      summary += `${index + 1}. ${log.date}\n`;
      log.workouts.forEach((workout) => {
        summary += `   - ${workout.name}`;
        if (workout.weight_kg) summary += ` ${workout.weight_kg}kg`;
        if (workout.sets) summary += ` ${workout.sets}세트`;
        if (workout.reps) summary += ` ${workout.reps}회`;
        if (workout.duration_min) summary += ` ${workout.duration_min}분`;
        summary += `\n`;
      });
      summary += '\n';
    });

    return summary;
  };

  // Setup View (프로필 생성)
  if (viewMode === 'setup') {
    return (
      <div className="container">
        <div className="recommend-header">
          <h1>AI 운동 추천 설정</h1>
          <p className="subtitle">운동 목표와 배경을 알려주시면 AI가 맞춤 추천을 해드립니다</p>
        </div>

        <div className="profile-setup">
          <div className="setup-instruction">
            <h3>운동 목표와 상황을 자유롭게 적어주세요</h3>
            <p className="instruction-text">
              예시: "주말마다 토요일 일요일 아침에 스노보드를 빡세게 타고, 스노보드 피지컬 향상을 위한 운동을
              하고 싶어요. 비시즌에는 러닝을 입문하려고 트레드밀을 탑니다."
            </p>
          </div>

          <textarea
            className="profile-input"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="운동 목표, 주요 스포츠, 운동 스케줄, 특이사항 등을 자유롭게 입력하세요..."
            rows={8}
          />

          {error && (
            <div className="error-box">
              <p>{error}</p>
            </div>
          )}

          <div className="setup-buttons">
            {profile && (
              <button className="cancel-button" onClick={() => setViewMode('ready')}>
                취소
              </button>
            )}
            <button
              className="primary-button"
              onClick={handleGenerateProfile}
              disabled={isGeneratingProfile || !userInput.trim()}
            >
              {isGeneratingProfile ? 'AI가 정리하는 중...' : 'AI로 정리하기'}
            </button>
          </div>

          {isGeneratingProfile && (
            <div className="setup-loading">
              <div className="spinner"></div>
              <p>AI가 운동 목표를 정리하고 있습니다...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Ready View (프로필 있음, 추천 받을 준비)
  if (viewMode === 'ready') {
    return (
      <div className="container">
        <div className="recommend-header">
          <h1>AI 운동 추천</h1>
          <p className="subtitle">최근 운동 기록을 분석하여 오늘의 운동을 추천해드립니다</p>
        </div>

        {profile && (
          <div className="profile-display">
            <div className="profile-header">
              <h3>내 운동 프로필</h3>
              <div className="profile-actions">
                <button className="edit-button" onClick={handleEditProfile}>
                  수정
                </button>
                <button className="delete-icon-button" onClick={handleDeleteProfile}>
                  삭제
                </button>
              </div>
            </div>
            <div className="profile-content">{profile.goals}</div>
          </div>
        )}

        <div className="today-feeling-section">
          <h3>오늘의 기분은 어떠세요?</h3>
          <textarea
            className="feeling-input"
            value={todayFeeling}
            onChange={(e) => setTodayFeeling(e.target.value)}
            placeholder="예: 어제 운동 후 다리가 뻐근해요. 컨디션은 좋은데 피곤해요. 오늘은 가볍게 하고 싶어요."
            rows={4}
          />
          <p className="feeling-hint">
            오늘의 컨디션, 피로도, 통증, 기분 등을 자유롭게 적어주세요. AI가 고려해서 추천해드립니다.
          </p>
        </div>

        <div className="recommend-cta">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <p>AI가 당신의 운동 기록, 목표, 컨디션을 분석하여</p>
          <p>맞춤 운동을 추천해드립니다</p>
          <button className="primary-button large-button" onClick={generateRecommendation}>
            추천 받기
          </button>
        </div>

        {error && (
          <div className="error-box">
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Loading View
  if (viewMode === 'loading') {
    return (
      <div className="container">
        <div className="recommend-loading">
          <div className="spinner"></div>
          <p>AI가 운동 기록을 분석하는 중...</p>
        </div>
      </div>
    );
  }

  // Result View
  return (
    <div className="container">
      <div className="recommend-header">
        <h1>AI 운동 추천</h1>
      </div>

      <div className="recommend-result">
        <div className="recommend-content">
          {recommendation.split('\n').map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
        <div className="result-actions">
          <button className="secondary-button" onClick={() => setViewMode('ready')}>
            돌아가기
          </button>
          <button className="primary-button" onClick={handleSaveAsTodo}>
            오늘의 Todo로 저장
          </button>
        </div>
        {error && (
          <div className="error-box">
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};
