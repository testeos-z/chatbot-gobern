"use client";

import {
  Loader2Icon,
  SendIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react";
// SVG con PNG embebido — se usa <img> directo para evitar hidratación (<next/image> no optimiza SVG)
import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ApiResponse = {
  text?: string;
  error?: string;
  details?: string;
};

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2);
}

export function LegislativoLiteChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();

    if (!text || isLoading) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setErrorMessage("");

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch("/api/legislativo-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: abortController.signal,
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error("Ocurrió un error inesperado. Por favor, intenta de nuevo.");
      }

      const assistantText = data.text?.trim();

      if (!assistantText) {
        throw new Error("Ocurrió un error inesperado. Por favor, intenta de nuevo.");
      }

      const assistantMessage: ChatMessage = {
        id: createId(),
        role: "assistant",
        content: assistantText,
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        assistantMessage,
      ]);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setErrorMessage("Respuesta detenida.");
        return;
      }

      console.error("Error enviando mensaje:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Ocurrió un error inesperado. Por favor, intenta de nuevo."
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }

  function handleStop() {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }

  function handleClear() {
    setMessages([]);
    setErrorMessage("");
  }

  return (
    <main className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border/40 px-4 py-3 md:px-8">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              alt="Gobern.AI"
              className="h-14 w-auto sm:h-16 md:h-20"
              src="/images/logotipo.svg"
            />
            <span className="hidden text-sm font-medium text-muted-foreground sm:inline">
              Legislativo
            </span>
          </div>

          <Button
            disabled={messages.length === 0 || isLoading}
            onClick={handleClear}
            type="button"
            variant="outline"
          >
            <Trash2Icon className="mr-2 size-4" />
            Limpiar
          </Button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 md:px-8">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto rounded-2xl border border-border/40 bg-card/30 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
              Haz una pregunta legislativa o pega un texto para analizarlo.
            </div>
          ) : (
            messages.map((message) => (
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto border border-border/40 bg-background"
                )}
                key={message.id}
              >
                {message.content}
              </div>
            ))
          )}

          {isLoading && (
            <div className="mr-auto flex items-center gap-2 rounded-2xl border border-border/40 bg-background px-4 py-3 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Consultando Información...
            </div>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <form className="flex gap-2" onSubmit={handleSubmit}>
          <Textarea
            className="min-h-24 resize-none rounded-2xl"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Escribe tu petición..."
            value={input}
          />

          {isLoading ? (
            <Button
              className="h-auto rounded-2xl px-4"
              onClick={handleStop}
              type="button"
              variant="outline"
            >
              <SquareIcon className="size-4" />
            </Button>
          ) : (
            <Button
              className="h-auto rounded-2xl px-4"
              disabled={!input.trim()}
              type="submit"
            >
              <SendIcon className="size-4" />
            </Button>
          )}
        </form>
      </section>
    </main>
  );
}