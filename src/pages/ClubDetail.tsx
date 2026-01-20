import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clubService from '../services/clubService';
import challengeService from '../services/challengeService';
import { getClubMemberLogs } from '../storage/clubStorage';
import type {
  ClubDetail,
  WorkoutLog,
  ClubChallenge,
  ClubMemberWithUser,
} from '../types';

type TabType = 'feed' | 'challenge' | 'members';

export const ClubDetailPage = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabType>('feed');
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
        case 'feed':
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
          className={`mode-button ${tab === 'feed' ? 'active' : ''}`}
          onClick={() => setTab('feed')}
        >
          피드
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

      {/* Feed Tab */}
      {tab === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {memberLogs.length === 0 ? (
            <div className="empty-state">
              <p>아직 공유된 운동이 없습니다.</p>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                멤버들이 운동 기록을 저장하면 여기에 표시됩니다.
              </p>
            </div>
          ) : (
            memberLogs.map((log) => (
              <div key={log.id} className="section">
                {/* User Info Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                  }}
                >
                  {log.userProfileImage ? (
                    <img
                      src={log.userProfileImage}
                      alt={log.userDisplayName}
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      className="profile-avatar"
                      style={{ width: '32px', height: '32px', fontSize: '14px' }}
                    >
                      {(log.userDisplayName || '?')[0]}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>
                      {log.userDisplayName || '익명'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {new Date(log.createdAt).toLocaleString('ko-KR')}
                    </div>
                  </div>
                </div>

                {/* Workout Date */}
                <div className="detail-date" style={{ marginBottom: '12px' }}>
                  {log.date}
                </div>

                {/* Workout Cards */}
                <div className="workout-cards">
                  {log.workouts.map((workout, idx) => (
                    <div key={idx} className={`workout-card ${workout.type}`}>
                      <div className="workout-name">{workout.name}</div>
                      <div className="workout-details">
                        {workout.distance_km && (
                          <span className="distance">{workout.distance_km} km</span>
                        )}
                        {workout.pace && (
                          <span className="pace">{workout.pace} /km</span>
                        )}
                        {workout.weight_kg && (
                          <span className="weight">{workout.weight_kg} kg</span>
                        )}
                        {workout.sets && <span>{workout.sets} 세트</span>}
                        {workout.reps && <span>{workout.reps} 회</span>}
                        {workout.duration_min && <span>{workout.duration_min} 분</span>}
                        {!workout.sets && !workout.reps && !workout.duration_min && !workout.weight_kg && !workout.distance_km && !workout.pace && (
                          <span className="no-details">상세 정보 없음</span>
                        )}
                      </div>
                      {workout.note && <div className="workout-note">{workout.note}</div>}
                      <div className="workout-type-badge">{workout.type}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
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

      {/* Create Challenge Modal */}
      {showCreateChallenge && (
        <CreateChallengeModal
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

// Challenge Creation Modal Component
const CreateChallengeModal = ({
  clubId,
  onClose,
  onSuccess,
}: {
  clubId: string;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [challengeType, setChallengeType] = useState<'total_workouts' | 'total_volume' | 'total_duration' | 'total_distance'>('total_workouts');
  const [targetValue, setTargetValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert('챌린지 제목을 입력해주세요.');
      return;
    }
    if (!targetValue || Number(targetValue) <= 0) {
      alert('목표 값을 입력해주세요.');
      return;
    }
    if (!startDate || !endDate) {
      alert('시작일과 종료일을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await challengeService.createChallenge({
        club_id: clubId,
        title: title.trim(),
        description: description.trim() || undefined,
        challenge_type: challengeType,
        target_value: Number(targetValue),
        start_date: startDate,
        end_date: endDate,
      });
      alert('챌린지가 생성되었습니다!');
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : '챌린지 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        className="section"
        style={{
          maxWidth: '500px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>챌린지 만들기</h3>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>제목 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 11월 볼륨 챌린지"
            maxLength={100}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'var(--input-bg)',
            }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>설명</label>
          <textarea
            className="text-input-area"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="챌린지에 대한 설명 (선택)"
            rows={3}
            maxLength={200}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>챌린지 타입 *</label>
          <select
            value={challengeType}
            onChange={(e) => setChallengeType(e.target.value as any)}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'var(--input-bg)',
            }}
          >
            <option value="total_workouts">총 운동 횟수</option>
            <option value="total_volume">총 볼륨 (kg)</option>
            <option value="total_duration">총 시간 (분)</option>
            <option value="total_distance">총 거리 (km)</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>목표 값 *</label>
          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            placeholder="예: 1000"
            min="1"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'var(--input-bg)',
            }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>시작일 *</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'var(--input-bg)',
            }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label>종료일 *</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              background: 'var(--input-bg)',
            }}
          />
        </div>

        <div className="action-buttons">
          <button className="cancel-button" onClick={onClose}>
            취소
          </button>
          <button
            className="primary-button"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '생성 중...' : '챌린지 만들기'}
          </button>
        </div>
      </div>
    </div>
  );
};
