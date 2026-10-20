import { expect, mock, test } from 'claude-code/testing'


import { cronLabel, goalFromTranscript, rowsOf, inkOn, oneLine, cmdQuery, completeCmd, suggestCmds, rollBuddy, buddyIdOf, wyhash, PET_ROWS, PET_SPECIES, PET_W, petFrame, petMood, themeOf, appleGpuParse, applyTodo, cells, duration, editedFile, elapsed, gitLabel, gitParse, gpuParse, padCells, todoProgress, localTime, tzOffset, parseUsage, pct, memInfoRam, procStatCpu, resRows, sections, shortModel, topCpuParse, vmStatRam } from './lib'

test('lib: formatting', async () => {
  expect(pct(9)).toBe('  9.0%')
  expect(pct(100)).toBe('100.0%')
  expect(shortModel('claude-opus-5-5')).toBe('Opus 5.5')
  expect(shortModel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(localTime(Date.UTC(2026, 9, 5, 5, 2), 540)).toBe('10-05 14:02')
  expect(localTime(Date.UTC(2026, 9, 5, 5, 2), -300)).toBe('10-05 00:02')
  expect([tzOffset('+0900\n'), tzOffset('-0530'), tzOffset('')]).toEqual([540, -330, undefined])
  expect(gpuParse('0, 95, 155252, 183359, 45\n1, 98, 167731, 183359, 47').map(c => [c.i, c.util, Math.round(c.used), Math.round(c.total)])).toEqual([['0', 95, 152, 179], ['1', 98, 164, 179]])
  const u = parseUsage({ five_hour: { utilization: 9, resets_at: '2026-10-02T11:20:00Z' }, seven_day: { utilization: 17 },
    limits: [{ kind: 'weekly', percent: 5, scope: { model: { display_name: 'Fable' } } }] }, 0)
  expect(u.session).toBe(9); expect(u.weekly).toBe(17); expect(u.fable).toBe(5)
})

test('band draws the usage rows on terminal and desktop', { options: { language: 'en' } }, async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 5, 5, 0) })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'status-band', surface, component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 24, bodyColumns: 140, scroll: { offset: 0, bodyRows: 24 }, view: {} } })
    expect(await ui.find({ type: 'Text', text: /Session:/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Weekly Fable:/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Reset Timer/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Opus 5\.5/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Thinking: default/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Prompts/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /GPU/ })).toBeDefined()
    await ui.unmount()
  }
})

test('Korean when set; /band lang switches the band', { options: { language: 'ko' } }, async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 5, 5, 0) })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  const props = { hasSurvey: false, isWorking: false, maxRows: 24, bodyColumns: 160, scroll: { offset: 0, bodyRows: 24 }, view: {} }
  const ko = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props })
  for (const re of [/세션:/, /주간 Fable:/, /모델: Opus 5\.5/, /사고: default/, /대화/, /아직 입력 없음/, /압축: 0/])
    expect(await ko.find({ type: 'Text', text: re })).toBeDefined()
  expect(await ko.find({ type: 'Text', text: /Session:/ })).toBeUndefined()
  await ko.unmount()
  expect((await $.command.run({ command: 'band', args: 'lang en' } as any)).text).toBe('band: language English')
  const en = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props })
  expect(await en.find({ type: 'Text', text: /Session:/ })).toBeDefined()
  expect(await en.find({ type: 'Text', text: /세션:/ })).toBeUndefined()
  expect((await $.command.run({ command: 'band', args: 'ko' } as any)).text).toBe('band: 언어 한국어')
  await en.unmount()
})

test('lib: language helpers', async () => {
  expect(duration(26 * 3600e3 + 5 * 60e3)).toBe('1d 2hr 5m')
  expect(duration(26 * 3600e3 + 5 * 60e3, 'ko')).toBe('1일 2시간 5분')
  expect(cells(padCells('세션:', 11))).toBe(11)
  expect(cells(padCells('주간 Fable:', 11))).toBe(11)
})

test('narrow terminal stacks, tiny terminal draws nothing', { options: { language: 'ko' } }, async ($, on) => {
  mock.clock(on, { now: Date.UTC(2026, 9, 5, 5, 0) })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('ui.render', ($, e) => { const { Text } = $.ui.resolve(e); return <Text>engine</Text> })
  const props = (bodyColumns: number) => ({ hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns, scroll: { offset: 0, bodyRows: 30 }, view: {} })
  const narrow = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: props(80) })
  expect(await narrow.find({ type: 'Text', text: /세션:/ })).toBeDefined()
  expect(await narrow.find({ type: 'Text', text: /리셋까지/ })).toBeDefined()
  await narrow.unmount()
  const tiny = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: props(40) })
  expect(await tiny.find({ type: 'Text', text: /세션:/ })).toBeUndefined()
  expect(await tiny.find({ type: 'Text', text: /engine/ })).toBeDefined()
  await tiny.unmount()
})

test('lib: mac GPU and CPU readers', async () => {
  const ioreg = `"model" = "Apple M4"\n"PerformanceStatistics" = {"Alloc system memory"=4676370432,"Device Utilization %"=37,"In use system memory"=745521152}`
  const [c] = appleGpuParse(ioreg, 16 * 2 ** 30)
  expect([c!.i, c!.util, +c!.used.toFixed(2), c!.total]).toEqual(['M4', 37, 0.69, 16])
  expect(appleGpuParse('', 1)).toEqual([])
  expect(topCpuParse('CPU usage: 1% user, 1% sys, 98.00% idle\nCPU usage: 62.99% user, 13.32% sys, 23.67% idle')!.toFixed(2)).toBe('76.33')
  expect(procStatCpu('cpu  100 0 100 800 0 0 0 0 0 0\ncpu  150 0 150 900 0 0 0 0 0 0')).toBe(50)
  expect(procStatCpu('cpu  1 2 3 4')).toBeUndefined()
})

const VM_STAT = 'Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages active:  312771.\nPages wired down:  184566.\nPages purgeable:  2837.\nAnonymous pages:  427331.\nPages occupied by compressor:  182329.\n'
const SSH_OUT = '@@hud-gpu@@\n0, 95, 155252, 183359, 45\n@@hud-cores@@\n64\n@@hud-cpu@@\ncpu  100 0 100 800 0\ncpu  150 0 150 900 0\n@@hud-ram@@\nMemTotal:  1056964608 kB\nMemAvailable:  792723456 kB\n'

