export type MessageClassifyResult = Record<string, unknown>;

export type DetectStackParamList = {
  DetectHome: undefined;
  MessageAnalyzer: undefined;
  JobPost: undefined;
  EmployerCheckScreen: undefined;
  ResultScreen: {
    result?: MessageClassifyResult;
    imageUri?: string;
    isImage?: boolean;
  };
};
