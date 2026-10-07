# Self-service roles

Configure the `self-roles` module in server setup: a destination, title, buttons or selection menu, and up to 20 role options. Options can share an exclusive group and require existing roles. Configuring offered roles requires current Manage Roles permission in addition to server management access. Enable the module and run `/roles-panel` with current Manage Roles permission to publish.

Button presses toggle one offered role. Selecting a menu applies the selected offered roles and removes unselected offered roles, while preserving unrelated roles. A member can select at most one role in each exclusive group. Prerequisites are checked against the resulting role set, including existing offered roles, so removing a prerequisite cannot leave a dependent role behind.

Each panel stores its server, channel, message ID and validated configuration hash. Changing settings invalidates old controls. The handler fetches current membership, bot permissions and each changed role. Managed roles, elevated permissions and roles at or above the bot are denied even if they became privileged after publication. Only the basic chat/voice permission allowlist is eligible.

Role choices persist by server/interaction ID, so repeated delivery cannot toggle twice. A per-member database lock serializes choices. The handler reads Discord back before recording success. An interrupted mutation is `UNCERTAIN` and retains the lock; subsequent choices remain held. A crash can leave a `PENDING` choice with the same protection. Before confirming a held lock, an operator must inspect the action and current Discord roles while avoiding concurrent role-panel activity for that member. The application does not guess an outcome or clear locks automatically.

## Held-action recovery

The recovery inventory is available to current server managers at `GET /guilds/:guildId/modules/recovery/held-actions`. It exposes only `UNCERTAIN` action records and does not modify Discord or release a lock. A `PENDING` record can still belong to an active worker and is not recoverable through this path.

For the live recovery, use `/recovery inspect kind:role-choice action-id:<UUID>` in the affected server. The command fetches the member's current roles and returns an evidence hash. After independently comparing that readback with the held record, run `/recovery confirm-current` with the exact action ID and evidence hash. Backline fetches the member again before writing an immutable recovery receipt. A changed role set or a stale hash fails closed. On a match, the choice becomes `RECONCILED` and only its matching per-member lock is released.

Confirmation records the current Discord role set; it does not rerun the old add/remove request or infer a missed mutation. Operators should pause or drain concurrent role-panel activity for that member while investigating. A changed panel policy, unavailable member or failed Discord readback leaves the lock held.

Panels and choices survive restart. Publishing the same configuration returns its existing message ID; deleted panels currently require a configuration change and republish. Reaction roles are not enabled. `GET /guilds/:guildId/modules/self-roles/history` exposes the last 100 choices to current server managers. Disabling the module rejects future controls; existing messages remain in Discord.

Validation includes role policy tests and PostgreSQL tests for duplicate delivery, stale panels, changed role privileges and uncertain mutation holds. Dashboard tests save role options and exclusive groups to the selected server. Human button/select interactions and the owner recovery workflow remain qualification gates.

Live service qualification on October 4, 2026 published panel `1556409729767706705` in server `947948179897327686`, restarted the Gateway client, and applied a role choice for the existing bot member. Discord readback confirmed the panel components and temporary role assignment. The first cleanup used objects from the destroyed client and failed; exact owned fixture IDs were then removed through Discord REST. Restart also exposed a plugin-manager lifecycle defect; shutdown now clears initialization state so plugins rebind to the next client, covered by a regression test. This was an explicit fixture, not a human button/select interaction.

The rerun after those fixes published panel `1556410278155915316`, restarted with plugins reinitialized, confirmed role delivery and removed fixtures through the active client. Completed and denied choices expire locally after 90 days; held uncertain choices retain their recovery evidence.
