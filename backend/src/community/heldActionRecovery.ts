import { createHash } from 'crypto';

import { Prisma } from '@prisma/client';
import {
    ChannelType,
    ChatInputCommandInteraction,
    Client,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';

import { db } from '../db';
import { toInputJson } from '../utils/prismaJson';

import { ticketConfig } from './config';
import { ticketOverwrites } from './tickets';

const recoveryKinds = ['role-choice', 'ticket-action'] as const;
type RecoveryKind = (typeof recoveryKinds)[number];
type Evidence = Record<string, unknown>;

function isUnknownChannel(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === 10003
    );
}

async function currentTicketChannel(
    client: Client,
    guildId: string,
    ticketId: string,
    channelId: string | null,
    actionKind: string
) {
    const guild = await client.guilds.fetch({ guild: guildId, force: true });
    let channel = null;
    if (channelId)
        try {
            channel = await guild.channels.fetch(channelId, { force: true });
        } catch (error) {
            if (!isUnknownChannel(error)) throw error;
        }
    if (!channel && actionKind === 'open') {
        const matches = (await guild.channels.fetch()).filter(
            (candidate) =>
                candidate?.type === ChannelType.GuildText &&
                candidate.topic === `Backline ticket ${ticketId}`
        );
        if (matches.size > 1)
            throw new Error('Multiple channels have this ticket marker');
        channel = matches.first() ?? null;
    }
    return { guild, channel };
}

function digest(evidence: Evidence): string {
    return createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

function actionId(value: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value))
        throw new Error('Action ID must be a UUID');
    return value;
}

function sorted(value: Iterable<string>): string[] {
    return [...value].sort();
}

function normalizeOverwrite(overwrite: {
    id: string;
    type: number;
    allow: { bitfield: bigint };
    deny: { bitfield: bigint };
}) {
    return {
        id: overwrite.id,
        type: overwrite.type,
        allow: overwrite.allow.bitfield.toString(),
        deny: overwrite.deny.bitfield.toString(),
    };
}

function expectedOverwrites(
    guildId: string,
    botId: string,
    participants: string[],
    staffRoles: string[],
    closed: boolean
) {
    const entries = ticketOverwrites(
        guildId,
        botId,
        participants,
        staffRoles,
        closed
    ).reduce<
        Map<string, { id: string; type: number; allow: bigint; deny: bigint }>
    >((entries, overwrite) => {
        const id = String(overwrite.id);
        const entry = entries.get(id) ?? {
            id,
            type: overwrite.type,
            allow: BigInt(0),
            deny: BigInt(0),
        };
        if ('allow' in overwrite)
            entry.allow = overwrite.allow.reduce(
                (mask: bigint, bit: bigint) => mask | bit,
                BigInt(0)
            );
        if ('deny' in overwrite)
            entry.deny = overwrite.deny.reduce(
                (mask: bigint, bit: bigint) => mask | bit,
                BigInt(0)
            );
        entries.set(id, entry);
        return entries;
    }, new Map());
    return Array.from(entries.values())
        .map((overwrite) => ({
            ...overwrite,
            allow: overwrite.allow.toString(),
            deny: overwrite.deny.toString(),
        }))
        .sort((a, b) => a.id.localeCompare(b.id));
}

function strings(value: Prisma.JsonValue): string[] {
    return Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : [];
}

async function inspectRoleChoice(client: Client, guildId: string, id: string) {
    const choice = await db.roleChoice.findFirstOrThrow({
        where: {
            id,
            guildId,
            state: 'UNCERTAIN',
        },
    });
    const lock = await db.roleChoiceLock.findUnique({
        where: { guildId_userId: { guildId, userId: choice.userId } },
    });
    if (!lock || lock.actionId !== choice.id)
        throw new Error('Role choice is no longer held');
    const guild = await client.guilds.fetch({ guild: guildId, force: true });
    const member = await guild.members.fetch({
        user: choice.userId,
        force: true,
    });
    return {
        kind: 'role-choice' as const,
        actionId: choice.id,
        state: choice.state,
        requestId: choice.requestId,
        userId: choice.userId,
        detail: choice.detail,
        observedRoleIds: sorted(member.roles.cache.keys()),
    };
}

