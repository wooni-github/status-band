import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Activity, GitState, Goal, Gpu, LoopJob, Prompt, RunningAgent, Turn, Usage } from '../types'
import type { Buddy, Lang, Rarity, Strings, Theme } from './lib'
import {
  NO_ACTIVITY, applyTodo, editedFile, elapsed, gitLabel, gitParse, todoProgress,
  FIVE_H, SEVEN_D,
  STRINGS, asLang, inkOn, padCells, themeOf,
  appleGpuParse, bar, duration, gpuParse, memInfoRam, pct4, procStatCpu, resRows, resWidths,
  sections, topCpuParse, vmStatRam, health, kTok, localTime, tzOffset, padCellsStart,
  cells, rowsOf, cronLabel, goalFromTranscript, transcriptPath, oneLine, parseUsage, pct, shortModel, windowElapsed, PET_ROWS, PET_W, PET_SPECIES, cutCells, cmdQuery, completeCmd, suggestCmds, STAT_NAMES, buddyIdOf, petFrame, petMood, rollBuddy, toolArg,
} from './lib'

const usageA = atom({ plugin: 'status-band', key: 'usage' } as const, null as Usage | null)
const turnA = atom({ plugin: 'status-band', key: 'turn' } as const, null as Turn | null)
const gpuA = atom({ plugin: 'status-band', key: 'gpu' } as const, [] as Gpu[])
const promptsA = atom({ plugin: 'status-band', key: 'prompts' } as const, [] as Prompt[])
const compA = atom({ plugin: 'status-band', key: 'compactions' } as const, 0)
const hiddenA = atom({ plugin: 'status-band', key: 'hidden' } as const, false)
const workingA = atom({ plugin: 'status-band', key: 'working' } as const, false)
const effortA = atom({ plugin: 'status-band', key: 'effort' } as const, 'default')
const openA = atom({ plugin: 'status-band', key: 'open' } as const, 0)   // `at` of the expanded prompt, 0 = none
const langA = atom({ plugin: 'status-band', key: 'lang' } as const, '' as Lang | '')   // `/band lang`, '' = the Language setting
const gitA = atom({ plugin: 'status-band', key: 'git' } as const, null as GitState | null)
const speedA = atom({ plugin: 'status-band', key: 'speed' } as const, 0)   // output tok/s of the last main-loop request
const tzA = atom({ plugin: 'status-band', key: 'tz' } as const, null as number | null)   // minutes east of UTC, from `date +%z`
const agentsOpenA = atom({ plugin: 'status-band', key: 'agentsOpen' } as const, false)   // the agent list, when 3 or more
const themeA = atom({ plugin: 'status-band', key: 'theme' } as const, 'dark' as Theme)
const actA = atom({ plugin: 'status-band', key: 'activity' } as const, NO_ACTIVITY as Activity)
const agentViewA = atom({ plugin: 'status-band', key: 'agentView' } as const, null as RunningAgent | null)   // the agent the side pane shows
const memoA = atom({ plugin: 'status-band', key: 'memo' } as const, '')   // the one memo, lines joined by \n
const memoDraftA = atom({ plugin: 'status-band', key: 'memoDraft' } as const, { key: '', text: '' })   // the memo field being typed in
const promptViewA = atom({ plugin: 'status-band', key: 'promptView' } as const, null as Prompt | null)   // the prompt the side pane shows whole
const goalA = atom({ plugin: 'status-band', key: 'goal' } as const, null as Goal | null)
const loopsA = atom({ plugin: 'status-band', key: 'loops' } as const, [] as LoopJob[])
const setDraftA = atom({ plugin: 'status-band', key: 'settingsDraft' } as const, { key: '', text: '' })   // the settings field being typed in
const memoEditA = atom({ plugin: 'status-band', key: 'memoEdit' } as const, -1)   // `id` of the memo being edited, 0 = none
const memoFileA = atom({ plugin: 'status-band', key: 'memoSessionPath' } as const, '')   // this session's memo file, once HOME is known
const buddyIdA = atom({ plugin: 'status-band', key: 'buddyId' } as const, '')   // the account id Claude Code rolled the buddy from

// ccstatusline palette
// the four role colors: the Palette setting replaces them when register runs (a settings change reloads the module)
let PINK = '#D0607A', YELLOW = '#E8C07D', GREEN = '#A3BE8C', BLUE = '#5B80A8'
const DARK = '#1E1E2E', LIGHT = '#F5F5F5'
const ORANGE = '#D08770', RED = '#BF616A'   // resource load
let SEQ = [PINK, YELLOW, GREEN, BLUE]   // pill order in every chain
// powerline glyphs (Nerd Font), escaped so no copy or paste drops them: rounded caps around an arrow-joined pill row
const CAP_L = '\uE0B6', ARROW = '\uE0B0', CAP_R = '\uE0B4'
// the pet: body pink, effects in their own colors
const petFx = (): Record<string, string> => ({ '*': YELLOW, '+': YELLOW, z: BLUE, Z: BLUE, ';': BLUE, '?': GREEN, '!': GREEN, '♥': RED })
let PET_FX = petFx()
const isColor = (s: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)
const PET_FRAME_MS = 500
// Claude Code's rarity colors (dark theme) and stars
const RARITY_COLOR: Record<Rarity, string> = { common: '#999999', uncommon: '#4EBA65', rare: '#B1B9F9', epic: '#AF87FF', legendary: '#FFC107' }
const STARS: Record<Rarity, string> = { common: '★', uncommon: '★★', rare: '★★★', epic: '★★★★', legendary: '★★★★★' }
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const GPU_QUERY = ['--query-gpu=index,utilization.gpu,memory.used,memory.total,temperature.gpu', '--format=csv,noheader,nounits']

// ---- data loops ---------------------------------------------------------
async function fetchUsage($: EngineInterface) {
  const now = await $.clock.now()
  try {
    const auth = await $.session.authorize()
    if (auth) {
      const r = await $.http.fetch(USAGE_URL, { auth: auth.handle, headers: { 'anthropic-beta': 'oauth-2025-04-20' } })
      if (r.ok) { await update($, usageA, () => parseUsage(JSON.parse(r.text), now)); return }
    }
  } catch { /* fall through to the engine's own reading */ }
  const { rateLimits } = await $.session.usage()
  const five = rateLimits.find(l => l.kind === 'five_hour'), week = rateLimits.find(l => l.kind === 'seven_day')
  if (five || week) await update($, usageA, prev => ({
    ...(prev ?? {}), fetchedAt: now,
    session: five?.percentUsed, sessionResetAt: five?.resetsAt,
    weekly: week?.percentUsed, weeklyResetAt: week?.resetsAt,
  }))
}

// the machine's own UTC offset: the plugin runtime's Date may not know the local zone
// the id Claude Code hatched the buddy from: ~/.claude.json's account uuid
async function loadBuddyId($: EngineInterface) {
  let id = 'anon'
  try {
    const home = (await $.process.run(['printenv', 'HOME'], { timeoutMs: 3000 })).stdout.trim()
    if (home) id = buddyIdOf(await $.fs.read(`${home}/.claude.json`))
  } catch { /* no config: the anonymous buddy */ }
  await update($, buddyIdA, () => id)
}

async function pollTz($: EngineInterface) {
  const off = tzOffset(await run($, ['date', '+%z'], 3000))
  if (off !== undefined) await update($, tzA, () => off)
}