test('lib: RAM readers and ssh sections', async () => {
  const mac = vmStatRam(VM_STAT, 16 * 2 ** 30)!
  expect([mac.used.toFixed(1), mac.total]).toEqual(['12.1', 16])
  const lin = memInfoRam('MemTotal:  16384000 kB\nMemAvailable:  4096000 kB')!
  expect([lin.used.toFixed(2), lin.total.toFixed(2)]).toEqual(['11.72', '15.63'])
  expect(memInfoRam('')).toBeUndefined()
  expect(sections(SSH_OUT).cores!.trim()).toBe('64')
  expect(Object.keys(sections(SSH_OUT))).toEqual(['gpu', 'cores', 'cpu', 'ram'])
})

test('lib: resource rows', async () => {
  const rows = resRows([{ host: 'local', gpu: true, cards: [], cpu: 40, cores: 10, ram: { used: 8, total: 16 } }], { cpu: true, ram: true })
  expect(rows.map(r => [r.label, r.detail, r.value])).toEqual([['GPU', '', undefined], ['CPU', '10c', 40], ['RAM', '8.0/16G', 50]])
})

// what the band polls, answered as a Mac and one Linux ssh host would
const fakeMachines = (on: any, seen: string[][]) =>
  on('process.run', (_$: unknown, e: { argv: readonly string[] }) => {
    seen.push([...e.argv])
    const a = e.argv.join(' ')
    const out = a === 'uname -s' ? 'Darwin\n' : a === 'sysctl -n hw.ncpu' ? '10\n' : a === 'sysctl -n hw.memsize' ? String(16 * 2 ** 30)
      : a.startsWith('ioreg') ? '"model" = "Apple M4"\n"Device Utilization %"=37,"In use system memory"=745521152'
      : a.startsWith('top') ? 'CPU usage: 1% user, 1% sys, 98% idle\nCPU usage: 20% user, 20% sys, 60.00% idle'
      : a === 'vm_stat' ? VM_STAT
      : a.startsWith('ssh') ? SSH_OUT : ''
    return { value: { exitCode: 0, stdout: out, stderr: '' } }
  })
// the first poll runs unawaited from session.start: let the event loop settle, then draw
const mountPolled = async ($: any, clock: { advance: (ms: number) => Promise<unknown> }) => {
  await clock.advance(0)
  return $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
}
const bandProps = { hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns: 160, scroll: { offset: 0, bodyRows: 30 }, view: {} }

test('local Mac GPU and CPU, plus an ssh host', { options: { gpuHosts: 'box1' } }, async ($, on) => {
  const seen: string[][] = []
  fakeMachines(on, seen)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 5, 5, 0) })
  await $.session.start({ cwd: '/tmp', source: 'startup' } as any)
  const ui = await mountPolled($, clock)
  expect(await ui.find({ type: 'Text', text: /GPU · CPU/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /M4 .*0\.7\/16G/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /CPU .*10c.*40%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /box1 .*CPU .*64c.*50%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /RAM .*12\/16G.*75%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /box1 RAM .*252\/1008G.*25%/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /GPU · CPU · RAM/ })).toBeDefined()
  // every resource row puts '[', ']' and '%' in the same column
  const lines = (await ui.findAll({ type: 'Text', text: /\[[█░]{5}\] .*%$/ })).map((t: { text: string }) => t.text)
  expect(lines.length).toBe(6)
  for (const ch of ['[', ']', '%']) expect(new Set(lines.map((l: string) => l.indexOf(ch))).size).toBe(1)
  expect(seen.some(a => a[0] === 'nvidia-smi')).toBe(false)
  await ui.unmount()
})

test('local only, no CPU: no ssh, no top', { options: { gpuHosts: 'box1', gpuSsh: false, showCpu: false } }, async ($, on) => {
  const seen: string[][] = []
  fakeMachines(on, seen)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 5, 5, 0) })
  await $.session.start({ cwd: '/tmp', source: 'startup' } as any)
  const ui = await mountPolled($, clock)
  expect(await ui.find({ type: 'Text', text: /M4 / })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /CPU/ })).toBeUndefined()
  expect(seen.some(a => a[0] === 'ssh' || a[0] === 'top')).toBe(false)
  expect(await ui.find({ type: 'Text', text: /RAM .*12\/16G/ })).toBeDefined()
  await ui.unmount()
})

test('everything off: no resource panel, nothing polled', { options: { gpuLocal: false, gpuSsh: false, showCpu: false, showRam: false, showGit: false, pet: 'off', showGoalLoop: false } }, async ($, on) => {
  const seen: string[][] = []
  fakeMachines(on, seen)
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 5, 5, 0) })
  await $.session.start({ cwd: '/tmp', source: 'startup' } as any)
  const ui = await mountPolled($, clock)
  expect(await ui.find({ type: 'Text', text: /GPU|CPU|RAM/ })).toBeUndefined()
  expect(seen).toEqual([['date', '+%z'], ['printenv', 'HOME']])   // only the local time zone and where the memo lives
  await ui.unmount()
})

// ---- git · cost · activity --------------------------------------------------

const PORCELAIN = '# branch.oid abcdef1234567\n# branch.head main\n# branch.upstream origin/main\n# branch.ab +2 -1\n1 M. N... 100644 100644 100644 a b f1\n1 .M N... 100644 100644 100644 a b f2\n1 MM N... 100644 100644 100644 a b f3\n? new.txt\n'

test('lib: git status', async () => {
  const g = gitParse(PORCELAIN)!
  expect([g.branch, g.ahead, g.behind, g.staged, g.unstaged, g.untracked]).toEqual(['main', 2, 1, 2, 2, 1])
  expect(gitLabel(g)).toBe('\uE0A0 main ⇡2 ⇣1 ●2 ✚2 …1')
  expect(gitLabel(g, true)).toBe('\uE0A0 main *')
  expect(gitParse('')).toBeUndefined()
  const d = gitParse('# branch.oid 1234567890\n# branch.head (detached)\n', true)!
  expect([d.detached, d.branch, gitLabel(d)]).toEqual([true, '1234567', '⎇ @1234567'])
})

