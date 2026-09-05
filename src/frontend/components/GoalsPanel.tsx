import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function GoalsPanel() {
  const [goals, setGoals] = useState({
    min_salary: 100000,
    max_salary: 200000,
    required_tech_stack: ['TypeScript', 'React', 'Node.js'],
    avoid_tech_stack: ['PHP', 'Perl'],
    preferred_roles: ['Senior Engineer', 'Full Stack'],
    remote_preference: 'remote',
    seniority_level: 'Mid-level',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/goals');
      if (response.data && Object.keys(response.data).length > 0) {
        setGoals(response.data);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await axios.post('http://localhost:3001/api/goals', goals);
      alert('Goals saved successfully!');
    } catch (error) {
      console.error('Error saving goals:', error);
      alert('Error saving goals');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setGoals({ ...goals, [field]: value });
  };

  return (
    <div className="panel">
      <h2>Job Goals</h2>
      <form className="goals-form">
        <div className="form-group">
          <label>Minimum Salary</label>
          <input
            type="number"
            value={goals.min_salary}
            onChange={(e) => handleChange('min_salary', parseInt(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Maximum Salary</label>
          <input
            type="number"
            value={goals.max_salary}
            onChange={(e) => handleChange('max_salary', parseInt(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Required Tech Stack (comma-separated)</label>
          <textarea
            value={goals.required_tech_stack?.join(', ') || ''}
            onChange={(e) => handleChange('required_tech_stack', e.target.value.split(',').map((s) => s.trim()))}
          />
        </div>

        <div className="form-group">
          <label>Avoid Tech Stack (comma-separated)</label>
          <textarea
            value={goals.avoid_tech_stack?.join(', ') || ''}
            onChange={(e) => handleChange('avoid_tech_stack', e.target.value.split(',').map((s) => s.trim()))}
          />
        </div>

        <div className="form-group">
          <label>Remote Preference</label>
          <select value={goals.remote_preference} onChange={(e) => handleChange('remote_preference', e.target.value)}>
            <option value="any">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </div>

        <div className="form-group">
          <label>Seniority Level</label>
          <select value={goals.seniority_level} onChange={(e) => handleChange('seniority_level', e.target.value)}>
            <option value="Junior">Junior</option>
            <option value="Mid-level">Mid-level</option>
            <option value="Senior">Senior</option>
            <option value="Lead">Lead</option>
          </select>
        </div>

        <button type="button" onClick={handleSave} disabled={loading} className="btn btn-primary">
          {loading ? 'Saving...' : 'Save Goals'}
        </button>
      </form>
    </div>
  );
}
