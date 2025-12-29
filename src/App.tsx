import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { History } from './pages/History';
import { TodoList } from './pages/TodoList';
import { Recommend } from './pages/Recommend';
import { BottomNav } from './components/BottomNav';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<History />} />
          <Route path="/todo" element={<TodoList />} />
          <Route path="/recommend" element={<Recommend />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
