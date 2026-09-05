import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface Job {
  id: number;
  title: string;
  company: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  job_url: string;
  applied: number;
  rejected: number;
  agent_score?: number;
  agent_decision?: string;
}

interface ProposedAnswers {
  fitDescription: string;
  whyInterested: string;
  whyGoodFit: string;
  whyCompany: string;
}

interface AnswerFeedback {
  fitDescription: string;
  whyInterested: string;
  whyGoodFit: string;
  whyCompany: string;
}

export default function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewingJobId, setReviewingJobId] = useState<number | null>(null);
  const [proposedAnswers, setProposedAnswers] = useState<ProposedAnswers>({
    fitDescription: '',
    whyInterested: '',
    whyGoodFit: '',
    whyCompany: ''
  });
  const [editedAnswers, setEditedAnswers] = useState<ProposedAnswers>({
    fitDescription: '',
    whyInterested: '',
    whyGoodFit: '',
    whyCompany: ''
  });
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback>({
    fitDescription: '',
    whyInterested: '',
    whyGoodFit: '',
    whyCompany: ''
  });
  const [showFeedbackHelp, setShowFeedbackHelp] = useState<string | null>(null);
  const [showTailorResume, setShowTailorResume] = useState(false);
  const [tailoringJobId, setTailoringJobId] = useState<number | null>(null);
  const [tailorLoading, setTailorLoading] = useState(false);
  const [tailoredResumeData, setTailoredResumeData] = useState<{
    originalResume: string;
    tailoredResume: string;
    jobTitle: string;
    company: string;
  } | null>(null);
  const [activeResumeTab, setActiveResumeTab] = useState<'original' | 'tailored'>('tailored');
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJob, setNewJob] = useState({
    title: '',
    company: '',
    location: '',
    salary_min: '',
    salary_max: '',
    description: '',
    job_url: ''
  });
  const [addingJob, setAddingJob] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3001/api/jobs');
      setJobs(response.data);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async () => {
    setLoading(true);
    setJobs([]); // Clear existing jobs immediately
    try {
      const response = await axios.post('http://localhost:3001/api/scrape');
      console.log('Scrape response:', response.data);
      // Fetch fresh jobs from API
      const jobsResponse = await axios.get('http://localhost:3001/api/jobs');
      setJobs(jobsResponse.data);
    } catch (error) {
      console.error('Error scraping jobs:', error);
      alert('Error scraping jobs');
    } finally {
      setLoading(false);
    }
  };

  const [showJobDetails, setShowJobDetails] = useState(false);
  const [jobDetailsJobId, setJobDetailsJobId] = useState<number | null>(null);
  const [jobDetails, setJobDetails] = useState({
    description: '',
    questions: ''
  });
  const [generatedContent, setGeneratedContent] = useState<{
    tailoredResume: string;
    answers: string;
  } | null>(null);
  const [showGeneratedContent, setShowGeneratedContent] = useState(false);

  const handleAnalyzeWithAgent = async (jobId: number) => {
    setJobDetailsJobId(jobId);
    setShowJobDetails(true);
  };

  const handleGenerateFromDetails = async () => {
    if (!jobDetails.description || !jobDetails.questions) {
      alert('Please paste both job description and questions');
      return;
    }

    setAnalyzing(jobDetailsJobId);
    try {
      const response = await axios.post('http://localhost:3001/api/applications/generate-from-details', {
        resumeId: 1,
        jobDescription: jobDetails.description,
        applicationQuestions: jobDetails.questions
      });
      setGeneratedContent(response.data);
      setShowGeneratedContent(true);
      setShowJobDetails(false);
    } catch (error) {
      console.error('Error generating content:', error);
      alert('Error generating content');
    } finally {
      setAnalyzing(null);
    }
  };

  const handleProceedToApplication = async (jobId: number) => {
    try {
      const response = await axios.post('http://localhost:3001/api/applications/generate-answers', {
        jobId,
        resumeId: 1
      });
      setProposedAnswers(response.data.proposedAnswers);
      setEditedAnswers(response.data.proposedAnswers);
      setReviewingJobId(jobId);
      setShowReview(true);
      setShowAnalysis(false);
    } catch (error) {
      console.error('Error generating answers:', error);
      alert('Error generating application answers.');
    }
  };

  const handleConfirmAndApply = async () => {
    if (!reviewingJobId) return;
    try {
      await axios.post('http://localhost:3001/api/applications/submit', {
        jobId: reviewingJobId,
        resumeId: 1,
        answers: editedAnswers,
        feedback: answerFeedback,
        originalAnswers: proposedAnswers
      });
      alert('✅ Application submitted! Agent learned from your feedback.');
      setShowReview(false);
      setReviewingJobId(null);
      setAnswerFeedback({ fitDescription: '', whyInterested: '', whyGoodFit: '', whyCompany: '' });
      setTimeout(fetchJobs, 1000);
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Error submitting application.');
    }
  };

  const handleTailorResume = async (jobId: number) => {
    setTailoringJobId(jobId);
    setTailorLoading(true);
    try {
      const response = await axios.post('http://localhost:3001/api/resume/tailor', {
        jobId,
        resumeId: 1
      });
      setTailoredResumeData(response.data);
      setShowTailorResume(true);
      setActiveResumeTab('tailored');
    } catch (error) {
      console.error('Error tailoring resume:', error);
      alert('Error tailoring resume');
    } finally {
      setTailorLoading(false);
    }
  };

  const handleAddJob = async () => {
    if (!newJob.title || !newJob.company) {
      alert('Title and company are required');
      return;
    }

    setAddingJob(true);
    try {
      await axios.post('http://localhost:3001/api/jobs/add', {
        title: newJob.title,
        company: newJob.company,
        location: newJob.location || 'Remote',
        salary_min: newJob.salary_min ? parseInt(newJob.salary_min) : 0,
        salary_max: newJob.salary_max ? parseInt(newJob.salary_max) : 0,
        description: newJob.description,
        job_url: newJob.job_url
      });
      alert('✅ Job added! Agent is analyzing it.');
      setShowAddJob(false);
      setNewJob({
        title: '',
        company: '',
        location: '',
        salary_min: '',
        salary_max: '',
        description: '',
        job_url: ''
      });
      setTimeout(fetchJobs, 1000);
    } catch (error) {
      console.error('Error adding job:', error);
      alert('Error adding job');
    } finally {
      setAddingJob(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Available Jobs</h2>
        <button onClick={() => setShowAddJob(true)} className="btn btn-primary">
          ➕ Add Job by URL
        </button>
      </div>

      <div className="jobs-list">
        {jobs.length === 0 ? (
          <p className="empty-state">No jobs yet. Click "Scrape LinkedIn" to get started.</p>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="job-card">
              <div className="job-header">
                <div>
                  <h3>{job.title}</h3>
                  <span className="company">{job.company}</span>
                </div>
                {job.agent_score !== undefined && (
                  <div className={`fit-score fit-score-${job.agent_score >= 70 ? 'high' : job.agent_score >= 50 ? 'medium' : 'low'}`}>
                    <div className="score-number">{job.agent_score}</div>
                    <div className="score-label">Fit</div>
                  </div>
                )}
              </div>

              {job.agent_decision && (
                <div className="quick-summary">
                  {job.agent_decision}
                </div>
              )}

              <div className="job-details">
                <span className="location">{job.location}</span>
                {job.salary_min && (
                  <span className="salary">
                    ${job.salary_min.toLocaleString()} - ${job.salary_max?.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="job-status">
                <span>{job.applied > 0 ? `Applied: ${job.applied}` : ''}</span>
                <span>{job.rejected > 0 ? `Rejected: ${job.rejected}` : ''}</span>
              </div>
              <div className="job-actions">
                <button
                  onClick={() => handleAnalyzeWithAgent(job.id)}
                  disabled={analyzing === job.id}
                  className="btn btn-primary"
                  title="Generate application answers based on your resume"
                >
                  {analyzing === job.id ? 'Generating...' : '✍️ Generate Answers'}
                </button>
                <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                  View Job
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {showJobDetails && (
        <div className="analysis-modal">
          <div className="analysis-content">
            <button className="close-btn" onClick={() => setShowJobDetails(false)}>✕</button>
            <h2>📋 Paste Job Details</h2>
            <p className="analysis-subtitle">Go to the LinkedIn job posting and copy the job description and application questions below.</p>

            <div className="form-group">
              <label>Job Description & Bullets *</label>
              <textarea
                value={jobDetails.description}
                onChange={(e) => setJobDetails({...jobDetails, description: e.target.value})}
                placeholder="Paste the job description, requirements, and key responsibilities..."
                className="job-details-textarea"
              />
            </div>

            <div className="form-group">
              <label>Application Questions *</label>
              <textarea
                value={jobDetails.questions}
                onChange={(e) => setJobDetails({...jobDetails, questions: e.target.value})}
                placeholder="Paste the application form questions. Example:&#10;1. Why are you interested in this role?&#10;2. Tell us about your relevant experience..."
                className="job-details-textarea"
              />
            </div>

            <div className="analysis-actions">
              <button
                onClick={handleGenerateFromDetails}
                disabled={analyzing === jobDetailsJobId}
                className="btn btn-primary"
              >
                {analyzing === jobDetailsJobId ? 'Generating...' : '✨ Generate Tailored Resume & Answers'}
              </button>
              <button onClick={() => setShowJobDetails(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showGeneratedContent && generatedContent && (
        <div className="analysis-modal">
          <div className="analysis-content" style={{ maxWidth: '800px' }}>
            <button className="close-btn" onClick={() => setShowGeneratedContent(false)}>✕</button>
            <h2>✨ Your Customized Application Materials</h2>

            <div className="content-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e0e0e0' }}>
              <button
                onClick={() => setActiveResumeTab('tailored')}
                className={`resume-tab ${activeResumeTab === 'tailored' ? 'active' : ''}`}
              >
                📄 Tailored Resume
              </button>
              <button
                onClick={() => setActiveResumeTab('original')}
                className={`resume-tab ${activeResumeTab === 'original' ? 'active' : ''}`}
              >
                ✍️ Application Answers
              </button>
            </div>

            {activeResumeTab === 'tailored' ? (
              <div>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>💡 This resume highlights your most relevant experience for this job.</p>
                <div className="resume-display">
                  <pre className="resume-text">{generatedContent.tailoredResume}</pre>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(generatedContent.tailoredResume);
                      alert('✅ Tailored resume copied to clipboard!');
                    } catch (err) {
                      console.error('Clipboard error:', err);
                      alert('⚠️ Copy failed. Try selecting and copying manually (Cmd+C)');
                    }
                  }}
                  className="btn btn-primary"
                  style={{ marginTop: '15px' }}
                >
                  📋 Copy Tailored Resume
                </button>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>💡 Agent-generated answers based on your resume and the job description.</p>
                <div className="resume-display">
                  <pre className="resume-text">{generatedContent.answers}</pre>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(generatedContent.answers);
                      alert('✅ Application answers copied to clipboard!');
                    } catch (err) {
                      console.error('Clipboard error:', err);
                      alert('⚠️ Copy failed. Try selecting and copying manually (Cmd+C)');
                    }
                  }}
                  className="btn btn-primary"
                  style={{ marginTop: '15px' }}
                >
                  📋 Copy Answers
                </button>
              </div>
            )}

            <div className="analysis-actions" style={{ marginTop: '20px' }}>
              <button onClick={() => setShowGeneratedContent(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showReview && reviewingJobId && (
        <div className="review-modal">
          <div className="review-content">
            <button className="close-btn" onClick={() => setShowReview(false)}>✕</button>
            <h2>Review & Learn from Your Answers</h2>
            <p className="review-intro">Edit the proposed answers. The agent learns from your feedback to improve future applications.</p>

            <div className="answer-block">
              <div className="answer-header">
                <label>How you fit for this role:</label>
                {proposedAnswers.fitDescription !== editedAnswers.fitDescription && (
                  <span className="edited-badge">✎ Edited</span>
                )}
              </div>
              <textarea
                value={editedAnswers.fitDescription}
                onChange={(e) => setEditedAnswers({...editedAnswers, fitDescription: e.target.value})}
                className="review-textarea"
                placeholder="Your answer for the job application"
              />
              {proposedAnswers.fitDescription !== editedAnswers.fitDescription && (
                <div className="feedback-section">
                  <button
                    className="feedback-toggle"
                    onClick={() => setShowFeedbackHelp(showFeedbackHelp === 'fit' ? null : 'fit')}
                  >
                    💡 Why did you change this? (optional)
                  </button>
                  {showFeedbackHelp === 'fit' && (
                    <textarea
                      value={answerFeedback.fitDescription}
                      onChange={(e) => setAnswerFeedback({...answerFeedback, fitDescription: e.target.value})}
                      className="feedback-textarea"
                      placeholder="E.g., 'Agent missed my cloud expertise' or 'Too technical, needs more business angle'"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="answer-block">
              <div className="answer-header">
                <label>Why you're interested in this role:</label>
                {proposedAnswers.whyInterested !== editedAnswers.whyInterested && (
                  <span className="edited-badge">✎ Edited</span>
                )}
              </div>
              <textarea
                value={editedAnswers.whyInterested}
                onChange={(e) => setEditedAnswers({...editedAnswers, whyInterested: e.target.value})}
                className="review-textarea"
              />
              {proposedAnswers.whyInterested !== editedAnswers.whyInterested && (
                <div className="feedback-section">
                  <button
                    className="feedback-toggle"
                    onClick={() => setShowFeedbackHelp(showFeedbackHelp === 'interested' ? null : 'interested')}
                  >
                    💡 Why did you change this? (optional)
                  </button>
                  {showFeedbackHelp === 'interested' && (
                    <textarea
                      value={answerFeedback.whyInterested}
                      onChange={(e) => setAnswerFeedback({...answerFeedback, whyInterested: e.target.value})}
                      className="feedback-textarea"
                      placeholder="Share what the agent missed..."
                    />
                  )}
                </div>
              )}
            </div>

            <div className="answer-block">
              <div className="answer-header">
                <label>Why you're a good fit:</label>
                {proposedAnswers.whyGoodFit !== editedAnswers.whyGoodFit && (
                  <span className="edited-badge">✎ Edited</span>
                )}
              </div>
              <textarea
                value={editedAnswers.whyGoodFit}
                onChange={(e) => setEditedAnswers({...editedAnswers, whyGoodFit: e.target.value})}
                className="review-textarea"
              />
              {proposedAnswers.whyGoodFit !== editedAnswers.whyGoodFit && (
                <div className="feedback-section">
                  <button
                    className="feedback-toggle"
                    onClick={() => setShowFeedbackHelp(showFeedbackHelp === 'fit-details' ? null : 'fit-details')}
                  >
                    💡 Why did you change this? (optional)
                  </button>
                  {showFeedbackHelp === 'fit-details' && (
                    <textarea
                      value={answerFeedback.whyGoodFit}
                      onChange={(e) => setAnswerFeedback({...answerFeedback, whyGoodFit: e.target.value})}
                      className="feedback-textarea"
                      placeholder="E.g., 'Overemphasized Python, should highlight leadership' or 'Needs more FSI context'"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="answer-block">
              <div className="answer-header">
                <label>Why you want to work here:</label>
                {proposedAnswers.whyCompany !== editedAnswers.whyCompany && (
                  <span className="edited-badge">✎ Edited</span>
                )}
              </div>
              <textarea
                value={editedAnswers.whyCompany}
                onChange={(e) => setEditedAnswers({...editedAnswers, whyCompany: e.target.value})}
                className="review-textarea"
              />
              {proposedAnswers.whyCompany !== editedAnswers.whyCompany && (
                <div className="feedback-section">
                  <button
                    className="feedback-toggle"
                    onClick={() => setShowFeedbackHelp(showFeedbackHelp === 'company' ? null : 'company')}
                  >
                    💡 Why did you change this? (optional)
                  </button>
                  {showFeedbackHelp === 'company' && (
                    <textarea
                      value={answerFeedback.whyCompany}
                      onChange={(e) => setAnswerFeedback({...answerFeedback, whyCompany: e.target.value})}
                      className="feedback-textarea"
                      placeholder="Share insights about why this matters to you..."
                    />
                  )}
                </div>
              )}
            </div>

            <div className="review-actions">
              <button onClick={handleConfirmAndApply} className="btn btn-primary">
                ✓ Confirm & Apply (Agent Learns)
              </button>
              <button onClick={() => setShowReview(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showTailorResume && tailoredResumeData && (
        <div className="tailor-modal">
          <div className="tailor-content">
            <button className="close-btn" onClick={() => setShowTailorResume(false)}>✕</button>
            <h2>Tailored Resume for {tailoredResumeData.company}</h2>
            <p className="tailor-subtitle">Job: {tailoredResumeData.jobTitle}</p>

            <div className="resume-tabs">
              <button
                className={`resume-tab ${activeResumeTab === 'original' ? 'active' : ''}`}
                onClick={() => setActiveResumeTab('original')}
              >
                📋 Original Resume
              </button>
              <button
                className={`resume-tab ${activeResumeTab === 'tailored' ? 'active' : ''}`}
                onClick={() => setActiveResumeTab('tailored')}
              >
                ✨ Tailored for This Job
              </button>
            </div>

            <div className="resume-display">
              {activeResumeTab === 'original' ? (
                <pre className="resume-text">{tailoredResumeData.originalResume}</pre>
              ) : (
                <pre className="resume-text">{tailoredResumeData.tailoredResume}</pre>
              )}
            </div>

            <div className="tailor-actions">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    activeResumeTab === 'original'
                      ? tailoredResumeData.originalResume
                      : tailoredResumeData.tailoredResume
                  );
                  alert('✅ Resume copied to clipboard!');
                }}
                className="btn btn-primary"
              >
                📋 Copy to Clipboard
              </button>
              <button onClick={() => setShowTailorResume(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddJob && (
        <div className="add-job-modal">
          <div className="add-job-content">
            <button className="close-btn" onClick={() => setShowAddJob(false)}>✕</button>
            <h2>Add Job Manually</h2>
            <p className="add-job-intro">Found a job on LinkedIn or Indeed? Paste the details below and our agent will analyze it.</p>

            <div className="form-group">
              <label>Job Title *</label>
              <input
                type="text"
                value={newJob.title}
                onChange={(e) => setNewJob({...newJob, title: e.target.value})}
                placeholder="e.g., Senior AI Engineer"
              />
            </div>

            <div className="form-group">
              <label>Company *</label>
              <input
                type="text"
                value={newJob.company}
                onChange={(e) => setNewJob({...newJob, company: e.target.value})}
                placeholder="e.g., OpenAI"
              />
            </div>

            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                value={newJob.location}
                onChange={(e) => setNewJob({...newJob, location: e.target.value})}
                placeholder="e.g., New York, NY or Remote"
              />
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Min Salary</label>
                <input
                  type="number"
                  value={newJob.salary_min}
                  onChange={(e) => setNewJob({...newJob, salary_min: e.target.value})}
                  placeholder="e.g., 200000"
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Max Salary</label>
                <input
                  type="number"
                  value={newJob.salary_max}
                  onChange={(e) => setNewJob({...newJob, salary_max: e.target.value})}
                  placeholder="e.g., 300000"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Job Description</label>
              <textarea
                value={newJob.description}
                onChange={(e) => setNewJob({...newJob, description: e.target.value})}
                placeholder="Paste job description here..."
                rows={5}
              />
            </div>

            <div className="form-group">
              <label>Job URL</label>
              <input
                type="text"
                value={newJob.job_url}
                onChange={(e) => setNewJob({...newJob, job_url: e.target.value})}
                placeholder="https://linkedin.com/jobs/..."
              />
            </div>

            <div className="add-job-actions">
              <button
                onClick={handleAddJob}
                disabled={addingJob}
                className="btn btn-primary"
              >
                {addingJob ? 'Adding...' : '✓ Add Job'}
              </button>
              <button onClick={() => setShowAddJob(false)} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
