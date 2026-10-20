// Pure helpers: no `$`, so `band.test.tsx` can check them directly.

import type { Activity, GitState } from '../types'

// ---- language ------------------------------------------------------------

export type Lang = 'ko' | 'en'
export type Theme = 'dark' | 'light'
/** A theme setting ('auto' = Claude Code's own `theme` row, e.g. 'light-daltonized') → dark or light. */
export const themeOf = (setting: unknown, engine?: unknown): Theme =>
  setting === 'dark' || setting === 'light' ? setting : String(engine ?? '').startsWith('light') ? 'light' : 'dark'
/** Black or white, whichever reads better on `bg` (#rgb / #rrggbb; anything else: `light`). WCAG contrast ratio. */
export const inkOn = (bg: string, dark: string, light: string): string => {
  const lum = (hex: string) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
    if (!m) return undefined
    const h = m[1]!.length === 3 ? m[1]!.replace(/./g, '$&$&') : m[1]!
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const lb = lum(bg), ld = lum(dark), ll = lum(light)
  if (lb === undefined || ld === undefined || ll === undefined) return light
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  return ratio(lb, ll) >= ratio(lb, ld) ? light : dark
}
/**
 * The goal's last state in a transcript tail (JSONL): `/goal`'s own output rows and the engine's goal notices.
 * Matched on unescaped JSON (`"content":"...`), so text quoted inside a tool result never counts.
 */
export const goalFromTranscript = (tail: string): { kind: 'set'; text: string } | { kind: 'clear' | 'met' | 'failed' } | undefined => {
  // `/goal`'s output rows, and the engine's goal record: `"met":false` with the condition when set (also when `/goal`
  // was typed mid-turn and its output row is plain text), `"met":true` once the condition holds
  const re = /"content":"<local-command-stdout>(?:Goal set: ((?:[^<"\\]|\\.)*)|(Goal cleared|No goal set))|"type":"goal_status","met":(?:(true)|false(?:,"sentinel":true)?,"condition":"((?:[^"\\]|\\.)*)")|"content":"(Goal could not be achieved)|"content":"(Goal cleared)/g
  let last: ReturnType<typeof goalFromTranscript>
  for (const m of tail.matchAll(re)) {
    const set = m[1] ?? m[4]
    if (set !== undefined) {
      let text = set
      try { text = JSON.parse(`"${set}"`) as string } catch { /* keep it raw */ }
      last = { kind: 'set', text: text.trim() }
    } else last = { kind: m[3] ? 'met' : m[5] ? 'failed' : 'clear' }
  }
  return last
}
/** Rows a text takes wrapped at w, its line breaks kept: words move whole to the next row, as the renderer wraps. */
export const rowsOf = (text: string, w: number): number => text.split('\n').reduce((n, l) => {
  let rows = 1, col = 0
  for (const word of l.split(' ')) {
    const c = cells(word)
    if (col && col + 1 + c > w) { rows++; col = 0 }
    col += (col ? 1 : 0) + c
    while (col > w) { rows++; col -= w }
  }
  return n + rows
}, 0)
/** A cron line the engine left as is, in words when it is a plain repeat; anything else stays as written. */
export const cronLabel = (cron: string): string => {
  const [m, h, ...rest] = cron.trim().split(/\s+/)
  if (rest.length !== 3 || rest.some(x => x !== '*') || !m || !h) return cron
  const every = /^\*\/(\d+)$/
  if (h === '*') {
    if (every.test(m)) return `every ${every.exec(m)![1]} min`
    const mins = m.split(',').map(Number)
    if (mins.some(x => !Number.isInteger(x) || x < 0 || x > 59)) return cron
    if (mins.length === 1) return `hourly at :${String(mins[0]).padStart(2, '0')}`
    const gap = 60 / mins.length
    return Number.isInteger(gap) && mins.every((x, i) => i === 0 || x - mins[i - 1]! === gap) ? `every ${gap} min` : cron
  }
  return /^\d+$/.test(m) && every.test(h) ? `every ${every.exec(h)![1]} h` : cron
}
/** ~/.claude/projects/<cwd, every non-alphanumeric a dash>/<session id>.jsonl */
export const transcriptPath = (home: string, cwd: string, session: string) => `${home}/.claude/projects/${cwd.replace(/[^A-Za-z0-9]/g, '-')}/${session}.jsonl`
export const asLang = (v: unknown): Lang => (v === 'ko' ? 'ko' : 'en')

