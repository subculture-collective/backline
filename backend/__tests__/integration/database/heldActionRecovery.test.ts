import { Client, Collection } from 'discord.js';

import {
    confirmHeldAction,
    inspectHeldAction,
    listHeldActions,
} from '../../../src/community/heldActionRecovery';
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
        await db.heldActionReceipt.deleteMany({ where: { guildId } });
        await db.roleChoiceLock.deleteMany({ where: { guildId } });
        await db.roleChoice.deleteMany({ where: { guildId } });
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
});
