import React, { useState, useEffect } from 'react';
import './App.css';
import JobsList from './components/JobsList';
import ApplicationsList from './components/ApplicationsList';
import GoalsPanel from './components/GoalsPanel';
import ResumesPanel from './components/ResumesPanel';
import Stats from './components/Stats';

function App() {
  const [activeTab, setActiveTab] = useState<'jobs' | 'applications' | 'goals' | 'resumes' | 'stats'>('jobs');

  return (
    <div className="app">
      <header className="header">
        <h1>Job Applier</h1>
        <nav className="nav">
          <button
            className={`nav-button ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            Jobs
          </button>
          <button
            className={`nav-button ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            Applications
          </button>
          <button
            className={`nav-button ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Stats
          </button>
          <button
            className={`nav-button ${activeTab === 'resumes' ? 'active' : ''}`}
            onClick={() => setActiveTab('resumes')}
          >
            Resumes
          </button>
          <button
            className={`nav-button ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => setActiveTab('goals')}
          >
            Goals
          </button>
        </nav>
      </header>

      <main className="main">
        {activeTab === 'jobs' && <JobsList />}
        {activeTab === 'applications' && <ApplicationsList />}
        {activeTab === 'stats' && <Stats />}
        {activeTab === 'resumes' && <ResumesPanel />}
        {activeTab === 'goals' && <GoalsPanel />}
      </main>
    </div>
  );
}

export default App;
