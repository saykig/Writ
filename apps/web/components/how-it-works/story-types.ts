export const STORY_STAGES = ["source", "passage", "record", "review", "corpus"] as const;

export type StoryStage = (typeof STORY_STAGES)[number];
