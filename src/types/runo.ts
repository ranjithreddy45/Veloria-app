export interface RunoTranscriptionUtterance {
  speaker: string;
  utterance: string;
}

export interface RunoCallTranscriptionPayload {
  callId: string;
  callerId: string;
  customerId: string;
  customerEmail: string;
  calledBy: string;
  name: string;
  phoneNumber: string;
  startTime: number;
  userEmail: string;
  userPhone: string;
  processId: string;
  transcription: RunoTranscriptionUtterance[];
  chapters: string;
  summary: string;
  keyQuestions: string;
  callNotes: string;
  issuesDiscussed: string;
  actionItems: string[];
  fillerWords: string;
  agentIntroduced: string;
  agentClosure: string;
  issueResolved: string;
  feedbackRequested: string;
  verification: string;
  objectionHandling: string;
  acknowledgementProactiveness: string;
  empathy: string;
  effectiveListening: string;
  slangJargons: string;
  unprofessionalSpeech: string;
  abruptCallDisconnection: string;
  rudeness: string;
  relevantInformation: string;
  probing: string;
  customerFcr: string;
  appRating: string;
  agentSpeakingTime: number;
  customerSpeakingTime: number;
  holdTime: number;
  deadAirTime: number;
  noiseTime: number;
  agentLoudness: string;
  customerLoudness: string;
  agentSentiment: string;
  customerSentiment: string;
  score: number;
  callCategories: string[];
  "Confirm OP number"?: string;
  "odered date"?: string;
  "customer unsatisfied"?: string;
  "complaint number"?: string;
  "broken package"?: string;
  "App Rating"?: string;
  leadSummary: string;
  leadHealth: string;
  leadScore: number;
  leadSentiment: string;
  conversionPrediction: string;
  confidenceScore: number;
  actionableInsight: string;
  sourceCallCount: number;
  leadLastUpdatedAt: number;
  
  // To allow for any other dynamic evaluation fields runo might send
  [key: string]: any;
}
