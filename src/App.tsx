import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { History } from './pages/History';
import { Dashboard } from './pages/Dashboard';
import { TodoList } from './pages/TodoList';
import { Recommend } from './pages/Recommend';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { FEATURES } from './config/features';
import './App.css';

function ProtectedRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <div className="loading-screen">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<History />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/todo" element={<TodoList />} />
        <Route path="/recommend" element={<Recommend />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
      {FEATURES.SHOW_FOOTER && <Footer />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/signup" element={<Signup />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          {/* Protected routes */}
          <Route path="/*" element={
            <div className="app-container">
              <ProtectedRoutes />
            </div>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
