# Private support tickets

The opt-in tickets module creates a private text channel with a complete overwrite list: deny View Channel to everyone, then allow the opener, invited participants, configured staff roles and the bot. Server owners and administrators retain Discord's inherent access. Category selection changes placement without copying its overwrites. This implementation uses text channels; private thread tickets are not yet implemented. Discord documents channel creation and permission overwrites in its [Guild API](https://github.com/discord/discord-api-docs/blob/main/developers/resources/guild.mdx).

Configure category, panel destination, staff roles, capacity and retention in Servers. Configuration requires current Manage Server, Manage Channels and Manage Roles permissions. Use `/ticket-panel` to publish a button or `/ticket open` to open directly. A member may have one open or pending ticket. Capacity counts open, closed and uncertain creations, with at most 1000 retained ticket records per server.

Inside the ticket, staff may claim/release, add/remove participants, close and reopen. Participants may close their ticket and request a transcript. Each action checks current membership and access; unrelated members cannot export a ticket. Claims persist in the database. Changing staff roles is blocked while retained channels exist, so existing channels do not silently keep an obsolete staff policy. Removing a server role or its membership takes effect through Discord's current permissions.

Closing removes participant Send Messages permission. Closed channels expire after 1–90 days; the bot verifies both the stored channel ID and its ticket marker before deleting it. Disabling the module pauses channel deletion and new actions. Local transcripts expire regardless of module enablement. Completed ticket metadata expires after 90 days; held actions remain for investigation.

Transcripts fetch at most ten pages of 100 messages and mark a full 1000-message result as potentially truncated. Content is excluded by default and requires both explicit retention and Message Content intent. Attachments are not downloaded. Downloaded JSON files remain with their recipients. Turning off content retention removes local transcripts that contained content; it cannot recall downloads.

Requests reserve an action and ticket lock before Discord mutations. Concurrent opens reserve one channel, duplicate interaction IDs do not replay actions, and lost responses retain a hold. A crash during creation or overwrite changes requires operator investigation. Compare the exact ticket ID, channel marker, action and actual Discord permissions before resolving a hold; never clear it merely to retry. An operator recovery UI, natural member testing and private thread tickets remain qualification work.

## Held-action recovery

Server owners, administrators and members with Manage Server can list `UNCERTAIN` records through `GET /guilds/:guildId/modules/recovery/held-actions`. The API is an inventory only; it never clears a lock or performs a Discord mutation. `PENDING` actions may still have an active worker, so they are never eligible for this recovery path.

Use the bot in the affected server for the live workflow:

1. Run `/recovery inspect kind:ticket-action action-id:<UUID>`. It fetches the current channel, checks the `Backline ticket <ticket UUID>` marker, returns current overwrites and prints an evidence hash.
2. Compare the receipt with the held action. For an open, close, reopen or expiry action, confirm that the current channel and overwrite set prove the expected outcome. Held legacy add/remove actions remain inspection-only because their target was not stored in the original action record.
3. Run `/recovery confirm-current` with the same kind, action ID and evidence hash. Backline fetches Discord again. If anything changed, it rejects the confirmation. If the expected current state still matches, it records an immutable recovery receipt, marks the action `RECONCILED`, and releases only that ticket's held action.

This procedure does not retry a create, overwrite or delete. A missing marker, changed overwrite, stale evidence hash or failed Discord readback leaves the hold in place for further investigation.
