import type { Register } from 'claude-code'

import type { DashLimit, DashPeer, DashTask } from '../types'

const PANE = 'session-dash'
// What the pane and band draw. Kept in the module: a reload starts it over and session.start fills it again.
const M: { tasks: DashTask[]; peers: DashPeer[]; limits: DashLimit[]; isBandHidden: boolean } =
  { tasks: [], peers: [], limits: [], isBandHidden: false }

const FILE_TOOLS: Record<string, string> = { Read: 'file_path', Edit: 'file_path', Write: 'file_path', NotebookEdit: 'notebook_path', Grep: 'path', Glob: 'path' }
const SHOW_FOR_MS = 3 * 60 * 60 * 1000

// Cut to a width in terminal cells, counting wide (CJK) characters as two.
function fit(text: string, cells: number): string {
  let out = ''
  let used = 0
  for (const ch of text) {
    const w = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1
    if (used + w > cells) return out.length < text.length ? out.slice(0, -1) + '…' : out
    out += ch
    used += w
  }
  return out
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}秒前`
  if (s < 3600) return `${Math.round(s / 60)}分前`
  return `${Math.round(s / 3600)}時間前`
}

function base(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path
}

function limitLabel(kind: string): string {
  return kind === 'five_hour' ? '5時間' : kind === 'seven_day' ? '週' : kind
}

// Module state: starts over on a reload, which is fine (session.start runs again).
const S: { dir: string; selfId: string; self: DashPeer | null; lastWrite: number } = { dir: '', selfId: '', self: null, lastWrite: 0 }

async function writeSelf($: any, patch: Partial<DashPeer>, force = false) {
  if (!S.dir || !S.self) return
  S.self = { ...S.self, ...patch, at: await $.clock.now() }
  const now = S.self.at
  if (!force && now - S.lastWrite < 3000) return
  S.lastWrite = now
  await $.fs.write(`${S.dir}/sessions/${S.selfId}.json`, JSON.stringify(S.self))
}

async function loadPeers($: any): Promise<DashPeer[] | null> {
  if (!S.dir) return null
  const now = await $.clock.now()
  let entries: { name: string; kind: string }[] = []
  try {
    entries = await $.fs.list(`${S.dir}/sessions`)
  } catch {
    return null
  }
  const found: DashPeer[] = []
  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    try {
      const peer = JSON.parse(await $.fs.read(`${S.dir}/sessions/${entry.name}`)) as DashPeer
      if (!peer.isEnded && now - peer.at < SHOW_FOR_MS) found.push(peer)
    } catch {
      // a file another session is writing right now; next tick reads it
    }
  }
  found.sort((a, b) => b.at - a.at)
  return found
}

async function loadLimits($: any): Promise<DashLimit[] | null> {
  try {
    const usage = await $.session.usage()
    const list: DashLimit[] = usage.rateLimits.map((r: DashLimit) => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt }))
    return list
  } catch {
    return null // usage is not reported in every mode
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    const home = ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '').replace(/\\/g, '/')
    if (home) S.dir = `${home}/.claude/session-dash`
    S.selfId = await $.session.id()
    S.self = { id: S.selfId, cwd: await $.session.cwd(), prompt: '', tool: '', file: '', at: await $.clock.now(), isEnded: false }
    await writeSelf($, {}, true)

    await $.command.register({ name: 'dash', description: '使用量・裏の作業・各セッションの作業ファイルのパネルを開く' })
    void $.ui.open({ id: PANE, title: 'セッション' })

    const syncPeers = async () => { const l = await loadPeers($); if (l) { M.peers = l; $.ui.invalidate('ui.render') } }
    const syncLimits = async () => { const l = await loadLimits($); if (l) { M.limits = l; $.ui.invalidate('ui.render'); if (S.dir) await $.fs.write(`${S.dir}/limits.json`, JSON.stringify(l)) } }
    void syncPeers()
    void syncLimits()
    $.clock.every(5000, () => void syncPeers())
    $.clock.every(60000, () => void syncLimits())

    return ran
  })

  on('command.run', { command: 'dash' }, async $ => {
    await $.ui.open({ id: PANE, title: 'セッション' })
    return { text: 'パネルを開きました。' }
  })

  on('prompt.submit', async ($, e, next) => {
    await writeSelf($, { prompt: e.text.replace(/\s+/g, ' ').slice(0, 80) }, true)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const key = FILE_TOOLS[e.tool]
    const path = key ? (e as Record<string, unknown>)[key] : undefined
    if (typeof path === 'string' && path) {
      await writeSelf($, { tool: e.tool, file: path })
    }
    const isBackground = (e as Record<string, unknown>).run_in_background === true
    const ran = await next(e)
    if (isBackground && !ran.deny) {
      const label = String((e as Record<string, unknown>).description ?? (e as Record<string, unknown>).command ?? e.tool)
      const task: DashTask = { id: e.tool_use_id, kind: e.tool === 'Bash' ? 'shell' : e.tool === 'Agent' ? 'subagent' : e.tool, label, startedAt: await $.clock.now() }
      M.tasks = [...M.tasks, task].slice(-30)
      $.ui.invalidate('ui.render')
    }
    return ran
  })

  // The engine's own list of work still in flight, each time a turn stops.
  on('classic.Stop', async ($, e, next) => {
    const now = await $.clock.now()
    const live = (e.background_tasks ?? []).map(t => ({
      id: t.id,
      kind: t.type,
      label: t.description || t.command || t.name || t.type,
      startedAt: now,
    }))
    M.tasks = live.map(t => ({ ...t, startedAt: M.tasks.find(o => o.label === t.label)?.startedAt ?? t.startedAt }))
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await writeSelf($, { isEnded: true }, true)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = M.limits
    if (e.props.hasSurvey || M.isBandHidden || list.length === 0) {
      return next(e)
    }
    const { Box, Button, Text } = $.ui.resolve(e)
    const parts = list.map(l => `${limitLabel(l.kind)} ${Math.round(l.percentUsed)}%`)
    const high = list.some(l => l.percentUsed >= 80)
    return (
      <Box>
        <Text color={high ? 'red' : undefined} dimColor={!high}>
          {fit(parts.join('・'), Math.max(10, (e.props.bodyColumns ?? 80) - 10))}{' '}
        </Text>
        <Button key="hide" label="隠す" onPress={() => { M.isBandHidden = true; $.ui.invalidate('ui.render') }} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const cols = Math.max(20, e.props.bodyColumns ?? 60)
    const now = await $.clock.now()
    const lim = M.limits
    const work = M.tasks
    const all = M.peers

    return (
      <Box flexDirection="column">
        <Text bold>使用量</Text>
        {lim.length === 0 && <Text dimColor>まだありません</Text>}
        {lim.map(l => (
          <Text color={l.percentUsed >= 80 ? 'red' : undefined}>
            {fit(`${limitLabel(l.kind)} ${Math.round(l.percentUsed)}%${l.resetsAt ? `（${l.resetsAt.slice(5, 16).replace('T', ' ')} リセット）` : ''}`, cols)}
          </Text>
        ))}
        <Text> </Text>
        <Text bold>裏の作業 {work.length > 0 ? `(${work.length})` : ''}</Text>
        {work.length === 0 && <Text dimColor>なし</Text>}
        {work.map(t => (
          <Text>{fit(`${t.kind === 'shell' ? '⚙' : t.kind === 'subagent' ? '◆' : '・'} ${t.label}　${ago(now - t.startedAt)}`, cols)}</Text>
        ))}
        <Text> </Text>
        <Text bold>セッション ({all.length})</Text>
        {all.length === 0 && <Text dimColor>なし</Text>}
        {all.map(p => (
          <Box flexDirection="column">
            <Text color={p.id === S.selfId ? 'cyan' : undefined}>
              {fit(`${p.id === S.selfId ? '▶ ' : ''}${base(p.cwd)}　${ago(now - p.at)}`, cols)}
            </Text>
            {p.file ? <Text dimColor>{fit(`  ${p.tool} ${base(p.file)}`, cols)}</Text> : null}
            {p.prompt ? <Text dimColor>{fit(`  「${p.prompt}」`, cols)}</Text> : null}
          </Box>
        ))}
      </Box>
    )
  })
}
