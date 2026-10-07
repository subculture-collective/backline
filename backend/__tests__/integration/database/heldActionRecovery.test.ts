import { ChannelType, Client, Collection } from 'discord.js';

import {
    confirmHeldAction,
    inspectHeldAction,
    listHeldActions,
} from '../../../src/community/heldActionRecovery';
import { ticketOverwrites } from '../../../src/community/tickets';
import { db } from '../../../src/db';

const databaseTests =
    process.env.RUN_DATABASE_TESTS === 'true' ? describe : describe.skip;

databaseTests('held action recovery', () => {
    const guildId = '788888888888888881';
    const userId = '788888888888888882';
    const roles = new Collection<string, unknown>([['role-a', {}]]);
    const member = { roles: { cache: roles } };
    const guild = { members: { fetch: jest.fn().mockResolvedValue(member) } };
    const client = {
        guilds: { fetch: jest.fn().mockResolvedValue(guild) },
    } as unknown as Client;

    beforeEach(() => {
        roles.clear();
        roles.set('role-a', {});
    });
    afterEach(async () => {
        await db.$executeRawUnsafe('TRUNCATE TABLE "HeldActionReceipt"');
        await db.roleChoiceLock.deleteMany({ where: { guildId } });
        await db.roleChoice.deleteMany({ where: { guildId } });
        await db.ticketAction.deleteMany({ where: { guildId } });
        await db.supportTicket.deleteMany({ where: { guildId } });
        await db.guildModuleConfig.deleteMany({ where: { guildId } });
        await db.guildInstallation.deleteMany({ where: { guildId } });
        jest.clearAllMocks();
    });
    afterAll(async () => {
        await db.$disconnect();
    });

    it('rechecks current Discord roles and records evidence before releasing one lock', async () => {
        const choice = await db.roleChoice.create({
            data: {
                guildId,
                userId,
                requestId: 'recovery-fixture',
                state: 'UNCERTAIN',
                detail: 'Role outcome requires investigation; further choices are held',
            },
        });
        await db.roleChoiceLock.create({
            data: { guildId, userId, actionId: choice.id },
        });

        const listed = await listHeldActions(guildId);
        expect(listed.roleChoices.map((row) => row.id)).toEqual([choice.id]);

        const inspection = await inspectHeldAction(
            client,
            guildId,
            'role-choice',
            choice.id
        );
        expect(
            (
                inspection as Awaited<ReturnType<typeof inspectHeldAction>> & {
                    observedRoleIds: string[];
                }
            ).observedRoleIds
        ).toEqual(['role-a']);

        roles.set('role-b', {});
        await expect(
            confirmHeldAction(
                client,
                guildId,
                'role-choice',
                choice.id,
                inspection.evidenceHash,
                'operator'
            )
        ).rejects.toThrow('Discord changed since inspection');
        expect(
            await db.roleChoiceLock.findUnique({
                where: { guildId_userId: { guildId, userId } },
            })
        ).not.toBeNull();

        roles.delete('role-b');
        await expect(
            confirmHeldAction(
                client,
                guildId,
                'role-choice',
                choice.id,
                inspection.evidenceHash,
                'operator'
            )
        ).resolves.toEqual({ state: 'RECONCILED' });
        await expect(
            db.roleChoiceLock.findUnique({
                where: { guildId_userId: { guildId, userId } },
            })
        ).resolves.toBeNull();
        await expect(
            db.heldActionReceipt.findUniqueOrThrow({
                where: {
                    kind_actionId: { kind: 'role-choice', actionId: choice.id },
                },
            })
        ).resolves.toMatchObject({ guildId, actorId: 'operator' });
        await expect(
            db.$executeRawUnsafe(
                'UPDATE "HeldActionReceipt" SET "actorId" = \'changed\''
            )
        ).rejects.toThrow('immutable');
    });

    it('refuses a pending action and allows only one concurrent confirmation', async () => {
        const pending = await db.roleChoice.create({
            data: {
                guildId,
                userId,
                requestId: 'pending-fixture',
                state: 'PENDING',
            },
        });
        await db.roleChoiceLock.create({
            data: { guildId, userId, actionId: pending.id },
        });
        await expect(
            inspectHeldAction(client, guildId, 'role-choice', pending.id)
        ).rejects.toThrow();
        expect((await listHeldActions(guildId)).roleChoices).toEqual([]);

        await db.roleChoice.update({
            where: { id: pending.id },
            data: { state: 'UNCERTAIN' },
        });
        const inspection = await inspectHeldAction(
            client,
            guildId,
            'role-choice',
            pending.id
        );
        const results = await Promise.allSettled([
            confirmHeldAction(
                client,
                guildId,
                'role-choice',
                pending.id,
                inspection.evidenceHash,
                'operator-one'
            ),
            confirmHeldAction(
                client,
                guildId,
                'role-choice',
                pending.id,
                inspection.evidenceHash,
                'operator-two'
            ),
        ]);
        expect(
            results.filter((result) => result.status === 'fulfilled')
        ).toHaveLength(1);
        expect(
            results.filter((result) => result.status === 'rejected')
        ).toHaveLength(1);
        await expect(
            db.heldActionReceipt.count({
                where: { kind: 'role-choice', actionId: pending.id },
            })
        ).resolves.toBe(1);
    });

    it('reconciles a ticket only when current marked-channel overwrites prove close delivery', async () => {
        await db.guildInstallation.create({
            data: { guildId, name: 'fixture' },
        });
        await db.guildModuleConfig.create({
            data: {
                guildId,
                moduleId: 'tickets',
                enabled: true,
                config: { retentionDays: 7 },
            },
        });
        const ticket = await db.supportTicket.create({
            data: {
                guildId,
                openerId: userId,
                channelId: '788888888888888883',
                participants: [userId],
                staffRoles: ['788888888888888884'],
                state: 'OPEN',
            },
        });
        const action = await db.ticketAction.create({
            data: {
                guildId,
                ticketId: ticket.id,
                requestId: 'close-fixture',
                actorId: 'operator',
                kind: 'close',
                state: 'UNCERTAIN',
            },
        });
        await db.supportTicket.update({
            where: { id: ticket.id },
            data: { heldActionId: action.id },
        });
        const cache = new Collection(
            ticketOverwrites(
                guildId,
                '788888888888888885',
                [userId],
                ['788888888888888884'],
                true
            ).map((overwrite) => [
                String(overwrite.id),
                {
                    id: String(overwrite.id),
                    type: overwrite.type,
                    allow: {
                        bitfield: ('allow' in overwrite
                            ? overwrite.allow
                            : []
                        ).reduce((mask, bit) => mask | bit, BigInt(0)),
                    },
                    deny: {
                        bitfield: ('deny' in overwrite
                            ? overwrite.deny
                            : []
                        ).reduce((mask, bit) => mask | bit, BigInt(0)),
                    },
                },
            ])
        );
        const channel = {
            id: ticket.channelId,
            type: ChannelType.GuildText,
            topic: `Backline ticket ${ticket.id}`,
            permissionOverwrites: { cache },
        };
        const ticketClient = {
            guilds: {
                fetch: jest.fn().mockResolvedValue({
                    channels: { fetch: jest.fn().mockResolvedValue(channel) },
                    members: {
                        fetchMe: jest
                            .fn()
                            .mockResolvedValue({ id: '788888888888888885' }),
                    },
                }),
            },
        } as unknown as Client;
        const inspection = await inspectHeldAction(
            ticketClient,
            guildId,
            'ticket-action',
            action.id
        );
        await expect(
            confirmHeldAction(
                ticketClient,
                guildId,
                'ticket-action',
                action.id,
                inspection.evidenceHash,
                'operator'
            )
        ).resolves.toEqual({ state: 'RECONCILED' });
        await expect(
            db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })
        ).resolves.toMatchObject({ state: 'CLOSED', heldActionId: null });
        expect(
            (
                await db.supportTicket.findUniqueOrThrow({
                    where: { id: ticket.id },
                })
            ).expiresAt
        ).not.toBeNull();
    });

    it('leaves unsafe and ambiguous ticket actions held', async () => {
        const ticket = await db.supportTicket.create({
            data: {
                guildId,
                openerId: userId,
                participants: [userId],
                staffRoles: [],
                state: 'CREATING',
            },
        });
        const action = await db.ticketAction.create({
            data: {
                guildId,
                ticketId: ticket.id,
                requestId: 'open-fixture',
                actorId: userId,
                kind: 'open',
                state: 'UNCERTAIN',
            },
        });
        await db.supportTicket.update({
            where: { id: ticket.id },
            data: { heldActionId: action.id },
        });
        const duplicates = new Collection([
            [
                'a',
                {
                    id: 'a',
                    type: ChannelType.GuildText,
                    topic: `Backline ticket ${ticket.id}`,
                },
            ],
            [
                'b',
                {
                    id: 'b',
                    type: ChannelType.GuildText,
                    topic: `Backline ticket ${ticket.id}`,
                },
            ],
        ]);
        const ambiguousClient = {
            guilds: {
                fetch: jest.fn().mockResolvedValue({
                    channels: {
                        fetch: jest.fn().mockResolvedValue(duplicates),
                    },
                }),
            },
        } as unknown as Client;
        await expect(
            inspectHeldAction(
                ambiguousClient,
                guildId,
                'ticket-action',
                action.id
            )
        ).rejects.toThrow('Multiple channels');
        await expect(
            db.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } })
        ).resolves.toMatchObject({ heldActionId: action.id });
    });

    it('treats only Discord unknown-channel as an absent expiry channel', async () => {
        const ticket = await db.supportTicket.create({
            data: {
                guildId,
                openerId: userId,
                channelId: '788888888888888886',
                participants: [userId],
                staffRoles: [],
                state: 'CLOSED',
            },
        });
        const action = await db.ticketAction.create({
            data: {
                guildId,
                ticketId: ticket.id,
                requestId: 'expire-fixture',
                actorId: 'system',
                kind: 'expire',
                state: 'UNCERTAIN',
            },
        });
        await db.supportTicket.update({
            where: { id: ticket.id },
            data: { heldActionId: action.id },
        });
        const fetch = jest.fn().mockRejectedValue({ code: 50013 });
        const failingClient = {
            guilds: {
                fetch: jest.fn().mockResolvedValue({ channels: { fetch } }),
            },
        } as unknown as Client;
        await expect(
            inspectHeldAction(
                failingClient,
                guildId,
                'ticket-action',
                action.id
            )
        ).rejects.toEqual({ code: 50013 });

        fetch.mockRejectedValue({ code: 10003 });
        await expect(
            inspectHeldAction(
                failingClient,
                guildId,
                'ticket-action',
                action.id
            )
        ).resolves.toMatchObject({ channel: null });
    });
});
