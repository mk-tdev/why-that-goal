export type AgentName = 'analysis' | 'storytelling' | 'evidence-check';
export type AgentIssue = {
  target: string;
  reason:
    | 'unsupported-claim'
    | 'wrong-outcome'
    | 'wrong-actor'
    | 'missing-evidence'
    | 'causal-overclaim'
    | 'language'
    | 'format';
  detail: string;
  factIds: string[];
};
export type AgentStep = {
  agent: AgentName;
  attempt: number;
  status: 'running' | 'completed' | 'revision-requested' | 'rejected' | 'failed';
  elapsedMs: number;
  factIds: string[];
  summary: string;
  toolCalls: { name: 'getFact'; factId: string }[];
  inputTokens: number;
  outputTokens: number;
};
export type WorkflowTrace = {
  snapshotId: string;
  version: '1.0';
  status: 'running' | 'approved' | 'fallback';
  steps: AgentStep[];
  handoffs: { from: AgentName; to: AgentName; reason: string; factIds: string[] }[];
  issues: AgentIssue[];
  revisions: number;
  modelCalls: number;
};
