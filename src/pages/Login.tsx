import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Login = () => {
  const [username, setUsername] = useState('tester01');
  const [password, setPassword] = useState('test');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username);
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = () => {
    alert('카카오 로그인 기능은 준비 중입니다.');
  };

  return (
    <div className="container">
      <div className="login-container">
        <h1>🏋️ Voice Workout Log</h1>
        <p className="login-subtitle">운동 기록 앱</p>

        <button type="button" className="kakao-login-button" onClick={handleKakaoLogin}>
          <span className="kakao-icon">💬</span>
          카카오 로그인하기
        </button>

        <div className="divider">
          <span>또는</span>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="username">사용자 이름</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tester01"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="test"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="login-hint">
          <p>테스트 계정: tester01 / test</p>
        </div>

        <div className="login-footer">
          <p>
            계정이 없으신가요?{' '}
            <Link to="/signup" className="link-text">
              회원가입
            </Link>
          </p>
        </div>

        <div className="login-business-info">
          <p>jh308(제이에이치308) | 대표자: 양석환 | 사업자번호: 188-17-02548</p>
        </div>
      </div>
    </div>
  );
};
