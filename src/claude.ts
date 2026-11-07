export interface RunOptions {
  prompt: string; cwd: string; model?: string; allowedTools?: string[];
  disallowedTools?: string[]; permissionMode?: string; timeoutMs: number;
}
export interface RunResult { ok: boolean; text: string }
export interface ClaudeRunner { run(o: RunOptions): Promise<RunResult> }
