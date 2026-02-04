// Types matching the focus.json schema from Phase 2 Design

export interface FocusBundle {
  meta: {
    schemaVersion: number;
    appVersion: string;
    generatedAt: string;
    mode: 'focus' | 'classic';
    scope: {
      kind: 'node' | 'file' | 'folder' | 'vault';
      focusNodeId: string;
      focusNodePath: string;
      focusNodeTitle: string;
    };
  };

  health: HealthSummary;

  graph: {
    nodes: NodeDTO[];
    edges: EdgeDTO[];
  };

  suggestions: {
    relatedNotes: RelatedNote[];
    candidateLinks: CandidateLink[];
    orphans: OrphanEntry[];
  };

  actions: ActionTemplates;
}

export interface HealthSummary {
  level: 'ok' | 'warn' | 'fail';

  embeddings: {
    level: 'ok' | 'warn' | 'fail';
    coverageInView: number;
    eligibleInView: number;
    embeddedInView: number;
    missingInView: number;
    pending: number;
    errors: number;
    lastError?: string;
  };

  wormholes: {
    enabled: boolean;
    level: 'ok' | 'warn' | 'fail';
    countInView: number;
    threshold: number;
    disabledReason?: string;
  };

  index: {
    lastRunAt?: string;
    nodeCount: number;
    edgeCountsByLayer: { A: number; B: number; C: number };
  };

  extraction: {
    parseFailures: number;
    badChunksPath?: string;
  };
}

export interface NodeDTO {
  id: string;
  title: string;
  type: string;
  path?: string;
  isGhost?: boolean;
}

export interface EdgeDTO {
  id: string;
  sourceId: string;
  targetId: string;
  edgeType: string;
  strength?: number;
}

export interface RelatedNote {
  nodeId: string;
  title: string;
  path?: string;
  score: number;
  reasons: string[];
}

export interface CandidateLink {
  suggestionId: string;
  fromId: string;
  fromTitle: string;
  toId: string;
  toTitle: string;
  toPath?: string;
  edgeType: string;
  score: number;
  reasons: string[];
  isGhostTarget: boolean;
}

export interface OrphanEntry {
  nodeId: string;
  title: string;
  path?: string;
  orphanScore: number;
  reasons: string[];
}

export interface ActionTemplates {
  approve: {
    template: string;
    description: string;
  };
  reject: {
    template: string;
    description: string;
  };
  openInAtlas: {
    template: string;
    description: string;
  };
}

// Response types for approve/reject commands
export interface ApproveResponse {
  success: boolean;
  warnings?: string[];
  error?: string;
  errorCode?: 'NOT_VAULT' | 'DB_ERROR' | 'INVALID_ARGS' | 'NOT_FOUND' | 'COMPUTE_ERROR';
  idempotent?: boolean;
  suggestionId?: string;
  fromId?: string;
  fromTitle?: string;
  toId?: string;
  toTitle?: string;
  edgeId?: string;
  edgeType?: string;
  writeback?: 'success' | 'skipped' | 'failed';
  writebackReason?: string;
  writebackPath?: string;
}

export interface RejectResponse {
  success: boolean;
  warnings?: string[];
  error?: string;
  errorCode?: 'NOT_VAULT' | 'DB_ERROR' | 'INVALID_ARGS' | 'NOT_FOUND' | 'COMPUTE_ERROR';
  idempotent?: boolean;
  suggestionId?: string;
  fromId?: string;
  fromTitle?: string;
  toId?: string;
  toTitle?: string;
  edgeType?: string;
}
