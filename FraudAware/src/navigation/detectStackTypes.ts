export type ParsedTactic = {
  name: string;
  example?: string;
};

export type AnalysisPayload = {
  is_scam: boolean;
  /** API may omit; treated as false when absent. */
  inconclusive?: boolean;
  confidence: number;
  tactics: ParsedTactic[];
  warning: string;
  reassurance: string;
  original_text: string;
  word_importance: { word: string; score: number }[];
};

/** Raw `/classify` or `/classify-image` response; mapped via `analysisPayloadFromApi`. */
export type MergeableApiResult = Record<string, unknown>;

export type DetectStackParamList = {
  DetectHome: undefined;
  MessageAnalyzer: undefined;
  JobPost: undefined;
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
    /** Multi-screenshot flow: screenshots with meaningful OCR text */
    screenshotCount?: number;
    /** Multi-screenshot flow: total images user selected */
    screenshotTotal?: number;
  };
};
