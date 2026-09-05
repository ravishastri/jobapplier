import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Application {
  id: number;
  title: string;
  company: string;
  status: string;
  applied_at: string;
  agent_score?: number;
  outcome?: string;
}

export default function ApplicationsList() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3001/api/applications');
      setApplications(response.data);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied':
        return 'status-applied';
      case 'rejected':
        return 'status-rejected';
      case 'interview':
        return 'status-interview';
      case 'offer':
        return 'status-offer';
      default:
        return 'status-pending';
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Applications</h2>
        <button onClick={fetchApplications} className="btn btn-secondary">
          Refresh
        </button>
      </div>

      <div className="applications-list">
        {applications.length === 0 ? (
          <p className="empty-state">No applications yet.</p>
        ) : (
          applications.map((app) => (
            <div key={app.id} className="app-card">
              <div className="app-header">
                <h3>{app.title}</h3>
                <span className={`status ${getStatusColor(app.status)}`}>{app.status}</span>
              </div>
              <p className="company">{app.company}</p>
              {app.applied_at && <p className="date">Applied: {new Date(app.applied_at).toLocaleDateString()}</p>}
              {app.agent_score && <p className="score">Score: {app.agent_score}/100</p>}
              {app.outcome && <p className="outcome">Outcome: {app.outcome}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