test('lib: todos, files, elapsed', async () => {
  let t = applyTodo({}, 'TodoWrite', { todos: [{ status: 'completed' }, { status: 'in_progress' }] }, {})
  t = applyTodo(t, 'TaskCreate', {}, { task: { id: '7' } })
  expect(todoProgress(t)).toEqual({ done: 1, total: 3 })
  t = applyTodo(t, 'TaskUpdate', { taskId: '7', status: 'completed' }, {})
  expect(todoProgress(t)).toEqual({ done: 2, total: 3 })
  t = applyTodo(t, 'TaskUpdate', { taskId: '7', status: 'deleted' }, {})
  expect(todoProgress(t)).toEqual({ done: 1, total: 2 })
  expect(editedFile('Edit', { file_path: '/a' })).toBe('/a')
  expect(editedFile('Read', { file_path: '/a' })).toBeUndefined()
  expect([elapsed(42e3), elapsed(72e3), elapsed(3780e3)]).toEqual(['42s', '1m12s', '1h3m'])
})

const quiet = { gpuLocal: false, gpuSsh: false, showCpu: false, showRam: false, pet: 'off' }   // the pet ticks every 500 ms: off unless a test is about it
const wideProps = { hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns: 200, scroll: { offset: 0, bodyRows: 30 }, view: {} }
const startBand = async ($: any, on: any, cost?: number) => {
  on('process.run', (_$: unknown, e: { argv: readonly string[] }) => ({
    value: { exitCode: 0, stderr: '', stdout: e.argv[1] === 'status' ? PORCELAIN : e.argv[1] === 'rev-parse' ? '/r/.git\n/r/.git\n' : '' },
  }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [], ...(cost === undefined ? {} : { cost: { usd: cost } }) } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$: unknown, e: any) => ({ value: { command: e.name } }))
  const clock = mock.clock(on, { now: 2 * 3600e3 })
  await $.session.start({ cwd: '/r', source: 'startup' } as any)
  await clock.advance(0)
  return clock
}

test('band shows git, cost and activity', { options: { ...quiet, language: 'en' } }, async ($, on) => {
  on('agent.spawn', () => ({ model: 'claude-haiku-4-5', agentId: 'a1' }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'x', type: 'Explore', status: 'running' }] }))
  on('tool.call', { tool: 'TodoWrite' }, () => ({ result: {}, text: 'ok' }))
  on('tool.call', { tool: 'Edit' }, () => ({ result: {}, text: 'ok' }))
  await startBand($, on, 1.5)
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'x', subagentType: 'Explore', background: true } as any)
  await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'a', status: 'completed', activeForm: 'a' }, { content: 'b', status: 'pending', activeForm: 'b' }] } as any)
  await $.tool.call({ tool: 'Edit', file_path: '/r/f.ts', old_string: 'a', new_string: 'b' } as any)
  const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: wideProps })
  expect(await ui.find({ type: 'Text', text: /\uE0A0 main ⇡2 ⇣1 ●2 ✚2 …1/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Cost: \$1\.50$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\$0\.75\/h$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^🤖 Explore +0s \(bg\)  x$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /☑ 1\/2/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /✎ files 1 · tools 2/ })).toBeDefined()
  await ui.unmount()
})

test('git, cost and activity can be turned off', { options: { ...quiet, language: 'ko', showGit: false, showCost: false, showActivity: false } }, async ($, on) => {
  await startBand($, on, 1.5)
  const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: wideProps })
  expect(await ui.find({ type: 'Text', text: /세션:/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /main|\$1\.50|✎/ })).toBeUndefined()
  await ui.unmount()
})

test('Korean reset rows share column widths', { options: { ...quiet, language: 'ko', showGit: false } }, async ($, on) => {
  const day = 24 * 3600e3
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [
    { kind: 'five_hour', percentUsed: 10, resetsAt: new Date(day + 3 * 3600e3).toISOString() },
    { kind: 'seven_day', percentUsed: 20, resetsAt: new Date(day + 2 * day + 4 * 3600e3 + 5 * 60e3).toISOString() },
  ] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$: unknown, e: any) => ({ value: { command: e.name } }))
  const clock = mock.clock(on, { now: day })
  await $.session.start({ cwd: '/r', source: 'startup' } as any)
  await clock.advance(0)
  const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: wideProps })
  const w = async (re: RegExp) => cells((await ui.find({ type: 'Text', text: re }))!.text)
  expect(await w(/^ *리셋 타이머 *$/)).toBe(await w(/^ *주간 리셋 *$/))
  expect(await w(/^ *3시간 0분 *$/)).toBe(await w(/^ *2일 4시간 5분 *$/))
  expect(await w(/^ *리셋 타이머 *$/)).toBe(await w(/^ *컨텍스트 10%/))   // the bottom row's first pill shares the column
  await ui.unmount()
})

test('3 or more agents fold under a header that opens', { options: { ...quiet, language: 'en', showGit: false } }, async ($, on) => {
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-haiku-4-5', agentId: `a${++n}` }))
  on('agent.list', () => ({ value: [] }))
  await startBand($, on)
  const spawn = (type: string) => $.agent.spawn({ tool_use_id: type, prompt: 'p', description: `do ${type}`, subagentType: type, background: false } as any)
  await spawn('Explore'); await spawn('Plan')
  let ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: wideProps })
  expect(await ui.find({ type: 'Text', text: /^🤖 Explore .* do Explore$/ })).toBeDefined()   // two: a line each, no header
  expect(await ui.find({ type: 'Text', text: /^🤖 Plan .* do Plan$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /2 agents/ })).toBeUndefined()
  await ui.unmount()
  await spawn('general-purpose')
  ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: wideProps })
  expect(await ui.find({ type: 'Text', text: /🤖 3 agents/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /do Explore/ })).toBeUndefined()
  await ui.press({ key: 'agents' })
  expect(await ui.find({ type: 'Text', text: /do Explore/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /do general-purpose/ })).toBeDefined()
  await ui.press({ key: 'agents' })
  expect(await ui.find({ type: 'Text', text: /do Explore/ })).toBeUndefined()
  await ui.unmount()
})

test('resource rows are never cut: the panel fits its content or stacks', { options: { gpuHosts: 'gpu-server-long-01' } }, async ($, on) => {
  fakeMachines(on, [])
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 5, 5, 0) })
  await $.session.start({ cwd: '/tmp', source: 'startup' } as any)
  await clock.advance(0)
  for (const bodyColumns of [90, 120, 200]) {
    const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: { ...bandProps, maxRows: 40, bodyColumns } })
    const rows = (await ui.findAll({ type: 'Text', text: /^[\w-][\w -]*\[[█░]{5}\]/ })).map((t: { text: string }) => t.text)
    expect(rows.length).toBe(6)
    for (const r of rows) expect(r).toMatch(/%$/)
    expect(await ui.find({ type: 'Text', text: /gpu-server-long-01 RAM \[█░░░░\] 252\/1008G  25%/ })).toBeDefined()
    await ui.unmount()
  }
})

