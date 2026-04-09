import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

export default function App() {
  const [repos, setRepos] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [reposRes, healthRes] = await Promise.all([
        fetch('/api/repos'),
        fetch('/api/health')
      ]);
      
      const reposData = await reposRes.json();
      const healthData = await healthRes.json();
      
      setRepos(reposData);
      setHealth(healthData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🎯 Helix Collective Dashboard</h1>
        <p>Real-time monitoring of all 13 repositories</p>
      </header>

      <div className="stats">
        <div className="stat-card">
          <h3>Repositories</h3>
          <p className="stat-value">{repos.length}</p>
        </div>
        <div className="stat-card">
          <h3>Status</h3>
          <p className="stat-value" style={{ color: health?.status === 'healthy' ? '#10b981' : '#ef4444' }}>
            {health?.status || 'Unknown'}
          </p>
        </div>
        <div className="stat-card">
          <h3>Total Stars</h3>
          <p className="stat-value">{repos.reduce((sum, r) => sum + (r.stars || 0), 0)}</p>
        </div>
        <div className="stat-card">
          <h3>Last Updated</h3>
          <p className="stat-value">{new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      <div className="repos-grid">
        {repos.map((repo) => (
          <div key={repo.name} className="repo-card">
            <div className="repo-header">
              <h3>{repo.name}</h3>
              <span className={`status ${repo.status}`}>{repo.status}</span>
            </div>
            <p className="repo-desc">{repo.description || 'No description'}</p>
            <div className="repo-stats">
              <div className="stat">
                <span>⭐</span>
                <span>{repo.stars || 0}</span>
              </div>
              <div className="stat">
                <span>🍴</span>
                <span>{repo.forks || 0}</span>
              </div>
              <div className="stat">
                <span>💻</span>
                <span>{repo.language || 'N/A'}</span>
              </div>
            </div>
            <a href={repo.url} target="_blank" rel="noopener noreferrer" className="repo-link">
              View on GitHub →
            </a>
          </div>
        ))}
      </div>

      <footer className="footer">
        <p>Helix Collective Ecosystem • 388,476 LOC • 13 Production-Ready Repositories</p>
      </footer>
    </div>
  );
}
