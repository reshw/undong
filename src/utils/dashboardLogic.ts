import type { WorkoutLog, WorkoutCategory } from '../types';

/**
 * 클럽 대시보드 계산 로직
 * MMORPG 길드 로비 스타일의 게이밍 UI를 위한 유틸리티
 */

// ============================================
// 타이틀 시스템
// ============================================

export interface MemberTitle {
  userId: string;
  displayName: string;
  profileImage: string | null;
  title: string;
  icon: string;
  value: number | string;
  description: string;
}

/**
 * 타이틀 부여 로직
 */
export const calculateTitles = (members: WorkoutLog[]): MemberTitle[] => {
  const titles: MemberTitle[] = [];

  // 🌅 새벽 트레이너 (04:00-07:00 최초 운동)
  const earlyBird = findEarlyBird(members);
  if (earlyBird) titles.push(earlyBird);

  // 🏋️ 볼륨 킹 (총 볼륨 1위)
  const volumeKing = findVolumeKing(members);
  if (volumeKing) titles.push(volumeKing);

  // 🏃 거리 킹 (총 거리 1위)
  const distanceKing = findDistanceKing(members);
  if (distanceKing) titles.push(distanceKing);

  // 🏂 런 킹 (총 런 수 1위)
  const runKing = findRunKing(members);
  if (runKing) titles.push(runKing);

  // ⚡ 연속 출석 (주간 운동 횟수 최다)
  const streakKing = findStreakKing(members);
  if (streakKing) titles.push(streakKing);

  return titles;
};

const findEarlyBird = (members: WorkoutLog[]): MemberTitle | null => {
  const today = new Date().toISOString().split('T')[0];

  let earliest: { userId: string; displayName: string; profileImage: string | null; time: number } | null = null;

  members.forEach((log) => {
    if (log.date !== today) return;

    const createdTime = new Date(log.createdAt);
    const hour = createdTime.getHours();

    if (hour >= 4 && hour < 7) {
      if (!earliest || createdTime.getTime() < earliest.time) {
        earliest = {
          userId: log.userId!,
          displayName: log.userDisplayName!,
          profileImage: log.userProfileImage || null,
          time: createdTime.getTime(),
        };
      }
    }
  });

  if (!earliest) return null;

  const time = new Date(earliest.time);
  return {
    userId: earliest.userId,
    displayName: earliest.displayName,
    profileImage: earliest.profileImage,
    title: '새벽 트레이너',
    icon: '🌅',
    value: `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`,
    description: '오늘 가장 먼저 운동 시작',
  };
};

const findVolumeKing = (members: WorkoutLog[]): MemberTitle | null => {
  const userVolumes = new Map<string, { displayName: string; profileImage: string | null; volume: number }>();

  members.forEach((log) => {
    if (!log.userId) return;

    const existing = userVolumes.get(log.userId) || {
      displayName: log.userDisplayName!,
      profileImage: log.userProfileImage || null,
      volume: 0,
    };

    log.workouts.forEach((workout) => {
      if (workout.type === 'strength' && workout.volume_kg) {
        existing.volume += workout.volume_kg;
      }
    });

    userVolumes.set(log.userId, existing);
  });

  const rankings = Array.from(userVolumes.entries())
    .filter(([_, data]) => data.volume > 0)
    .sort((a, b) => b[1].volume - a[1].volume);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];
  const volumeInTons = data.volume / 1000;

  return {
    userId,
    displayName: data.displayName,
    profileImage: data.profileImage,
    title: '볼륨 킹',
    icon: '🏋️',
    value: `${volumeInTons.toFixed(1)}t`,
    description: '총 볼륨 1위',
  };
};