function ticketDesired(
    ticket: {
        participants: Prisma.JsonValue;
        staffRoles: Prisma.JsonValue;
        state: string;
        openerId: string;
    },
    action: { kind: string; actorId: string }
): {
    participants: string[];
    state: 'OPEN' | 'CLOSED' | 'EXPIRED';
    channelExpected: boolean;
} | null {
    const participants = new Set(strings(ticket.participants));
    switch (action.kind) {
        case 'open':
            return {
                participants: [ticket.openerId],
                state: 'OPEN',
                channelExpected: true,
            };
        case 'close':
            return {
                participants: sorted(participants),
                state: 'CLOSED',
                channelExpected: true,
            };
        case 'reopen':
            return {
                participants: sorted(participants),
                state: 'OPEN',
                channelExpected: true,
            };
        case 'add':
            // Legacy held actions do not retain an add target, so they remain
            // inspection-only. A later schema version can safely support it.
            return null;
        case 'remove':
            return null;
        case 'expire':
            return {
                participants: sorted(participants),
                state: 'EXPIRED',
                channelExpected: false,
            };
        default:
            return null;
    }
}

async function inspectTicketAction(
    client: Client,
    guildId: string,
    id: string
) {
    const action = await db.ticketAction.findFirstOrThrow({
        where: { id, guildId, state: 'UNCERTAIN' },
    });
    const ticket = await db.supportTicket.findFirstOrThrow({
        where: { id: action.ticketId, guildId, heldActionId: action.id },
    });
    const { channel } = await currentTicketChannel(
        client,
        guildId,
        ticket.id,
        ticket.channelId,
        action.kind
    );
    const evidence: Evidence = {
        kind: 'ticket-action',
        actionId: action.id,
        ticketId: ticket.id,
        action: action.kind,
        actionState: action.state,
        ticketState: ticket.state,
        channel: channel
            ? {
                  id: channel.id,
                  type: channel.type,
                  topic:
                      channel.type === ChannelType.GuildText
                          ? channel.topic
                          : null,
                  overwrites:
                      channel.type === ChannelType.GuildText
                          ? channel.permissionOverwrites.cache
                                .map(normalizeOverwrite)
                                .sort((a, b) => a.id.localeCompare(b.id))
                          : [],
              }
            : null,
    };
    return { ...evidence, evidenceHash: digest(evidence) };
}

export async function inspectHeldAction(
    client: Client,
    guildId: string,
    kind: RecoveryKind,
    id: string
) {
    const inspected =
        kind === 'role-choice'
            ? await inspectRoleChoice(client, guildId, id)
            : await inspectTicketAction(client, guildId, id);
    const evidence = { ...inspected } as Evidence;
    return { ...inspected, evidenceHash: digest(evidence) };
}