/** Everything the band, toasts and commands show. */
export const STRINGS = {
  ko: {
    model: '모델', thinking: '사고', in: '입력', out: '출력',
    session: '세션:', weekly: '주간:', weeklyFable: '주간 Fable:',
    resetTimer: '리셋 타이머', weeklyResetTimer: '주간 리셋', resetsIn: '리셋까지',
    ctx: '컨텍스트', timer: '캐시', hit: '적중', compactions: '압축', cost: '비용',
    prompts: '대화', noPrompts: '아직 입력 없음', polling: '수집 중…',
    working: '작업 중…', ctxHigh: (p: number) => `컨텍스트 ${p}% — /compact 어때요`,
    cacheCold: '캐시 식었어요', idle: '대기 중',
    shown: '밴드 표시', hidden: '밴드 숨김 (다시: /band show)',
    lang: '언어 한국어',
    ctxToast: (p: number) => `band: 컨텍스트 ${p}% — /compact 권장`,
    files: '파일', tools: '도구', errors: '오류', bg: '백그라운드', agents: (n: number) => `에이전트 ${n}개`,
memo: '메모', memoClick: '메모 — 눌러서 쓰기', memoHelp: '줄을 누르면 수정 (비우고 Enter 면 그 줄 삭제) · / 를 치면 명령 추천 · ↳ /명령 을 누르면 입력창에 넣기 · 아래에 쓰고 Enter 면 줄 추가 · Esc 로 닫기', memoPlaceholder: '새 줄…', memoAdd: '추가', memoSave: '저장',
    goalMet: '목표 달성', goalFailed: '목표 실패', goal: '목표', loop: '루프', autoLoop: '자율 루프', nextIn: (d: string) => `다음 ${d} 후`, firing: '실행 중',
    cardMore: '… 남은 부분은 위 대화 기록의 원문에 (접혀 있으면 ctrl+o)',
    fullText: '전체 보기', cfgOn: '[✓] 켜짐', cfgOff: '[ ] 꺼짐',
    presets: { reset: '기본(비우기)', white: '흰색', black: '검은색', pastel: '기본 파스텔', deep: '진한 색(흰 글자용)' },
    cfg: {
      language: ['언어', '밴드·토스트·명령 응답 언어'],
      theme: ['알약 글자색 방식', 'contrast: 알약 배경마다 잘 보이는 흰/검정을 자동 · auto: Claude Code 테마를 따라 · dark: 흰 글자 · light: 검은 글자'],
      showGit: ['git 표시', '브랜치, 앞섬/뒤처짐, 변경 수'],
      gitIntervalSec: ['git 갱신 주기(초)', 'git status 를 다시 읽는 간격 (수정·셸 명령 뒤에도 다시 읽음)'],
      showCost: ['비용 표시', '세션 비용, $/h, 출력 tok/s'],
      showGoalLoop: ['목표·루프 표시', '/goal 로 정한 목표와 /loop 예약(무엇을, 다음 실행까지 얼마)을 대화 칸 위 별도 칸에 보여줌 (있을 때만)'],
      showActivity: ['활동 표시', '실행 중 에이전트·긴 도구, 할 일 진행, 수정한 파일, 도구/오류 수'],
      pet: ['펫', 'buddy: 내 계정의 buddy · 종 이름: 그 종으로 고정 · off: 끄기'],
      petName: ['펫 이름', '펫 아래 이름 (비우면 종 이름)'],
      petEye: ['펫 눈', 'auto: 내 buddy 의 눈'],
      petHat: ['펫 모자', 'auto: 내 buddy 의 모자 (common 은 없음)'],
      petPlace: ['펫 위치', 'auto: 자원 패널 아래, 자리가 없으면 옆 · under/beside: 그 자리만 (자리가 없으면 펫 숨김)'],
      gpuLocal: ['이 컴퓨터 GPU', 'Linux: nvidia-smi · macOS: ioreg'],
      gpuSsh: ['SSH GPU', '아래 GPU 호스트를 ssh 로 조회'],
      showCpu: ['CPU 표시', '이 컴퓨터(와 SSH GPU 가 켜져 있으면 각 호스트)의 CPU 사용률'],
      showRam: ['RAM 표시', '이 컴퓨터(와 SSH GPU 가 켜져 있으면 각 호스트)의 메모리'],
      gpuColumns: ['자원 칸 열 수', 'auto: 줄이 4개를 넘고(GPU 8장 등) 폭이 되면 2열 · 1 / 2: 고정'],
      gpuHosts: ['GPU 호스트', 'nvidia-smi 로 조회할 ssh 호스트, 쉼표로 구분'],
      gpuIntervalSec: ['자원 갱신 주기(초)', 'GPU/CPU/RAM 조회 간격'],
      usageIntervalSec: ['사용량 갱신 주기(초)', '세션/주간 한도 조회 간격'],
      promptLines: ['최근 입력 줄 수', '대화 칸에 보일 최근 입력 개수'],
      pillColors: ['팔레트', '4색 #RRGGBB 쉼표 구분 (분홍·노랑·초록·파랑 역할): 알약, 테두리, 제목'],
      pillText: ['알약 글자색', '#RRGGBB 로 고정 · 비우면 위 "알약 글자색 방식"'],
      textColor: ['글자색', '최근 입력 줄 #RRGGBB · 비우면 터미널 기본'],
    } as Record<string, readonly [string, string]>,
    opt: { auto: '자동', under: '아래', beside: '옆', off: '끔', buddy: '내 buddy', contrast: '대비 자동', dark: '다크(흰 글자)', light: '라이트(검은 글자)', none: '없음', ko: '한국어', en: 'English' } as Record<string, string>,
    settings: '설정', settingsHelp: '◂ ▸ 로 고르기 · 칸에 쓰고 Enter 로 저장 · 바꾸면 밴드가 바로 다시 그려져요 · Esc 로 닫기', settingsNone: '설정 목록을 못 읽었어요 (/config 에서 status-band 항목)', settingsBad: '숫자가 아니에요',
    running: '실행 중', done: '완료', paneEmpty: '밴드의 에이전트 줄 ↗ 를 누르면 대화가 여기 보여요',
    pet: { idle: '느긋느긋', working: '열일 중!', happy: '다 했다!', sleepy: '캐시 식음', dizzy: '어질어질' },
  },
  en: {
    model: 'Model', thinking: 'Thinking', in: 'in', out: 'out',
    session: 'Session:', weekly: 'Weekly:', weeklyFable: 'Weekly Fable:',
    resetTimer: 'Reset Timer', weeklyResetTimer: 'Weekly Reset Timer', resetsIn: 'resets in',
    ctx: 'ctx', timer: 'timer', hit: 'hit', compactions: 'Compactions', cost: 'Cost',
    prompts: 'Prompts', noPrompts: 'No prompts yet', polling: 'polling…',
    working: 'working…', ctxHigh: (p: number) => `context ${p}% — time to /compact?`,
    cacheCold: 'cache went cold', idle: 'idle',
    shown: 'band shown', hidden: 'band hidden (again: /band show)',
    lang: 'language English',
    ctxToast: (p: number) => `band: context ${p}% — consider /compact`,
    files: 'files', tools: 'tools', errors: 'errors', bg: 'bg', agents: (n: number) => `${n} agents`,
memo: 'Memo', memoClick: 'memo: click to write', memoHelp: 'click a line to edit it (empty + Enter removes it) · type / for commands · ↳ /command puts it in the prompt box · type below + Enter adds a line · Esc closes', memoPlaceholder: 'new line…', memoAdd: 'add', memoSave: 'save',
    goalMet: 'goal met', goalFailed: 'goal failed', goal: 'goal', loop: 'loop', autoLoop: 'autonomous loop', nextIn: (d: string) => `next in ${d}`, firing: 'firing',
    cardMore: '… the rest is in the transcript above (ctrl+o if folded)',
    fullText: 'full text', cfgOn: '[✓] on', cfgOff: '[ ] off',
    presets: { reset: 'default (clear)', white: 'white', black: 'black', pastel: 'pastel (default)', deep: 'deep (for white text)' },
    cfg: {} as Record<string, readonly [string, string]>,   // the manifest's own titles and descriptions
    opt: {} as Record<string, string>,
    settings: 'settings', settingsHelp: '◂ ▸ to pick · type in a field + Enter to save · the band redraws at once · Esc closes', settingsNone: 'could not read the settings (/config → status-band)', settingsBad: 'not a number',
    running: 'running', done: 'done', paneEmpty: 'press ↗ on an agent line in the band to see its conversation here',
    pet: { idle: 'chilling', working: 'on it!', happy: 'done!', sleepy: 'cache cold', dizzy: 'dizzy' },
  },
} satisfies Record<Lang, Record<string, unknown>>
export type Strings = (typeof STRINGS)[Lang]

