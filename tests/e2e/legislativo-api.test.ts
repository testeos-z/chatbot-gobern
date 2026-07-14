import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "../../app/api/legislativo-chat/route";

const COOKIE_NAME = "legislativo_session_id";
const FLOWISE_API_URL = "https://flowise.test";
const FLOWISE_CHATFLOW_ID = "legislativo-flow";
const originalFetch = globalThis.fetch;

function createRequest(method: string, sessionId?: string, body?: unknown) {
  const headers = new Headers();

  if (body) {
    headers.set("Content-Type", "application/json");
  }

  if (sessionId) {
    headers.set("Cookie", `${COOKIE_NAME}=${sessionId}`);
  }

  return new NextRequest("http://localhost/api/legislativo-chat", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

test.beforeEach(() => {
  process.env.FLOWISE_API_URL = FLOWISE_API_URL;
  process.env.FLOWISE_CHATFLOW_ID = FLOWISE_CHATFLOW_ID;
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.FLOWISE_API_KEY = "";
});

test("forwards the browser session to Flowise predictions", async () => {
  const sessionId = crypto.randomUUID();
  let predictionBody: unknown;

  globalThis.fetch = (input, init) => {
    expect(String(input)).toBe(
      `${FLOWISE_API_URL}/api/v1/prediction/${FLOWISE_CHATFLOW_ID}`
    );
    predictionBody = JSON.parse(String(init?.body));

    return Promise.resolve(Response.json({ text: "Resposta com memória" }));
  };

  const response = await POST(
    createRequest("POST", sessionId, {
      messages: [{ role: "user", content: "Qual é o meu nome?" }],
    })
  );

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({
    text: "Resposta com memória",
  });
  expect(predictionBody).toEqual({
    question: "Qual é o meu nome?",
    overrideConfig: { sessionId },
  });
  expect(response.headers.get("set-cookie")).toContain(
    `${COOKIE_NAME}=${sessionId}`
  );
});

test("keeps the chat available when no history API key is configured", async () => {
  const sessionId = crypto.randomUUID();
  let flowiseWasCalled = false;
  process.env.FLOWISE_API_KEY = "";
  globalThis.fetch = () => {
    flowiseWasCalled = true;
    return Promise.resolve(Response.json([]));
  };

  const response = await GET(createRequest("GET", sessionId));

  expect(await response.json()).toEqual({ messages: [] });
  expect(response.headers.get("set-cookie")).toContain(
    `${COOKIE_NAME}=${sessionId}`
  );
  expect(flowiseWasCalled).toBe(false);
});

test("loads and maps the Flowise history for the current session", async () => {
  const sessionId = crypto.randomUUID();
  let historyUrl: URL | undefined;
  process.env.FLOWISE_API_KEY = "flowise-secret";

  globalThis.fetch = (input, init) => {
    historyUrl = new URL(String(input));
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer flowise-secret"
    );

    return Promise.resolve(
      Response.json([
        {
          id: "user-message",
          role: "userMessage",
          content: "Chamo-me Ana",
          createdDate: "2026-07-14T12:00:00.000Z",
        },
        {
          id: "assistant-message",
          role: "apiMessage",
          content: "Prazer, Ana",
          createdDate: "2026-07-14T12:00:01.000Z",
        },
      ])
    );
  };

  const response = await GET(createRequest("GET", sessionId));
  const data = await response.json();

  expect(historyUrl?.pathname).toBe(
    `/api/v1/chatmessage/${FLOWISE_CHATFLOW_ID}`
  );
  expect(historyUrl?.searchParams.get("sessionId")).toBe(sessionId);
  expect(historyUrl?.searchParams.get("order")).toBe("ASC");
  expect(data).toEqual({
    messages: [
      { id: "user-message", role: "user", content: "Chamo-me Ana" },
      {
        id: "assistant-message",
        role: "assistant",
        content: "Prazer, Ana",
      },
    ],
  });
});

test("starts a new session without deleting the previous Flowise history", async () => {
  let flowiseWasCalled = false;
  globalThis.fetch = () => {
    flowiseWasCalled = true;
    return Promise.resolve(Response.json([]));
  };

  const response = DELETE();
  const data = await response.json();
  const setCookie = response.headers.get("set-cookie") ?? "";
  const sessionId = setCookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1];

  expect(data).toEqual({ messages: [] });
  expect(sessionId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
  expect(setCookie).toContain("HttpOnly");
  expect(flowiseWasCalled).toBe(false);
});
