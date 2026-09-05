import { proxyActivities, defineQuery, defineSignal, setHandler } from '@temporalio/workflow';
import * as activities from './activities';

export const jobScrapeWorkflow = defineQuery('jobScrapeProgress');

export async function scrapeLinkedInJobs(): Promise<{ jobsScraped: number; success: boolean }> {
  return activities.scrapeLinkedInJobsActivity();
}

export async function evaluateJobFitWorkflow(jobId: number): Promise<{
  jobId: number;
  score: number;
  decision: 'apply' | 'skip';
  reasoning: string;
}> {
  return activities.evaluateJobFitActivity(jobId);
}

export async function fillJobApplicationWorkflow(
  jobId: number,
  resumeId: number
): Promise<{
  success: boolean;
  applicationId?: number;
  error?: string;
}> {
  return activities.fillJobApplicationActivity(jobId, resumeId);
}

export async function dailyJobScrapeWorkflow(): Promise<{ success: boolean; jobsProcessed: number }> {
  const scrapeResult = await scrapeLinkedInJobs();

  if (!scrapeResult.success) {
    return { success: false, jobsProcessed: 0 };
  }

  return { success: true, jobsProcessed: scrapeResult.jobsScraped };
}
