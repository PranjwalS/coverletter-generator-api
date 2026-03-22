export interface SupabaseJob {
  id: number;
  title: string;
  company: string;
  location: string;
  tags: string[];
  apply_type: string;
  job_desc: string;
  company_desc: string;
  url: string;
  scraped_at: string;  
  processed_coverletter: boolean;
  coverletter_text: string | null;
  score: number | null;
  score_breakdown: Record<string, unknown> | null;
  scored_at: string | null;
  application_status: string;
  feedback_status: string;
  deadline: string | null;
  notes: string | null;
}
