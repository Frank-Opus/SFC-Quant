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
  await expect(page.getByTestId("paper-guard-banner")).toHaveText(
    "当前仅为 paper 执行。行情可来自真实市场，但不会动用实盘资金。",
  );
  await expect(page.getByTestId("requested-market-source")).toContainText("CCXT -> CCXT");
  await expect(page.getByTestId("system-status-chip")).toContainText("正常");

  await page.screenshot({ path: "/tmp/sfc-quant-release-home-zh.png", fullPage: true });

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Overview" })).toBeVisible();
  await expect(page.getByTestId("paper-guard-banner")).toHaveText(
    "Paper execution only. Market data may be live, but no live funds are traded.",
  );

  await page.getByRole("button", { name: "Chinese" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "总览" })).toBeVisible();

  await page.getByRole("button", { name: "工作流中枢" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "工作流中枢" })).toBeVisible();
  const workflowStudio = page.getByTestId("workflow-studio");
  await expect(workflowStudio).toBeVisible();
  await expect(workflowStudio.getByTestId("workflow-star-stage")).toBeVisible();
  await expect(workflowStudio.getByTestId("workflow-role-node")).toHaveCount(4);
  await page.getByRole("button", { name: "总览" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "总览" })).toBeVisible();

  const analysisResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/analysis/run") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "运行分析" }).click();
  await analysisResponse;
  await page.getByRole("button", { name: "最新论点" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "最新论点" })).toBeVisible();
  const thesisPanel = page.getByTestId("thesis-panel");
  await expect(thesisPanel.locator(".empty-state")).toHaveCount(0);
  await expect(thesisPanel.locator(".thesis-summary-card")).toBeVisible();

  await page.getByRole("button", { name: "总览" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "总览" })).toBeVisible();
  await expect(page.getByRole("button", { name: "派发模拟交易" })).toBeEnabled({ timeout: 60_000 });

  const dispatchResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/execution/dispatch") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "派发模拟交易" }).click();
  await dispatchResponse;

  await page.getByRole("button", { name: "宏观证据与策略工作区" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "宏观证据与策略工作区" })).toBeVisible();

  const enableFactoryResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/strategy/config") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "启用工厂" }).click();
  await enableFactoryResponse;
  const strategyFactoryPanel = page.getByTestId("strategy-factory-panel");
  await expect(page.getByTestId("strategy-factory-status")).toContainText("已启用");

  const generateArtifactResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/strategy/generate") &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await expect(page.getByRole("button", { name: "生成工件" })).toBeEnabled({ timeout: 60_000 });
  await page.getByRole("button", { name: "生成工件" }).click();
  await generateArtifactResponse;

  await expect(page.getByTestId("strategy-generation-status")).toContainText("已完成");
  await expect(strategyFactoryPanel.getByTestId("strategy-recent-artifacts")).toContainText("最近工件");

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(networkErrors).toEqual([]);
});
