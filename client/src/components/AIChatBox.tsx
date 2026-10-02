import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIChatBoxProps = {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  height?: string | number;
  emptyStateMessage?: string;
  suggestedPrompts?: string[];
};

/** Presentational chat sample. The caller supplies the response service. */
export function AIChatBox({
  messages,
  onSendMessage,
  isLoading = false,
  placeholder = "Écrivez un message…",
  className = "",
  height = 480,
  emptyStateMessage = "Comment puis-je vous aider ?",
  suggestedPrompts = [],
}: AIChatBoxProps) {
  const [draft, setDraft] = useState("");

  const send = (event?: FormEvent) => {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || isLoading) return;
    onSendMessage(content);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  };

  return (
    <section className={`flex flex-col rounded-xl border bg-card ${className}`} style={{ height }}>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Sparkles aria-hidden="true" />
            <p>{emptyStateMessage}</p>
            {suggestedPrompts.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedPrompts.map(prompt => (
                  <Button key={prompt} type="button" variant="outline" size="sm" disabled={isLoading} onClick={() => onSendMessage(prompt)}>
                    {prompt}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ) : messages.filter(message => message.role !== "system").map((message, index) => (
          <div key={`${message.role}-${index}`} className={`rounded-lg p-3 text-sm ${message.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 bg-muted"}`}>
            <p className="mb-1 text-xs font-medium opacity-70">{message.role === "user" ? "Vous" : "Assistant"}</p>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
        {isLoading && <p className="text-sm text-muted-foreground" role="status">Réponse en cours…</p>}
      </div>
      <form className="flex items-end gap-2 border-t p-3" onSubmit={send}>
        <Textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} rows={2} aria-label={placeholder} />
        <Button type="submit" size="icon" aria-label="Envoyer" disabled={!draft.trim() || isLoading}>
          <Send size={16} />
        </Button>
      </form>
    </section>
  );
}