test('lib: theme', async () => {
  expect([themeOf('dark', 'light'), themeOf('light'), themeOf('auto', 'light-daltonized'), themeOf('auto', 'dark-ansi'), themeOf('auto')])
    .toEqual(['dark', 'light', 'light', 'dark', 'dark'])
})

for (const [setting, engine, color] of [['auto', 'light', '#1E1E2E'], ['auto', 'dark', '#F5F5F5'], ['light', 'dark', '#1E1E2E'], ['dark', 'light', '#F5F5F5']] as const) {
  test(`theme ${setting} with Claude Code ${engine}: pill text ${color}`, { options: { ...quiet, language: 'en', showGit: false, theme: setting } }, async ($, on) => {
    on('config.list', () => ({ value: [{ key: 'theme', label: 'Theme', kind: 'choice', value: engine, provider: { plugin: 'engine', tier: 'core' }, isLocked: false }] }))
    await startBand($, on)
    const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: wideProps })
    for (const re of [/^Session:/, /^Reset Timer/, /^Weekly Fable:/]) expect((await ui.find({ type: 'Text', text: re }))!.props.color).toBe(color)
    await ui.unmount()
  })
}

test('pills join with powerline arrows between rounded caps', { options: { ...quiet, language: 'en', showGit: false } }, async ($, on) => {
  await startBand($, on)
  const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: wideProps })
  for (const glyph of ['\uE0B6', '\uE0B0', '\uE0B4']) expect(await ui.find({ type: 'Text', text: new RegExp(`^${glyph}$`) })).toBeDefined()
  await ui.unmount()
})

test('mid widths shed spacing and bar length before stacking', { options: { ...quiet, language: 'en', showGit: false } }, async ($, on) => {
  await startBand($, on)
  const look = async (bodyColumns: number) => {
    const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: { ...wideProps, bodyColumns } })
    const stacked = !!(await ui.find({ type: 'Text', text: /resets in/ }))
    const bar = Math.max(...(await ui.findAll({ type: 'Text', text: /^\[[█░]+\]$/ })).map((t: { text: string }) => t.text.length - 2))
    const spaced = (await ui.findAll({ type: 'Text', text: /^ $/ })).some((t: { props: Record<string, unknown> }) => t.props.backgroundColor)
    await ui.unmount()
    return stacked ? 'stacked' : `${bar}${spaced ? ' spaced' : ''}`
  }
  // widest to narrowest: each step appears, in this order, before the rows stack
  const seen: string[] = []
  for (let w = 200; w >= 70; w -= 4) { const l = await look(w); if (seen.at(-1) !== l) seen.push(l) }
  expect(seen).toEqual(['16 spaced', '10 spaced', '10', 'stacked'])
})

test('lib: pet moods and frames', async () => {
  const base = { working: false, ctx: 10, cacheCold: false }
  expect(petMood(base)).toBe('idle')
  expect(petMood({ ...base, working: true, ctx: 90 })).toBe('working')
  expect(petMood({ ...base, ctx: 85, sinceDone: 1000 })).toBe('dizzy')
  expect(petMood({ ...base, sinceDone: 3000, cacheCold: true })).toBe('happy')
  expect(petMood({ ...base, sinceDone: 9000, cacheCold: true })).toBe('sleepy')
  expect(PET_SPECIES.length).toBe(18)
  for (const sp of PET_SPECIES)
    for (const m of ['idle', 'working', 'happy', 'sleepy', 'dizzy'] as const)
      for (const i of [-1, 0, 1, 2, 4, 8, 11, 15]) {
        const f = petFrame(sp, m, i, '·', i % 2 ? 'crown' : 'none')
        expect(f.length).toBe(PET_ROWS)
        // every line the same width: the buddy never jitters sideways; eyes all filled in
        for (const l of f) { expect(cells(l)).toBe(PET_W); expect(l).not.toContain('{E}') }
      }
  // Claude Code's idle loop: still, fidget, blink
  expect(petFrame('cat', 'idle', 8).join('')).toContain('-   -')
  expect(petFrame('cat', 'sleepy', 0)[0]).toMatch(/z/)
})

const petText = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((x: any) => x.text).filter((x: string) => /\/\\[_-]\/\\|\(  ω  \)|\("\)_\("\)/.test(x))

test('pet: under the resources, animated, gives way to the prompts', { options: { ...quiet, language: 'en', showGit: false, pet: 'cat' } }, async ($, on) => {
  const clock = await startBand($, on)
  const mount = (maxRows: number) => $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: { ...bandProps, maxRows } })
  const ui = await mount(30)
  expect(await ui.find({ type: 'Text', text: /^chilling$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\(•ᴗ•\)/ })).toBeUndefined()   // the one-line face gave way to the pet
  await ui.unmount()
  const faces = new Set<string>()
  for (let i = 0; i < 12; i++) {
    const u = await mount(30)
    faces.add((await petText(u)).join('|'))
    await u.unmount()
    await clock.advance(500)
  }
  expect(faces.size).toBeGreaterThan(1)
  // too few rows: no pet, the face is back in the prompts header
  const small = await mount(12)
  expect(await small.find({ type: 'Text', text: /^chilling$/ })).toBeUndefined()
  expect(await small.find({ type: 'Text', text: /\(•ᴗ•\)/ })).toBeDefined()
  await small.unmount()
})

test('pet: off by setting', { options: { ...quiet, language: 'en', showGit: false, pet: 'off' } }, async ($, on) => {
  await startBand($, on)
  const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  expect(await ui.find({ type: 'Text', text: /^chilling$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /\(•ᴗ•\)/ })).toBeDefined()
  await ui.unmount()
})

