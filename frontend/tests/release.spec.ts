import { expect, test } from "@playwright/test";

test("SFC-Quant release walkthrough stays truthful and operable", async ({ page, request }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const networkErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("response", (response) => {
    if (response.status() >= 400) {
      networkErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await request.post("http://127.0.0.1:8000/api/strategy/config", {
    data: {
      enabled: false,
      auto_generate: false,
    },
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/SFC-Quant/);

  await expect(page.getByRole("heading", { level: 1, name: "SFC-Quant" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "总览" })).toBeVisible();
  await expect(page.getByText("当前仅为 paper 执行。行情可来自真实市场，但不会动用实盘资金。")).toBeVisible();
  await expect(page.getByText("CCXT -> CCXT").first()).toBeVisible();
  await expect(page.getByText("正常").first()).toBeVisible();

  await page.screenshot({ path: "/tmp/sfc-quant-release-home-zh.png", fullPage: true });

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Overview" })).toBeVisible();
  await expect(
    page.getByText("Paper execution only. Market data may be live, but no live funds are traded."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Chinese" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "总览" })).toBeVisible();

  const analysisResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/analysis/run") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "运行分析" }).click();
  await analysisResponse;
  await expect(page.getByRole("heading", { name: "最新论点" })).toBeVisible();
  await expect(page.getByRole("button", { name: "派发模拟交易" })).toBeEnabled({ timeout: 60_000 });

  const dispatchResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/execution/dispatch") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "派发模拟交易" }).click();
  await dispatchResponse;

  const enableFactoryResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/strategy/config") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "启用工厂" }).click();
  await enableFactoryResponse;
  await expect(page.getByText("已启用").first()).toBeVisible();

  const generateArtifactResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/strategy/generate") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await expect(page.getByRole("button", { name: "生成工件" })).toBeEnabled({ timeout: 60_000 });
  await page.getByRole("button", { name: "生成工件" }).click();
  await generateArtifactResponse;

  await expect(page.getByText("已完成").first()).toBeVisible();
  await expect(page.getByText("最近工件")).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(networkErrors).toEqual([]);
});
