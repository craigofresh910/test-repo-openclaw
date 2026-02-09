# Token Plan (Cost-Aware Usage Guide)

## Goals
- Minimize token spend without degrading outcomes.
- Use the smallest model that reliably completes the task.
- Prefer deterministic, short responses for routine work.

---

## Model Tiers (Default)
**T0 — Ultra‑cheap (triage / tiny tasks)**
- Model: `gpt-4.1-nano`
- Use for: one‑liners, formatting, quick explanations, tiny code edits.

**T1 — Daily driver (most coding / small features)**
- Model: `gpt-4.1-mini`
- Use for: normal feature work, small bug fixes, scripts, tests.

**T2 — Reliable / multi‑file**
- Model: `gpt-4.1`
- Use for: multi‑file edits, refactors, non‑trivial reasoning.

**T3 — Specialist coding**
- Model: `gpt-5.2-codex`
- Use for: complex engineering, large refactors, debugging deep issues.

**T4 — Long context / heavy reasoning**
- Model: `gpt-5.2`
- Use for: ambiguous specs, large context, mixed analysis + coding.

---

## Decision Rules (Fast)
1. **Single‑file, small diff?** → T0 or T1.
2. **Multi‑file or moderate complexity?** → T2.
3. **Large refactor / hard debug?** → T3.
4. **Needs long context or unclear spec?** → T4.
5. **If unsure** → T1.

---

## Token‑Saving Habits
- **Prefer patch diffs** over full files when possible.
- **Hard cap on file reads**: start with 200–400 lines; expand only if needed.
- **Avoid re‑reading large files** unless needed (use targeted offsets).
- **Avoid web search** unless requirements are unclear.
- **Cache context**: keep shared notes in concise files (e.g., `MEMORY.md`).
- **Limit verbose output**: prefer concise explanations + only required code.
- **Batch related requests** instead of many small iterations.
- **Stop streaming** when not needed.
- **Keep reasoning off** unless explicitly requested.

---

## Delegation Guidance (Multi‑Agent)
- Main agent triages with T1.
- Spawn sub‑agents only when complexity demands it.
- Use T0 for quick reviews / summarization of outputs.

---

## Operational Settings (Config)
- **Heartbeat interval**: 60m (local Ollama model).
- **Heartbeat model**: local `ollama/llama3.2:3b`.
- **Default model**: `gpt-4.1-mini`; escalate only when needed.

---

## Review Cadence
- Revisit monthly; adjust tiers or thresholds based on actual spend.