const findDistanceKing = (members: WorkoutLog[]): MemberTitle | null => {
  const userDistances = new Map<string, { displayName: string; profileImage: string | null; distance: number }>();

  members.forEach((log) => {
    if (!log.userId) return;

    const existing = userDistances.get(log.userId) || {
      displayName: log.userDisplayName!,
      profileImage: log.userProfileImage || null,
      distance: 0,
    };

    log.workouts.forEach((workout) => {
      if (workout.type === 'cardio' && workout.adjusted_dist_km) {
        existing.distance += workout.adjusted_dist_km;
      }
    });

    userDistances.set(log.userId, existing);
  });

  const rankings = Array.from(userDistances.entries())
    .filter(([_, data]) => data.distance > 0)
    .sort((a, b) => b[1].distance - a[1].distance);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    displayName: data.displayName,
    profileImage: data.profileImage,
    title: '거리 킹',
    icon: '🏃',
    value: `${data.distance.toFixed(1)}km`,
    description: '총 거리 1위',
  };
};

const findRunKing = (members: WorkoutLog[]): MemberTitle | null => {
  const userRuns = new Map<string, { displayName: string; profileImage: string | null; runs: number }>();

  members.forEach((log) => {
    if (!log.userId) return;

    const existing = userRuns.get(log.userId) || {
      displayName: log.userDisplayName!,
      profileImage: log.userProfileImage || null,
      runs: 0,
    };

    log.workouts.forEach((workout) => {
      if (workout.category === 'snowboard' && workout.run_count) {
        existing.runs += workout.run_count;
      }
    });

    userRuns.set(log.userId, existing);
  });

  const rankings = Array.from(userRuns.entries())
    .filter(([_, data]) => data.runs > 0)
    .sort((a, b) => b[1].runs - a[1].runs);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    displayName: data.displayName,
    profileImage: data.profileImage,
    title: '런 킹',
    icon: '🏂',
    value: `${data.runs}회`,
    description: '총 런 수 1위',
  };
};

