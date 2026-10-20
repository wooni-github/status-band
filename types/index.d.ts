export type Usage = {
  session?: number; sessionResetAt?: string
  weekly?: number; weeklyResetAt?: string
  fable?: number; fableResetAt?: string
  fetchedAt: number
}
export type Turn = { input: number; output: number; cacheRead: number; cacheCreate: number; at: number; model: string }
export type GpuCard = { i: string; util: number; used: number; total: number }
/** One polled machine: GPU cards (when GPU is polled there), CPU busy % and RAM GiB (when shown). */
export type Gpu = { host: string; cards: GpuCard[]; gpu: boolean; cpu?: number; cores?: number; ram?: { used: number; total: number } }
export type Prompt = { at: number; text: string }
/** The session's goal: set by `/goal <condition>` or the ProposeGoal tool, gone on `/goal clear`. */
export type Goal = { text: string; at: number; done?: 'met' | 'failed'; doneAt?: number }
/** One scheduled /loop run: a dynamic wakeup (ScheduleWakeup) or a cron job (CronCreate). */
export type LoopJob = { id: string; kind: 'wake' | 'cron'; prompt: string; schedule?: string; next?: number; reason?: string; recurring?: boolean; at: number }
/** `git status --porcelain=v2 --branch` counts; `worktree` when git-dir differs from the common dir. */
export type GitState = { branch: string; detached: boolean; ahead: number; behind: number; staged: number; unstaged: number; untracked: number; conflicts: number; worktree: boolean }
export type RunningAgent = { id: string; type: string; desc: string; bg: boolean; at: number }
export type RunningTool = { id: string; tool: string; at: number }
/** Session activity: running agents and tools, todo states by key, edited files, call and error counts. */
export type Activity = { agents: RunningAgent[]; tools: RunningTool[]; todos: Record<string, string>; files: string[]; calls: number; errors: number }

declare module 'claude-code' {
  interface PluginState {
    'status-band': {
      usage: Usage | null
      turn: Turn | null
      gpu: Gpu[]
      prompts: Prompt[]
      compactions: number
      hidden: boolean
      working: boolean
      effort: string
      open: number
      lang: 'ko' | 'en' | ''
      git: GitState | null
      speed: number
      tz: number | null
      agentsOpen: boolean
      theme: 'dark' | 'light'
      activity: Activity
      buddyId: string
      agentView: RunningAgent | null
      memo: string
      memoEdit: number
      memoSessionPath: string
      memoDraft: { key: string; text: string }
      settingsDraft: { key: string; text: string }
      promptView: Prompt | null
      goal: Goal | null
      loops: LoopJob[]
    }
  }
}