test("lib: the buddy roll is Claude Code's", async () => {
  // wyhash as Bun.hash: '' is Zig's own test vector (seed 0)
  expect(wyhash('')).toBe(0x409638ee2bde459n)
  expect(wyhash('a')).toBe(0x28d2053309d28531n)   // matches coding-buddy's port
  const b = rollBuddy('00000000-0000-0000-0000-000000000000')
  expect(rollBuddy('00000000-0000-0000-0000-000000000000')).toBe(b)
  expect(PET_SPECIES).toContain(b.species)
  if (b.rarity === 'common') expect(b.hat).toBe('none')
  expect(buddyIdOf('{"oauthAccount":{"accountUuid":"u1"},"userID":"x"}')).toBe('u1')
  expect(buddyIdOf('{"userID":"x"}')).toBe('x')
  expect(buddyIdOf('nope')).toBe('anon')
  // the spread over many ids looks like the 60/25/10/4/1 table
  const n: Record<string, number> = {}
  for (let i = 0; i < 2000; i++) { const r = rollBuddy(`id-${i}`).rarity; n[r] = (n[r] ?? 0) + 1 }
  expect(n.common! / 2000).toBeGreaterThan(0.5)
  expect(n.common! / 2000).toBeLessThan(0.7)
})

test('pet setting: a species, a name, a hat; /band buddy shows the card', { options: { ...quiet, language: 'en', showGit: false, pet: 'ghost', petName: 'Boo', petHat: 'wizard' } }, async ($, on) => {
  await startBand($, on)
  const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  expect(await ui.find({ type: 'Text', text: /^Boo ★/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\/\^\\/ })).toBeDefined()      // the wizard hat
  expect(await ui.find({ type: 'Text', text: /\.----\./ })).toBeDefined()     // the ghost
  await ui.unmount()
  const card = (await $.command.run({ command: 'band', args: 'buddy' } as any)).text as string
  expect(card).toMatch(/^Boo · \w+ ghost ★/)
  expect(card).toMatch(/DEBUGGING/)
})

test('↗ on an agent line opens its conversation in the side pane', { options: { ...quiet, language: 'en', showGit: false } }, async ($, on) => {
  on('agent.spawn', () => ({ model: 'claude-haiku-4-5', agentId: 'a1' }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'find x', type: 'Explore', status: 'running' }] }))
  const opened: string[] = []
  on('ui.open', (_$: unknown, e: any) => { opened.push(e.id); return { value: { isPlaced: true } } })
  on('ui.scroll', () => ({ value: {} }))
  on('session.messages', (_$: unknown, e: any) => ({ value: e.agentId === 'a1' ? [
    { role: 'user', text: 'find where x is defined', toolUses: [] },
    { role: 'assistant', text: 'Searching.', toolUses: [{ tool_use_id: 'u1', tool: 'Grep', input: { pattern: 'const x' }, text: 'src/a.ts:3' }] },
  ] : [] }))
  await startBand($, on)
  await $.agent.spawn({ tool_use_id: 't1', prompt: 'p', description: 'find x', subagentType: 'Explore', background: false } as any)
  const band = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  await band.press({ key: 'agent:a1' })
  expect(opened).toEqual(['agent'])
  await band.unmount()
  const pane = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'Pane', requestId: 'agent',
    props: { title: '🤖 Explore', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } } as any)
  expect(await pane.find({ type: 'Text', text: /🤖 Explore.*running.*find x/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^▶ find where x is defined$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^💬 Searching\.$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /🔧 Grep const x  → src\/a\.ts:3/ })).toBeDefined()
  await pane.unmount()
})

test('agents the spawn hook never saw still show, from the engine list', { options: { ...quiet, language: 'en', showGit: false } }, async ($, on) => {
  let list = [{ id: 'b1', description: 'web ui', type: 'general-purpose', status: 'running' }]
  on('agent.list', () => ({ value: list }))
  const clock = await startBand($, on)
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  expect(await ui.find({ type: 'Text', text: /^🤖 general-purpose .* web ui$/ })).toBeDefined()
  await ui.unmount()
  list = [{ ...list[0]!, status: 'completed' }]
  await clock.advance(2000)
  const after = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  expect(await after.find({ type: 'Text', text: /web ui/ })).toBeUndefined()
  await after.unmount()
})

test('memo: first lines under the prompts; a click opens it to edit line by line, saved per session to ~/.claude/band-memo/<id>.md', { options: { ...quiet, language: 'en', showGit: false } }, async ($, on) => {
  let disk = ''
  const FILE = '/home/me/.claude/band-memo/s1.md'
  on('session.id', () => ({ value: 's1' }))
  on('process.run', (_$: unknown, e: { argv: readonly string[] }) => ({ value: { exitCode: 0, stderr: '', stdout: e.argv[0] === 'printenv' ? '/home/me\n' : '' } }))
  on('fs.read', (_$: unknown, e: any) => (e.path === FILE && disk ? { value: disk } : { deny: 'missing' }))
  on('fs.write', (_$: unknown, e: any) => { if (e.path === FILE) disk = e.text; return { value: undefined } })
  on('command.list', () => ({ value: [{ name: 'caveman:caveman', description: 'Terse caveman voice', source: 'plugin', plugin: 'caveman' }] }))
  const filled: string[] = []
  on('prompt.fill', (_$: unknown, e: any) => { filled.push(`${e.mode}:${e.text}`); return { isFilled: true } })
  const opened: string[] = []
  on('ui.open', (_$: unknown, e: any) => { opened.push(e.id); return { value: { isPlaced: true } } })
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$: unknown, e: any) => ({ value: { command: e.name } }))
  const clock = mock.clock(on, { now: 1000 })
  await $.session.start({ cwd: '/r', source: 'startup' } as any)
  await clock.advance(0)
  const band = () => $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  let b = await band()
  expect((await b.find({ type: 'Button', key: 'memo' }))?.props.label).toBe('📝 memo: click to write')
  await b.press({ key: 'memo' })
  expect(opened).toEqual(['memo'])
  await b.unmount()
  const PANE = { plugin: 'status-band', surface: 'terminal', component: 'Pane', requestId: 'memo',
    props: { title: '📝 memo', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 20 }, view: {} } } as any
  let pane = await $.ui.mount(PANE)
  for (const l of ['buy milk', 'call bob', 'ship v1']) await pane.input({ key: 'memo:new', text: l })
  await pane.unmount()
  expect(disk).toBe('buy milk\ncall bob\nship v1\n')
  // the band shows the first two lines only
  b = await band()
  expect((await b.find({ type: 'Button', key: 'memo' }))?.props.label).toBe('📝 Memo  buy milk')
  expect((await b.find({ type: 'Button', key: 'memo1' }))?.props.label).toBe('         call bob')
  expect(await b.find({ type: 'Button', key: 'memo2' })).toBeUndefined()
  await b.unmount()
  // edit a line, empty a line to remove it
  pane = await $.ui.mount(PANE)
  await pane.press({ key: 'memo:line:1' })
  await pane.unmount()
  pane = await $.ui.mount(PANE)
  await pane.input({ key: 'memo:edit:1', text: 'call bob at 5' })
  await pane.press({ key: 'memo:line:0' })
  await pane.unmount()
  pane = await $.ui.mount(PANE)
  await pane.input({ key: 'memo:edit:0', text: '' })
  await pane.unmount()
  expect(disk).toBe('call bob at 5\nship v1\n')
  expect((await $.command.run({ command: 'memo', args: 'from the prompt' } as any)).text).toBe('📝 from the prompt')
  // a /command in a line: a button under it that mentions it in the prompt box
  await $.command.run({ command: 'memo', args: 'try /caveman and /nope' } as any)
  pane = await $.ui.mount(PANE)
  expect(await pane.find({ type: 'Button', key: 'memo:cmd:3:nope' })).toBeUndefined()
  await pane.press({ key: 'memo:cmd:3:caveman:caveman' })
  await pane.unmount()
  expect(filled).toEqual(['insert:/caveman:caveman '])
  // typing `/cave` in the new-line field suggests it; a click completes the field
  pane = await $.ui.mount(PANE)
  await pane.input({ key: 'memo:new', text: 'see /cave', kind: 'change' } as any)
  await pane.unmount()
  pane = await $.ui.mount(PANE)
  await pane.press({ key: 'memo:pick:caveman:caveman' })
  await pane.unmount()
  pane = await $.ui.mount(PANE)
  expect((await pane.find({ key: 'memo:new' }))?.props.value).toBe('see /caveman:caveman ')
  await pane.unmount()
  expect(disk).toBe('call bob at 5\nship v1\nfrom the prompt\ntry /caveman and /nope\n')
})

