import { useState, useEffect } from 'react';
import { getAllLogs } from '../storage/supabaseStorage';
import type { WorkoutLog } from '../types';

interface MonthlyStats {
  year: number;
  month: number;
  workoutDays: number;
  totalDistance: number; // 조정된 거리
  totalCardioMinutes: number;
  avgPace: number; // 평균 페이스 (분/km)
  strengthDays: Set<string>;
  cardioDays: Set<string>;
  coreDays: Set<string>;
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
  const calculateCardioDistance = (workoutName: string, duration: number): number => {
    const name = workoutName.toLowerCase();

    // 기본 속도 가정 (km/h)
    let baseSpeed = 0;
    let adjustment = 1.0;

    if (name.includes('트레드밀') || name.includes('러닝') || name.includes('런닝')) {
      baseSpeed = 10; // 10 km/h
      adjustment = 1.0; // 100%
    } else if (name.includes('사이클') || name.includes('자전거')) {
      baseSpeed = 25; // 25 km/h
      adjustment = 0.4; // 40%
    } else if (name.includes('로잉') || name.includes('rowing')) {
      baseSpeed = 12; // 12 km/h
      adjustment = 0.6; // 60%
    }

    return (baseSpeed * (duration / 60)) * adjustment;
  };

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
      coreDays: new Set<string>(),
      snowboardDays: new Set<string>(),
    };

    const workoutDates = new Set<string>();

    logs.forEach((log) => {
      const logDate = new Date(log.date);
      if (logDate.getFullYear() === selectedYear && logDate.getMonth() + 1 === selectedMonth) {
        workoutDates.add(log.date);

        log.workouts.forEach((workout) => {
          // 타입별 날짜 추가
          if (workout.type === 'strength') stats.strengthDays.add(log.date);
          if (workout.type === 'cardio') stats.cardioDays.add(log.date);
          if (workout.type === 'core') stats.coreDays.add(log.date);
          if (workout.name.toLowerCase().includes('스노보드')) stats.snowboardDays.add(log.date);

          // 유산소 거리 및 시간 계산
          if (workout.type === 'cardio') {
            // distance_km이 있으면 직접 사용, 없으면 duration_min으로 계산
            let distance = 0;
            if (workout.distance_km) {
              distance = workout.distance_km;
            } else if (workout.duration_min) {
              distance = calculateCardioDistance(workout.name, workout.duration_min);
            }

            stats.totalDistance += distance;

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
          types.add(workout.type);
          if (workout.name.toLowerCase().includes('스노보드')) {
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
            <div className="stat-label">유산소 거리</div>
            <div className="stat-value">{stats.totalDistance.toFixed(1)} km</div>
            <div className="stat-note">조정된 거리</div>
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
