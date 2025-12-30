import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { History } from './pages/History';
import { Dashboard } from './pages/Dashboard';
import { TodoList } from './pages/TodoList';
import { Recommend } from './pages/Recommend';
import { BottomNav } from './components/BottomNav';
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
      <Routes>
        <Route path="/" element={<History />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/todo" element={<TodoList />} />
        <Route path="/recommend" element={<Recommend />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="app-container">
          <ProtectedRoutes />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