/** Cut to at most `width` terminal cells, '…' marking the cut. */
export const cutCells = (text: string, width: number): string => {
  if (cells(text) <= width) return text
  let out = ''
  for (const ch of text) { if (cells(out + ch) > width - 1) break; out += ch }
  return out + '…'
}
/** padEnd by terminal cells, so Korean labels line up too. */
export const padCells = (text: string, width: number): string => text + ' '.repeat(Math.max(0, width - cells(text)))
export const padCellsStart = (text: string, width: number): string => ' '.repeat(Math.max(0, width - cells(text))) + text

export const FIVE_H = 5 * 3600e3
export const SEVEN_D = 7 * 86400e3

export const bar = (pct: number, width = 16): string => {
  const n = Math.round(Math.max(0, Math.min(100, pct)) / 100 * width)
  return '[' + '█'.repeat(n) + '░'.repeat(width - n) + ']'
}

/** ' 9.0%' style: fixed width 6 so the three usage rows line up. */
export const pct = (v: number | undefined): string =>
  v === undefined ? '   n/a' : (v.toFixed(1) + '%').padStart(6)

export const kTok = (n: number): string =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(n)

export const duration = (ms: number, lang: Lang = 'en'): string => {
  const m = Math.max(0, Math.floor(ms / 60e3))
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60
  const u = lang === 'ko' ? ['일', '시간', '분'] : ['d', 'hr', 'm']
  return [d && `${d}${u[0]}`, h && `${h}${u[1]}`, `${mm}${u[2]}`].filter(Boolean).join(' ')
}

/** Elapsed share of a reset window, 0..100. */
export const windowElapsed = (resetAt: string | undefined, windowMs: number, now: number): number | undefined => {
  if (!resetAt) return undefined
  const remaining = Date.parse(resetAt) - now
  return Math.max(0, Math.min(100, 100 - remaining / windowMs * 100))
}

export const health = (v: number | undefined, good: number, ok: number, higherIsBetter = false): string => {
  if (v === undefined) return '⚪'
  const g = higherIsBetter ? v >= good : v < good
  const o = higherIsBetter ? v >= ok : v < ok
  return g ? '💚' : o ? '💛' : '💔'
}

export const shortModel = (id: string): string => {
  const m = /claude-([a-z]+)-(\d+)-(\d+)/.exec(id)
  return m ? `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1)} ${m[2]}.${m[3]}` : id
}

/** Wall clock at a UTC offset in minutes (local by default), 'MM-DD HH:MM'. */
export const localTime = (ms: number, offsetMin = -new Date(ms).getTimezoneOffset()): string =>
  new Date(ms + offsetMin * 60e3).toISOString().slice(5, 16).replace('T', ' ')

/** `date +%z` ('+0900', '-0530') → minutes east of UTC; undefined when unreadable. */
export const tzOffset = (text: string): number | undefined => {
  const m = /^([+-])(\d\d)(\d\d)$/.exec(text.trim())
  return m ? (m[1] === '-' ? -1 : 1) * (+m[2]! * 60 + +m[3]!) : undefined
}

export const oneLine = (text: string, width = 60): string => {
  // a tagged block goes whole, up to the closing tag of the same name (nested tags inside it included)
  const t = text.replace(/<([\w:-]+)[^>]*>[\s\S]*?<\/\1>/g, '').replace(/\s+/g, ' ').trim()
  return t.length > width ? t.slice(0, width - 1) + '…' : t
}

/** /api/oauth/usage response → our Usage. Mirrors ccstatusline's reader. */
export const parseUsage = (json: unknown, now: number) => {
  const j = (json ?? {}) as Record<string, any>
  const limits: any[] = Array.isArray(j.limits) ? j.limits : []
  const byKind = (k: string) => limits.find(l => l?.kind === k)
  const scoped = (name: string) => limits.find(l => l?.scope?.model?.display_name === name)
  const u = (b: any, l: any) => (b?.utilization ?? l?.percent ?? undefined) as number | undefined
  const r = (b: any, l: any) => (b?.resets_at ?? l?.resets_at ?? undefined) as string | undefined
  const fable = scoped('Fable')
  return {
    session: u(j.five_hour, byKind('session')), sessionResetAt: r(j.five_hour, byKind('session')),
    weekly: u(j.seven_day, byKind('weekly_all')), weeklyResetAt: r(j.seven_day, byKind('weekly_all')),
    fable: u(undefined, fable), fableResetAt: r(undefined, fable),
    fetchedAt: now,
  }
}