test('lib: /command suggestions', async () => {
  expect(cmdQuery('see /cave')).toBe('cave')
  expect(cmdQuery('see /')).toBe('')
  expect(cmdQuery('a/b')).toBeUndefined()
  expect(cmdQuery('/x done')).toBeUndefined()
  expect(completeCmd('see /cave', 'caveman:caveman')).toBe('see /caveman:caveman ')
  const cmds = [{ name: 'compact' }, { name: 'caveman:caveman' }, { name: 'caveman:caveman-help' }, { name: 'ponytail:ponytail' }, { name: 'clear' }]
  expect(suggestCmds(cmds, 'cave').map(c => c.name)).toEqual(['caveman:caveman', 'caveman:caveman-help'])
  expect(suggestCmds(cmds, 'pony').map(c => c.name)).toEqual(['ponytail:ponytail'])
  expect(suggestCmds(cmds, 'c').map(c => c.name)[0]).toBe('clear')
})


test('pet: beside the resources when there is no room under them; place under: no pet then', { options: { language: 'en', showGit: false, pet: 'cat', gpuHosts: 'box1' } }, async ($, on) => {
  fakeMachines(on, [])
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$: unknown, e: any) => ({ value: { command: e.name } }))
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 5, 5, 0) })
  await $.session.start({ cwd: '/tmp', source: 'startup' } as any)
  await clock.advance(0)
  // 6 resource rows fold into 2 columns (3 rows); under them the pet needs 15 rows, beside it 9
  const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: { ...bandProps, maxRows: 18 } })
  expect(await ui.find({ type: 'Text', text: /^chilling$/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Text', text: /^[\w-][\w -]*\[[█░]{5}\].*%$/ })).length).toBe(6)
  await ui.unmount()
})

test('pet place under: no room under the resources, no pet', { options: { language: 'en', showGit: false, pet: 'cat', gpuHosts: 'box1', petPlace: 'under' } }, async ($, on) => {
  fakeMachines(on, [])
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$: unknown, e: any) => ({ value: { command: e.name } }))
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 5, 5, 0) })
  await $.session.start({ cwd: '/tmp', source: 'startup' } as any)
  await clock.advance(0)
  const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: { ...bandProps, maxRows: 18 } })
  expect(await ui.find({ type: 'Text', text: /^chilling$/ })).toBeUndefined()
  await ui.unmount()
})

test('settings: ⚙ opens the pane; its rows change the band settings; palette recolors the pills', { options: { ...quiet, language: 'en', showGit: false, pillColors: '#111111,#222222,#333333,#444444', pillText: '#ABCDEF' } }, async ($, on) => {
  const opened: string[] = []
  on('ui.open', (_$: unknown, e: any) => { opened.push(e.id); return { value: { isPlaced: true } } })
  const set: [string, unknown][] = []
  on('config.set', (_$: unknown, e: any) => { set.push([e.key, e.value]); return { value: e.value } })
  const prov = { plugin: 'status-band', tier: 'user' }
  on('config.list', () => ({ value: [
    { key: 'theme', label: 'Theme', kind: 'choice', value: 'dark', options: ['dark', 'light'], provider: { plugin: 'engine', tier: 'core' }, isLocked: false },
    { key: 'status-band.pet', label: 'Pet', kind: 'choice', value: 'cat', options: ['buddy', 'cat', 'off'], provider: prov, isLocked: false },
    { key: 'status-band.showGit', label: 'Show git', kind: 'boolean', value: true, provider: prov, isLocked: false },
    { key: 'status-band.promptLines', label: 'Prompt lines', kind: 'number', value: 3, provider: prov, isLocked: false },
    { key: 'status-band.textColor', label: 'Text color', kind: 'text', value: '', provider: prov, isLocked: false },
  ] }))
  await startBand($, on)
  const band = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  const pill = (await band.findAll({ type: 'Text' })).find((x: any) => /^Model: /.test(x.text))
  expect(pill?.props.backgroundColor).toBe('#111111')
  expect(pill?.props.color).toBe('#ABCDEF')
  await band.press({ key: 'settings' })
  expect(opened).toEqual(['settings'])
  await band.unmount()
  const pane = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'Pane', requestId: 'settings',
    props: { title: '⚙ band', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 40 }, view: {} } } as any)
  expect(await pane.find({ type: 'Text', text: /^Theme$/ })).toBeUndefined()   // the engine's own rows stay in /config
  await pane.press({ key: 'set:status-band.pet:next' })
  await pane.press({ key: 'set:status-band.pet:prev' })
  await pane.press({ key: 'set:status-band.showGit' })
  await pane.input({ key: 'set:status-band.promptLines', text: '5' })
  await pane.input({ key: 'set:status-band.textColor', text: '#FF0000' })
  expect(set).toEqual([['status-band.pet', 'off'], ['status-band.pet', 'buddy'], ['status-band.showGit', false], ['status-band.promptLines', 5], ['status-band.textColor', '#FF0000']])
  await pane.unmount()
})

