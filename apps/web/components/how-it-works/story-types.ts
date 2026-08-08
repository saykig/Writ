export const STORY_STAGES = [
  "source",
  "passage",
  "record",
  "review",
  "corpus",
  "query",
  "result",
] as const;

export type StoryStage = (typeof STORY_STAGES)[number];