/** nvidia-smi csv (index,util,mem.used,mem.total,temp; nounits) → cards. */
export const gpuParse = (csv: string): { i: string; util: number; used: number; total: number }[] =>
  csv.trim().split('\n').filter(Boolean).map(row => {
    const [i, util, used, total] = row.split(',').map(s => s.trim())
    return { i: i ?? '?', util: +util! || 0, used: +used! / 1024, total: +total! / 1024 }
  })

/** macOS `ioreg -r -d 1 -c IOAccelerator` + hw.memsize → one Apple GPU card (unified memory, GiB). */
export const appleGpuParse = (ioreg: string, memBytes: number): { i: string; util: number; used: number; total: number }[] => {
  const util = /"Device Utilization %"=(\d+)/.exec(ioreg)
  if (!util) return []
  const used = /"In use system memory"=(\d+)/.exec(ioreg)
  const model = /"model" = "(?:Apple )?([^"]+)"/.exec(ioreg)
  return [{ i: model?.[1] ?? 'GPU', util: +util[1]!, used: +(used?.[1] ?? 0) / 2 ** 30, total: memBytes / 2 ** 30 }]
}

/** macOS `top -l 2 -n 0`: the last `CPU usage` line (the first is since boot) → busy %. */
export const topCpuParse = (text: string): number | undefined => {
  const idle = [...text.matchAll(/CPU usage:.*?([\d.]+)% idle/g)].at(-1)
  return idle ? Math.max(0, Math.min(100, 100 - +idle[1]!)) : undefined
}

/** Two `cpu ` lines of /proc/stat, a second apart → busy % over that second. */
export const procStatCpu = (text: string): number | undefined => {
  const rows = text.split('\n').filter(l => /^cpu\s/.test(l)).map(l => l.trim().split(/\s+/).slice(1).map(Number))
  if (rows.length < 2) return undefined
  const sum = (r: number[]) => r.reduce((a, b) => a + b, 0)
  const idle = (r: number[]) => (r[3] ?? 0) + (r[4] ?? 0)   // idle + iowait
  const [a, b] = [rows.at(-2)!, rows.at(-1)!]
  const dt = sum(b) - sum(a)
  return dt > 0 ? Math.max(0, Math.min(100, (1 - (idle(b) - idle(a)) / dt) * 100)) : undefined
}

/** macOS `vm_stat` → used GiB the way Activity Monitor counts it: app (anonymous − purgeable) + wired + compressed. */
export const vmStatRam = (text: string, memBytes: number): { used: number; total: number } | undefined => {
  const page = +(/page size of (\d+) bytes/.exec(text)?.[1] ?? 0)
  const n = (name: string) => +(new RegExp(`^${name}:\\s+(\\d+)`, 'm').exec(text)?.[1] ?? 0)
  if (!page || !memBytes) return undefined
  const app = n('Anonymous pages') ? n('Anonymous pages') - n('Pages purgeable') : n('Pages active')
  return { used: (app + n('Pages wired down') + n('Pages occupied by compressor')) * page / 2 ** 30, total: memBytes / 2 ** 30 }
}

/** /proc/meminfo (MemTotal, MemAvailable; kB) → used GiB. */
export const memInfoRam = (text: string): { used: number; total: number } | undefined => {
  const kb = (name: string) => +(new RegExp(`^${name}:\\s+(\\d+)`, 'm').exec(text)?.[1] ?? NaN)
  const total = kb('MemTotal'), avail = kb('MemAvailable')
  return total > 0 && avail >= 0 ? { used: (total - avail) / 2 ** 20, total: total / 2 ** 20 } : undefined
}

/** ssh output cut by `@@hud-<name>@@` lines → { name: text }. */
export const sections = (out: string): Record<string, string> => {
  const res: Record<string, string> = {}
  let cur = ''
  for (const line of out.split('\n')) {
    const m = /^@@hud-(\w+)@@$/.exec(line.trim())
    if (m) { cur = m[1]!; res[cur] = '' } else if (cur) res[cur] += line + '\n'
  }
  return res
}

/** One line of the resource panel: label, bar, detail, value; `value` undefined reads n/a. */
export type ResRow = { label: string; bar: number; detail: string; value?: number }
type Machine = { host: string; gpu: boolean; cards: { i: string; util: number; used: number; total: number }[]; cpu?: number; cores?: number; ram?: { used: number; total: number } }

const gib = (v: number) => (v < 10 ? v.toFixed(1) : String(Math.round(v)))

/** Machines → panel rows: GPU cards (bar = memory, value = utilization), CPU, RAM. */
export const resRows = (machines: Machine[], show: { cpu: boolean; ram: boolean }): ResRow[] =>
  machines.flatMap(m => {
    const pre = m.host === 'local' ? '' : m.host + ' '
    const gpu: ResRow[] = !m.gpu ? [] : m.cards.length === 0
      ? [{ label: pre + 'GPU', bar: 0, detail: '' }]
      : m.cards.map(c => ({ label: pre + c.i, bar: c.used / Math.max(1e-9, c.total) * 100, detail: `${gib(c.used)}/${Math.round(c.total)}G`, value: c.util }))
    const cpu: ResRow[] = !show.cpu ? [] : [{ label: pre + 'CPU', bar: m.cpu ?? 0, detail: m.cores ? `${m.cores}c` : '', value: m.cpu }]
    const r = m.ram, ramPct = r && r.used / Math.max(1e-9, r.total) * 100
    const ram: ResRow[] = !show.ram ? [] : [{ label: pre + 'RAM', bar: ramPct ?? 0, detail: r ? `${gib(r.used)}/${Math.round(r.total)}G` : '', value: ramPct }]
    return [...gpu, ...cpu, ...ram]
  })