// in the session's directory; both empty outside a repository
async function pollGit($: EngineInterface) {
  const [status, dirs] = await Promise.all([
    run($, ['git', 'status', '--porcelain=v2', '--branch'], 5000),
    run($, ['git', 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'], 5000),
  ])
  const [gitDir, commonDir] = dirs.trim().split('\n')
  await update($, gitA, () => gitParse(status, !!gitDir && !!commonDir && gitDir !== commonDir) ?? null)
}

// redraw every second while something shows a running clock
async function tickActivity($: EngineInterface) {
  const [act, now] = await Promise.all([read($, actA), $.clock.now()])
  if (act.agents.length || act.tools.some(t => now - t.at >= 9000)) $.ui.invalidate('ui.render')
}

// drop agents the engine no longer runs (a missed turn.complete, a killed one)
// the engine's agent list is the truth: agent.spawn alone misses agents started before this module
// (re)loaded, so live ones it never saw are added (timed from now) and ended ones dropped
async function syncAgents($: EngineInterface) {
  const all = await $.agent.list().catch(() => null)
  if (!all) return
  const live = all.filter(a => ['pending', 'running', 'waiting'].includes(a.status))
  const ids = new Set(live.map(a => a.id)), now = await $.clock.now()
  await update($, actA, act => {
    const known = new Set(act.agents.map(x => x.id))
    const added = live.filter(a => !known.has(a.id)).map(a => ({ id: a.id, type: a.type, desc: a.description, bg: false, at: now }))
    return { ...act, agents: [...act.agents.filter(x => ids.has(x.id)), ...added] }
  })
}

/** A machine to poll: `local`, or an ssh host (assumed Linux). */
type Source = { host: string; gpu: boolean; cpu: boolean; ram: boolean }
type Local = { mac: boolean; memBytes: number; cores?: number }

const run = async ($: EngineInterface, argv: string[], timeoutMs = 8000) => {
  try {
    const r = await $.process.run(argv, { timeoutMs })
    return r.exitCode === 0 ? r.stdout : ''
  } catch { return '' }
}

// /proc/stat twice, a second apart: CPU busy over that second
const PROC_CPU = 'head -1 /proc/stat; sleep 1; head -1 /proc/stat'
const MEMINFO = 'grep -E "^(MemTotal|MemAvailable):" /proc/meminfo'

async function probeLocal($: EngineInterface): Promise<Local> {
  const mac = (await run($, ['uname', '-s'])).trim() === 'Darwin'
  const cores = +(await run($, mac ? ['sysctl', '-n', 'hw.ncpu'] : ['nproc'])).trim() || undefined
  const memBytes = mac ? +(await run($, ['sysctl', '-n', 'hw.memsize'])).trim() || 0 : 0
  return { mac, memBytes, cores }
}

async function pollLocal($: EngineInterface, src: Source, local: Local): Promise<Gpu> {
  const [gpuOut, cpuOut, ramOut] = await Promise.all([
    !src.gpu ? '' : run($, local.mac ? ['ioreg', '-r', '-d', '1', '-c', 'IOAccelerator'] : ['nvidia-smi', ...GPU_QUERY]),
    !src.cpu ? '' : run($, local.mac ? ['top', '-l', '2', '-n', '0', '-s', '1'] : ['sh', '-c', PROC_CPU]),
    !src.ram ? '' : run($, local.mac ? ['vm_stat'] : ['sh', '-c', MEMINFO]),
  ])
  return {
    host: src.host, gpu: src.gpu, cores: local.cores,
    cards: !src.gpu ? [] : local.mac ? appleGpuParse(gpuOut, local.memBytes) : gpuParse(gpuOut),
    cpu: !src.cpu ? undefined : local.mac ? topCpuParse(cpuOut) : procStatCpu(cpuOut),
    ram: !src.ram ? undefined : local.mac ? vmStatRam(ramOut, local.memBytes) : memInfoRam(ramOut),
  }
}

async function pollSsh($: EngineInterface, src: Source): Promise<Gpu> {
  // one connection per host, each part after its own marker line
  const remote = [
    src.gpu ? `echo @@hud-gpu@@; nvidia-smi ${GPU_QUERY.join(' ')} 2>/dev/null` : '',
    src.cpu ? `echo @@hud-cores@@; nproc; echo @@hud-cpu@@; ${PROC_CPU}` : '',
    src.ram ? `echo @@hud-ram@@; ${MEMINFO}` : '',
  ].filter(Boolean).join('; ')
  const part = sections(await run($, ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3', src.host, remote], 10_000))
  return {
    host: src.host, gpu: src.gpu, cores: +(part.cores ?? '').trim() || undefined,
    cards: src.gpu ? gpuParse(part.gpu ?? '') : [],
    cpu: src.cpu ? procStatCpu(part.cpu ?? '') : undefined,
    ram: src.ram ? memInfoRam(part.ram ?? '') : undefined,
  }
}

async function pollResources($: EngineInterface, sources: Source[], local: Promise<Local>) {
  const rows = await Promise.all(sources.map(async src =>
    src.host === 'local' ? pollLocal($, src, await local) : pollSsh($, src)))
  await update($, gpuA, () => rows)
}

/** `/band lang` for this session, else the Language setting. */
async function langOf($: EngineInterface, fallback: Lang): Promise<Lang> {
  return (await read($, langA)) || fallback
}

// `auto` follows Claude Code's own theme row; its dialog may change it without a config.set, so this is polled too
async function pollTheme($: EngineInterface, setting: string) {
  let engine: unknown
  try { engine = setting === 'auto' ? (await $.config.list()).find(r => r.key === 'theme')?.value : undefined } catch { /* no menu here: dark */ }
  await update($, themeA, () => themeOf(setting, engine))
}

async function toggleAgents($: EngineInterface) {
  await update($, agentsOpenA, v => !v)
}

// a click on an agent line: its conversation in the side pane (kept after the agent ends)
const AGENT_PANE = 'agent'

// ---- memo: one note per terminal session, in ~/.claude/band-memo/<session id>.md (kept across --resume) ----
// the band shows its first lines under the prompts; a click opens it in the side pane, a line at a time
const MEMO_PANE = 'memo'
async function loadMemo($: EngineInterface) {
  try {
    let file = await read($, memoFileA)
    if (!file) {
      const home = (await $.process.run(['printenv', 'HOME'], { timeoutMs: 3000 })).stdout.trim()
      if (!home) return
      const dir = `${home}/.claude/band-memo`
      await $.process.run(['mkdir', '-p', dir], { timeoutMs: 3000 })
      file = `${dir}/${await $.session.id()}.md`
      await update($, memoFileA, () => file)
    }
    const text = await $.fs.read(file)
    await update($, memoA, () => text.replace(/\s+$/, ''))
  } catch { /* no memo yet */ }
}
// other sessions share the file: read it again right before a change, so none drops another's edit
async function changeMemo($: EngineInterface, change: (lines: string[]) => string[]) {
  await loadMemo($)
  const cur = await read($, memoA)
  const text = change(cur ? cur.split('\n') : []).join('\n')
  await update($, memoA, () => text)
  const file = await read($, memoFileA)
  if (file) await $.fs.write(file, text + '\n').catch(() => $.ui.toast('band: memo not saved'))
}
// open first, while the call still answers the person's press: an open after other awaits may count as
// unasked, and an unasked pane waits undrawn below 144 columns
async function openMemo($: EngineInterface) {
  const r = await $.ui.open({ id: MEMO_PANE, title: '📝 memo', focus: true, closeOnEscape: true })
  if (!r.isPlaced) $.ui.toast(`band: ${r.reason}`)
  await loadMemo($)
}
async function setMemoDraft($: EngineInterface, key: string, text: string) {
  await update($, memoDraftA, () => ({ key, text }))
}
// a suggestion picked: the /name being typed completed in the field
async function pickMemoCmd($: EngineInterface, key: string, text: string, name: string) {
  await update($, memoDraftA, () => ({ key, text: completeCmd(text, name) }))
}
async function addMemoLine($: EngineInterface, text: string) {
  await update($, memoDraftA, () => ({ key: '', text: '' }))
  if (text.trim()) await changeMemo($, lines => [...lines, text.trimEnd()])
}
/** A line's new text; empty removes the line. */
async function setMemoLine($: EngineInterface, i: number, text: string) {
  await update($, memoEditA, () => -1)
  await update($, memoDraftA, () => ({ key: '', text: '' }))
  await changeMemo($, lines => (text.trim() ? lines.map((l, k) => (k === i ? text.trimEnd() : l)) : lines.filter((_, k) => k !== i)))
}
// a /command named in the memo: into the prompt box at the cursor, for the person to send
async function mentionCmd($: EngineInterface, name: string) {
  const r = await $.prompt.fill({ text: `/${name} `, mode: 'insert' }).catch(() => null)
  if (!r?.isFilled) $.ui.toast(`band: /${name}`)
}
async function editMemoLine($: EngineInterface, i: number) {
  const lines = (await read($, memoA)).split('\n')
  await update($, memoDraftA, () => ({ key: `memo:edit:${i}`, text: lines[i] ?? '' }))
  await update($, memoEditA, v => (v === i ? -1 : i))
}
async function viewAgent($: EngineInterface, a: RunningAgent) {
  const r = await $.ui.open({ id: AGENT_PANE, title: `🤖 ${a.type}`, closeOnEscape: true })
  if (!r.isPlaced) $.ui.toast(`band: ${r.reason}`)
  await update($, agentViewA, () => a)
  void $.ui.scroll({ in: AGENT_PANE, to: 'end' }).catch(() => {})
}

// the goal: the engine tells plugins nothing, so its own transcript rows say it — `/goal`'s output
// (set, cleared) and the notice when the condition is met or cannot be; read from the file's tail
const GOAL_MARKS = '"content":"<local-command-stdout>(Goal set: [^<]*|Goal cleared|No goal set)|"type":"goal_status","met":(true|false(,"sentinel":true)?,"condition":"([^"\\\\]|\\\\.)*")|"content":"Goal could not be achieved|"content":"Goal cleared'
let goalCwd = '', goalFile = ''   // session.start sets the cwd (it fires again on every reload)
async function syncGoal($: EngineInterface) {
  try {
    if (!goalFile) {
      // the file sits under the directory the session started in, which may not be the cwd now: find it by id
      const id = await $.session.id()
      if (!/^[\w-]+$/.test(id)) return
      const found = (await $.process.run(['sh', '-c', `ls -t "$HOME"/.claude/projects/*/${id}.jsonl 2>/dev/null | head -1`], { timeoutMs: 3000 })).stdout.trim()
      const home = found ? '' : (await $.process.run(['printenv', 'HOME'], { timeoutMs: 3000 })).stdout.trim()
      goalFile = found || (home && goalCwd ? transcriptPath(home, goalCwd, id) : '')
      if (!goalFile) return
    }
    // only the marker rows, from the whole file: a long session pushes them far from its end
    const marks = (await $.process.run(['grep', '-a', '-o', '-E', GOAL_MARKS, goalFile], { timeoutMs: 5000 })).stdout
    const tail = marks.split('\n').slice(-50).join('\n')
    const s = goalFromTranscript(tail)
    if (!s) return
    const at = await $.clock.now()
    await update($, goalA, g => {
      if (s.kind === 'set') return g && g.text === s.text && !g.done ? g : { text: s.text, at }
      if (s.kind === 'clear') return null
      return g && !g.done ? { ...g, done: s.kind, doneAt: at } : g   // met / failed: shown a while, then gone
    })
  } catch { /* no transcript yet */ }
}

// ---- one prompt, whole (line breaks kept) ----
// the prompt as it was sent (line breaks kept), for the band's focused view
async function loadPromptRaw($: EngineInterface, p: Prompt) {
  await update($, promptViewA, () => p)
  const head = (p.text.endsWith('…') ? p.text.slice(0, -1) : p.text).slice(0, 200)
  const found = (await $.session.messages()).find(m => m.role === 'user' && oneLine(m.text, 4000).startsWith(head))
  if (found) await update($, promptViewA, v => (v?.at === p.at ? { ...v, text: found.text } : v))
}

// ---- settings: every /config row of this plugin, in a side pane ----
const SETTINGS_PANE = 'settings'
async function openSettings($: EngineInterface) {
  const r = await $.ui.open({ id: SETTINGS_PANE, title: '⚙ band', focus: true, closeOnEscape: true })
  if (!r.isPlaced) $.ui.toast(`band: ${r.reason}`)
}
// written like a change in /config: the engine reloads this module with the new options
async function setOption($: EngineInterface, key: string, value: boolean | string | number) {
  await update($, setDraftA, () => ({ key: '', text: '' }))
  const r = await $.config.set({ key, value }).catch((err: unknown) => ({ deny: String(err) }))
  if (r.deny) $.ui.toast(`band: ${r.deny}`)
}

type CronJobs = { jobs?: { id: string; cron: string; humanSchedule?: string; prompt: string; recurring?: boolean; nextFireAt?: number }[] }
/** The session's cron jobs as they are now (a job from before a restart or --continue included). */
async function syncCrons($: EngineInterface, given?: CronJobs) {
  try {
    let list = given
    if (!list) {
      const r = await $.tool.call({ tool: 'CronList' })
      if (('deny' in r && r.deny) || r.isError) return
      list = r.result as CronJobs
    }
    const jobs = list?.jobs
    if (!jobs) return
    const at = await $.clock.now()
    await update($, loopsA, l => [...l.filter(x => x.kind !== 'cron'), ...jobs.map(j => ({
      id: j.id, kind: 'cron' as const, prompt: j.prompt, schedule: cronLabel(j.humanSchedule ?? j.cron), next: j.nextFireAt,
      recurring: j.recurring !== false, at: l.find(x => x.id === j.id)?.at ?? at,
    }))])
  } catch { /* no cron tool here */ }
}

// too long for the rows left: the band's focused view of it (the left side gives itself to it)
async function openCard($: EngineInterface, p: Prompt) {
  await update($, openA, () => p.at)
  await loadPromptRaw($, p)
}

async function toggleOpen($: EngineInterface, p: Prompt) {
  const cur = await read($, openA)
  await update($, openA, () => (cur === p.at ? 0 : p.at))
  if (cur === p.at || !p.text.endsWith('…')) return
  const head = p.text.slice(0, -1)
  const found = (await $.session.messages()).find(m => m.role === 'user' && oneLine(m.text, 4000).startsWith(head))
  if (found) await update($, promptsA, list => list.map(q => (q.at === p.at ? { ...q, text: oneLine(found.text, 4000) } : q)))
}

async function gather($: EngineInterface, promptLines: number) {
  const now = await $.clock.now()
  const [usage, turn, gpu, prompts, compactions, working] = await Promise.all([
    read($, usageA), read($, turnA), read($, gpuA), read($, promptsA), read($, compA), read($, workingA),
  ])
  const [effort, open, git, speed, act, tz] = await Promise.all([read($, effortA), read($, openA), read($, gitA), read($, speedA), read($, actA), read($, tzA)])
  const agentsOpen = await read($, agentsOpenA)
  const theme = await read($, themeA)
  const memo = await read($, memoA)
  const [goal, loops] = await Promise.all([read($, goalA), read($, loopsA)])
  const { context, cost, startedAt } = await $.session.usage()
  const sinceS = turn ? (now - turn.at) / 1000 : undefined
  const cacheLeft = sinceS === undefined ? undefined : Math.max(0, 300 - sinceS)
  return { now, usage, turn, gpu, prompts: prompts.filter(p => !/<\/?(?:task-notification|system-reminder)>/.test(p.text)).slice(-promptLines), compactions, working, effort, open, context, cacheLeft, cost, startedAt, git, speed, act, tz, agentsOpen, theme, memo, goal, loops }
}
type Gathered = Awaited<ReturnType<typeof gather>>

export const register: Register = (on, options) => {
  const opt = options as Record<string, unknown>
  const num = (k: string, d: number) => (typeof opt[k] === 'number' ? (opt[k] as number) : d)
  const str = (k: string, d: string) => (typeof opt[k] === 'string' ? (opt[k] as string) : d)
  const bool = (k: string, d: boolean) => (typeof opt[k] === 'boolean' ? (opt[k] as boolean) : d)
  const gpuLocal = bool('gpuLocal', true), gpuSsh = bool('gpuSsh', true), showCpu = bool('showCpu', true), showRam = bool('showRam', true)
  const sshHosts = gpuSsh ? str('gpuHosts', '').split(',').map(s => s.trim()).filter(Boolean) : []
  const sources: Source[] = [
    ...(gpuLocal || showCpu || showRam ? [{ host: 'local', gpu: gpuLocal, cpu: showCpu, ram: showRam }] : []),
    ...sshHosts.map(host => ({ host, gpu: true, cpu: showCpu, ram: showRam })),
  ]
  const showGit = bool('showGit', true), showCost = bool('showCost', true), showActivity = bool('showActivity', true)
  const showGoalLoop = bool('showGoalLoop', true)
  // the pet: your own Claude Code buddy, or a species picked in the settings; eyes, hat and name may be overridden
  const petSetting = str('pet', 'buddy'), showPet = petSetting !== 'off'
  const petEyeSetting = str('petEye', 'auto'), petHatSetting = str('petHat', 'auto'), petName = str('petName', '').trim()
  const buddyOf = (id: string): Buddy => {
    const b = rollBuddy(id || 'anon')
    return {
      ...b,
      species: PET_SPECIES.includes(petSetting) ? petSetting : b.species,
      eye: petEyeSetting === 'auto' ? b.eye : petEyeSetting,
      hat: petHatSetting === 'auto' ? b.hat : petHatSetting,
    }
  }
  const nameOf = (b: Buddy) => petName || b.species[0]!.toUpperCase() + b.species.slice(1)
  let gitQueued = false
  const resTitle = [gpuLocal || sshHosts.length ? 'GPU' : '', showCpu ? 'CPU' : '', showRam ? 'RAM' : ''].filter(Boolean).join(' · ')
  let ctxToasted = false
  const cfgLang = asLang(opt.language)
  const palette = str('pillColors', '').split(',').map(s => s.trim())
  if (palette.length === 4 && palette.every(isColor)) {
    [PINK, YELLOW, GREEN, BLUE] = palette as [string, string, string, string]
    SEQ = [PINK, YELLOW, GREEN, BLUE]; PET_FX = petFx()
  }
  const colorOpt = (k: string) => (isColor(str(k, '').trim()) ? str(k, '').trim() : undefined)
  const pillText = colorOpt('pillText'), textColor = colorOpt('textColor')
  const petPlace = str('petPlace', 'auto'), gpuColumns = str('gpuColumns', 'auto')
  const themeSetting = str('theme', 'contrast')

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'band', description: 'Toggle the band · lang ko|en · buddy · settings' })
    await $.command.register({ name: 'memo', description: 'Add a line to the memo (no text: open it)' })
    void fetchUsage($)
    $.clock.every(num('usageIntervalSec', 60) * 1000, () => void fetchUsage($))
    if (sources.length) {
      const local = probeLocal($)
      void pollResources($, sources, local)
      $.clock.every(num('gpuIntervalSec', 15) * 1000, () => void pollResources($, sources, local))
    }
    void pollTheme($, themeSetting)
    if (themeSetting === 'auto') $.clock.every(10_000, () => void pollTheme($, themeSetting))
    void pollTz($)
    $.clock.every(3600e3, () => void pollTz($))   // daylight saving moves it
    if (showGit) {
      void pollGit($)
      $.clock.every(num('gitIntervalSec', 10) * 1000, () => void pollGit($))
    }
    if (showActivity) {
      $.clock.every(1000, () => void tickActivity($))
      void syncAgents($)
      $.clock.every(2000, () => void syncAgents($))
    }
    if (showPet) void loadBuddyId($)
    if (showGoalLoop) {
      goalCwd = e.cwd
      void syncGoal($)
      $.clock.every(10_000, () => void syncGoal($))
      $.clock.after(2000, () => void syncCrons($))
    }
    void loadMemo($)
    $.clock.every(5000, () => void loadMemo($))   // edits from another session or an editor show up
    $.clock.every(showPet ? PET_FRAME_MS : 10_000, () => $.ui.invalidate('ui.render'))   // the pet's frames, else the clocks
    return next(e)
  })

  // ---- commands -----------------------------------------------------------
  on('command.run', { command: 'band' }, async ($, e) => {
    const arg = e.args.trim()
    const pick = /^(?:lang\s+)?(ko|en)$/.exec(arg)
    if (pick) {
      await update($, langA, () => pick[1] as Lang)
      return { text: STRINGS[pick[1] as Lang].lang }
    }
    const t = STRINGS[await langOf($, cfgLang)]
    if (arg === 'settings' || arg === 'config') { await openSettings($); return {} }
    if (arg === 'buddy' || arg === 'pet') {
      const b = buddyOf(await read($, buddyIdA))
      const stat = STAT_NAMES.map(n => `${n.padEnd(9)} ${'█'.repeat(Math.round(b.stats[n]! / 10)).padEnd(10, '░')} ${b.stats[n]}`)
      return { text: [`${b.shiny ? '✨ ' : ''}${nameOf(b)} · ${b.rarity} ${b.species} ${STARS[b.rarity]}`,
        ...petFrame(b.species, 'idle', 0, b.eye, b.hat).filter(l => l.trim()), ...stat].join('\n') }
    }
    const hidden = arg === 'hide' ? false : arg === 'show' ? true : await read($, hiddenA)
    await update($, hiddenA, () => !hidden)
    return { text: hidden ? t.shown : t.hidden }
  })
  on('command.run', { command: 'memo' }, async ($, e) => {
    const text = e.args.trim()
    if (!text) { await openMemo($); return {} }
    await addMemoLine($, text)
    return { text: `📝 ${text}` }
  })


  // ---- recording ----------------------------------------------------------
  // only what the person typed: a background task's notice, a /loop firing or another session's message is not a prompt of theirs
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') return next(e)
    const at = await $.clock.now()
    await update($, promptsA, list => [...list, { at, text: oneLine(e.text, 4000) }].slice(-5))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await update($, workingA, () => true)
    if (showGoalLoop) { void syncGoal($); void syncCrons($) }   // a fired job has a new next run
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId) return yield* next(e)
    await update($, effortA, () => String(e.effort ?? 'default'))
    const t0 = await $.clock.now()
    const r = yield* next(e)
    const out = r.usage?.output_tokens ?? 0, sec = ((await $.clock.now()) - t0) / 1000
    if (out >= 20 && sec > 0) await update($, speedA, () => out / sec)
    return r
  })

  on('turn.complete', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId) {   // a subagent's loop: not the main turn's tokens, model or working state
      await update($, actA, a => ({ ...a, agents: a.agents.filter(x => x.id !== e.agentId) }))
      return ran
    }
    await update($, workingA, () => false)
    if (showGoalLoop) void syncGoal($)
    {
      const at = await $.clock.now()
      await update($, loopsA, l => (l.some(x => x.next !== undefined && x.next < at - 5000 && (x.kind === 'wake' || !x.recurring))
        ? l.filter(x => !(x.next !== undefined && x.next < at - 5000 && (x.kind === 'wake' || !x.recurring))) : l))
    }
    if (ran.usage) {
      const u = ran.usage, at = await $.clock.now()
      await update($, turnA, prev => ({
        input: (prev?.input ?? 0) + u.input_tokens, output: (prev?.output ?? 0) + u.output_tokens,
        cacheRead: u.cache_read_input_tokens, cacheCreate: u.cache_creation_input_tokens, at, model: u.model,
      }))
    }
    const { context } = await $.session.usage()
    if ((context.percent ?? 0) >= 80 && !ctxToasted) { ctxToasted = true; $.ui.toast(STRINGS[await langOf($, cfgLang)].ctxToast(context.percent!)) }
    return ran
  })

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const r = await next(e)
    if (themeSetting === 'auto' && 'value' in r) await update($, themeA, () => themeOf('auto', r.value))
    return r
  })

  on('session.compact', async ($, e, next) => {
    await update($, compA, n => n + 1)
    return next(e)
  })

  // ---- activity -----------------------------------------------------------
  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if (showActivity && 'agentId' in r && r.agentId) {
      const at = await $.clock.now(), agent = { id: r.agentId, type: e.subagentType, desc: e.description, bg: e.background, at }
      await update($, actA, a => ({ ...a, agents: [...a.agents.filter(x => x.id !== agent.id), agent] }))
    }
    return r
  })

  on('tool.call', async ($, e, next) => {
    if (!showActivity && !showGit) return next(e)
    const id = e.tool_use_id ?? `${e.tool}:${await $.clock.now()}`
    const timed = showActivity && !e.agentId && e.tool !== 'Agent'
    if (timed) {
      const at = await $.clock.now()
      await update($, actA, a => ({ ...a, tools: [...a.tools, { id, tool: e.tool, at }] }))
    }
    let r
    try { r = await next(e) } finally {
      if (timed) await update($, actA, a => ({ ...a, tools: a.tools.filter(t => t.id !== id) }))
    }
    if (showActivity && !('deny' in r && r.deny)) {
      const file = r.isError ? undefined : editedFile(e.tool, e)
      await update($, actA, a => ({
        ...a, calls: a.calls + 1, errors: a.errors + (r.isError ? 1 : 0),
        files: file && !a.files.includes(file) ? [...a.files, file] : a.files,
        todos: r.isError ? a.todos : applyTodo(a.todos, e.tool, e, r.result),
      }))
    }
    // the working copy may have changed: re-read git a second later, once
    if (showGit && !gitQueued && ['Bash', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(e.tool)) {
      gitQueued = true
      $.clock.after(1000, () => { gitQueued = false; void pollGit($) })
    }
    return r
  })

  // ---- goal & loop: what the engine does not show in one place -------------
  // the goal is read from the transcript (syncGoal); the ProposeGoal tool sets it at once
  on('tool.call', { tool: 'ProposeGoal' }, async ($, e, next) => {
    const r = await next(e)
    if (!('deny' in r && r.deny) && !r.isError) {
      const text = (r.result as { condition?: string } | undefined)?.condition ?? e.condition
      if (text) { const at = await $.clock.now(); await update($, goalA, () => ({ text, at })) }
    }
    return r
  })
  // /loop: a dynamic loop is one pending wakeup at a time; an interval loop is a cron job
  on('tool.call', { tool: 'ScheduleWakeup' }, async ($, e, next) => {
    const r = await next(e)
    if (('deny' in r && r.deny) || r.isError) return r
    const res = (r.result ?? {}) as { scheduledFor?: number; stopped?: boolean }
    const at = await $.clock.now()
    await update($, loopsA, l => {
      const rest = l.filter(x => x.kind !== 'wake')
      return e.stop || res.stopped ? rest : [...rest, { id: 'wake', kind: 'wake' as const, prompt: e.prompt ?? '', reason: e.reason, next: res.scheduledFor, at }]
    })
    return r
  })
  on('tool.call', { tool: 'CronCreate' }, async ($, e, next) => {
    const r = await next(e)
    if (('deny' in r && r.deny) || r.isError) return r
    const res = (r.result ?? {}) as { id?: string; humanSchedule?: string; recurring?: boolean; nextFireAt?: number }
    const at = await $.clock.now(), id = res.id ?? `cron:${at}`
    await update($, loopsA, l => [...l.filter(x => x.id !== id), { id, kind: 'cron' as const, prompt: e.prompt, schedule: cronLabel(res.humanSchedule ?? e.cron), next: res.nextFireAt, recurring: res.recurring ?? e.recurring !== false, at }])
    return r
  })
  on('tool.call', { tool: 'CronList' }, async ($, e, next) => {
    const r = await next(e)
    if (!('deny' in r && r.deny) && !r.isError) await syncCrons($, r.result as CronJobs)
    return r
  })
  on('tool.call', { tool: 'CronDelete' }, async ($, e, next) => {
    const r = await next(e)
    if (!('deny' in r && r.deny) && !r.isError) await update($, loopsA, l => l.filter(x => x.id !== e.id))
    return r
  })

  // ---- drawing ------------------------------------------------------------
  const promptLines = num('promptLines', 3)


  // the mascot: one face per mood
  const mascot = (g: Gathered, t: Strings): [string, string] => {
    const ctx = g.context.percent ?? 0
    if (g.working) return ['(•̀ᴗ•́)و', t.working]
    if (ctx >= 80) return ['(×﹏×)', t.ctxHigh(ctx)]
    if (g.cacheLeft !== undefined && g.cacheLeft <= 0) return ['(－ω－) zzZ', t.cacheCold]
    return ['(•ᴗ•)', t.idle]
  }

  // ---- side pane: one subagent's conversation ------------------------------
  on('ui.close', async ($, e, next) => {
    if (e.id === AGENT_PANE) await update($, agentViewA, () => null).catch(() => {})
    return next(e)
  })
  // the arrows stop at the memo's last field instead of running off it to the prompt; Esc still leaves
  on('ui.focus', { requestId: MEMO_PANE }, ($, e, next) => (e.origin.kind === 'person' && !e.element ? {} : next(e)))
  on('ui.render', { component: 'Pane', requestId: MEMO_PANE }, async ($, e) => {
    const { Box, Button, Input, Text } = $.ui.resolve(e)
    const [memo, editing, draft, cmds] = await Promise.all([read($, memoA), read($, memoEditA), read($, memoDraftA), $.command.list().catch(() => [])])
    const t = STRINGS[await langOf($, cfgLang)]
    const lines = memo ? memo.split('\n') : []
    // `/name` in a line, when the session has that command (skills included; `/caveman` also finds a
    // plugin's `caveman:caveman`): a button under the line that puts it in the prompt box
    const names = cmds.map(c => c.name)
    const resolve = (n: string) => (names.includes(n) ? n : names.find(x => x.endsWith(`:${n}`)))
    const refs = (l: string) => [...new Set([...l.matchAll(/(?:^|\s)\/([\w:.-]+)/g)].map(m => resolve(m[1]!)).filter((x): x is string => !!x))]
    // typing `/` in a field: the commands it could be, under the field; a click completes it
    const w = Math.max(20, e.props.bodyColumns - 2)
    const suggest = (key: string) => {
      const q = draft.key === key ? cmdQuery(draft.text) : undefined
      const found = q === undefined ? [] : suggestCmds(cmds, q)
      return found.map(c => (
        <Box flexDirection="row">
          <Text dimColor>{'  '}</Text>
          <Button key={`memo:pick:${c.name}`} variant="secondary" label={`/${c.name}`} onPress={() => void pickMemoCmd($, key, draft.text, c.name)} />
          <Text dimColor wrap="truncate">{' '}{cutCells(c.description, Math.max(10, w - cells(c.name) - 8))}</Text>
        </Box>
      ))
    }
    const field = (key: string, fallback: string) => (draft.key === key ? draft.text : fallback)
    return (
      <Box flexDirection="column">
        <Text dimColor>{t.memoHelp}</Text>
        {lines.map((l, i) => (editing === i
          ? (
            <Box flexDirection="column">
              <Input key={`memo:edit:${i}`} value={field(`memo:edit:${i}`, l)} autoFocus submitLabel={t.memoSave}
                onInput={v => void setMemoDraft($, `memo:edit:${i}`, v)} onSubmit={v => void setMemoLine($, i, v)} />
              {suggest(`memo:edit:${i}`)}
            </Box>
          )
          : (
            <Box flexDirection="column">
              <Button key={`memo:line:${i}`} plain label={l || ' '} onPress={() => void editMemoLine($, i)} />
              {refs(l).length > 0 && (
                <Box flexDirection="row">
                  <Text dimColor>{'  ↳ '}</Text>
                  {refs(l).map(n => (
                    <Box flexDirection="row">
                      <Button key={`memo:cmd:${i}:${n}`} variant="secondary" label={`/${n}`} onPress={() => void mentionCmd($, n)} />
                      <Text> </Text>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )))}
        <Input key="memo:new" value={field('memo:new', '')} placeholder={t.memoPlaceholder} submitLabel={t.memoAdd} autoFocus={editing >= 0 ? undefined : true}
          onInput={v => void setMemoDraft($, 'memo:new', v)} onSubmit={v => void addMemoLine($, v)} />
        {suggest('memo:new')}
      </Box>
    )
  })
  on('ui.render', { component: 'Pane', requestId: SETTINGS_PANE }, async ($, e) => {
    const { Box, Button, Input, Text } = $.ui.resolve(e)
    const t = STRINGS[await langOf($, cfgLang)]
    const [rows, draft] = await Promise.all([$.config.list().catch(() => []), read($, setDraftA)])
    const mine = rows.filter(r => /^status-band(?:@[^.]*)?\./.test(r.key))
    if (!mine.length) return <Text dimColor>{t.settingsNone}</Text>
    const w = Math.max(20, e.props.bodyColumns - 2)
    const control = (r: (typeof mine)[number]) => {
      if (r.isLocked) return <Text dimColor>🔒 {String(r.value)}</Text>
      if (r.kind === 'boolean') return <Button key={`set:${r.key}`} plain label={r.value ? t.cfgOn : t.cfgOff} onPress={() => void setOption($, r.key, !r.value)} />
      const opts = r.options ?? []
      if (r.kind === 'choice' && opts.length) {
        const i = Math.max(0, opts.indexOf(String(r.value))), n = opts.length
        return (
          <Box flexDirection="row">
            <Button key={`set:${r.key}:prev`} plain label="◂" onPress={() => void setOption($, r.key, opts[(i - 1 + n) % n]!)} />
            <Text bold>{` ${t.opt[String(r.value)] ?? String(r.value)} `}</Text>
            <Button key={`set:${r.key}:next`} plain label="▸" onPress={() => void setOption($, r.key, opts[(i + 1) % n]!)} />
            <Text dimColor wrap="truncate">{`  (${i + 1}/${n})`}</Text>
          </Box>
        )
      }
      const value = draft.key === r.key ? draft.text : String(r.value ?? '')
      const swatch = value.split(',').map(s => s.trim()).filter(isColor)
      const field = r.key.slice(r.key.indexOf('.') + 1)
      const presets: [string, string][] = field === 'pillColors'
        ? [[t.presets.pastel, '#D0607A,#E8C07D,#A3BE8C,#5B80A8'], [t.presets.deep, '#A8405C,#8F6420,#4F7A35,#3A5A80']]
        : field === 'pillText' || field === 'textColor'
          ? [[t.presets.reset, ''], [`${t.presets.white} #FFFFFF`, '#FFFFFF'], [`${t.presets.black} #000000`, '#000000']]
          : []
      return (
        <Box flexDirection="column">
          <Input key={`set:${r.key}`} value={value} submitLabel={t.memoSave}
            onInput={v => void update($, setDraftA, () => ({ key: r.key, text: v }))}
            onSubmit={v => {
              if (r.kind !== 'number') return void setOption($, r.key, v.trim())
              const x = Number(v)
              if (v.trim() && Number.isFinite(x)) void setOption($, r.key, x)
              else $.ui.toast(`band: ${t.settingsBad}`)
            }} />
          {swatch.length > 0 && <Text>{'  '}{swatch.map(c => <Text color={c}>{'██ '}</Text>)}</Text>}
          {presets.length > 0 && (
            <Box flexDirection="row">
              <Text dimColor>{'  '}</Text>
              {presets.map(([label, v], i) => (
                <Box flexDirection="row">
                  <Button key={`set:${r.key}:preset:${i}`} variant="secondary" label={label} onPress={() => void setOption($, r.key, v)} />
                  <Text> </Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Text dimColor wrap="wrap">{t.settingsHelp}</Text>
        {mine.map(r => {
          const [label, desc] = t.cfg[r.key.slice(r.key.indexOf('.') + 1)] ?? [r.label, r.description ?? '']
          return (
          <Box flexDirection="column">
            <Text> </Text>
            <Text color={YELLOW} bold wrap="truncate">{label}</Text>
            {desc && <Text dimColor wrap="wrap">{desc}</Text>}
            {control(r)}
          </Box>
          )
        })}
      </Box>
    )
  })
  on('ui.render', { component: 'Pane', requestId: AGENT_PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const a = await read($, agentViewA)
    const lg = await langOf($, cfgLang), t = STRINGS[lg]
    if (!a) return <Text dimColor>{t.paneEmpty}</Text>
    const [msgs, act, now] = await Promise.all([$.session.messages({ agentId: a.id }), read($, actA), $.clock.now()])
    const running = act.agents.some(x => x.id === a.id)
    const w = Math.max(20, e.props.bodyColumns - 4)
    const head = (
      <Text wrap="truncate"><Text color={GREEN} bold>🤖 {a.type}</Text>  <Text color={running ? YELLOW : BLUE}>{running ? `${t.running} ${elapsed(now - a.at)}` : t.done}</Text>  <Text dimColor>{a.desc}</Text></Text>
    )
    if ('deny' in msgs) return <Box flexDirection="column">{head}<Text color={RED}>{msgs.deny}</Text></Box>
    return (
      <Box flexDirection="column">
        {head}
        {msgs.slice(-80).flatMap((m, i) => [
          ...(m.text ? [<Text key={`m${i}`} wrap="wrap" color={m.role === 'user' ? YELLOW : undefined} dimColor={m.role === 'user' && i > 0}>{m.role === 'user' ? '▶ ' : '💬 '}{m.role === 'user' ? oneLine(m.text, w * 3) : m.text}</Text>] : []),
          ...m.toolUses.map(u => (
            <Text key={`u${u.tool_use_id}`} wrap="truncate">
              <Text color={u.isError ? RED : BLUE}>🔧 {u.tool}</Text> <Text dimColor>{oneLine(toolArg(u.input), w)}</Text>
              {u.text !== undefined && <Text color={u.isError ? RED : undefined} dimColor={!u.isError}>{'  → '}{oneLine(u.text, w)}</Text>}
            </Text>
          )),
        ])}
        {msgs.length === 0 && <Text dimColor>{t.polling}</Text>}
      </Box>
    )
  })

  // ---- band: the ccstatusline rows ------------------------------------------
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, hiddenA))) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const g = await gather($, promptLines)
    const raw = await read($, promptViewA)
    const lg = await langOf($, cfgLang), t = STRINGS[lg]
    const dur = (ms: number) => duration(ms, lg)
    const { now, usage, turn, context, cacheLeft } = g
    const model = shortModel(turn?.model ?? (await $.session.model()))

    const hit = turn ? turn.cacheRead / Math.max(1, turn.input + turn.cacheRead + turn.cacheCreate) * 100 : undefined
    const resetIn = usage?.sessionResetAt ? Date.parse(usage.sessionResetAt) - now : undefined
    const wResetIn = usage?.weeklyResetAt ? Date.parse(usage.weeklyResetAt) - now : undefined
    const sessionElapsed = windowElapsed(usage?.sessionResetAt, FIVE_H, now)
    const weeklyElapsed = windowElapsed(usage?.weeklyResetAt, SEVEN_D, now)

    const W = e.props.bodyColumns
    if (W < 50) return next(e)                  // too narrow: draw nothing
    const inner = Math.max(40, W - 4)

    // ccstatusline powerline: one start cap, arrow separators carrying bg→bg, one end cap.
    // Every pill writes in one color, so the bars (drawn in the text color) read the same on both sides:
    // white on a dark theme, black on a light one.
    type SegSpec = { bg: string; fg?: string; bold?: boolean; text: RenderChildren }
    const ink = pillText ?? (g.theme === 'light' ? DARK : LIGHT)
    // contrast: each pill its own black or white, whichever reads better on its color
    const inkFor = (bg: string) => (pillText || themeSetting !== 'contrast' ? ink : inkOn(bg, DARK, LIGHT))
    const Pills = ({ segs }: { segs: SegSpec[] }) => (
      <Box flexDirection="row">
        <Text color={segs[0]!.bg}>{CAP_L}</Text>
        {segs.map((sg, i) => {
          const nx = segs[i + 1]
          return (
            <Box flexDirection="row">
              {pad > 0 && <Text backgroundColor={sg.bg}> </Text>}
              <Text backgroundColor={sg.bg} color={sg.fg ?? inkFor(sg.bg)} bold={sg.bold} wrap="truncate">{sg.text}</Text>
              {pad > 0 && <Text backgroundColor={sg.bg}> </Text>}
              {nx ? <Text color={sg.bg} backgroundColor={nx.bg}>{ARROW}</Text> : <Text color={sg.bg}>{CAP_R}</Text>}
            </Box>
          )
        })}
      </Box>
    )
    const Row = ({ children }: { children: RenderChildren }) => (
      <Box flexDirection={narrow ? 'column' : 'row'} justifyContent="space-between" width={inner}>{children}</Box>
    )
    // one color rule for every pill chain: left to right pink → yellow → green → blue, as the model row
    const chain = (parts: (string | { text: string; bold?: boolean })[]): SegSpec[] =>
      parts.map((p, i) => ({ bg: SEQ[i % SEQ.length]!, ...(typeof p === 'string' ? { text: p } : p) }))
    const center = (text: string, w: number) => {
      const gap = Math.max(0, w - cells(text)), l = Math.floor(gap / 2)
      return ' '.repeat(l) + text + ' '.repeat(gap - l)
    }
    const usageRow = (label: string, v: number | undefined, bw: number, bold?: boolean): SegSpec[] =>
      chain([{ text: padCells(label, labelW), bold }, bar(v ?? 0, bw), pct(v)])
    const labelW = Math.max(...[t.session, t.weekly, t.weeklyFable].map(cells))
    const [face, line] = mascot(g, t)
    const at = (ms: number) => localTime(ms, g.tz ?? undefined)
    const resetLabelW = Math.max(cells(t.resetTimer), cells(t.weeklyResetTimer))
    const durs = [resetIn, wResetIn].map(v => (v === undefined ? 'n/a' : dur(v)))
    const durW = Math.max(...durs.map(cells))
    const hours = (now - g.startedAt) / 3600e3
    const costSeg: SegSpec[] = !showCost || !g.cost ? [] : chain([
      `${t.cost}: $${g.cost.usd.toFixed(2)}`, ...(hours >= 1 / 6 ? [`$${(g.cost.usd / hours).toFixed(2)}/h`] : []),
    ])
    const speed = showCost && g.speed > 0 ? ` · ${Math.round(g.speed)} tok/s` : ''
    const git = showGit ? g.git : null
    const gitBg = git && git.staged + git.unstaged + git.untracked + git.conflicts > 0 ? YELLOW : GREEN
    const R1: SegSpec[] = git ? [{ bg: gitBg, text: gitLabel(git) }] : []
    // the top row's right side: cost, then git, each its own pill group
    const L1 = chain([
      { text: `${t.model}: ${model}`, bold: true }, `${t.thinking}: ${g.effort}`,
      `${t.in} ${kTok(turn?.input ?? 0)}`, `${t.out} ${kTok(turn?.output ?? 0)}${speed}`,
    ])
    // the bar rows at a bar width; the right rows: four pills each, every column as wide as its widest,
    // so the colors stack in columns
    const rowsAt = (bw: number) => {
    const rightRaw = [
      [padCells(t.resetTimer, resetLabelW), padCellsStart(durs[0]!, durW), bar(sessionElapsed ?? 0, bw), pct(sessionElapsed)],
      [padCells(t.weeklyResetTimer, resetLabelW), padCellsStart(durs[1]!, durW), bar(weeklyElapsed ?? 0, bw), pct(weeklyElapsed)],
      [
        `${t.ctx} ${context.percent ?? 0}% ${health(context.percent, 50, 80)}`,
        `${t.timer} ${cacheLeft === undefined ? 'n/a' : `${Math.round(cacheLeft)}s`} ${health(cacheLeft, 120, 30, true)}`,
        `${t.hit} ${hit === undefined ? 'n/a' : `${hit.toFixed(0)}%`} ${health(hit, 80, 50, true)}`,
        `${t.compactions}: ${g.compactions}`,
      ],
    ]
    const colW = [0, 1, 2, 3].map(i => Math.max(...rightRaw.map(r => cells(r[i]!))))
    const [R2, R3, R4] = rightRaw.map(r => chain(r.map((x, i) => center(x, colW[i]!))))
    return {
      R2: R2!, R3: R3!, R4: R4!,
      L2: usageRow(t.session, usage?.session, bw, true),
      L3: usageRow(t.weekly, usage?.weekly, bw),
      L4: usageRow(t.weeklyFable, usage?.fable, bw),
    }
    }
    const wide = (segs: SegSpec[], p: number) => segs.reduce((n, sg) => n + cells(String(sg.text)) + 2 * p, 0) + segs.length + 1   // padding, caps + arrows
    const topRightW = (p: number) => (costSeg.length ? wide(costSeg, p) : 0) + (R1.length ? wide(R1, p) : 0) + (costSeg.length && R1.length ? 1 : 0)
    // the roomiest layout whose rows all fit left and right on one line: spaced pills and long bars, then
    // shorter bars, then no spacing; only when none fits, left and right stack
    const fits = (bw: number, p: number) => {
      const r = rowsAt(bw)
      return [[r.L2, r.R2], [r.L3, r.R3], [r.L4, r.R4]].every(([l, rr]) => wide(l, p) + wide(rr, p) + 1 <= inner) && wide(L1, p) + topRightW(p) + 1 <= inner
    }
    const layout = [{ bw: 16, pad: 1 }, { bw: 10, pad: 1 }, { bw: 10, pad: 0 }].find(l => fits(l.bw, l.pad))
    const narrow = !layout
    const pad = layout?.pad ?? 1
    const { L2, L3, L4, R2, R3, R4 } = rowsAt(layout?.bw ?? 16)
    const L1n: SegSpec[] = [
      ...chain([{ text: model, bold: true }, String(g.effort), `${t.in} ${kTok(turn?.input ?? 0)}`, `${t.out} ${kTok(turn?.output ?? 0)}`]),
      ...(git ? [{ bg: gitBg, text: gitLabel(git, true) }] : []),
      ...(costSeg.length ? [{ bg: GREEN, text: `$${g.cost!.usd.toFixed(2)}` }] : []),
    ]
    const resetLine = (remain: string, spent: number | undefined) => (
      <Text dimColor wrap="truncate">{`   ↳ ${t.resetsIn} `}{remain}{'  '}{bar(spent ?? 0, 10)} {pct(spent)}</Text>
    )

    // activity: what the engine's own UI does not sum up
    const act = g.act, todo = todoProgress(act.todos)
    // one line per agent; 3 or more fold under a header line
    const agents = showActivity ? act.agents : []
    const agentLine = (a: (typeof agents)[number]) =>
      `🤖 ${a.type}  ${elapsed(now - a.at).padStart(6)}${a.bg ? ` (${t.bg})` : ''}  ${a.desc}`
    const foldable = agents.length >= 3
    const longest = agents.length ? elapsed(now - Math.min(...agents.map(a => a.at))) : ''
    const actParts = !showActivity ? [] : [
      ...act.tools.filter(x => now - x.at >= 10_000).map(x => `⏳ ${x.tool} ${elapsed(now - x.at)}`),
      ...(todo.total && todo.done < todo.total ? [`☑ ${todo.done}/${todo.total}`] : []),
      ...(act.calls ? [`✎ ${t.files} ${act.files.length} · ${t.tools} ${act.calls}${act.errors ? ` · ${t.errors} ${act.errors}` : ''}`] : []),
    ]

    // fit the band into the rows the engine allows (half the terminal at most)
    const res = resRows(g.gpu, { cpu: showCpu, ram: showRam }), resW = resWidths(res)
    const STATUS_ROWS = narrow ? 9 : 6                           // rows + round border (stacked: 7 lines)
    // label · [bar] · detail · value%: fixed columns, so brackets and % line up. The panel is sized by the
    // renderer from its own text (no width given), so it is never cut to '…'. gpuW is only our estimate for
    // the layout: █ ░ · are ambiguous-width and draw 2 cells in some (CJK) terminals, so count them 2.
    const BAR = 5                                                // 20% a cell
    // many rows (8 GPUs and more) fold into two columns side by side when the band is wide enough
    const entryW = resW.label + 1 + 2 * BAR + 2 + 1 + resW.detail + 1 + 4
    const gpuWOf = (c: number) => Math.max(c * entryW + (c - 1) * 2, cells(resTitle) + 2) + 4 + 2
    const cols = gpuColumns === '2' || (gpuColumns === 'auto' && res.length > 4 && W - gpuWOf(2) >= 40) ? 2 : 1
    const gpuW = gpuWOf(cols)
    const cards = Math.ceil((res.length || 1) / cols)
    const stackTop = narrow || (sources.length > 0 && W - gpuW < 40)
    const budget = e.props.maxRows - STATUS_ROWS
    // the pet sits under the resource panel (beside the prompts box only, never stacked) and gives way first
    const gpuH = sources.length ? 3 + cards : 0, PET_H = PET_ROWS + 4   // sprite + its line + border
    const buddy = buddyOf(await read($, buddyIdA)), bodyColor = RARITY_COLOR[buddy.rarity]
    const nameLine = `${buddy.shiny ? '✨ ' : ''}${nameOf(buddy)} ${STARS[buddy.rarity]}`
    const petW = Math.max(PET_W, cells(nameLine), ...Object.values(t.pet).map(cells)) + 4
    // the pet: under the resource panel, or beside it (the Pet place setting; auto tries under first)
    const resPanelW = sources.length ? gpuW : 0
    let petMode: 'off' | 'under' | 'beside' = 'off'
    // agent rows: every line, or the header alone (folded, or squeezed for room)
    let agentMode: 'lines' | 'header' | 'none' = !agents.length ? 'none' : foldable && !g.agentsOpen ? 'header' : 'lines'
    const agentRows = () => (agentMode === 'none' ? 0 : agentMode === 'header' ? 1 : agents.length + (foldable ? 1 : 0))
    let sumRows = actParts.length ? 1 : 0
    // goal and loop lines at the top of the prompts box; they stay while the prompts give way
    const goal = showGoalLoop && g.goal && !(g.goal.done && now - (g.goal.doneAt ?? 0) > 600e3) ? g.goal : null
    // a wakeup long past while idle fired without asking for the next one (turn.complete prunes it too)
    const loops = showGoalLoop ? g.loops.filter(l => !(l.kind === 'wake' && l.next !== undefined && l.next < now - 120e3 && !g.working)).slice(0, 3) : []
    const glRows = (goal ? 1 : 0) + loops.length
    let glH = glRows ? glRows + 2 : 0   // its own box above the prompts, only while it has a line
    let shown = g.prompts.length
    // the memo under the prompts: its first lines (2 at most), or the line that says to click
    const memoLines = g.memo.split('\n').filter(l => l.trim()).slice(0, 2)
    let memoH = 2 + Math.max(1, memoLines.length)
    const memoHead = `📝 ${t.memo}  `
    // the left column alone (goal box, prompts, activity, memo): what an expanded prompt may grow into is the
    // budget less this, not less the band's height, when the resource panel and the pet stand taller beside it
    const leftNeed = (n: number) => glH + 3 + n + agentRows() + sumRows + memoH
    const need = (n: number) => {
      const act = agentRows() + sumRows
      const right = petMode === 'under' ? gpuH + PET_H : petMode === 'beside' ? Math.max(gpuH, PET_H) : gpuH
      return stackTop ? glH + (3 + n + act) + memoH + (3 + cards) : Math.max(glH + 3 + n + act + memoH, right, 3 + cards)
    }
    const tries = !showPet || stackTop ? [] : petPlace === 'under' ? ['under' as const] : petPlace === 'beside' ? ['beside' as const] : ['under' as const, 'beside' as const]
    for (const m of tries) {
      if (W - (m === 'beside' ? resPanelW + petW : Math.max(resPanelW, petW)) < 40) continue
      petMode = m
      if (need(shown) <= budget) break
      petMode = 'off'
    }
    const petOn = petMode !== 'off'
    // the activity gives way first: agent lines fold to the header, then it all goes
    if (need(shown) > budget && agentMode === 'lines' && agents.length > 1) agentMode = 'header'
    if (need(shown) > budget) { agentMode = 'none'; sumRows = 0 }
    // then the memo shrinks to its first line; the prompts go before the memo does
    if (need(shown) > budget && memoLines.length > 1) { memoLines.length = 1; memoH = 3 }
    while (shown > 0 && need(shown) > budget) shown--
    if (need(shown) > budget) memoH = 0
    const showTop = need(shown) <= budget && (shown > 0 || budget >= 3 + cards)
    const showGpu = showTop && budget >= (stackTop ? need(shown) : 3 + cards)
    let prompts = g.prompts.slice(-shown)
    const opened = prompts.find(p => p.at === g.open)
    let EXPAND_ROWS = Math.max(3, budget - (stackTop ? need(shown) : leftNeed(shown)))
    // easy green, fair orange, busy red: the bar by its fill, the % by utilization
    const load = (v: number | undefined) => (v === undefined ? undefined : v >= 80 ? RED : v >= 50 ? ORANGE : GREEN)
    const heat = (v: number | undefined) => <Text color={load(v)} dimColor={v === undefined}>{pct4(v)}</Text>
    const mood = petMood({ working: g.working, ctx: context.percent ?? 0, sinceDone: turn ? now - turn.at : undefined,
      cacheCold: cacheLeft !== undefined && cacheLeft <= 0 })
    // one Text per run of a color, so the effects light up inside the buddy (drawn in its rarity color)
    const petLine = (l: string) => {
      const runs: { color: string; text: string }[] = []
      for (const ch of l) {
        const color = PET_FX[ch] ?? bodyColor, last = runs.at(-1)
        if (last?.color === color) last.text += ch
        else runs.push({ color, text: ch })
      }
      return <Text>{runs.map(r => <Text color={r.color} bold={r.color !== bodyColor}>{r.text}</Text>)}</Text>
    }
    const rightW = petMode === 'beside' ? resPanelW + petW : Math.max(resPanelW, petOn ? petW : 0)
    const expandW = Math.max(10, (stackTop ? W : W - rightW) - 8)
    const fitsInline = (p: Prompt) => rowsOf(`${at(p.at)}  ${p.text}`, expandW) <= EXPAND_ROWS - 2
    // too long for the rows left: the band's left side gives itself to that prompt (the goal box, the other prompts,
    // the activity and the memo step aside), so the band grows up to its cap and nothing moves sideways
    const focus = !!opened && !fitsInline(opened)
    if (focus && opened) {
      glH = 0; memoH = 0; agentMode = 'none'; sumRows = 0; shown = 1; prompts = [opened]
      EXPAND_ROWS = Math.max(3, budget - (stackTop ? need(1) : leftNeed(1)))
    }
    const openText = opened ? (focus && raw?.at === opened.at ? raw.text : opened.text) : ''
    const openNeed = opened ? rowsOf(`${at(opened.at)}  ${openText}`, expandW) : 0
    const openCut = openNeed > EXPAND_ROWS - 2
    const openH = Math.min(EXPAND_ROWS, openNeed + 2)   // the box fits the text, up to the rows left
    const resLines = Array.from({ length: Math.ceil(res.length / cols) }, (_, k) => res.slice(k * cols, k * cols + cols))
    return (
      <Box flexDirection="column" width={W}>
        {showTop && (
          <Box flexDirection={stackTop ? 'column' : 'row'} width={W}>
            <Box flexDirection="column" flexGrow={1}>
            {glH > 0 && (
              <Box flexDirection="column" borderStyle="round" borderColor={PINK} borderDimColor paddingX={1}>
                {goal && (
                  <Text wrap="truncate"><Text color={goal.done === 'met' ? GREEN : goal.done ? RED : PINK} bold>{goal.done === 'met' ? `✅ ${t.goalMet}` : goal.done ? `✖ ${t.goalFailed}` : `🎯 ${t.goal}`}</Text>{'  '}<Text color={textColor}>{oneLine(goal.text, Math.max(10, (stackTop ? W : W - rightW) - 24))}</Text>  <Text dimColor>{elapsed(now - goal.at)}</Text></Text>
                )}
                {loops.map(l => {
                  const what = /^<<autonomous-loop/.test(l.prompt) ? t.autoLoop : oneLine(l.prompt, Math.max(10, Math.floor(((stackTop ? W : W - rightW) - 30) / 2)))
                  const when = l.next !== undefined && l.next > now ? t.nextIn(elapsed(l.next - now)) : l.kind === 'wake' ? t.firing : ''
                  return (
                    <Text wrap="truncate"><Text color={BLUE} bold>🔁 {t.loop}</Text>{'  '}<Text color={textColor}>{what}</Text>{l.schedule ? <Text color={YELLOW}>{`  ${l.schedule}`}</Text> : null}{when ? <Text color={GREEN}>{`  ${when}`}</Text> : null}{l.reason ? <Text dimColor>{`  ${l.reason}`}</Text> : null}</Text>
                  )
                })}
              </Box>
            )}
            <Box flexDirection="column" borderStyle="round" borderColor={YELLOW} borderDimColor paddingX={1} flexGrow={1}>
              <Box flexDirection="row">
                <Box flexGrow={1} flexShrink={1}>
                  <Text wrap="truncate"><Text color={YELLOW} bold>{t.prompts}</Text>  {!petOn && <Text><Text color={PINK} bold>{face}</Text> <Text dimColor>{line}</Text></Text>}</Text>
                </Box>
                <Button key="settings" plain dimColor label={`⚙ ${t.settings}`} onPress={() => void openSettings($)} />
              </Box>
              {prompts.length === 0 && <Text dimColor>{t.noPrompts}</Text>}
              {prompts.map(p => (
                <Box flexDirection="row">
                  <Button key={`p${p.at}`} plain dimColor label={g.open === p.at ? '▾' : '▸'} onPress={() => void (g.open === p.at || fitsInline(p) ? toggleOpen($, p) : openCard($, p))} />
                  <Text wrap="truncate">{' '}<Text color={BLUE}>{at(p.at).slice(0, 5)}</Text> <Text color={YELLOW}>{at(p.at).slice(6)}</Text>{'  '}<Text color={textColor}>{oneLine(p.text, Math.max(10, (stackTop ? W : W - rightW) - 24))}</Text></Text>
                </Box>
              ))}
              {agentMode === 'header' || (agentMode === 'lines' && foldable) ? (
                <Box flexDirection="row">
                  {foldable && <Button key="agents" plain dimColor label={agentMode === 'lines' ? '▾' : '▸'} onPress={() => void toggleAgents($)} />}
                  <Text wrap="truncate" color={GREEN}>{foldable ? ' ' : ''}🤖 {t.agents(agents.length)}  {longest}</Text>
                </Box>
              ) : null}
              {agentMode === 'lines' && agents.map(a => (
                <Box flexDirection="row">
                  {foldable && <Text>  </Text>}
                  <Button key={`agent:${a.id}`} plain dimColor label="↗" onPress={() => void viewAgent($, a)} />
                  <Text> </Text>
                  <Text wrap="truncate" color={GREEN}>{agentLine(a)}</Text>
                </Box>
              ))}
              {sumRows > 0 && <Text wrap="truncate" color={GREEN}>{actParts.join('   ')}</Text>}
              {opened && (
                <Box flexDirection="column" height={openH} paddingX={1} borderStyle="round" borderDimColor>
                  <Box flexDirection="column" height={openH - 2 - (openCut ? 1 : 0)} overflow="hidden">
                    <Text wrap="wrap"><Text color={YELLOW}>{at(opened.at)}</Text>{'  '}<Text color={textColor}>{openText}</Text></Text>
                  </Box>
                  {openCut && <Text dimColor>{t.cardMore}</Text>}
                </Box>
              )}
            </Box>
            {memoH > 0 && (
              <Box flexDirection="column" borderStyle="round" borderColor={BLUE} borderDimColor paddingX={1}>
                {memoLines.length === 0
                  ? <Button key="memo" plain dimColor label={`📝 ${t.memoClick}`} onPress={() => void openMemo($)} />
                  : memoLines.map((l, i) => (
                    <Button key={i ? `memo${i}` : 'memo'} plain label={cutCells(`${i ? ' '.repeat(cells(memoHead)) : memoHead}${l}`, (stackTop ? W : W - rightW) - 6)} onPress={() => void openMemo($)} />
                  ))}
              </Box>
            )}
            </Box>
            {((showGpu && sources.length > 0) || petOn) && (
              <Box flexDirection={petMode === 'beside' ? 'row' : 'column'} width={stackTop ? W : undefined} flexShrink={0}>
                {showGpu && sources.length > 0 && (
                  <Box flexDirection="column" borderStyle="round" borderColor={GREEN} borderDimColor paddingX={1} width={stackTop ? W : undefined} flexShrink={0}>
                    <Text color={GREEN} bold>{resTitle}</Text>
                    {g.gpu.length === 0 && <Text dimColor>{t.polling}</Text>}
                    {resLines.map(line => (
                      <Box flexDirection="row">
                        {line.map((r, j) => (
                          <Box flexDirection="row">
                          {j > 0 && <Text>{'  '}</Text>}
                          <Text wrap="truncate">
                            <Text dimColor={r.value === undefined}>{r.label.padEnd(resW.label)}</Text>{' '}<Text color={load(r.value === undefined ? undefined : r.bar)}>{bar(r.bar, BAR)}</Text>{' '}
                            <Text dimColor>{r.detail.padStart(resW.detail)}</Text>{' '}{heat(r.value)}
                          </Text>
                          </Box>
                        ))}
                      </Box>
                    ))}
                  </Box>
                )}
                {petOn && (
                  <Box flexDirection="column" borderStyle="round" borderColor={bodyColor} borderDimColor paddingX={1} alignItems="center">
                    {petFrame(buddy.species, mood, Math.floor(now / PET_FRAME_MS), buddy.eye, buddy.hat).map(petLine)}
                    <Text color={bodyColor} bold wrap="truncate">{nameLine}</Text>
                    <Text dimColor wrap="truncate">{t.pet[mood]}</Text>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1} width={W}>
          <Row>
            <Pills segs={narrow ? L1n : L1} />
            {!narrow && (costSeg.length || R1.length ? (
              <Box flexDirection="row">
                {costSeg.length > 0 && <Pills segs={costSeg} />}
                {costSeg.length > 0 && R1.length > 0 && <Text> </Text>}
                {R1.length > 0 && <Pills segs={R1} />}
              </Box>
            ) : <Text> </Text>)}
          </Row>
          <Row>
            <Pills segs={L2} />
            {narrow ? resetLine(padCellsStart(durs[0]!, durW), sessionElapsed) : <Pills segs={R2} />}
          </Row>
          <Row>
            <Pills segs={L3} />
            {narrow ? resetLine(padCellsStart(durs[1]!, durW), weeklyElapsed) : <Pills segs={R3} />}
          </Row>
          <Row>
            <Pills segs={L4} />
            <Pills segs={R4} />
          </Row>
        </Box>
      </Box>
    )
  })
}
