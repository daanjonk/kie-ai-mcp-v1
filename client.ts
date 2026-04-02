/**
 * Kie AI API Client
 *
 * Universal client for all Kie AI models. Every model uses the same two endpoints:
 *   POST /jobs/createTask   — submit a generation / edit task
 *   GET  /jobs/recordInfo   — poll for task status and results
 */

import axios, { AxiosError } from "axios";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KieAiConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
}

export interface CreateTaskRequest {
  model: string;
  input: Record<string, unknown>;
  callBackUrl?: string;
}

export interface CreateTaskResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
  };
}

export interface TaskStatusResponse {
  code: number;
  msg: string;
  data: {
    taskId: string;
    model: string;
    state: "waiting" | "success" | "fail";
    param: string;
    resultJson: string | null;
    failCode: string | null;
    failMsg: string | null;
    costTime: number | null;
    completeTime: number | null;
    createTime: number;
  };
}

export interface TaskResult {
  taskId: string;
  model: string;
  state: "waiting" | "success" | "fail";
  resultUrls?: string[];
  resultObject?: Record<string, unknown>;
  failCode?: string;
  failMsg?: string;
  costTimeMs?: number;
  createdAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class KieAiClient {
  private config: KieAiConfig;

  constructor(config: KieAiConfig) {
    this.config = config;
  }

  /**
   * Create a generation / editing task for any model.
   */
  async createTask(request: CreateTaskRequest): Promise<CreateTaskResponse> {
    return this.post<CreateTaskResponse>("/jobs/createTask", request);
  }

  /**
   * Query the status of a task by its ID.
   */
  async getTaskStatus(taskId: string): Promise<TaskResult> {
    const response = await this.get<TaskStatusResponse>("/jobs/recordInfo", { taskId });
    return this.normalizeTaskResult(response);
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async post<T>(path: string, data: unknown): Promise<T> {
    try {
      const response = await axios.post(`${this.config.baseUrl}${path}`, data, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: this.config.timeout,
      });
      return response.data as T;
    } catch (error) {
      throw new Error(this.formatError(error));
    }
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    try {
      const response = await axios.get(`${this.config.baseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        params,
        timeout: this.config.timeout,
      });
      return response.data as T;
    } catch (error) {
      throw new Error(this.formatError(error));
    }
  }

  private normalizeTaskResult(response: TaskStatusResponse): TaskResult {
    const d = response.data;

    let resultUrls: string[] | undefined;
    let resultObject: Record<string, unknown> | undefined;

    if (d.resultJson) {
      try {
        const parsed = JSON.parse(d.resultJson);
        if (parsed.resultUrls) {
          resultUrls = parsed.resultUrls;
        } else if (parsed.resultObject) {
          resultObject = parsed.resultObject;
        }
      } catch {
        // resultJson was not valid JSON — ignore
      }
    }

    return {
      taskId: d.taskId,
      model: d.model,
      state: d.state,
      resultUrls,
      resultObject,
      failCode: d.failCode ?? undefined,
      failMsg: d.failMsg ?? undefined,
      costTimeMs: d.costTime ?? undefined,
      createdAt: new Date(d.createTime).toISOString(),
      completedAt: d.completeTime ? new Date(d.completeTime).toISOString() : undefined,
    };
  }

  private formatError(error: unknown): string {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const msg = error.response?.data?.msg;

      switch (status) {
        case 400:
          return `Bad request: ${msg ?? "Invalid parameters or content policy violation"}`;
        case 401:
          return "Authentication failed — check your KIE_AI_API_KEY";
        case 402:
          return "Insufficient credits — top up your Kie AI balance at https://kie.ai/api-key";
        case 404:
          return `Not found: ${msg ?? "Resource does not exist"}`;
        case 422:
          return `Validation error: ${msg ?? "Parameter validation failed"}`;
        case 429:
          return "Rate limit exceeded — wait a moment and try again";
        case 500:
          return `Kie AI server error: ${msg ?? "Internal error"}`;
        default:
          if (status) return `API error ${status}: ${msg ?? error.message}`;
          if (error.code === "ECONNABORTED") return "Request timed out — try again";
          return `Network error: ${error.message}`;
      }
    }
    return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