const findStreakKing = (members: WorkoutLog[]): MemberTitle | null => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const userFrequency = new Map<string, { displayName: string; profileImage: string | null; count: number }>();

  members.forEach((log) => {
    if (!log.userId) return;
    if (new Date(log.createdAt) < sevenDaysAgo) return;

    const existing = userFrequency.get(log.userId) || {
      displayName: log.userDisplayName!,
      profileImage: log.userProfileImage || null,
      count: 0,
    };

    existing.count += 1;
    userFrequency.set(log.userId, existing);
  });

  const rankings = Array.from(userFrequency.entries())
    .filter(([_, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (rankings.length === 0) return null;

  const [userId, data] = rankings[0];

  return {
    userId,
    displayName: data.displayName,
    profileImage: data.profileImage,
    title: '연속 출석',
    icon: '⚡',
    value: `${data.count}일`,
    description: '주간 운동 횟수 최다',
  };
};

// ============================================
// 미션 시스템
// ============================================

export interface Mission {
  title: string;
  current: number;
  target: number;
  progress: number;
  unit: string;
  category: WorkoutCategory;
}

/**
 * 클럽 미션 계산
 * 클럽의 주요 카테고리에 따라 목표 자동 설정
 */
export const calculateMission = (members: WorkoutLog[], mainCategory: WorkoutCategory): Mission => {
  let current = 0;
  let target = 0;
  let unit = '';
  let title = '';

  switch (mainCategory) {
    case 'gym':
      // 총 볼륨 목표: 100톤
      members.forEach((log) => {
        log.workouts.forEach((workout) => {
          if (workout.type === 'strength' && workout.volume_kg) {
            current += workout.volume_kg;
          }
        });
      });
      target = 100000; // kg
      unit = 't';
      title = '볼륨 목표';
      current = current / 1000; // 톤으로 변환
      target = target / 1000;
      break;

    case 'running':
      // 총 거리 목표: 400km (서울-부산)
      members.forEach((log) => {
        log.workouts.forEach((workout) => {
          if (workout.type === 'cardio' && workout.adjusted_dist_km) {
            current += workout.adjusted_dist_km;
          }
        });
      });
      target = 400;
      unit = 'km';
      title = '거리 목표';
      break;

    case 'snowboard':
      // 총 런 목표: 8,848m (에베레스트 높이)
      members.forEach((log) => {
        log.workouts.forEach((workout) => {
          if (workout.category === 'snowboard' && workout.run_count) {
            current += workout.run_count;
          }
        });
      });
      target = 8848;
      unit = 'm';
      title = '고도 목표';
      break;

    default:
      // 기본: 총 운동 횟수
      members.forEach((log) => {
        current += log.workouts.length;
      });
      target = 1000;
      unit = '회';
      title = '운동 목표';
  }

  const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return {
    title,
    current: Number(current.toFixed(1)),
    target: Number(target.toFixed(1)),
    progress: Number(progress.toFixed(1)),
    unit,
    category: mainCategory,
  };
};

// ============================================
// 오늘의 출석부
// ============================================

export interface SquadMember {
  userId: string;
  displayName: string;
  profileImage: string | null;
  mainActivity: string; // 🏂, 🏋️, 🏃
  memo: string | null;
  workoutCount: number;
}

/**
 * 오늘 운동한 멤버 필터링
 */
export const getTodaySquad = (members: WorkoutLog[]): SquadMember[] => {
  const today = new Date().toISOString().split('T')[0];

  const squadMap = new Map<string, SquadMember>();

  members.forEach((log) => {
    if (log.date !== today) return;
    if (!log.userId) return;

    const existing = squadMap.get(log.userId) || {
      userId: log.userId,
      displayName: log.userDisplayName!,
      profileImage: log.userProfileImage || null,
      mainActivity: '💪',
      memo: log.memo || null,
      workoutCount: 0,
    };

    // 가장 비중이 높은 운동 타입 찾기
    const typeCounts = new Map<string, number>();
    log.workouts.forEach((workout) => {
      const icon = getActivityIcon(workout.category, workout.type);
      typeCounts.set(icon, (typeCounts.get(icon) || 0) + 1);
    });

    const maxIcon = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '💪';
    existing.mainActivity = maxIcon;
    existing.workoutCount += log.workouts.length;

    squadMap.set(log.userId, existing);
  });

  return Array.from(squadMap.values()).sort((a, b) => b.workoutCount - a.workoutCount);
};

const getActivityIcon = (category: WorkoutCategory, type: string): string => {
  if (category === 'snowboard') return '🏂';
  if (type === 'cardio') return '🏃';
  if (type === 'strength') return '🏋️';
  if (type === 'skill') return '🎯';
  return '💪';
};

// ============================================
// Live Ticker
// ============================================

export interface TickerItem {
  id: string;
  icon: string;
  text: string;
  timestamp: number;
}

/**
 * 최신 활동 피드 생성
 */
export const generateTickerItems = (members: WorkoutLog[], limit: number = 10): TickerItem[] => {
  const items: TickerItem[] = [];

  // 최신순 정렬
  const sorted = [...members].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);

  sorted.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    // 대표 운동 선택 (가장 인상적인 것)
    const bestWorkout = log.workouts.reduce((best, current) => {
      const currentScore = getWorkoutScore(current);
      const bestScore = getWorkoutScore(best);
      return currentScore > bestScore ? current : best;
    }, log.workouts[0]);

    if (!bestWorkout) return;

    const icon = getActivityIcon(bestWorkout.category, bestWorkout.type);
    const text = formatTickerText(log.userDisplayName, bestWorkout);

    items.push({
      id: log.id,
      icon,
      text,
      timestamp: log.createdAt,
    });
  });

  return items;
};

const getWorkoutScore = (workout: any): number => {
  // 인상적인 운동일수록 높은 점수
  if (workout.volume_kg) return workout.volume_kg / 100;
  if (workout.adjusted_dist_km) return workout.adjusted_dist_km * 10;
  if (workout.run_count) return workout.run_count * 5;
  return 1;
};

const formatTickerText = (displayName: string, workout: any): string => {
  const name = workout.name;

  if (workout.volume_kg && workout.volume_kg > 1000) {
    const tons = (workout.volume_kg / 1000).toFixed(1);
    return `${displayName}님 ${name} ${tons}t 달성`;
  }

  if (workout.adjusted_dist_km && workout.adjusted_dist_km > 10) {
    return `${displayName}님 ${workout.adjusted_dist_km.toFixed(1)}km 완주`;
  }

  if (workout.run_count && workout.run_count > 20) {
    return `${displayName}님 ${workout.run_count}런 완료`;
  }

  return `${displayName}님 ${name} 완료`;
};