/** Column widths so every row's `[`, `]` and `%` land in the same cell. */
export const resWidths = (rows: ResRow[]) => ({
  label: Math.max(0, ...rows.map(r => cells(r.label))),
  detail: Math.max(0, ...rows.map(r => cells(r.detail))),
})

/** '  7%' / '100%' / ' n/a': always 4 cells. */
export const pct4 = (v: number | undefined): string => (v === undefined ? ' n/a' : `${String(Math.round(v)).padStart(3)}%`)

/** Terminal cell width: CJK, emoji and powerline glyphs count 2 (the font draws caps 1 wide, kept 1). */
export const cells = (text: string): number => {
  let n = 0
  for (const ch of text) {
    const c = ch.codePointAt(0)!
    if (c < 0x20 || (c >= 0xfe00 && c <= 0xfe0f) || (c >= 0x300 && c <= 0x36f)) continue   // controls, VS, combining
    n += (c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) || (c >= 0x1f300 && c <= 0x1faff) || (c >= 0x20000 && c <= 0x3fffd))) ? 2 : 1
  }
  return n
}

// ---- git ------------------------------------------------------------------


/** `git status --porcelain=v2 --branch` → counts; undefined outside a repository (empty output). */
export const gitParse = (out: string, worktree = false): GitState | undefined => {
  if (!out.trim()) return undefined
  const g: GitState = { branch: '', detached: false, ahead: 0, behind: 0, staged: 0, unstaged: 0, untracked: 0, conflicts: 0, worktree }
  let oid = ''
  for (const line of out.split('\n')) {
    const [kind, xy] = line.split(' ')
    if (line.startsWith('# branch.head ')) g.branch = line.slice(14).trim()
    else if (line.startsWith('# branch.oid ')) oid = line.slice(13).trim()
    else if (line.startsWith('# branch.ab ')) {
      const m = /\+(\d+) -(\d+)/.exec(line)
      if (m) { g.ahead = +m[1]!; g.behind = +m[2]! }
    } else if (kind === '1' || kind === '2') {
      if (xy?.[0] !== '.') g.staged++
      if (xy?.[1] !== '.') g.unstaged++
    } else if (kind === 'u') g.conflicts++
    else if (kind === '?') g.untracked++
  }
  if (g.branch === '(detached)') { g.detached = true; g.branch = oid.slice(0, 7) || 'HEAD' }
  return g.branch ? g : undefined
}

/** '<branch glyph U+E0A0> main ⇡2⇣1 ●3 ✚1 …2' (zero counts left out); `short` keeps branch and the dirty mark only. */
export const gitLabel = (g: GitState, short = false): string => {
  const head = `${g.worktree ? '⎇ ' : '\uE0A0 '}${g.detached ? '@' : ''}${g.branch}`
  const dirty = g.staged + g.unstaged + g.untracked + g.conflicts > 0
  if (short) return head + (dirty ? ' *' : '')
  const marks = [
    g.ahead && `⇡${g.ahead}`, g.behind && `⇣${g.behind}`, g.conflicts && `✖${g.conflicts}`,
    g.staged && `●${g.staged}`, g.unstaged && `✚${g.unstaged}`, g.untracked && `…${g.untracked}`,
  ].filter(Boolean)
  return [head, ...marks].join(' ')
}

// ---- activity -------------------------------------------------------------

export const NO_ACTIVITY: Activity = { agents: [], tools: [], todos: {}, files: [], calls: 0, errors: 0 }

/** Todo state after one TodoWrite / TaskCreate / TaskUpdate: `w:<i>` for the list, `t:<id>` for tasks. */
export const applyTodo = (todos: Record<string, string>, tool: string, input: any, result: any): Record<string, string> => {
  if (tool === 'TodoWrite' && Array.isArray(input?.todos)) {
    const rest = Object.fromEntries(Object.entries(todos).filter(([k]) => !k.startsWith('w:')))
    input.todos.forEach((t: any, i: number) => { rest[`w:${i}`] = String(t?.status ?? 'pending') })
    return rest
  }
  if (tool === 'TaskCreate' && result?.task?.id !== undefined) return { ...todos, [`t:${result.task.id}`]: 'pending' }
  if (tool === 'TaskUpdate' && input?.taskId !== undefined && input?.status) {
    const { [`t:${input.taskId}`]: _, ...rest } = todos
    return input.status === 'deleted' ? rest : { ...rest, [`t:${input.taskId}`]: String(input.status) }
  }
  return todos
}

export const todoProgress = (todos: Record<string, string>) => {
  const all = Object.values(todos)
  return { done: all.filter(s => s === 'completed').length, total: all.length }
}

/** The file a write-type tool touched, if any. */
export const editedFile = (tool: string, input: any): string | undefined =>
  tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit' ? input?.file_path : tool === 'NotebookEdit' ? input?.notebook_path : undefined

