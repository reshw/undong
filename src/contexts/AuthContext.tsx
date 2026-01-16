import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  username: string;
  display_name: string;
  email?: string;
  kakao_id?: string;
  provider?: string;
  profile_image?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string) => Promise<void>;
  loginWithKakao: (userData: User) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 로컬스토리지에서 사용자 정보 복원
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string) => {
    try {
      // Supabase에서 사용자 조회
      const { data, error } = await supabase
        .from('users')
        .select('id, username, display_name, email')
        .eq('username', username)
        .single();

      if (error) throw error;
      if (!data) throw new Error('사용자를 찾을 수 없습니다.');

      setUser(data);
      localStorage.setItem('current_user', JSON.stringify(data));
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  const loginWithKakao = async (userData: User) => {
    try {
      setUser(userData);
      localStorage.setItem('current_user', JSON.stringify(userData));
    } catch (err) {
      console.error('Kakao login error:', err);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('current_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithKakao, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
