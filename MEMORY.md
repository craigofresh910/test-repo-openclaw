# MEMORY

## Preferences / operating modes
- User wants a "CODING MODEL DELEGATOR MODE": read coding request → select best model from set (gpt-4.1-nano/mini/4.1/5.2/5.2-codex) using provided rules → execute with that model → return output in strict coding format. Do not mention model choice; ask at most one question if essential; do not repeat request; output must include Commands, Changed files, Code (diff/full). If uncertain, choose gpt-4.1-mini. (2026-02-09)
- "Da vault" refers to Apple Notes entry where user stores credentials (e.g., Ducksurfer). Do not store secrets in memory. (2026-02-09)
- When credentials or server info are needed, check "Da vault" in Apple Notes instead of asking for secrets. Do not store secrets in memory. (2026-02-13)
- Ducksurfer is the hosting site; BullCircle is hosted under the Ducksurfer server filesystem. Base path is /var/www/ducksurfer. Website assets appear under /var/www/ducksurfer/<account-id>/<site-id> and symlinked via /var/www/ducksurfer/storage/websites/<account-id> (e.g., f71facd0-4d2e-4aad-8196-89c788ca1cf8). BullCircle site-id: 3c4b9b30-fff0-40aa-8ad1-c813c9e1b7cb. (2026-02-13)
- Use AppleScript with Mail.app to send test emails when asked (send/compose via osascript). (2026-02-09)
- User wants the response to include which model provided the answer, every time. (2026-02-10)
- For sites with backend outside the websites folder, create a read-only symlink inside the site root (e.g., `_server_api`) so it’s visible in DuckSurfer file manager without serving it publicly. (2026-02-14)
