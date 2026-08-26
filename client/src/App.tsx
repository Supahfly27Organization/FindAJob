import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import PositionTitlesPage from './pages/PositionTitlesPage';
import PostingsPage from './pages/PostingsPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-masthead">
        <span className="app-wordmark">FindAJob</span>
        <nav className="app-nav" aria-label="Sections">
          <NavLink to="/titles" className={({ isActive }) => (isActive ? 'active' : '')}>
            Position Titles
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>
            Settings
          </NavLink>
        </nav>
      </header>
      <main className="app-main" id="main">
        <Routes>
          <Route path="/" element={<Navigate to="/titles" replace />} />
          <Route path="/titles" element={<PositionTitlesPage />} />
          <Route path="/titles/:id/postings" element={<PostingsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
}
