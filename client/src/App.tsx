import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import PositionTitlesPage from './pages/PositionTitlesPage';
import PostingsPage from './pages/PostingsPage';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <nav className="app-nav">
        <NavLink to="/titles" className={({ isActive }) => (isActive ? 'active' : '')}>
          Position Titles
        </NavLink>
      </nav>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/titles" replace />} />
          <Route path="/titles" element={<PositionTitlesPage />} />
          <Route path="/titles/:id/postings" element={<PostingsPage />} />
          <Route path="*" element={<Navigate to="/titles" replace />} />
        </Routes>
      </main>
    </div>
  );
}