test('lib: pill ink by contrast', async () => {
  const [D, L] = ['#1E1E2E', '#F5F5F5']
  expect(['#D0607A', '#E8C07D', '#A3BE8C', '#5B80A8'].map(c => inkOn(c, D, L))).toEqual([D, D, D, D])   // the pastel default: black reads better on all four
  expect(['#A8405C', '#8F6420', '#4F7A35', '#3A5A80'].map(c => inkOn(c, D, L))).toEqual([L, L, L, L])   // the deep preset: white everywhere
  expect(inkOn('red', D, L)).toBe(L)
})

test('settings pane speaks the band language; presets set colors', { options: { ...quiet, language: 'ko', showGit: false } }, async ($, on) => {
  const set: [string, unknown][] = []
  on('config.set', (_$: unknown, e: any) => { set.push([e.key, e.value]); return { value: e.value } })
  const prov = { plugin: 'status-band', tier: 'user' }
  on('config.list', () => ({ value: [
    { key: 'status-band@inline.petPlace', label: 'Pet place', kind: 'choice', value: 'auto', options: ['auto', 'under', 'beside'], provider: prov, isLocked: false },
    { key: 'status-band@inline.textColor', label: 'Text color', kind: 'text', value: '', provider: prov, isLocked: false },
  ] }))
  await startBand($, on)
  const pane = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'Pane', requestId: 'settings',
    props: { title: '⚙ band', isFocused: true, bodyColumns: 60, placement: 'inline', scroll: { offset: 0, bodyRows: 40 }, view: {} } } as any)
  expect(await pane.find({ type: 'Text', text: /^펫 위치$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /자동/ })).toBeDefined()
  await pane.press({ key: 'set:status-band@inline.textColor:preset:1' })
  await pane.press({ key: 'set:status-band@inline.textColor:preset:2' })
  expect(set).toEqual([['status-band@inline.textColor', '#FFFFFF'], ['status-band@inline.textColor', '#000000']])
  await pane.unmount()
})

