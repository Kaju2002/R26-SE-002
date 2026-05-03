export type ParsedTactic = {
  name: string;
  example?: string;
};

export type AnalysisPayload = {
  is_scam: boolean;
  confidence: number;
  tactics: ParsedTactic[];
  warning: string;
  reassurance: string;
  original_text: string;
};

/** Raw API envelope (temporary); merge with dummy JSON via `mergeAnalysisFromApi`. */
export type MergeableApiResult = Record<string, unknown>;

export type JobPostResultParams = {
  prediction: string;
  confidence: number;
  legitimate_probability: number;
  fake_probability: number;
  extracted_text: string;
  message: string;
  imageUri: string;
};

export type DetectStackParamList = {
  DetectHome: undefined;
  MessageAnalyzer: undefined;
  JobPost: undefined;
  JobPostResult: JobPostResultParams;
  EmployerCheckScreen: undefined;
  ResultScreen: {
    /** When omitted, scam sample JSON is shown */
    analysis?: AnalysisPayload;
    /** Raw classify response merged with scam_sample until backend matches shape */
    result?: MergeableApiResult;
    pastedMessage?: string;
    /** Screenshot picker flow */
    imageUri?: string;
    isImage?: boolean;
  };
};
