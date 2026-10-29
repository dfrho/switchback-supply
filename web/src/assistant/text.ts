/** Copy and formatting for the trail guide panel (ShoppingAssistant.tsx). */

export const STARTER_QUESTIONS = [
  'Two nights in Colorado in October. What should I pack?',
  'Which headlamp is best for under $60?',
  'Do I need a water filter for long day hikes?',
];

/** "claude-haiku-5-5" -> "Claude Haiku 5.5". Unknown names are shown as they are. */
export function modelLabel(model: string): string {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?$/.exec(model);
  if (!match) return model;
  const [, family, major, minor] = match;
  return `Claude ${family[0].toUpperCase()}${family.slice(1)} ${major}${minor ? `.${minor}` : ''}`;
}