/** '42s', '1m12s', '1h3m'. */
export const elapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`
}

// ---- pet ------------------------------------------------------------------

/** What the pet is up to, most telling first. */
export type PetMood = 'working' | 'dizzy' | 'happy' | 'sleepy' | 'idle'
export const petMood = (s: { working: boolean; ctx: number; sinceDone?: number; cacheCold: boolean }): PetMood =>
  s.working ? 'working' : s.ctx >= 80 ? 'dizzy' : s.sinceDone !== undefined && s.sinceDone < 8000 ? 'happy'
    : s.cacheCold ? 'sleepy' : 'idle'

// Claude Code's own /buddy companions (removed from Claude Code; art via github.com/ramarivera/coding-buddy, MIT):
// 18 species, 3 frames of 5 rows × 12 cells, {E} = the eyes
export const PET_ART: Record<string, string[][]> = {

  duck: [
    ["            ", "    __      ", "  <({E} )___  ", "   (  ._>   ", "    `--'    "],
    ["            ", "    __      ", "  <({E} )___  ", "   (  ._>   ", "    `--'~   "],
    ["            ", "    __      ", "  <({E} )___  ", "   (  .__>  ", "    `--'    "],
  ],
  goose: [
    ["            ", "     ({E}>    ", "     ||     ", "   _(__)_   ", "    ^^^^    "],
    ["            ", "    ({E}>     ", "     ||     ", "   _(__)_   ", "    ^^^^    "],
    ["            ", "     ({E}>>   ", "     ||     ", "   _(__)_   ", "    ^^^^    "],
  ],
  blob: [
    ["            ", "   .----.   ", "  ( {E}  {E} )  ", "  (      )  ", "   `----'   "],
    ["            ", "  .------.  ", " (  {E}  {E}  ) ", " (        ) ", "  `------'  "],
    ["            ", "    .--.    ", "   ({E}  {E})   ", "   (    )   ", "    `--'    "],
  ],
  cat: [
    ["            ", "   /\\_/\\    ", "  ( {E}   {E})  ", "  (  \u03c9  )   ", "  (\")_(\")   "],
    ["            ", "   /\\_/\\    ", "  ( {E}   {E})  ", "  (  \u03c9  )   ", "  (\")_(\")~  "],
    ["            ", "   /\\-/\\    ", "  ( {E}   {E})  ", "  (  \u03c9  )   ", "  (\")_(\")   "],
  ],
  dragon: [
    ["            ", "  /^\\  /^\\  ", " <  {E}  {E}  > ", " (   ~~   ) ", "  `-vvvv-'  "],
    ["            ", "  /^\\  /^\\  ", " <  {E}  {E}  > ", " (        ) ", "  `-vvvv-'  "],
    ["   ~    ~   ", "  /^\\  /^\\  ", " <  {E}  {E}  > ", " (   ~~   ) ", "  `-vvvv-'  "],
  ],
  octopus: [
    ["            ", "   .----.   ", "  ( {E}  {E} )  ", "  (______)  ", "  /\\/\\/\\/\\  "],
    ["            ", "   .----.   ", "  ( {E}  {E} )  ", "  (______)  ", "  \\/\\/\\/\\/  "],
    ["     o      ", "   .----.   ", "  ( {E}  {E} )  ", "  (______)  ", "  /\\/\\/\\/\\  "],
  ],
  owl: [
    ["            ", "   /\\  /\\   ", "  (({E})({E}))  ", "  (  ><  )  ", "   `----'   "],
    ["            ", "   /\\  /\\   ", "  (({E})({E}))  ", "  (  ><  )  ", "   .----.   "],
    ["            ", "   /\\  /\\   ", "  (({E})(-))  ", "  (  ><  )  ", "   `----'   "],
  ],
  penguin: [
    ["            ", "  .---.     ", "  ({E}>{E})     ", " /(   )\\    ", "  `---'     "],
    ["            ", "  .---.     ", "  ({E}>{E})     ", " |(   )|    ", "  `---'     "],
    ["  .---.     ", "  ({E}>{E})     ", " /(   )\\    ", "  `---'     ", "   ~ ~      "],
  ],
  turtle: [
    ["            ", "   _,--._   ", "  ( {E}  {E} )  ", " /[______]\\ ", "  ``    ``  "],
    ["            ", "   _,--._   ", "  ( {E}  {E} )  ", " /[______]\\ ", "   ``  ``   "],
    ["            ", "   _,--._   ", "  ( {E}  {E} )  ", " /[======]\\ ", "  ``    ``  "],
  ],
  snail: [
    ["            ", " {E}    .--.  ", "  \\  ( @ )  ", "   \\_`--'   ", "  ~~~~~~~   "],
    ["            ", "  {E}   .--.  ", "  |  ( @ )  ", "   \\_`--'   ", "  ~~~~~~~   "],
    ["            ", " {E}    .--.  ", "  \\  ( @  ) ", "   \\_`--'   ", "   ~~~~~~   "],
  ],
  ghost: [
    ["            ", "   .----.   ", "  / {E}  {E} \\  ", "  |      |  ", "  ~`~``~`~  "],
    ["            ", "   .----.   ", "  / {E}  {E} \\  ", "  |      |  ", "  `~`~~`~`  "],
    ["    ~  ~    ", "   .----.   ", "  / {E}  {E} \\  ", "  |      |  ", "  ~~`~~`~~  "],
  ],
  axolotl: [
    ["            ", "}~(______)~{", "}~({E} .. {E})~{", "  ( .--. )  ", "  (_/  \\_)  "],
    ["            ", "~}(______){~", "~}({E} .. {E}){~", "  ( .--. )  ", "  (_/  \\_)  "],
    ["            ", "}~(______)~{", "}~({E} .. {E})~{", "  (  --  )  ", "  ~_/  \\_~  "],
  ],
  capybara: [
    ["            ", "  n______n  ", " ( {E}    {E} ) ", " (   oo   ) ", "  `------'  "],
    ["            ", "  n______n  ", " ( {E}    {E} ) ", " (   Oo   ) ", "  `------'  "],
    ["    ~  ~    ", "  u______n  ", " ( {E}    {E} ) ", " (   oo   ) ", "  `------'  "],
  ],
  cactus: [
    ["            ", " n  ____  n ", " | |{E}  {E}| | ", " |_|    |_| ", "   |    |   "],
    ["            ", "    ____    ", " n |{E}  {E}| n ", " |_|    |_| ", "   |    |   "],
    [" n        n ", " |  ____  | ", " | |{E}  {E}| | ", " |_|    |_| ", "   |    |   "],
  ],
  robot: [
    ["            ", "   .[||].   ", "  [ {E}  {E} ]  ", "  [ ==== ]  ", "  `------'  "],
    ["            ", "   .[||].   ", "  [ {E}  {E} ]  ", "  [ -==- ]  ", "  `------'  "],
    ["     *      ", "   .[||].   ", "  [ {E}  {E} ]  ", "  [ ==== ]  ", "  `------'  "],
  ],
  rabbit: [
    ["            ", "   (\\__/)   ", "  ( {E}  {E} )  ", " =(  ..  )= ", "  (\")__(\")" ],
    ["            ", "   (|__/)   ", "  ( {E}  {E} )  ", " =(  ..  )= ", "  (\")__(\")" ],
    ["            ", "   (\\__/)   ", "  ( {E}  {E} )  ", " =( .  . )= ", "  (\")__(\")" ],
  ],
  mushroom: [
    ["            ", " .-o-OO-o-. ", "(__________)","   |{E}  {E}|   ", "   |____|   "],
    ["            ", " .-O-oo-O-. ", "(__________)","   |{E}  {E}|   ", "   |____|   "],
    ["   . o  .   ", " .-o-OO-o-. ", "(__________)","   |{E}  {E}|   ", "   |____|   "],
  ],
  chonk: [
    ["            ", "  /\\    /\\  ", " ( {E}    {E} ) ", " (   ..   ) ", "  `------'  "],
    ["            ", "  /\\    /|  ", " ( {E}    {E} ) ", " (   ..   ) ", "  `------'  "],
    ["            ", "  /\\    /\\  ", " ( {E}    {E} ) ", " (   ..   ) ", "  `------'~ "],
  ],
}
export const PET_SPECIES = Object.keys(PET_ART)
export const PET_EYES = ['·', '✦', '×', '◉', '@', '°']
export const PET_HATS: Record<string, string> = {
  none: '', crown: '   \\^^^/    ', tophat: '   [___]    ', propeller: '    -+-     ',
  halo: '   (   )    ', wizard: '    /^\\     ', beanie: '   (___)    ', tinyduck: '    ,>      ',
}
export const PET_ROWS = 5
/** The widest line of any frame, so no frame jitters sideways in its box. */
export const PET_W = Math.max(12, ...Object.values(PET_ART).flat(2).map(l => cells(l.replace(/\{E\}/g, '·'))))
// Claude Code's idle loop, a tick every 500 ms: mostly still, a fidget (1, 2) and a blink (-1)
const IDLE_SEQ = [0, 0, 0, 0, 1, 0, 0, 0, -1, 0, 0, 2, 0, 0, 0]
// what floats above the head (row 0, when no hat sits there), per mood: a few positions cycled
const PET_FX: Partial<Record<PetMood, string[]>> = {
  working: ['   *     +  ', '  +    *    ', '     *    + '],
  happy: ['   ♥    ♥   ', '  ♥  ♥   ♥  ', ' ♥   ♥  ♥   ', '♥  ♥      ♥ '],
  sleepy: ['        z   ', '       z Z  ', '      z Z z '],
  dizzy: ['   ~ ? ~    ', '    ? ~ ?   '],
}
/** The frame for this tick: the species' art with the mood's eyes, motion and effects, every line PET_W wide. */
export const petFrame = (species: string, mood: PetMood, tick: number, eye = '·', hat = 'none'): string[] => {
  const frames = PET_ART[species] ?? PET_ART.cat!
  const at = <T,>(xs: T[], i: number) => xs[((i % xs.length) + xs.length) % xs.length]!
  // idle keeps Claude Code's calm loop; working fidgets every tick; the rest hold still
  const seq = mood === 'working' ? at([0, 1, 2], tick) : mood === 'idle' ? at(IDLE_SEQ, tick) : 0
  const eyes = seq === -1 || mood === 'sleepy' ? '-' : mood === 'dizzy' ? '×' : mood === 'happy' ? '^' : eye
  const art = at(frames, Math.max(0, seq)).map(l => l.replace(/\{E\}/g, eyes))
  const top = PET_HATS[hat] || at(PET_FX[mood] ?? [''], tick)
  if (top && !art[0]!.trim()) art[0] = top
  return art.map(l => padCells(l, PET_W))
}

