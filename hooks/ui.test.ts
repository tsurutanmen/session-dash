import { expect, mock, test } from 'claude-code/testing'

test('the pane draws before anything has happened, on every surface', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-dash', surface, component: 'Pane', requestId: 'session-dash', props: {} })
    expect(await ui.find({ type: 'Text', text: /使用量/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /裏の作業/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /セッション/ })).toBeDefined()
    await ui.unmount()
  }
})

test('work the engine reports at a stop shows in the pane', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  on('classic.Stop', () => ({}))
  await $.classic.Stop({
    stop_hook_active: false,
    background_tasks: [{ id: 't1', type: 'shell', status: 'running', description: 'スクショを撮る' }],
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-dash', surface, component: 'Pane', requestId: 'session-dash', props: {} })
    expect(await ui.find({ type: 'Text', text: /スクショを撮る/ })).toBeDefined()
    await ui.unmount()
  }
})

test('the band stays out of the way while there is nothing to show', async ($, on) => {
  mock.clock(on, { now: 1_800_000_000_000 })
  // the engine's own band, which the mod leaves in place
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, {}, 'engine band')
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-dash', surface, component: 'AbovePrompt', props: {} })
    expect(await ui.find({ key: 'hide' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /engine band/ })).toBeDefined()
    await ui.unmount()
  }
})
