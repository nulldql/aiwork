export type Agent = {
  name: string;
  path: string;
  branch: string;
  base: string;
};

export type AgentStatus = {
  agent: Agent;
  touchedFiles: string[];
  hasUncommittedChanges: boolean;
  ahead: number;
  behind: number;
};

export type RiskLevel = "none" | "medium" | "high";

export type Overlap = {
  agentA: string;
  agentB: string;
  sharedFiles: string[];
  sharedDirectories: string[];
  risk: RiskLevel;
};
