export type ChatTicketMessage = {
  role: "user" | "ai";
  content: string;
  originalQuestion?: string | null;
};

export function associatedQuestion(messages: ChatTicketMessage[], answerIndex: number): string | null {
  const answer = messages[answerIndex];
  if (answer?.role !== "ai") return null;
  const original = answer.originalQuestion?.trim();
  if (original) return original;
  const previous = messages[answerIndex - 1];
  if (previous?.role !== "user") return null;
  return previous.content.trim() || null;
}