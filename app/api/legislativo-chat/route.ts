type FlowisePredictionResponse = {
  text?: string;
  answer?: string;
  result?: string;
  message?: string;
  json?: unknown;
};

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LegislativoChatRequestBody;

    const question = getLastUserMessage(body.messages);

    if (!question.trim()) {
      return Response.json({ error: "No question provided" }, { status: 400 });
    }

    const flowiseApiUrl = process.env.FLOWISE_API_URL;
    const chatflowId = process.env.FLOWISE_CHATFLOW_ID;
    const flowiseApiKey = process.env.FLOWISE_API_KEY;

    if (!flowiseApiUrl || !chatflowId) {
      return Response.json(
        {
          error: "Ocorreu um erro inesperado. Por favor, tente novamente.",
        },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${flowiseApiUrl.replace(/\/$/, "")}/api/v1/prediction/${chatflowId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(flowiseApiKey
            ? { Authorization: `Bearer ${flowiseApiKey}` }
            : {}),
        },
        body: JSON.stringify({
          question,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error("Flowise error:", errorText);

      return Response.json(
        {
          error: "Ocorreu um erro inesperado. Por favor, tente novamente.",
        },
        { status: response.status }
      );
    }

    const data = (await response.json()) as FlowisePredictionResponse;
    const text = getFlowiseText(data);

    return Response.json({ text });
  } catch (error) {
    console.error("Error en legislativo-chat Flowise:", error);

    return Response.json(
      { error: "Ocorreu um erro inesperado. Por favor, tente novamente." },
      { status: 500 }
    );
  }
}
