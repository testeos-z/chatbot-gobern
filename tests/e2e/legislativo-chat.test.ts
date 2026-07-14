import { expect, test } from "@playwright/test";

test("restores history, sends messages, and starts a new conversation", async ({
  page,
}) => {
  let resetWasRequested = false;

  await page.route("**/api/legislativo-chat", async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          messages: [
            { id: "user-history", role: "user", content: "Chamo-me Ana" },
            {
              id: "assistant-history",
              role: "assistant",
              content: "Prazer, Ana",
            },
          ],
        }),
      });
      return;
    }

    if (request.method() === "DELETE") {
      resetWasRequested = true;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ messages: [] }),
      });
      return;
    }

    expect(request.postDataJSON()).toEqual({
      messages: [
        { id: "user-history", role: "user", content: "Chamo-me Ana" },
        {
          id: "assistant-history",
          role: "assistant",
          content: "Prazer, Ana",
        },
        expect.objectContaining({
          role: "user",
          content: "Qual é o meu nome?",
        }),
      ],
    });
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ text: "O seu nome é Ana" }),
    });
  });

  await page.goto("/legislativo-chat");

  await expect(page.getByText("Chamo-me Ana")).toBeVisible();
  await expect(page.getByText("Prazer, Ana")).toBeVisible();

  await page.getByTestId("legislativo-input").fill("Qual é o meu nome?");
  await page.getByTestId("legislativo-send-button").click();

  await expect(page.getByText("O seu nome é Ana")).toBeVisible();

  await page.getByTestId("legislativo-clear-button").click();

  await expect(page.getByText("Chamo-me Ana")).not.toBeVisible();
  expect(resetWasRequested).toBe(true);
});
