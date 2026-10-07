import { PermissionFlagsBits } from 'discord.js';
import { Router, raw } from 'express';
import { z } from 'zod';

import {
    clipSelect,
    deleteClip,
    saveSoundboard,
    storeClip,
} from '../audio/clips';
import { stationId } from '../audio/config';
import { queueItems } from '../audio/queue';
import { somaStations } from '../audio/stations';
import {
    onboardingConfig,
    selfRolesConfig,
    antiSpamConfig,
    levelingConfig,
    communityReportsConfig,
} from '../community/config';
import { listHeldActions } from '../community/heldActionRecovery';
import { db } from '../db';
import {
    originalTemplates,
    templateProvenance,
} from '../entertainment/catalog';
import { renderTemplate } from '../entertainment/images';
import { listManagedGuilds } from '../guilds/authorization';
import { enqueueJob } from '../jobs/store';
import { requireAuthOrApiKey, requireGuildAccess } from '../middleware';
import { moduleOperatorReady, moduleRegistry } from '../modules/registry';
import { exportSnapshot } from '../recovery/snapshots';

const router = Router();
router.get('/guilds', requireAuthOrApiKey, async (req, res) => {
    try {
        res.json(await listManagedGuilds(req.user!.userId));
    } catch {
        res.status(503).json({
            error: 'Current Discord server authorization unavailable. Sign in again or retry.',
        });
    }
});
const updateSchema = z.object({
    enabled: z.boolean(),
    config: z.unknown().default({}),
});
router.use('/guilds/:guildId/modules', requireAuthOrApiKey, requireGuildAccess);
const audioActionInput = z.discriminatedUnion('action', [
    z
        .object({
            action: z.literal('enqueue'),
            station: stationId,
            minutes: z.number().int().min(1).max(30),
            requestId: z.string().uuid(),
        })
        .strict(),
    z
        .object({ action: z.literal('start'), requestId: z.string().uuid() })
        .strict(),
    z
        .object({
            action: z.literal('control'),
            control: z.enum(['pause', 'resume', 'skip', 'stop']),
            requestId: z.string().uuid(),
        })
        .strict(),
    z
        .object({
            action: z.literal('volume'),
            volume: z.number().int().min(0).max(100),
            requestId: z.string().uuid(),
        })
        .strict(),
    z
        .object({
            action: z.literal('queue-setting'),
            setting: z.enum(['shuffle', 'loop', 'clear']),
            enabled: z.boolean().optional(),
            requestId: z.string().uuid(),
        })
        .strict(),
    z
        .object({
            action: z.literal('playlist'),
            operation: z.enum(['save', 'load', 'delete']),
            name: z
                .string()
                .trim()
                .regex(/^[\p{L}\p{N} _-]{1,40}$/u),
            requestId: z.string().uuid(),
        })
        .strict(),
]);
router.get('/guilds/:guildId/modules/audio/diagnostics', async (req, res) => {
    try {
        const guildId = req.params.guildId;
        const [queue, playlists, playback, jobs] = await Promise.all([
            db.audioQueue.findUnique({ where: { guildId } }),
            db.audioPlaylist.findMany({
                where: { guildId },
                orderBy: { name: 'asc' },
                take: 20,
                select: {
                    id: true,
                    name: true,
                    createdBy: true,
                    createdAt: true,
                    items: true,
                },
            }),
            db.voicePlayback.findMany({
                where: { guildId },
                orderBy: { startedAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    stationId: true,
                    channelId: true,
                    requesterId: true,
                    state: true,
                    detail: true,
                    startedAt: true,
                    finishedAt: true,
                    playbackMs: true,
                    daveProtocol: true,
                },
            }),
            db.durableJob.findMany({
                where: { guildId, kind: 'audio-dashboard' },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    state: true,
                    lastError: true,
                    createdAt: true,
                    result: true,
                },
            }),
        ]);
        res.json({
            stations: Object.entries(somaStations).map(([id, station]) => ({
                id,
                title: station.title,
            })),
            queue: queue
                ? { ...queue, items: queueItems.parse(queue.items) }
                : { items: [], state: 'IDLE', loop: false, shuffle: false },
            playlists: playlists.map((playlist) => ({
                ...playlist,
                items: queueItems.parse(playlist.items),
            })),
            playback,
            jobs,
        });
    } catch {
        res.status(503).json({ error: 'Audio diagnostics unavailable' });
    }
});
router.post('/guilds/:guildId/modules/audio/actions', async (req, res) => {
    const input = audioActionInput.safeParse(req.body);
    if (!input.success) {
        res.status(400).json({ error: 'Invalid audio action' });
        return;
    }
    try {
        const job = await enqueueJob({
            guildId: req.params.guildId,
            actorId: req.user!.userId,
            moduleId: 'audio',
            kind: 'audio-dashboard',
            idempotencyKey: `audio-dashboard:${req.user!.userId}:${input.data.requestId}`,
            payload: { ...input.data, discordId: req.user!.discordId },
            runAt: new Date(),
            expiresAt: new Date(Date.now() + 300000),
            maxAttempts: 1,
        });
        res.status(202).json({ id: job.id, state: job.state });
    } catch {
        res.status(409).json({
            error: 'Audio action was not queued. Enable audio and retry from the intended voice channel.',
        });
    }
});
router.get('/guilds/:guildId/modules/audio/clips', async (req, res) => {
    try {
        res.json(
            await db.audioClip.findMany({
                where: { guildId: req.params.guildId },
                select: clipSelect,
                orderBy: { title: 'asc' },
                take: 100,
            })
        );
    } catch {
        res.status(503).json({ error: 'Clip catalog unavailable' });
    }
});
router.post(
    '/guilds/:guildId/modules/audio/clips',
    raw({ type: ['audio/wav', 'audio/x-wav'], limit: '3mb' }),
    async (req, res) => {
        try {
            if (!Buffer.isBuffer(req.body)) {
                res.status(400).json({
                    error: 'Upload a canonical 16-bit PCM WAV as audio/wav',
                });
                return;
            }
            const metadata = {
                title: req.query.title,
                source: req.query.source,
                license: req.query.license,
                rights: req.query.rights,
                confirmed: req.query.confirmed === 'true',
            };
            res.status(201).json(
                await storeClip(
                    req.params.guildId,
                    req.user!.discordId,
                    req.body,
                    metadata
                )
            );
        } catch {
            res.status(400).json({
                error: 'Clip was not approved or stored. Check format, duration, provenance, enabled clip setting and quota.',
            });
        }
    }
);
router.delete('/guilds/:guildId/modules/audio/clips/:id', async (req, res) => {
    try {
        await deleteClip(req.params.guildId, req.params.id);
        res.json({ success: true });
    } catch {
        res.status(400).json({ error: 'Clip withdrawal failed' });
    }
});
router.get('/guilds/:guildId/modules/audio/soundboards', async (req, res) => {
    try {
        res.json(
            await db.audioSoundboard.findMany({
                where: { guildId: req.params.guildId },
                orderBy: { name: 'asc' },
                take: 20,
            })
        );
    } catch {
        res.status(503).json({ error: 'Soundboards unavailable' });
    }
});
router.put('/guilds/:guildId/modules/audio/soundboards', async (req, res) => {
    try {
        res.json(
            await saveSoundboard(
                req.params.guildId,
                req.user!.discordId,
                req.body
            )
        );
    } catch {
        res.status(400).json({
            error: 'Soundboard was not saved. Select one to twenty approved clips from this server.',
        });
    }
});
router.delete(
    '/guilds/:guildId/modules/audio/soundboards/:id',
    async (req, res) => {
        try {
            const id = z.string().uuid().parse(req.params.id);
            await db.audioSoundboard.deleteMany({
                where: { guildId: req.params.guildId, id },
            });
            res.json({ success: true });
        } catch {
            res.status(400).json({ error: 'Soundboard deletion failed' });
        }
    }
);
router.get('/guilds/:guildId/modules/entertainment/catalog', (_req, res) => {
    res.json(
        Object.entries(originalTemplates).map(([id, template]) => ({
            id,
            ...template,
            provenance: templateProvenance,
        }))
    );
});
router.get(
    '/guilds/:guildId/modules/entertainment/templates/:id/preview',
    async (req, res) => {
        try {
            res.type('png').send(
                await renderTemplate(req.params.id, 'OUR COMMUNITY / OUR STORY')
            );
        } catch {
            res.status(503).json({ error: 'Template preview unavailable' });
        }
    }
);
router.get(
    '/guilds/:guildId/modules/entertainment/trades',
    async (req, res) => {
        try {
            res.json(
                await db.collectionTrade.findMany({
                    where: { guildId: req.params.guildId },
                    orderBy: { createdAt: 'desc' },
                    take: 100,
                    select: {
                        id: true,
                        sellerId: true,
                        buyerId: true,
                        itemId: true,
                        quantity: true,
                        price: true,
                        state: true,
                        expiresAt: true,
                    },
                })
            );
        } catch {
            res.status(503).json({ error: 'Trade history unavailable' });
        }
    }
);
router.get('/guilds/:guildId/modules/economy/ledger', async (req, res) => {
    try {
        res.json(
            await db.economyEntry.findMany({
                where: { guildId: req.params.guildId },
                orderBy: { createdAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    memberId: true,
                    actorId: true,
                    kind: true,
                    delta: true,
                    balanceAfter: true,
                    reason: true,
                    createdAt: true,
                },
            })
        );
    } catch {
        res.status(503).json({ error: 'Economy ledger unavailable' });
    }
});
router.get(
    '/guilds/:guildId/modules/scheduled-utilities/history',
    async (req, res) => {
        try {
            const events = await db.scheduledUtility.findMany({
                where: {
                    guildId: req.params.guildId,
                    OR: [
                        { kind: 'ANNOUNCEMENT' },
                        { actorId: req.user!.discordId },
                    ],
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    kind: true,
                    channelId: true,
                    runAt: true,
                    timeZone: true,
                    state: true,
                    messageId: true,
                },
            });
            const jobs = await db.durableJob.findMany({
                where: {
                    guildId: req.params.guildId,
                    kind: 'scheduled-utility',
                    idempotencyKey: {
                        in: events.map(
                            (event) => 'scheduled-utility:' + event.id
                        ),
                    },
                },
                select: { idempotencyKey: true, state: true, lastError: true },
            });
            res.json(
                events.map((event) => ({
                    ...event,
                    delivery:
                        jobs.find(
                            (job) =>
                                job.idempotencyKey ===
                                'scheduled-utility:' + event.id
                        ) ?? null,
                }))
            );
        } catch {
            res.status(503).json({
                error: 'Scheduled message history unavailable',
            });
        }
    }
);
router.get(
    '/guilds/:guildId/modules/scheduled-utilities/series',
    async (req, res) => {
        try {
            res.json(
                await db.announcementSeries.findMany({
                    where: { guildId: req.params.guildId },
                    orderBy: { createdAt: 'desc' },
                    take: 100,
                    select: {
                        id: true,
                        state: true,
                        cadence: true,
                        localTime: true,
                        timeZone: true,
                        nextAt: true,
                        endsAt: true,
                        lastEventId: true,
                    },
                })
            );
        } catch {
            res.status(503).json({
                error: 'Recurring announcements unavailable',
            });
        }
    }
);
router.get(
    '/guilds/:guildId/modules/integrations/history',
    async (req, res) => {
        try {
            const feeds = await db.providerFeed.findMany({
                where: { guildId: req.params.guildId },
                orderBy: { createdAt: 'desc' },
                take: 20,
                select: {
                    id: true,
                    provider: true,
                    source: true,
                    channelId: true,
                    enabled: true,
                    baselineAt: true,
                    nextPollAt: true,
                    failures: true,
                    lastError: true,
                },
            });
            const events = await db.providerEvent.findMany({
                where: { guildId: req.params.guildId },
                orderBy: { createdAt: 'desc' },
                take: 100,
                select: {
                    id: true,
                    feedId: true,
                    state: true,
                    messageId: true,
                    publishedAt: true,
                    createdAt: true,
                },
            });
            const jobs = await db.durableJob.findMany({
                where: {
                    guildId: req.params.guildId,
                    idempotencyKey: {
                        in: events.map((event) => 'provider-event:' + event.id),
                    },
                },
                select: { idempotencyKey: true, state: true, lastError: true },
            });
            res.json({
                feeds,
                events: events.map((event) => ({
                    ...event,
                    delivery:
                        jobs.find(
                            (job) =>
                                job.idempotencyKey ===
                                'provider-event:' + event.id
                        ) ?? null,
                })),
            });
        } catch {
            res.status(503).json({ error: 'Provider history unavailable' });
        }
    }
);
router.get('/guilds/:guildId/modules/workflows/history', async (req, res) => {
    try {
        const runs = await db.workflowRun.findMany({
            where: { guildId: req.params.guildId },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
                id: true,
                ruleId: true,
                state: true,
                messageId: true,
                createdAt: true,
            },
        });
        const jobs = await db.durableJob.findMany({
            where: {
                guildId: req.params.guildId,
                idempotencyKey: {
                    in: runs.map((run) => 'workflow-run:' + run.id),
                },
            },
            select: { idempotencyKey: true, state: true, lastError: true },
        });
        res.json(
            runs.map((run) => ({
                ...run,
                delivery:
                    jobs.find(
                        (job) => job.idempotencyKey === 'workflow-run:' + run.id
                    ) ?? null,
            }))
        );
    } catch {
        res.status(503).json({ error: 'Workflow history unavailable' });
    }
});
router.get('/guilds/:guildId/modules/recovery/snapshots', async (req, res) => {
    try {
        res.json(
            await db.serverSnapshot.findMany({
                where: {
                    guildId: req.params.guildId,
                    expiresAt: { gt: new Date() },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    kind: true,
                    checksum: true,
                    createdAt: true,
                    expiresAt: true,
                },
            })
        );
    } catch {
        res.status(503).json({ error: 'Snapshot history unavailable' });
    }
});
router.get(
    '/guilds/:guildId/modules/recovery/snapshots/:id/export',
    async (req, res) => {
        try {
            const exported = await exportSnapshot(
                req.params.guildId,
                req.params.id
            );
            res.attachment(
                'backline-' + req.params.guildId + '-snapshot-v1.json'
            ).json(exported);
        } catch {
            res.status(404).json({ error: 'Snapshot export unavailable' });
        }
    }
);
router.get('/guilds/:guildId/modules/recovery/plans', async (req, res) => {
    try {
        const plans = await db.restorePlan.findMany({
            where: { guildId: req.params.guildId },
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
                id: true,
                snapshotId: true,
                actorId: true,
                state: true,
                operations: true,
                lastError: true,
                expiresAt: true,
                createdAt: true,
            },
        });
        res.json(
            plans.map((plan) => ({
                ...plan,
                operations: Array.isArray(plan.operations)
                    ? plan.operations.map((operation) =>
                          operation &&
                          typeof operation === 'object' &&
                          !Array.isArray(operation) &&
                          operation.selected
                              ? operation
                              : {
                                    ...(operation as Record<string, unknown>),
                                    before: null,
                                    after: null,
                                }
                      )
                    : [],
            }))
        );
    } catch {
        res.status(503).json({ error: 'Restore history unavailable' });
    }
});
router.get(
    '/guilds/:guildId/modules/recovery/plans/:id/export',
    async (req, res) => {
        try {
            const plan = await db.restorePlan.findFirstOrThrow({
                where: { guildId: req.params.guildId, id: req.params.id },
            });
            res.attachment(
                'backline-' +
                    req.params.guildId +
                    '-restore-' +
                    plan.id +
                    '.json'
            ).json(plan);
        } catch {
            res.status(404).json({ error: 'Restore plan unavailable' });
        }
    }
);
router.get('/guilds/:guildId/modules/anti-spam/history', async (req, res) => {
    try {
        const decisions = await db.spamDecision.findMany({
            where: { guildId: req.params.guildId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        const jobs = await db.durableJob.findMany({
            where: {
                guildId: req.params.guildId,
                id: {
                    in: decisions.flatMap((decision) =>
                        decision.jobId ? [decision.jobId] : []
                    ),
                },
            },
            select: { id: true, state: true, lastError: true },
        });
        res.json({
            decisions: decisions.map((decision) => ({
                ...decision,
                delivery: jobs.find((job) => job.id === decision.jobId) ?? null,
            })),
            raid: await db.raidState.findUnique({
                where: { guildId: req.params.guildId },
            }),
        });
    } catch {
        res.status(503).json({ error: 'Anti-spam history unavailable' });
    }
});
router.delete('/guilds/:guildId/modules/anti-spam/raid', async (req, res) => {
    try {
        await db.raidState.deleteMany({
            where: { guildId: req.params.guildId },
        });
        res.json({ success: true });
    } catch {
        res.status(503).json({ error: 'Raid controls unavailable' });
    }
});
router.get('/guilds/:guildId/modules/self-roles/history', async (req, res) => {
    try {
        res.json(
            await db.roleChoice.findMany({
                where: {
                    guildId: req.params.guildId,
                    createdAt: { gte: new Date(Date.now() - 90 * 86400000) },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            })
        );
    } catch {
        res.status(503).json({ error: 'Role choice history unavailable' });
    }
});
router.get(
    '/guilds/:guildId/modules/recovery/held-actions',
    async (req, res) => {
        try {
            res.json(await listHeldActions(req.params.guildId));
        } catch {
            res.status(503).json({ error: 'Held action history unavailable' });
        }
    }
);
router.get('/guilds/:guildId/modules/onboarding/history', async (req, res) => {
    try {
        res.json(
            await db.memberJourney.findMany({
                where: {
                    guildId: req.params.guildId,
                    expiresAt: { gt: new Date() },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            })
        );
    } catch {
        res.status(503).json({ error: 'Onboarding history unavailable' });
    }
});
router.get('/guilds/:guildId/modules/audit-log/history', async (req, res) => {
    try {
        res.json(
            await db.serverAuditEvent.findMany({
                where: {
                    guildId: req.params.guildId,
                    expiresAt: { gt: new Date() },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            })
        );
    } catch {
        res.status(503).json({ error: 'Audit history unavailable' });
    }
});
router.get('/guilds/:guildId/modules', async (req, res) => {
    try {
        const settings = await db.guildModuleConfig.findMany({
            where: { guildId: req.params.guildId },
        });
        res.json(
            moduleRegistry.list().map((module) => ({
                id: module.id,
                description: module.description,
                version: module.version,
                permissions: module.permissions.map(String),
                actionPermissions: Object.fromEntries(
                    Object.entries(module.actionPermissions ?? {}).map(
                        ([action, permissions]) => [
                            action,
                            permissions.map(String),
                        ]
                    )
                ),
                intents: module.intents,
                pendingJobPolicy: module.pendingJobPolicy,
                operatorReady: moduleOperatorReady(module),
                settings: settings.find(
                    (row) => row.moduleId === module.id
                ) ?? { enabled: false, config: {} },
            }))
        );
    } catch {
        res.status(503).json({ error: 'Module settings unavailable' });
    }
});
router.put('/guilds/:guildId/modules/:moduleId', async (req, res) => {
    const body = updateSchema.safeParse(req.body);
    if (!body.success) {
        res.status(400).json({ error: 'Invalid module settings' });
        return;
    }
    try {
        if (
            req.params.moduleId === 'community-reports' &&
            communityReportsConfig.parse(body.data.config).counters.length
        ) {
            const membership = await db.guild.findUnique({
                where: {
                    userId_guildId: {
                        userId: req.user!.userId,
                        guildId: req.params.guildId,
                    },
                },
            });
            if (
                !membership ||
                (!membership.owner &&
                    !(
                        membership.permissions &
                        (PermissionFlagsBits.ManageChannels |
                            PermissionFlagsBits.Administrator)
                    ))
            ) {
                res.status(403).json({
                    error: 'Current Manage Channels permission is required to configure channel counters',
                });
                return;
            }
        }
        if (req.params.moduleId === 'tickets') {
            const member = await db.guild.findUnique({
                where: {
                    userId_guildId: {
                        userId: req.user!.userId,
                        guildId: req.params.guildId,
                    },
                },
            });
            const required =
                PermissionFlagsBits.ManageChannels |
                PermissionFlagsBits.ManageRoles;
            if (
                !member ||
                (!member.owner &&
                    !(member.permissions & PermissionFlagsBits.Administrator) &&
                    (member.permissions & required) !== required)
            ) {
                res.status(403).json({
                    error: 'Current Manage Channels and Manage Roles permissions are required for ticket configuration',
                });
                return;
            }
        }
        if (
            (req.params.moduleId === 'onboarding' &&
                onboardingConfig.parse(body.data.config).joinRoles.length) ||
            (req.params.moduleId === 'leveling' &&
                levelingConfig.parse(body.data.config).rewards.length) ||
            (req.params.moduleId === 'self-roles' &&
                selfRolesConfig.parse(body.data.config).roles.length)
        ) {
            const membership = await db.guild.findUnique({
                where: {
                    userId_guildId: {
                        userId: req.user!.userId,
                        guildId: req.params.guildId,
                    },
                },
            });
            if (
                !membership ||
                (!membership.owner &&
                    !(
                        membership.permissions &
                        (PermissionFlagsBits.ManageRoles |
                            PermissionFlagsBits.Administrator)
                    ))
            ) {
                res.status(403).json({
                    error: 'Current Manage Roles permission is required to configure role assignments',
                });
                return;
            }
        }
        if (
            req.params.moduleId === 'anti-spam' &&
            !antiSpamConfig.parse(body.data.config).observeOnly
        ) {
            const membership = await db.guild.findUnique({
                where: {
                    userId_guildId: {
                        userId: req.user!.userId,
                        guildId: req.params.guildId,
                    },
                },
            });
            if (
                !membership ||
                (!membership.owner &&
                    !(
                        membership.permissions &
                        (PermissionFlagsBits.ModerateMembers |
                            PermissionFlagsBits.Administrator)
                    ))
            ) {
                res.status(403).json({
                    error: 'Current Moderate Members permission is required to enable enforcement',
                });
                return;
            }
        }
        await moduleRegistry.configure(
            req.params.guildId,
            req.params.moduleId,
            body.data.enabled,
            body.data.config,
            req.user!.discordId
        );
        res.json({ success: true });
    } catch {
        res.status(400).json({
            error: 'Unknown module, invalid configuration or unavailable installation',
        });
    }
});
export default router;
