import { type FormEvent, useEffect, useMemo, useState } from "react";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type StatusPayload = {
  online?: boolean;
  mode?: string;
  gateway?: boolean;
  desktopRelay?: boolean;
  openaiBaseUrl?: string;
};

function asErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  const text = String(error ?? "").trim();
  return text || fallback;
}

export default function WebOnlyApp() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then(async (response) => {
        if (!response.ok) throw new Error(`status failed: ${response.status}`);
        return (await response.json()) as StatusPayload;
      })
      .then((payload) => {
        if (!cancelled) setStatus(payload);
      })
      .catch((error) => {
        if (!cancelled) setStatusError(asErrorMessage(error, "status unavailable"));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (statusError) return statusError;
    if (!status) return "Checking web-only backend...";
    return status.online ? "Web-only backend online" : "Web-only backend offline";
  }, [status, statusError]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || submitting) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setChatError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          model: model.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || `chat failed: ${response.status}`);
      }
      const assistantMessage = String(payload?.message ?? "").trim();
      setMessages((current) => [
        ...current,
        { role: "assistant", content: assistantMessage || "(empty response)" },
      ]);
    } catch (error) {
      setChatError(asErrorMessage(error, "chat request failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col rounded-3xl border border-border bg-card/80 p-6 shadow-2xl">
        <header className="mb-6 space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
            LiveAgent Web-only
          </p>
          <h1 className="text-3xl font-semibold">OpenAI-compatible Web Chat</h1>
          <p className="text-sm text-muted-foreground">
            No Gateway WebSocket. No desktop relay. Requests go through the hosted /api/chat backend.
          </p>
          <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm">
            <div className="font-medium">{statusLabel}</div>
            {status?.openaiBaseUrl ? (
              <div className="mt-1 text-muted-foreground">Base URL: {status.openaiBaseUrl}</div>
            ) : null}
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border bg-background/60 p-4">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">
              Send a prompt to start a web-only conversation.
            </div>
          ) : null}
          {messages.map((message, index) => (
            <article
              className={`rounded-2xl px-4 py-3 text-sm ${
                message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
              } max-w-[85%] whitespace-pre-wrap`}
              key={`${message.role}-${index}`}
            >
              {message.content}
            </article>
          ))}
        </div>

        {chatError ? <div className="mt-3 text-sm text-destructive">{chatError}</div> : null}

        <form className="mt-4 space-y-3" onSubmit={sendMessage}>
          <input
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            onChange={(event) => setModel(event.target.value)}
            placeholder="Optional model override (default from OPENAI_MODEL)"
            value={model}
          />
          <div className="flex gap-3">
            <textarea
              className="min-h-24 flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              onChange={(event) => setInput(event.target.value)}
              placeholder="Message"
              value={input}
            />
            <button
              className="rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || !input.trim()}
              type="submit"
            >
              {submitting ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
