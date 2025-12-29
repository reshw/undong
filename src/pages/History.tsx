import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutLog } from '../types';
import { getAllLogs, deleteLog } from '../storage/logStorage';

export const History = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkoutLog | null>(null);

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
            </div>
          )}

          <button
            className="delete-button"
            onClick={() => handleDelete(selectedLog.id)}
          >
            삭제
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>히스토리</h1>
        <button className="nav-button" onClick={() => navigate('/')}>
          홈
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="empty-state">
          <p>아직 운동 기록이 없습니다.</p>
          <button className="primary-button" onClick={() => navigate('/')}>
            기록 추가하기
          </button>
        </div>
      ) : (
        <div className="history-list">
          {dates.map((date) => (
            <div key={date} className="date-group">
              <div className="date-header">{formatDateDisplay(date)}</div>
              {groupedLogs[date].map((log) => (
                <div
                  key={log.id}
                  className="log-item"
                  onClick={() => setSelectedLog(log)}
                >
                  <div className="log-preview">
                    {log.rawText.length > 80
                      ? log.rawText.substring(0, 80) + '...'
                      : log.rawText}
                  </div>
                  <div className="log-meta">
                    {log.workouts.length > 0 && (
                      <span className="log-count">{log.workouts.length}개 운동</span>
                    )}
                    <span className="log-time">
                      {new Date(log.createdAt).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