// ---- your own buddy: Claude Code's roll -------------------------------------
// Claude Code hatched one companion per account: wyhash(accountUuid + salt) seeds mulberry32, which picks
// rarity, species, eyes, hat, shininess and stats in this order. Ported from github.com/ramarivera/coding-buddy (MIT).

const MASK64 = (1n << 64n) - 1n
const WY = [0xa0761d6478bd642fn, 0xe7037ed1a0b428dbn, 0x8ebc6af09c88c6e3n, 0x589965cc75374cc3n]
const wyMum = (a: bigint, b: bigint): [bigint, bigint] => { const x = (a & MASK64) * (b & MASK64); return [x & MASK64, (x >> 64n) & MASK64] }
const wyMix = (a: bigint, b: bigint) => { const [lo, hi] = wyMum(a, b); return (lo ^ hi) & MASK64 }
const wyR = (buf: Uint8Array, off: number, n: number) => { let v = 0n; for (let i = 0; i < n; i++) v |= BigInt(buf[off + i]!) << BigInt(i * 8); return v }
/** Zig's wyhash (what Bun.hash, and so Claude Code, uses), seed 0. */
export const wyhash = (input: string): bigint => {
  const buf = new TextEncoder().encode(input), len = buf.length
  let s0 = wyMix(WY[0]!, WY[1]!), s1 = s0, s2 = s0
  let a: bigint, b: bigint
  if (len <= 16) {
    if (len >= 4) {
      const q = (len >> 3) << 2
      a = ((wyR(buf, 0, 4) << 32n) | wyR(buf, q, 4)) & MASK64
      b = ((wyR(buf, len - 4, 4) << 32n) | wyR(buf, len - 4 - q, 4)) & MASK64
    } else if (len > 0) { a = (BigInt(buf[0]!) << 16n) | (BigInt(buf[len >> 1]!) << 8n) | BigInt(buf[len - 1]!); b = 0n }
    else { a = 0n; b = 0n }
  } else {
    let i = 0
    if (len >= 48) {
      while (i + 48 < len) {
        for (let j = 0; j < 3; j++) {
          const st = [s0, s1, s2]
          st[j] = wyMix((wyR(buf, i + 16 * j, 8) ^ WY[j + 1]!) & MASK64, (wyR(buf, i + 16 * j + 8, 8) ^ st[j]!) & MASK64)
          ;[s0, s1, s2] = st as [bigint, bigint, bigint]
        }
        i += 48
      }
      s0 = (s0 ^ s1 ^ s2) & MASK64
    }
    const rem = buf.subarray(i)
    for (let ri = 0; ri + 16 < rem.length; ri += 16) s0 = wyMix((wyR(rem, ri, 8) ^ WY[1]!) & MASK64, (wyR(rem, ri + 8, 8) ^ s0) & MASK64)
    a = wyR(buf, len - 16, 8); b = wyR(buf, len - 8, 8)
  }
  a = (a ^ WY[1]!) & MASK64; b = (b ^ s0) & MASK64
  ;[a, b] = wyMum(a, b)
  return wyMix((a ^ WY[0]! ^ BigInt(len)) & MASK64, (b ^ WY[1]!) & MASK64)
}
const mulberry32 = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
export type Rarity = (typeof RARITIES)[number]
const RARITY_WEIGHT = { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 }
const RARITY_FLOOR = { common: 5, uncommon: 15, rare: 25, epic: 35, legendary: 50 }
export const STAT_NAMES = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK'] as const
export type Buddy = { rarity: Rarity; species: string; eye: string; hat: string; shiny: boolean; stats: Record<string, number> }
const rolled = new Map<string, Buddy>()
/** The buddy Claude Code hatched for this account id (oauthAccount.accountUuid, else userID). */
export const rollBuddy = (userId: string): Buddy => {
  const hit = rolled.get(userId)
  if (hit) return hit
  const rng = mulberry32(Number(wyhash(userId + 'friend-2026-401') & 0xffffffffn))
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng() * xs.length)]!
  let roll = rng() * 100, rarity: Rarity = 'common'
  for (const r of RARITIES) { roll -= RARITY_WEIGHT[r]; if (roll < 0) { rarity = r; break } }
  const species = pick(PET_SPECIES), eye = pick(PET_EYES), hat = rarity === 'common' ? 'none' : pick(Object.keys(PET_HATS))
  const shiny = rng() < 0.01
  const peak = pick(STAT_NAMES)
  let dump = pick(STAT_NAMES)
  while (dump === peak) dump = pick(STAT_NAMES)
  const floor = RARITY_FLOOR[rarity], stats: Record<string, number> = {}
  for (const n of STAT_NAMES)
    stats[n] = n === peak ? Math.min(100, floor + 50 + Math.floor(rng() * 30))
      : n === dump ? Math.max(1, floor - 10 + Math.floor(rng() * 15)) : floor + Math.floor(rng() * 40)
  const b = { rarity, species, eye, hat, shiny, stats }
  rolled.set(userId, b)
  return b
}
/** The id Claude Code seeded the roll with, from ~/.claude.json. */
export const buddyIdOf = (claudeJson: string): string => {
  try {
    const d = JSON.parse(claudeJson) as { oauthAccount?: { accountUuid?: string }; userID?: string }
    return d.oauthAccount?.accountUuid ?? d.userID ?? 'anon'
  } catch { return 'anon' }
}