export async function confirmHeldAction(
    client: Client,
    guildId: string,
    kind: RecoveryKind,
    id: string,
    evidenceHash: string,
    actorId: string
) {
    const inspected = await inspectHeldAction(client, guildId, kind, id);
    if (inspected.evidenceHash !== evidenceHash)
        throw new Error(
            'Discord changed since inspection; inspect again before confirming'
        );
    if (kind === 'role-choice') {
        const evidence = inspected as unknown as Evidence;
        return db.$transaction(
            async (tx) => {
                const choice = await tx.roleChoice.findFirstOrThrow({
                    where: { id, guildId, state: 'UNCERTAIN' },
                });
                const lock = await tx.roleChoiceLock.findUnique({
                    where: {
                        guildId_userId: { guildId, userId: choice.userId },
                    },
                });
                if (!lock || lock.actionId !== choice.id)
                    throw new Error('Role choice is no longer held');
                const reconciled = await tx.roleChoice.updateMany({
                    where: { id, guildId, state: 'UNCERTAIN' },
                    data: {
                        state: 'RECONCILED',
                        detail: 'Operator confirmed current Discord role readback',
                        outcome: toInputJson({
                            reconciledRoleIds: (
                                inspected as Awaited<
                                    ReturnType<typeof inspectRoleChoice>
                                >
                            ).observedRoleIds,
                            evidenceHash,
                        }),
                    },
                });
                if (reconciled.count !== 1)
                    throw new Error('Role choice changed during confirmation');
                const released = await tx.roleChoiceLock.deleteMany({
                    where: {
                        guildId,
                        userId: choice.userId,
                        actionId: choice.id,
                    },
                });
                if (released.count !== 1)
                    throw new Error(
                        'Role choice lock changed during confirmation'
                    );
                await tx.heldActionReceipt.create({
                    data: {
                        guildId,
                        kind,
                        actionId: id,
                        actorId,
                        evidence: toInputJson(evidence),
                        evidenceHash,
                    },
                });
                return { state: 'RECONCILED' };
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
    }
    const ticketAction = await db.ticketAction.findFirstOrThrow({
        where: { id, guildId, state: 'UNCERTAIN' },
    });
    const ticket = await db.supportTicket.findFirstOrThrow({
        where: { id: ticketAction.ticketId, guildId, heldActionId: id },
    });
    const desired = ticketDesired(ticket, ticketAction);
    if (!desired)
        throw new Error(
            'This legacy ticket action lacks the target needed for safe reconciliation'
        );
    const settings = await db.guildModuleConfig.findUnique({
        where: { guildId_moduleId: { guildId, moduleId: 'tickets' } },
    });
    if (!settings)
        throw new Error('Ticket settings unavailable for reconciliation');
    const retention = ticketConfig.parse(settings.config).retentionDays;
    const { guild, channel } = await currentTicketChannel(
        client,
        guildId,
        ticket.id,
        ticket.channelId,
        ticketAction.kind
    );
    if (desired.channelExpected) {
        if (!channel || channel.type !== ChannelType.GuildText)
            throw new Error(
                'Current channel does not prove the held ticket action'
            );
        if (channel.topic !== `Backline ticket ${ticket.id}`)
            throw new Error(
                'Current channel marker does not match the held ticket'
            );
        const bot = await guild.members.fetchMe({ force: true });
        const actual = channel.permissionOverwrites.cache
            .map(normalizeOverwrite)
            .sort((a, b) => a.id.localeCompare(b.id));
        const expected = expectedOverwrites(
            guildId,
            bot.id,
            desired.participants,
            strings(ticket.staffRoles),
            desired.state === 'CLOSED'
        );
        if (JSON.stringify(actual) !== JSON.stringify(expected))
            throw new Error(
                'Current channel overwrites do not prove the held action'
            );
    } else if (channel) {
        throw new Error('Current channel exists; expiry cannot be reconciled');
    }
    const evidence = await inspectHeldAction(client, guildId, kind, id);
    if (evidence.evidenceHash !== evidenceHash)
        throw new Error('Discord changed during confirmation; inspect again');
    return db.$transaction(
        async (tx) => {
            const current = await tx.supportTicket.findFirstOrThrow({
                where: { id: ticket.id, guildId, heldActionId: id },
            });
            const reconciled = await tx.ticketAction.updateMany({
                where: { id, guildId, state: 'UNCERTAIN' },
                data: {
                    state: 'RECONCILED',
                    detail: 'Operator confirmed current Discord ticket readback',
                },
            });
            if (reconciled.count !== 1)
                throw new Error('Ticket action changed during confirmation');
            const released = await tx.supportTicket.updateMany({
                where: { id: current.id, guildId, heldActionId: id },
                data: {
                    heldActionId: null,
                    channelId: channel?.id ?? null,
                    participants: desired.participants,
                    state: desired.state,
                    closedAt:
                        desired.state === 'CLOSED'
                            ? new Date()
                            : desired.state === 'OPEN'
                              ? null
                              : current.closedAt,
                    expiresAt:
                        desired.state === 'CLOSED'
                            ? current.expiresAt &&
                              current.expiresAt > new Date()
                                ? current.expiresAt
                                : new Date(Date.now() + retention * 86400000)
                            : desired.state === 'OPEN'
                              ? null
                              : current.expiresAt,
                },
            });
            if (released.count !== 1)
                throw new Error('Ticket hold changed during confirmation');
            await tx.heldActionReceipt.create({
                data: {
                    guildId,
                    kind,
                    actionId: id,
                    actorId,
                    evidence: toInputJson(evidence),
                    evidenceHash,
                },
            });
            return { state: 'RECONCILED' };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
}

export async function listHeldActions(guildId: string) {
    const [roles, tickets] = await Promise.all([
        db.roleChoice.findMany({
            where: {
                guildId,
                state: 'UNCERTAIN',
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        }),
        db.ticketAction.findMany({
            where: { guildId, state: 'UNCERTAIN' },
            orderBy: { createdAt: 'desc' },
            take: 100,
        }),
    ]);
    const locks = await db.roleChoiceLock.findMany({
        where: { guildId, actionId: { in: roles.map((choice) => choice.id) } },
    });
    const held = new Set(locks.map((lock) => lock.actionId));
    return {
        roleChoices: roles.filter((choice) => held.has(choice.id)),
        ticketActions: tickets,
    };
}

export const recoveryCommand = new SlashCommandBuilder()
    .setName('recovery')
    .setDescription('Inspect and reconcile held Backline actions')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
        subcommand
            .setName('inspect')
            .setDescription('Read current Discord state for a held action')
            .addStringOption((option) =>
                option
                    .setName('kind')
                    .setDescription('Held action type')
                    .setRequired(true)
                    .addChoices(
                        ...recoveryKinds.map((kind) => ({
                            name: kind,
                            value: kind,
                        }))
                    )
            )
            .addStringOption((option) =>
                option
                    .setName('action-id')
                    .setDescription('Held action UUID')
                    .setRequired(true)
            )
    )
    .addSubcommand((subcommand) =>
        subcommand
            .setName('confirm-current')
            .setDescription(
                'Reconcile a held action only when fresh evidence matches'
            )
            .addStringOption((option) =>
                option
                    .setName('kind')
                    .setDescription('Held action type')
                    .setRequired(true)
                    .addChoices(
                        ...recoveryKinds.map((kind) => ({
                            name: kind,
                            value: kind,
                        }))
                    )
            )
            .addStringOption((option) =>
                option
                    .setName('action-id')
                    .setDescription('Held action UUID')
                    .setRequired(true)
            )
            .addStringOption((option) =>
                option
                    .setName('evidence')
                    .setDescription('Evidence hash from /recovery inspect')
                    .setRequired(true)
                    .setMinLength(64)
                    .setMaxLength(64)
            )
    )
    .setContexts(0)
    .setIntegrationTypes(0)
    .toJSON();

export async function routeHeldActionRecovery(
    interaction: ChatInputCommandInteraction
): Promise<boolean> {
    if (interaction.commandName !== 'recovery') return false;
    const guild = await interaction.client.guilds.fetch({
        guild: interaction.guildId!,
        force: true,
    });
    const actor = await guild.members.fetch({
        user: interaction.user.id,
        force: true,
    });
    if (
        guild.ownerId !== actor.id &&
        !actor.permissions.has(PermissionFlagsBits.Administrator) &&
        !actor.permissions.has(PermissionFlagsBits.ManageGuild)
    )
        throw new Error('Current Manage Server permission is required');
    const kind = interaction.options.getString('kind', true) as RecoveryKind;
    const id = actionId(interaction.options.getString('action-id', true));
    if (interaction.options.getSubcommand() === 'inspect') {
        const inspection = await inspectHeldAction(
            interaction.client,
            interaction.guildId!,
            kind,
            id
        );
        await interaction.editReply(
            `Held ${kind} ${id}: ${JSON.stringify(inspection)}`
        );
        return true;
    }
    const evidenceHash = interaction.options.getString('evidence', true);
    const result = await confirmHeldAction(
        interaction.client,
        interaction.guildId!,
        kind,
        id,
        evidenceHash,
        interaction.user.id
    );
    await interaction.editReply(
        `Held ${kind} ${id} is ${result.state}. A recovery receipt was retained.`
    );
    return true;
}
