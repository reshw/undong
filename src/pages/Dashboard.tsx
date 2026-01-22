import { useState, useEffect } from 'react';
import { getAllLogs } from '../storage/supabaseStorage';
import type { WorkoutLog } from '../types';
import { calculateAdjustedDistance } from '../features/parse/normalizeCardio';

interface MonthlyStats {
  year: number;
  month: number;
  workoutDays: number;
  totalDistance: number; // 조정된 거리
  totalCardioMinutes: number;
  avgPace: number; // 평균 페이스 (분/km)

  // Matrix Classification 기반 통계
  strengthDays: Set<string>;
  cardioDays: Set<string>;
  skillDays: Set<string>;
  flexibilityDays: Set<string>;

  // Target 기반 코어 추적
  coreDays: Set<string>;

  // Category 기반 추적
  snowboardDays: Set<string>;
}

export const Dashboard = () => {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const allLogs = await getAllLogs();
    setLogs(allLogs);
    setLoading(false);
  };

  // 유산소 거리 계산 (트레드밀 100%, 사이클 40%, 로잉 60%)
  // REMOVED: calculateCardioDistance - now using calculateAdjustedDistance from normalizeCardio.ts

  // 월간 통계 계산
  const calculateMonthlyStats = (): MonthlyStats => {
    const stats: MonthlyStats = {
      year: selectedYear,
      month: selectedMonth,
      workoutDays: 0,
      totalDistance: 0,
      totalCardioMinutes: 0,
      avgPace: 0,
      strengthDays: new Set<string>(),
      cardioDays: new Set<string>(),
      skillDays: new Set<string>(),
      flexibilityDays: new Set<string>(),
      coreDays: new Set<string>(),
      snowboardDays: new Set<string>(),
    };

    const workoutDates = new Set<string>();

    logs.forEach((log) => {
      const logDate = new Date(log.date);
      if (logDate.getFullYear() === selectedYear && logDate.getMonth() + 1 === selectedMonth) {
        workoutDates.add(log.date);

        log.workouts.forEach((workout) => {
          // Type별 날짜 추가 (Matrix Classification)
          if (workout.type === 'strength') stats.strengthDays.add(log.date);
          if (workout.type === 'cardio') stats.cardioDays.add(log.date);
          if (workout.type === 'skill') stats.skillDays.add(log.date);
          if (workout.type === 'flexibility') stats.flexibilityDays.add(log.date);

          // Target 기반 코어 운동 감지
          if (workout.type === 'strength' && workout.target === 'core') {
            stats.coreDays.add(log.date);
          }

          // Category 기반 스노보드 감지
          if (workout.category === 'snowboard') {
            stats.snowboardDays.add(log.date);
          }

          // 유산소 거리 및 시간 계산 (환산 비율 적용)
          if (workout.type === 'cardio') {
            // 카테고리별 환산 비율 적용
            const adjustedDistance = calculateAdjustedDistance(
              workout.distance_km,
              workout.adjusted_dist_km,
              workout.name
            );

            stats.totalDistance += adjustedDistance;

            if (workout.duration_min) {
              stats.totalCardioMinutes += workout.duration_min;
            }
          }
        });
      }
    });

    stats.workoutDays = workoutDates.size;

    // 평균 페이스 계산 (분/km)
    if (stats.totalDistance > 0) {
      stats.avgPace = stats.totalCardioMinutes / stats.totalDistance;
    }

    return stats;
  };

  // 캘린더 데이터 생성
  const generateCalendar = () => {
    const year = selectedYear;
    const month = selectedMonth;
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 = 일요일

    const calendar: (number | null)[] = [];

    // 빈 칸 채우기
    for (let i = 0; i < startDayOfWeek; i++) {
      calendar.push(null);
    }

    // 날짜 채우기
    for (let day = 1; day <= daysInMonth; day++) {
      calendar.push(day);
    }

    return calendar;
  };

  // 특정 날짜의 운동 타입 확인
  const getWorkoutTypesForDate = (day: number): Set<string> => {
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const types = new Set<string>();

    logs.forEach((log) => {
      if (log.date === dateStr) {
        log.workouts.forEach((workout) => {
          // Type별 추가
          types.add(workout.type);

          // Target 기반 코어 감지
          if (workout.type === 'strength' && workout.target === 'core') {
            types.add('core');
          }

          // Category 기반 스노보드 감지
          if (workout.category === 'snowboard') {
            types.add('snowboard');
          }
        });
      }
    });

    return types;
  };

  const stats = calculateMonthlyStats();
  const calendar = generateCalendar();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">데이터 로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>대시보드</h1>
      </div>

      {/* 월간 선택기 */}
      <div className="month-selector">
        <button className="month-nav-button" onClick={handlePrevMonth}>
          ←
        </button>
        <div className="month-display">
          {selectedYear}년 {selectedMonth}월
        </div>
        <button className="month-nav-button" onClick={handleNextMonth}>
          →
        </button>
      </div>

      {/* 월간 리포트 */}
      <div className="stats-section">
        <h2>월간 리포트</h2>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">운동 일수</div>
            <div className="stat-value">{stats.workoutDays}일</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">유산소 거리 (환산)</div>
            <div className="stat-value">{stats.totalDistance.toFixed(1)} km</div>
            <div className="stat-note" style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>
              종목별 난이도 보정 적용<br/>
              🏃×1.0 🪜×1.0 🚣×0.6 🚴×0.4 💨×0.3
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">평균 페이스</div>
            <div className="stat-value">
              {stats.avgPace > 0 ? `${stats.avgPace.toFixed(1)} 분/km` : '-'}
            </div>
          </div>
        </div>

        <div className="type-stats">
          <div className="type-stat-item">
            <span className="type-badge strength">근력</span>
            <span>{stats.strengthDays.size}일</span>
          </div>
          <div className="type-stat-item">
            <span className="type-badge cardio">유산소</span>
            <span>{stats.cardioDays.size}일</span>
          </div>
          <div className="type-stat-item">
            <span className="type-badge core">코어</span>
            <span>{stats.coreDays.size}일</span>
          </div>
          <div className="type-stat-item">
            <span className="type-badge snowboard">스노보드</span>
            <span>{stats.snowboardDays.size}일</span>
          </div>
        </div>
      </div>

      {/* 캘린더 */}
      <div className="calendar-section">
        <h2>운동 캘린더</h2>

        <div className="calendar-grid">
          {/* 요일 헤더 */}
          {weekdays.map((day) => (
            <div key={day} className="calendar-weekday">
              {day}
            </div>
          ))}

          {/* 날짜 */}
          {calendar.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="calendar-day empty"></div>;
            }

            const types = getWorkoutTypesForDate(day);
            const hasWorkout = types.size > 0;

            return (
              <div key={day} className={`calendar-day ${hasWorkout ? 'has-workout' : ''}`}>
                <div className="day-number">{day}</div>
                {hasWorkout && (
                  <div className="workout-indicators">
                    {types.has('strength') && <div className="indicator strength"></div>}
                    {types.has('cardio') && <div className="indicator cardio"></div>}
                    {types.has('core') && <div className="indicator core"></div>}
                    {types.has('snowboard') && <div className="indicator snowboard"></div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-dot strength"></div>
            <span>근력</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot cardio"></div>
            <span>유산소</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot core"></div>
            <span>코어</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot snowboard"></div>
            <span>스노보드</span>
          </div>
        </div>
      </div>
    </div>
  );
};
