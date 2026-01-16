import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService';

export const Signup = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithKakao } = useAuth();

  const kakaoUserInfo = location.state?.kakaoUserInfo;
  const fromPath = location.state?.from || '/';

  const [formData, setFormData] = useState({
    username: kakaoUserInfo ? `kakao_${kakaoUserInfo.id}` : '',
    name: kakaoUserInfo?.displayName || '',
    password: '',
    passwordConfirm: '',
    email: kakaoUserInfo?.email || '',
    phone: kakaoUserInfo?.phoneNumber || '',
    birthYear: kakaoUserInfo?.birthyear || '',
    gender: kakaoUserInfo?.gender || '',
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [agreedToSensitiveInfo, setAgreedToSensitiveInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 카카오 로그인이면 폼 자동 입력
  useEffect(() => {
    if (kakaoUserInfo) {
      setFormData({
        username: `kakao_${kakaoUserInfo.id}`,
        name: kakaoUserInfo.displayName,
        password: '',
        passwordConfirm: '',
        email: kakaoUserInfo.email,
        phone: kakaoUserInfo.phoneNumber || '',
        birthYear: kakaoUserInfo.birthyear || '',
        gender: kakaoUserInfo.gender || '',
      });
    }
  }, [kakaoUserInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agreedToTerms || !agreedToPrivacy || !agreedToSensitiveInfo) {
      setError('필수 약관에 모두 동의해주세요.');
      return;
    }

    // 카카오 회원가입
    if (kakaoUserInfo) {
      setLoading(true);
      try {
        const userData = await authService.registerKakaoUser(kakaoUserInfo);
        await loginWithKakao(userData);
        alert('회원가입이 완료되었습니다!');
        navigate(fromPath, { replace: true });
      } catch (err) {
        console.error('회원가입 실패:', err);
        setError(err instanceof Error ? err.message : '회원가입에 실패했습니다.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // 일반 회원가입 (준비 중)
    alert('일반 회원가입 기능은 준비 중입니다. 카카오 로그인을 이용해주세요.');
  };

  return (
    <div className="container">
      <div className="signup-container">
        <h1>회원가입</h1>
        <p className="signup-subtitle">
          {kakaoUserInfo ? '카카오 계정 정보를 확인해주세요' : 'Voice Workout Log에 오신 것을 환영합니다'}
        </p>

        {error && (
          <div className="error-message" style={{ marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="signup-form">
          <div className="form-group">
            <label htmlFor="username">아이디 *</label>
            <input
              id="username"
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="영문, 숫자 조합 (4-20자)"
              required
              disabled={!!kakaoUserInfo}
              readOnly={!!kakaoUserInfo}
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">이름 *</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="실명을 입력해주세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호 *</label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="영문, 숫자, 특수문자 조합 (8자 이상)"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="passwordConfirm">비밀번호 확인 *</label>
            <input
              id="passwordConfirm"
              type="password"
              value={formData.passwordConfirm}
              onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
              placeholder="비밀번호를 다시 입력해주세요"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">이메일 *</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="example@email.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">전화번호 *</label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="010-1234-5678"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="birthYear">출생연도 *</label>
            <input
              id="birthYear"
              type="number"
              value={formData.birthYear}
              onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
              placeholder="1990"
              min="1900"
              max={new Date().getFullYear()}
              required
            />
            <p className="field-hint">나이대별 맞춤 운동 추천에 활용됩니다</p>
          </div>

          <div className="form-group">
            <label htmlFor="gender">성별 *</label>
            <select
              id="gender"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              required
            >
              <option value="">선택해주세요</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>

          {kakaoUserInfo && (
            <div className="form-group">
              <label htmlFor="kakaoId">카카오 계정 연동</label>
              <input
                id="kakaoId"
                type="text"
                value={`카카오 ID: ${kakaoUserInfo.id}`}
                readOnly
                disabled
                style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
              />
              <p className="field-hint">카카오 로그인으로 승인된 계정입니다</p>
            </div>
          )}

          <div className="agreements-section">
            <div className="agreement-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  required
                />
                <span>
                  <Link to="/terms" target="_blank" className="link-text">
                    이용약관
                  </Link>
                  에 동의합니다 (필수)
                </span>
              </label>
            </div>

            <div className="agreement-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={agreedToPrivacy}
                  onChange={(e) => setAgreedToPrivacy(e.target.checked)}
                  required
                />
                <span>
                  <Link to="/privacy" target="_blank" className="link-text">
                    개인정보처리방침
                  </Link>
                  에 동의합니다 (필수)
                </span>
              </label>
            </div>

            <div className="agreement-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={agreedToSensitiveInfo}
                  onChange={(e) => setAgreedToSensitiveInfo(e.target.checked)}
                  required
                />
                <span>
                  민감정보(건강정보) 수집 및 이용에 동의합니다 (필수)
                </span>
              </label>
            </div>
            <p className="field-hint" style={{ marginTop: '12px', textAlign: 'left' }}>
              운동 기록, 신체 활동 정보 등 건강 관련 민감정보가 수집됩니다.
            </p>
          </div>

          <button
            type="submit"
            className="primary-button"
            disabled={!agreedToTerms || !agreedToPrivacy || !agreedToSensitiveInfo || loading}
          >
            {loading ? '회원가입 중...' : '회원가입'}
          </button>
        </form>

        <div className="signup-footer">
          <p>
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="link-text">
              로그인
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
