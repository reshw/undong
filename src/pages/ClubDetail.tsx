import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clubService from '../services/clubService';
import challengeService from '../services/challengeService';
import { getClubMemberLogs } from '../storage/clubStorage';
import { formatMetric } from '../utils/calculateMetrics';
import {
  calculateTitles,
  getTodaySquad,
  generateTickerItems,
} from '../utils/dashboardLogic';
import { ChallengeWizard } from '../components/challenge/ChallengeWizard';
import type {
  ClubDetail,
  WorkoutLog,
  ClubChallenge,
  ClubMemberWithUser,
} from '../types';

type TabType = 'dashboard' | 'challenge' | 'members';

export const ClubDetailPage = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabType>('dashboard');
  const [club, setClub] = useState<ClubDetail | null>(null);
  const [memberLogs, setMemberLogs] = useState<WorkoutLog[]>([]);
  const [challenges, setChallenges] = useState<ClubChallenge[]>([]);
  const [members, setMembers] = useState<ClubMemberWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<'owner' | 'admin' | 'member' | null>(null);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);

  useEffect(() => {
    if (clubId) {
      loadClubData();
    }
  }, [clubId]);

  useEffect(() => {
    if (clubId && club) {
      loadTabData();
    }
  }, [tab, club]);

  const loadClubData = async () => {
    if (!clubId) return;

    setLoading(true);
    try {
      const clubData = await clubService.getClubDetail(clubId);
      setClub(clubData);

      // Get my role
      const membersList = await clubService.getClubMembers(clubId);
      const currentUserId = localStorage.getItem('current_user')
        ? JSON.parse(localStorage.getItem('current_user')!).id
        : null;
      const myMembership = membersList.find((m) => m.user_id === currentUserId);
      setMyRole(myMembership?.role || null);
    } catch (error) {
      console.error('클럽 로드 실패:', error);
      alert('클럽을 불러오는데 실패했습니다.');
      navigate('/club');
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    if (!clubId) return;

    try {
      switch (tab) {
        case 'dashboard':
          // Zero-Copy View: 클럽 멤버들의 공개 로그를 직접 조회
          const logs = await getClubMemberLogs(clubId);
          setMemberLogs(logs);
          break;
        case 'challenge':
          const challengeData = await challengeService.getActiveChallenges(clubId);
          setChallenges(challengeData);
          break;
        case 'members':
          const memberData = await clubService.getClubMembers(clubId);
          setMembers(memberData);
          break;
      }
    } catch (error) {
      console.error('데이터 로드 실패:', error);
    }
  };

  const handleInvite = () => {
    if (!club) return;
    clubService.shareToKakao(club);
  };

  const handleLeave = async () => {
    if (!clubId || !confirm('정말 클럽을 탈퇴하시겠습니까?')) return;

    try {
      await clubService.leaveClub(clubId);
      alert('클럽을 탈퇴했습니다.');
      navigate('/club');
    } catch (error) {
      alert(error instanceof Error ? error.message : '탈퇴에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">로딩 중...</div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="container">
        <div className="empty-state">
          <p>클럽을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <button className="back-button" onClick={() => navigate('/club')}>
          ← 뒤로
        </button>
        <h2>{club.name}</h2>
      </div>

      {/* Club Info Card */}
      <div className="section" style={{ marginBottom: '20px' }}>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            marginBottom: '12px',
          }}
        >
          {club.description || '설명이 없습니다.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div className="stat-chip">{club.is_public ? '🌐 공개' : '🔒 비공개'}</div>
          <div className="stat-chip">👥 {club.member_count}명</div>
          <div className="stat-chip">🎯 챌린지 {club.active_challenge_count}개</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="primary-button" onClick={handleInvite}>
            📤 초대하기
          </button>
          {myRole !== 'owner' && (
            <button className="cancel-button" onClick={handleLeave}>
              탈퇴
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mode-selector">
        <button
          className={`mode-button ${tab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setTab('dashboard')}
        >
          대시보드
        </button>
        <button
          className={`mode-button ${tab === 'challenge' ? 'active' : ''}`}
          onClick={() => setTab('challenge')}
        >
          챌린지
        </button>
        <button
          className={`mode-button ${tab === 'members' ? 'active' : ''}`}
          onClick={() => setTab('members')}
        >
          멤버
        </button>
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Live Ticker */}
          <LiveTicker members={memberLogs} />

          {/* Hall of Fame - Dynamic Titles */}
          <HallOfFame members={memberLogs} />

          {/* Daily Squad */}
          <DailySquad members={memberLogs} />

          {/* 리더보드 (기존 유지) */}
          <LeaderboardSection
            title="🏃 유산소 킹"
            subtitle="평지 환산 거리 기준"
            members={memberLogs}
            metricType="cardio"
          />
          <LeaderboardSection
            title="🏋️ 스트렝스 킹"
            subtitle="총 볼륨 기준"
            members={memberLogs}
            metricType="strength"
          />
          <LeaderboardSection
            title="🏂 슬로프 킹"
            subtitle="런 수 기준"
            members={memberLogs}
            metricType="snowboard"
          />
        </div>
      )}


      {/* Challenge Tab */}
      {tab === 'challenge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(myRole === 'owner' || myRole === 'admin') && (
            <button
              className="primary-button"
              onClick={() => setShowCreateChallenge(true)}
            >
              + 챌린지 만들기
            </button>
          )}
          {challenges.length === 0 ? (
            <div className="empty-state">
              <p>진행 중인 챌린지가 없습니다.</p>
            </div>
          ) : (
            challenges.map((challenge) => {
              const progress = challengeService.calculateProgress(
                challenge.current_value,
                challenge.target_value
              );
              return (
                <div
                  key={challenge.id}
                  className="section"
                  onClick={() => navigate(`/club/${clubId}/challenge/${challenge.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
                    {challenge.title}
                  </h3>
                  {challenge.description && (
                    <p
                      style={{
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        marginBottom: '12px',
                      }}
                    >
                      {challenge.description}
                    </p>
                  )}
                  <div className="progress-bar-container">
                    <div className="progress-bar" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="progress-text">
                    {challenge.current_value} / {challenge.target_value} ({progress}%)
                  </div>
                  <div className="log-meta">
                    <span>
                      {challenge.start_date} ~ {challenge.end_date}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {members.map((member) => (
            <div key={member.id} className="log-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="profile-avatar"
                  style={{ width: '40px', height: '40px', fontSize: '16px' }}
                >
                  {member.user.display_name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: '600' }}>
                    {member.user.display_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    @{member.user.username}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    background: 'var(--primary-color)',
                    color: 'white',
                    borderRadius: '6px',
                  }}
                >
                  {member.role === 'owner' && '👑 소유자'}
                  {member.role === 'admin' && '⭐ 관리자'}
                  {member.role === 'member' && '👤 멤버'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Challenge Wizard */}
      {showCreateChallenge && (
        <ChallengeWizard
          clubId={clubId!}
          onClose={() => setShowCreateChallenge(false)}
          onSuccess={() => {
            setShowCreateChallenge(false);
            loadTabData();
          }}
        />
      )}
    </div>
  );
};


// ============================================
// Gamified Dashboard Components
// ============================================

// Live Ticker - 실시간 활동 피드 (뉴스 티커 스타일)
const LiveTicker = ({ members }: { members: WorkoutLog[] }) => {
  const tickerItems = useMemo(() => generateTickerItems(members, 15), [members]);

  if (tickerItems.length === 0) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '2px solid #334155',
        borderRadius: '12px',
        padding: '16px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <div style={{ fontSize: '20px' }}>📡</div>
        <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>LIVE ACTIVITY</h3>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}
      >
        {tickerItems.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              fontSize: '14px',
              borderLeft: '3px solid var(--primary-color)',
            }}
          >
            <div style={{ fontSize: '18px' }}>{item.icon}</div>
            <div style={{ flex: 1, color: '#e2e8f0' }}>{item.text}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              {new Date(item.timestamp).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


// Hall of Fame - 동적 타이틀 시스템
const HallOfFame = ({ members }: { members: WorkoutLog[] }) => {
  const titles = useMemo(() => calculateTitles(members), [members]);

  if (titles.length === 0) {
    return (
      <div className="section">
        <h3>🏆 명예의 전당</h3>
        <div className="empty-state">
          <p>아직 타이틀을 획득한 멤버가 없습니다.</p>
        </div>
      </div>
    );
  }

  const getTitleColor = (icon: string): string => {
    if (icon === '🌅') return '#f97316'; // orange
    if (icon === '🏋️') return '#ef4444'; // red
    if (icon === '🏃') return '#3b82f6'; // blue
    if (icon === '🏂') return '#8b5cf6'; // purple
    if (icon === '⚡') return '#eab308'; // yellow
    return '#64748b';
  };

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '2px solid #334155',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px', color: '#e2e8f0' }}>
        🏆 명예의 전당
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '12px',
        }}
      >
        {titles.map((title) => (
          <div
            key={title.userId + title.title}
            style={{
              background: `linear-gradient(135deg, ${getTitleColor(title.icon)}22 0%, ${getTitleColor(title.icon)}11 100%)`,
              border: `2px solid ${getTitleColor(title.icon)}66`,
              borderRadius: '12px',
              padding: '16px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Title Badge */}
            <div
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: getTitleColor(title.icon),
                color: 'white',
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{title.icon}</span>
              <span>{title.title}</span>
            </div>

            {/* User Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              {title.profileImage ? (
                <img
                  src={title.profileImage}
                  alt={title.displayName}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: `3px solid ${getTitleColor(title.icon)}`,
                  }}
                />
              ) : (
                <div
                  className="profile-avatar"
                  style={{
                    width: '48px',
                    height: '48px',
                    fontSize: '20px',
                    border: `3px solid ${getTitleColor(title.icon)}`,
                  }}
                >
                  {title.displayName[0]}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0' }}>
                  {title.displayName}
                </div>
              </div>
            </div>

            {/* Achievement Value */}
            <div style={{ marginTop: '12px' }}>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  color: getTitleColor(title.icon),
                  marginBottom: '4px',
                }}
              >
                {title.value}
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>{title.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Daily Squad - 오늘의 출석부
const DailySquad = ({ members }: { members: WorkoutLog[] }) => {
  const squad = useMemo(() => getTodaySquad(members), [members]);

  if (squad.length === 0) {
    return (
      <div className="section">
        <h3>👥 오늘의 스쿼드</h3>
        <div className="empty-state">
          <p>오늘 운동한 멤버가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '2px solid #334155',
        borderRadius: '12px',
        padding: '20px',
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0', marginBottom: '4px' }}>
          👥 오늘의 스쿼드
        </h3>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
          {squad.length}명이 오늘 운동했습니다
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '12px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {squad.map((member) => (
          <div
            key={member.userId}
            style={{
              minWidth: '160px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '2px solid #334155',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'center',
              position: 'relative',
            }}
          >
            {/* Activity Icon Badge */}
            <div
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                fontSize: '20px',
              }}
            >
              {member.mainActivity}
            </div>

            {/* Profile */}
            {member.profileImage ? (
              <img
                src={member.profileImage}
                alt={member.displayName}
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginBottom: '12px',
                }}
              />
            ) : (
              <div
                className="profile-avatar"
                style={{
                  width: '64px',
                  height: '64px',
                  fontSize: '28px',
                  margin: '0 auto 12px',
                }}
              >
                {member.displayName[0]}
              </div>
            )}

            {/* Name */}
            <div
              style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#e2e8f0',
                marginBottom: '8px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {member.displayName}
            </div>

            {/* Workout Count */}
            <div
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                marginBottom: '8px',
              }}
            >
              {member.workoutCount}개 운동
            </div>

            {/* Memo Speech Bubble */}
            {member.memo && (
              <div
                style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid #8b5cf6',
                  borderRadius: '8px',
                  padding: '8px',
                  fontSize: '12px',
                  color: '#c4b5fd',
                  marginTop: '8px',
                  lineHeight: '1.4',
                  maxHeight: '60px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                💬 {member.memo}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Leaderboard Section Component
const LeaderboardSection = ({
  title,
  subtitle,
  members,
  metricType,
}: {
  title: string;
  subtitle: string;
  members: WorkoutLog[];
  metricType: 'cardio' | 'strength' | 'snowboard';
}) => {
  // 사용자별 집계
  interface UserMetric {
    userId: string;
    displayName: string;
    profileImage: string | null;
    value: number;
  }

  const userMetrics = new Map<string, UserMetric>();

  members.forEach((log) => {
    if (!log.userId || !log.userDisplayName) return;

    const existingMetric = userMetrics.get(log.userId) || {
      userId: log.userId,
      displayName: log.userDisplayName,
      profileImage: log.userProfileImage || null,
      value: 0,
    };

    log.workouts.forEach((workout) => {
      let value = 0;

      switch (metricType) {
        case 'cardio':
          if (workout.type === 'cardio' && workout.adjusted_dist_km) {
            value = workout.adjusted_dist_km;
          }
          break;
        case 'strength':
          if (workout.type === 'strength' && workout.volume_kg) {
            value = workout.volume_kg;
          }
          break;
        case 'snowboard':
          if (workout.category === 'snowboard' && workout.run_count) {
            value = workout.run_count;
          }
          break;
      }

      existingMetric.value += value;
    });

    userMetrics.set(log.userId, existingMetric);
  });

  // 정렬 (내림차순)
  const rankings = Array.from(userMetrics.values())
    .filter((m) => m.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // 상위 10명

  if (rankings.length === 0) {
    return (
      <div className="section">
        <h3>{title}</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{subtitle}</p>
        <div className="empty-state">
          <p>아직 기록이 없습니다.</p>
        </div>
      </div>
    );
  }

  const formatValue = (value: number): string => {
    switch (metricType) {
      case 'cardio':
        return formatMetric(value, 'distance');
      case 'strength':
        return formatMetric(value, 'volume');
      case 'snowboard':
        return formatMetric(value, 'count');
      default:
        return String(value);
    }
  };

  return (
    <div className="section">
      <h3>{title}</h3>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        {subtitle}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {rankings.map((user, index) => (
          <div
            key={user.userId}
            className="log-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: index < 3 ? 'var(--highlight-bg)' : undefined,
            }}
          >
            {/* 순위 */}
            <div
              style={{
                fontSize: '18px',
                fontWeight: '700',
                width: '30px',
                textAlign: 'center',
                color:
                  index === 0
                    ? '#FFD700'
                    : index === 1
                    ? '#C0C0C0'
                    : index === 2
                    ? '#CD7F32'
                    : 'var(--text-secondary)',
              }}
            >
              {index + 1}
            </div>

            {/* 프로필 */}
            {user.profileImage ? (
              <img
                src={user.profileImage}
                alt={user.displayName}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <div
                className="profile-avatar"
                style={{ width: '40px', height: '40px', fontSize: '16px' }}
              >
                {user.displayName[0]}
              </div>
            )}

            {/* 이름 */}
            <div style={{ flex: 1, fontSize: '16px', fontWeight: '600' }}>
              {user.displayName}
            </div>

            {/* 점수 */}
            <div
              style={{
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--primary-color)',
              }}
            >
              {formatValue(user.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
