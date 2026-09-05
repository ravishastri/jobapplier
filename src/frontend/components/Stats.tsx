import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface StatsData {
  total: number;
  applied: number;
  rejected: number;
  interviews: number;
  offers: number;
}

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3001/api/applications/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!stats) {
    return <div className="panel">Loading...</div>;
  }

  const successRate = stats.total > 0 ? Math.round(((stats.interviews + stats.offers) / stats.total) * 100) : 0;

  return (
    <div className="panel">
      <h2>Application Stats</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Applications</h3>
          <p className="stat-value">{stats.total}</p>
        </div>
        <div className="stat-card">
          <h3>Applied</h3>
          <p className="stat-value">{stats.applied}</p>
        </div>
        <div className="stat-card">
          <h3>Rejected</h3>
          <p className="stat-value">{stats.rejected}</p>
        </div>
        <div className="stat-card">
          <h3>Interviews</h3>
          <p className="stat-value">{stats.interviews}</p>
        </div>
        <div className="stat-card">
          <h3>Offers</h3>
          <p className="stat-value">{stats.offers}</p>
        </div>
        <div className="stat-card">
          <h3>Success Rate</h3>
          <p className="stat-value">{successRate}%</p>
        </div>
      </div>
    </div>
  );
}
