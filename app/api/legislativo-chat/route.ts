import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "legislativo_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const GENERIC_ERROR_MESSAGE =
  "Ocorreu um erro inesperado. Por favor, tente novamente.";

type FlowisePredictionResponse = {
  text?: string;
  answer?: string;
  result?: string;
  message?: string;
  json?: unknown;
};

type FlowiseChatMessage = {
  id?: string;
  role?: string;
  content?: string;
  createdDate?: string;
};

type FlowiseChatMessageResponse =
  | FlowiseChatMessage[]
  | { data?: FlowiseChatMessage[] };

type LegislativoChatMessage = {
  role: string;
  content?: string;
  parts?: Array<{
    type: string;
    text?: string;
  }>;
};

type LegislativoChatRequestBody = {
  messages?: LegislativoChatMessage[];
};

type FlowiseConfig = {
  apiUrl: string;
  chatflowId: string;
  apiKey?: string;
};

function getFlowiseConfig(): FlowiseConfig | null {
  const apiUrl = process.env.FLOWISE_API_URL;
  const chatflowId = process.env.FLOWISE_CHATFLOW_ID;

  if (!(apiUrl && chatflowId)) {
    return null;
  }

  return {
    apiUrl: apiUrl.replace(/\/$/, ""),
    chatflowId,
    apiKey: process.env.FLOWISE_API_KEY,
  };
}

function getFlowiseHeaders(apiKey?: string) {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

function getSessionId(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId && UUID_REGEX.test(sessionId)) {
    return sessionId;
  }

  return crypto.randomUUID();
}

function jsonWithSession(
  data: unknown,
  sessionId: string,
  init?: ResponseInit
) {
  const response = NextResponse.json(data, init);

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });

  return response;
}

function getLastUserMessage(messages: LegislativoChatMessage[] = []) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    return "";
  }

  if (typeof lastUserMessage.content === "string") {
    return lastUserMessage.content;
  }

  return (
    lastUserMessage.parts
      ?.filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n") ?? ""
  );
}

function getFlowiseText(data: FlowisePredictionResponse) {
  if (typeof data.text === "string") {
    return data.text;
  }

  if (typeof data.answer === "string") {
    return data.answer;
  }

  if (typeof data.result === "string") {
    return data.result;
  }

  if (typeof data.message === "string") {
    return data.message;
  }

  return JSON.stringify(data, null, 2);
}

function getFlowiseChatMessages(data: FlowiseChatMessageResponse) {
  if (Array.isArray(data)) {
    return data;
  }

  return Array.isArray(data.data) ? data.data : [];
}

function mapFlowiseChatMessages(data: FlowiseChatMessageResponse) {
  return getFlowiseChatMessages(data)
    .toSorted((first, second) => {
      const firstTimestamp = Date.parse(first.createdDate ?? "");
      const secondTimestamp = Date.parse(second.createdDate ?? "");

      if (Number.isNaN(firstTimestamp) || Number.isNaN(secondTimestamp)) {
        return 0;
      }

      return firstTimestamp - secondTimestamp;
    })
    .flatMap((message) => {
      const role =
        message.role === "userMessage"
          ? "user"
          : message.role === "apiMessage"
            ? "assistant"
            : null;

      if (!(role && message.content?.trim())) {
        return [];
      }

      return [
        {
          id: message.id ?? crypto.randomUUID(),
          role,
          content: message.content,
        },
      ];
    });
}

export async function GET(request: NextRequest) {
  const sessionId = getSessionId(request);

  try {
    const config = getFlowiseConfig();

    if (!config) {
      return jsonWithSession({ error: GENERIC_ERROR_MESSAGE }, sessionId, {
        status: 500,
      });
    }

    // Flowise protects the Chat Message API even when predictions are public.
    // Conversation memory still works without this key; only UI restoration is skipped.
    if (!config.apiKey) {
      return jsonWithSession({ messages: [] }, sessionId);
    }

    const url = new URL(
      `${config.apiUrl}/api/v1/chatmessage/${config.chatflowId}`
    );
    url.searchParams.set("sessionId", sessionId);
    url.searchParams.set("order", "ASC");

    const response = await fetch(url, {
      method: "GET",
      headers: getFlowiseHeaders(config.apiKey),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Flowise history error:",
        response.status,
        errorText.slice(0, 500)
      );

      return jsonWithSession({ error: GENERIC_ERROR_MESSAGE }, sessionId, {
        status: response.status,
      });
    }

    const data = (await response.json()) as FlowiseChatMessageResponse;

    return jsonWithSession(
      { messages: mapFlowiseChatMessages(data) },
      sessionId
    );
  } catch (error) {
    console.error("Error loading Flowise history:", error);

    return jsonWithSession({ error: GENERIC_ERROR_MESSAGE }, sessionId, {
      status: 500,
    });
  }
}

export async function POST(request: NextRequest) {
  const sessionId = getSessionId(request);

  try {
    const body = (await request.json()) as LegislativoChatRequestBody;
    const question = getLastUserMessage(body.messages);

    if (!question.trim()) {
      return jsonWithSession({ error: "No question provided" }, sessionId, {
        status: 400,
      });
    }

    const config = getFlowiseConfig();

    if (!config) {
      return jsonWithSession({ error: GENERIC_ERROR_MESSAGE }, sessionId, {
        status: 500,
      });
    }

    const response = await fetch(
      `${config.apiUrl}/api/v1/prediction/${config.chatflowId}`,
      {
        method: "POST",
        headers: getFlowiseHeaders(config.apiKey),
        body: JSON.stringify({
          question,
          overrideConfig: {
            sessionId,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        "Flowise prediction error:",
        response.status,
        errorText.slice(0, 500)
      );

      return jsonWithSession({ error: GENERIC_ERROR_MESSAGE }, sessionId, {
        status: response.status,
      });
    }

    const data = (await response.json()) as FlowisePredictionResponse;
    const text = getFlowiseText(data);

    return jsonWithSession({ text }, sessionId);
  } catch (error) {
    console.error("Error en legislativo-chat Flowise:", error);

    return jsonWithSession({ error: GENERIC_ERROR_MESSAGE }, sessionId, {
      status: 500,
    });
  }
}

export function DELETE() {
  // Starting a new session keeps the previous conversation stored in Flowise.
  return jsonWithSession({ messages: [] }, crypto.randomUUID());
}