/** The one argument that says what a tool call did: the command, the file, the pattern… */
export const toolArg = (input: Record<string, unknown>): string => {
  for (const k of ['command', 'file_path', 'notebook_path', 'pattern', 'path', 'url', 'query', 'description', 'prompt', 'skill'])
    if (typeof input[k] === 'string') return input[k] as string
  return JSON.stringify(input)
}

// ---- memo: /command suggestions while typing --------------------------------------------------------

/** The `/name` being typed at the end of `text`, without its slash; undefined when none is. */
export const cmdQuery = (text: string): string | undefined => /(?:^|\s)\/([\w:.-]*)$/.exec(text)?.[1]
/** `text` with the `/name` being typed completed to `/<name> `. */
export const completeCmd = (text: string, name: string): string => text.replace(/\/[\w:.-]*$/, `/${name} `)
/** The commands a query names, best first: by name start, then a part after ':' starting it, then anywhere. */
export const suggestCmds = <T extends { name: string }>(cmds: readonly T[], q: string, max = 6): T[] => {
  const s = q.toLowerCase(), rank = (n: string) => {
    const l = n.toLowerCase()
    return l.startsWith(s) ? 0 : l.split(':').some(p => p.startsWith(s)) ? 1 : l.includes(s) ? 2 : 3
  }
  return cmds.map(c => ({ c, r: rank(c.name) })).filter(x => x.r < 3).sort((a, b) => a.r - b.r || a.c.name.length - b.c.name.length).slice(0, max).map(x => x.c)
}
