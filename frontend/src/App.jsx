import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ResultsPage from './pages/ResultsPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <Router>
      <div className="app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Navigation */}
        <nav className="navbar">
          <div className="container">
            <NavLink to="/" className="navbar-brand">
              <span className="brand-icon">🎓</span>
              <span>NAVO<span className="brand-accent">DISHA</span></span>
            </NavLink>
            <ul className="navbar-nav">
              <li>
                <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end>
                  🏠 Home
                </NavLink>
              </li>
              <li>
                <NavLink to="/results" className={({ isActive }) => isActive ? 'active' : ''}>
                  📊 Results
                </NavLink>
              </li>
              <li>
                <NavLink to="/admin" className={({ isActive }) => isActive ? 'active' : ''}>
                  ⚙️ Admin
                </NavLink>
              </li>
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="footer">
          <div className="container">
            <p>
              🎓 MHTCET College Predictor — Built for Maharashtra Engineering, Pharmacy, Nursing &amp; Agriculture Aspirants
            </p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
              Predictions based on previous year CAP round cutoff data. Actual results may vary.
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
