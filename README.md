# session-dash

A Claude Code mod with two parts:

- **A band above the prompt** with your usage limits, for example `5時間 42%・週 18%`. It turns red at 80%. The 隠す button hides it for the session.
- **A pane** (`/dash`) with the usage limits and when they reset, the background work running in this session (shell commands, subagents), and every open Claude Code session on this PC: its folder, the file it last touched, its last prompt.

The labels are in Japanese. Made on Windows 11 with Claude Code 2.1.286 (the version with function-hook plugins, "mods"). The tests in `hooks/ui.test.ts` draw it for both the terminal and the desktop app (`claude plugin test .`).

## Install

In Claude Code:

```
/plugin marketplace add tsurutanmen/session-dash
/plugin install session-dash@session-dash
```

Open a new session to see it.

## What it writes

Each session writes a small file to `~/.claude/session-dash/sessions/<session id>.json`: its folder, the last tool and file, and the first 80 characters of the last prompt. That is how sessions see each other. Nothing leaves your PC. Delete the folder to clear it.

The usage limits come from Claude Code itself. They are also copied to `~/.claude/session-dash/limits.json`, so other local programs (a desktop wallpaper, for example) can show them.

## Related

Five tools that work together, all MIT:

| | |
|---|---|
| [homedot](https://github.com/tsurutanmen/homedot) | A Dots-style personal agent on Claude Code, in a WSL2 VM on your own PC |
| [session-bridge](https://github.com/tsurutanmen/session-bridge) | Let open Claude Code sessions talk to each other, hold meetings, and answer your voice |
| [claude-desk](https://github.com/tsurutanmen/claude-desk) | "Hey Claude" voice listener with VOICEVOX replies, and a desktop wallpaper of your sessions |
| [homedot-panel](https://github.com/tsurutanmen/homedot-panel) | homedot and the 5-hour limit in Claude Code's status line |
| [session-dash](https://github.com/tsurutanmen/session-dash) | Usage limits above the prompt, and every open session in one pane |

More Claude Code plugins: [tsurutanmen/claude-plugins](https://github.com/tsurutanmen/claude-plugins)

## License

MIT

---

# session-dash（日本語）

Claude Code の mod です。2つのものを出します。

- **入力欄の上の帯**：使用量の上限を出します。たとえば `5時間 42%・週 18%`。80% を超えると赤くなります。「隠す」を押すと、そのセッションでは消えます。
- **パネル**（`/dash`）：使用量とリセットの時刻、このセッションの裏で動いている作業（シェルのコマンド・サブエージェント）、このPCで開いている Claude Code のセッション全部を出します。セッションごとに、フォルダ、最後にさわったファイル、最後のプロンプトが見えます。

Windows 11 と Claude Code 2.1.286 で作りました。`hooks/ui.test.ts` のテストで、ターミナルとデスクトップアプリの両方の描き方を確かめています（`claude plugin test .`）。

## 入れ方

Claude Code で次の2行を打ちます。

```
/plugin marketplace add tsurutanmen/session-dash
/plugin install session-dash@session-dash
```

新しいセッションを開くと出ます。

## 書き込むもの

各セッションは `~/.claude/session-dash/sessions/<セッションid>.json` に小さなファイルを書きます。中身はフォルダ、最後の道具とファイル、最後のプロンプトの先頭80文字です。セッション同士はこれで互いを見ています。PCの外には何も出しません。消したいときはフォルダごと消してください。

使用量は Claude Code 自身が出す数字です。`~/.claude/session-dash/limits.json` にも写すので、ほかのプログラム（デスクトップの壁紙など）からも読めます。

## ライセンス

MIT