test('goal and loop lines: the goal from the transcript, met shows a while, ScheduleWakeup and CronCreate show, a fired wakeup ends', { options: { ...quiet, language: 'en', showGit: false } }, async ($, on) => {
  // the transcript tail the goal is read from
  let jsonl = '{"type":"user","message":{"role":"user","content":"<local-command-stdout>Goal set: all \\"tests\\" pass</local-command-stdout>"}}\n'
    + '{"type":"tool_result","content":"echo \\"content\\":\\"Goal achieved\\""}\n'   // quoted inside a result: not the engine's notice
  on('process.run', (_$: unknown, e: { argv: readonly string[] }) => (e.argv[0] === 'grep' && e.argv[4]?.includes('goal_status')
    ? { value: { exitCode: 0, stderr: '', stdout: jsonl, isStdoutTruncated: false, isStderrTruncated: false } }
    : { value: { exitCode: 0, stderr: '', stdout: e.argv[0] === 'printenv' ? '/h\n' : '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$: unknown, e: any) => ({ value: { command: e.name } }))
  on('session.id', () => ({ value: 's1' }))
  on('tool.call', { tool: 'ScheduleWakeup' }, (_$: unknown, e: any) => ({ result: e.stop ? { scheduledFor: 0, clampedDelaySeconds: 0, wasClamped: false, stopped: true } : { scheduledFor: 2 * 3600e3 + 600e3, clampedDelaySeconds: 600, wasClamped: false }, text: 'ok' }))
  on('tool.call', { tool: 'CronCreate' }, () => ({ result: { id: 'c1', humanSchedule: 'every 5 minutes', recurring: true }, text: 'ok' }))
  on('tool.call', { tool: 'CronDelete' }, () => ({ result: { id: 'c1' }, text: 'ok' }))
  const clock = mock.clock(on, { now: 2 * 3600e3 })
  await $.session.start({ cwd: '/r', source: 'startup' } as any)
  await clock.advance(10_000)
  const band = () => $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  await $.tool.call({ tool: 'ScheduleWakeup', delaySeconds: 600, reason: 'watching CI', prompt: 'check the deploy' } as any)
  await $.tool.call({ tool: 'CronCreate', cron: '*/5 * * * *', prompt: '/babysit' } as any)
  let ui = await band()
  expect(await ui.find({ type: 'Text', text: /🎯 goal  all "tests" pass/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🔁 loop  check the deploy  next in 9m50s  watching CI/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🔁 loop  \/babysit  every 5 minutes/ })).toBeDefined()
  await ui.unmount()
  // the wakeup fires and the turn ends without a new one: the loop is over; the cron stays until deleted
  await clock.advance(800e3)
  await $.tool.call({ tool: 'CronDelete', id: 'c1' } as any)
  jsonl += '{"type":"attachment","attachment":{"type":"goal_status","met":false,"condition":"all \\"tests\\" pass","reason":"not yet"}}\n'
  await clock.advance(10_000)
  expect(await (await band()).find({ type: 'Text', text: /🎯 goal/ })).toBeDefined()   // an evaluation that says not yet changes nothing
  jsonl += '{"type":"attachment","attachment":{"type":"goal_status","met":true,"sentinel":true,"condition":"all \\"tests\\" pass"}}\n'
  await clock.advance(10_000)
  ui = await band()
  expect(await ui.find({ type: 'Text', text: /✅ goal met  all "tests" pass/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /🔁/ })).toBeUndefined()
  await ui.unmount()
  await clock.advance(601e3)   // a met goal shows 10 minutes
  ui = await band()
  expect(await ui.find({ type: 'Text', text: /✅|🎯/ })).toBeUndefined()
  await ui.unmount()
})


test('cron jobs from before a restart show: the band reads CronList at start', { options: { ...quiet, language: 'en', showGit: false } }, async ($, on) => {
  on('tool.call', { tool: 'CronList' }, () => ({ result: { jobs: [{ id: 'j1', cron: '7,37 * * * *', humanSchedule: 'every 30 minutes', prompt: 'check CI', recurring: true }] }, text: 'ok' }))
  const clock = await startBand($, on)
  await clock.advance(2000)
  const ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: bandProps })
  expect(await ui.find({ type: 'Text', text: /🔁 loop  check CI  every 30 minutes/ })).toBeDefined()
  await ui.unmount()
})

test('lib: cronLabel words plain repeats, leaves the rest', async () => {
  expect(cronLabel('7,37 * * * *')).toBe('every 30 min')
  expect(cronLabel('*/5 * * * *')).toBe('every 5 min')
  expect(cronLabel('7 * * * *')).toBe('hourly at :07')
  expect(cronLabel('0 */2 * * *')).toBe('every 2 h')
  expect(cronLabel('7,20 * * * *')).toBe('7,20 * * * *')
  expect(cronLabel('0 9 * * 1-5')).toBe('0 9 * * 1-5')
  expect(cronLabel('every 30 minutes')).toBe('every 30 minutes')
})

test('lib: a goal typed mid-turn is read from the goal record, a typed "Goal set:" prompt is not', async () => {
  const midTurn = '{"content":"Goal set: ship it","reason":"absorbed_mid_turn"}\n{"attachment":{"type":"goal_status","met":false,"sentinel":true,"condition":"ship \\"it\\""}}'
  expect(goalFromTranscript(midTurn)).toEqual({ kind: 'set', text: 'ship "it"' })
  expect(goalFromTranscript(midTurn + '\n{"attachment":{"type":"goal_status","met":true,"condition":"ship it"}}')).toEqual({ kind: 'met' })
  expect(goalFromTranscript('{"type":"user","message":{"content":"Goal set: not a goal"}}')).toBeUndefined()
})

test('lib: rowsOf wraps by words, keeps line breaks, hard-breaks long words', async () => {
  expect(rowsOf('aaaa bbbb', 9)).toBe(1)
  expect(rowsOf('aaa bbb ccc', 8)).toBe(2)  // 11 cells fit in 2 rows by count; words: "aaa bbb" / "ccc"
  expect(rowsOf('aaaaa bbbbb ccccc', 12)).toBe(2)   // 17 cells → 2 by count; words: "aaaaa bbbbb" / "ccccc"
  expect(rowsOf('aaaaaa bbbbbb cccccc', 13)).toBe(2)
  expect(rowsOf('aaaaaaa bbbbbbb ccccccc', 14)).toBe(3)   // 23 cells → 2 by count, but words need 3
  expect(rowsOf('one\ntwo', 80)).toBe(2)
  expect(rowsOf('x'.repeat(25), 10)).toBe(3)
  expect(rowsOf('가나다라', 4)).toBe(2)   // wide cells
})

test('lib: oneLine drops a tagged block whole, nested tags and all', async () => {
  expect(oneLine('<task-notification>\n<task-id>b1</task-id>\n<status>completed</status>\n</task-notification>')).toBe('')
  expect(oneLine('fix it <system-reminder>x <b>y</b> z</system-reminder> now')).toBe('fix it now')
})

test('a long prompt opens in the band itself (the left side gives way to it), not a pane', { options: { ...quiet, language: 'en', showGit: false } }, async ($, on) => {
  const opened: string[] = []
  on('ui.open', (_$: unknown, e: any) => { opened.push(e.id); return { value: { isPlaced: true } } })
  on('session.messages', () => ({ value: [] }))
  await startBand($, on)
  const long = 'line one of a long prompt ' + 'x'.repeat(600) + '\nsecond line'
  await $.prompt.submit({ text: long, origin: { kind: 'composer' } } as any).catch(() => {})
  const props = { ...bandProps, maxRows: 14 }
  let ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props, viewport: { columns: 160, rows: 60, isFullscreen: true } } as any)
  const btn = (await ui.findAll({ type: 'Button' })).find((b: any) => /^p\d/.test(b.key ?? ''))
  if (!btn) { await ui.unmount(); return }   // the harness stamped the prompt as a plugin's: nothing recorded to press
  await ui.press({ key: btn.key })
  await ui.unmount()
  ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props, viewport: { columns: 160, rows: 60, isFullscreen: true } } as any)
  expect(opened).toEqual([])
  expect(await ui.find({ type: 'Text', text: /second line/ })).toBeDefined()   // the whole text, line break kept
  expect(await ui.find({ type: 'Button', key: 'memo' })).toBeUndefined()      // the memo stepped aside for it
  // closed again: the band is as before
  await ui.press({ key: btn.key })
  await ui.unmount()
  ui = await $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props, viewport: { columns: 160, rows: 60, isFullscreen: true } } as any)
  expect(await ui.find({ type: 'Button', key: 'memo' })).toBeDefined()
  await ui.unmount()
})

test('an opened prompt grows into the whole left column, even beside a taller resource panel and pet', { options: { language: 'en', showGit: false, pet: 'cat', gpuHosts: 'box1' } }, async ($, on) => {
  fakeMachines(on, [])
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1e6, percent: 10 }, rateLimits: [] } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('session.start', (_$: unknown, e: any) => e)
  on('command.register', (_$: unknown, e: any) => ({ value: { command: e.name } }))
  on('session.messages', () => ({ value: [] }))
  const clock = mock.clock(on, { now: Date.UTC(2026, 9, 5, 5, 0) })
  await $.session.start({ cwd: '/tmp', source: 'startup' } as any)
  await clock.advance(0)
  // several lines: more rows than the band had left beside the resource panel and the pet (7 + 9 rows)
  const text = ['우리 대화탭 수정합니다.', '좌측 버튼 누르면 대화내용 보이는데,', '대화 내용이 너무 길면 새 탭(우측)에 나옵니다.', '그런 경우 전체 보기 없이', '바로 전체가 나왔으면 좋겠어요', '결과만 짧게 알려주세요'].join('\n')
  await $.prompt.submit({ text, origin: { kind: 'composer' } } as any).catch(() => {})
  const mount = () => $.ui.mount({ plugin: 'status-band', surface: 'terminal', component: 'AbovePrompt', props: { ...bandProps, maxRows: 22 }, viewport: { columns: 160, rows: 52, isFullscreen: true } } as any)
  let ui = await mount()
  const btn = (await ui.findAll({ type: 'Button' })).find((b: any) => /^p\d/.test(b.key ?? ''))
  expect(btn).toBeDefined()
  await ui.press({ key: btn.key })
  await ui.unmount()
  ui = await mount()
  expect(await ui.find({ type: 'Text', text: /결과만 짧게 알려주세요/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /ctrl\+o/ })).toBeUndefined()
  await ui.unmount()
})
