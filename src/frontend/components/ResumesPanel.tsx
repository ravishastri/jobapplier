import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Resume {
  id: number;
  version_name: string;
  is_active: boolean;
  created_at: string;
}

export default function ResumesPanel() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(false);
  const [newResumeName, setNewResumeName] = useState('');
  const [resumeContent, setResumeContent] = useState('');

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/resumes');
      setResumes(response.data);
    } catch (error) {
      console.error('Error fetching resumes:', error);
    }
  };

  const handleUpload = async () => {
    if (!newResumeName.trim() || !resumeContent.trim()) {
      alert('Please enter a name and resume content');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:3001/api/resumes', {
        version_name: newResumeName,
        content: resumeContent,
        is_active: resumes.length === 0,
      });
      setNewResumeName('');
      setResumeContent('');
      fetchResumes();
    } catch (error) {
      console.error('Error uploading resume:', error);
      alert('Error uploading resume');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel">
      <h2>Resume Versions</h2>

      <div className="resume-upload">
        <h3>Add New Resume</h3>
        <div className="form-group">
          <label>Version Name</label>
          <input
            type="text"
            placeholder="e.g., 'Senior Full Stack v1'"
            value={newResumeName}
            onChange={(e) => setNewResumeName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Resume Content (Text/Markdown)</label>
          <textarea
            placeholder="Paste your resume content here..."
            value={resumeContent}
            onChange={(e) => setResumeContent(e.target.value)}
            rows={10}
          />
        </div>

        <button onClick={handleUpload} disabled={loading} className="btn btn-primary">
          {loading ? 'Uploading...' : 'Upload Resume'}
        </button>
      </div>

      <div className="resumes-list">
        <h3>Saved Resumes</h3>
        {resumes.length === 0 ? (
          <p>No resumes yet.</p>
        ) : (
          resumes.map((resume) => (
            <div key={resume.id} className="resume-card">
              <div>
                <h4>{resume.version_name}</h4>
                <p>Created: {new Date(resume.created_at).toLocaleDateString()}</p>
                {resume.is_active && <span className="badge">Active</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
