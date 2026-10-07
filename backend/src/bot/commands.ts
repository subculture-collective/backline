import {
    ChatInputCommandInteraction,
    Client,
    Interaction,
    GatewayIntentBits,
    MessageFlags,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from 'discord.js';

import { clipCommand, routeClips } from '../audio/clipCommands';
import { audioCommand, routeAudio } from '../audio/queue';
import { radioCommand, routeRadio } from '../audio/radio';
import {
    auditConfig,
    levelingConfig,
    communityReportsConfig,
    onboardingConfig,
    selfRolesConfig,
} from '../community/config';
import {
    customCommand,
    routeCustomCommands,
} from '../community/customCommands';
import { giveawayCommand, routeGiveaways } from '../community/giveaways';
import {
    recoveryCommand,
    routeHeldActionRecovery,
} from '../community/heldActionRecovery';
import { routeLeveling, xpCommand } from '../community/leveling';
import {
    memberUtilityCommands,
    routeMemberUtilities,
} from '../community/memberUtilities';
import { acknowledgeRules } from '../community/onboarding';
import { pollCommand, routePolls } from '../community/polls';
import {
    routeScheduledUtilities,
    scheduledUtilityCommands,
} from '../community/scheduledUtilities';
import { rolePanelCommand, routeSelfRoles } from '../community/selfRoles';
import { routeSuggestions, suggestCommand } from '../community/suggestions';
import { routeTickets, ticketCommands } from '../community/tickets';
import { db } from '../db';
import { economyCommand, routeEconomy } from '../economy/engine';
import {
    funCommand,
    tradeCommand,
    routeEntertainment,
} from '../entertainment/engine';
import { feedCommand, routeFeed } from '../integrations/notifications';
import { moderationCommands, routeModeration } from '../moderation/commands';
import { moduleRegistry } from '../modules/registry';
import { restoreCommand, routeRestore } from '../recovery/restore';
import { routeSnapshot, snapshotCommand } from '../recovery/snapshots';
import { env } from '../utils/env';
import { routeWorkflow, workflowCommand } from '../workflows/engine';

function permissionNames(values: bigint[]): string {
    return values
        .map(
            (value) =>
                Object.entries(PermissionFlagsBits).find(
                    ([, bit]) => bit === value
                )?.[0] ?? String(value)
        )
        .join(', ');
}
function intentNames(values: GatewayIntentBits[]): string {
    return values
        .map(
            (value) =>
                Object.entries(GatewayIntentBits).find(
                    ([, bit]) => bit === value
                )?.[0] ?? String(value)
        )
        .join(', ');
}
function configurationNote(moduleId: string, config: unknown): string {
    if (moduleId === 'audit-log' && !auditConfig.parse(config).channelId)
        return 'Choose an audit destination channel in the dashboard before enabling.';
    if (moduleId === 'onboarding') {
        const saved = onboardingConfig.parse(config);
        if (
            !saved.channelId &&
            !saved.departureChannelId &&
            !saved.joinRoles.length
        )
            return 'Choose welcome/departure channels or join roles in the dashboard; no onboarding actions are configured.';
    }
    if (moduleId === 'self-roles') {
        const saved = selfRolesConfig.parse(config);
        if (!saved.channelId || !saved.roles.length)
            return 'Choose a panel channel and role choices in the dashboard before publishing.';
    }
    return '';
}

export const coreCommands = [
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show available commands'),
    new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Show server setup and permission diagnostics')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
        .setName('status')
        .setDescription('Show bot and server module status'),
    new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure server modules')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption((option) =>
            option
                .setName('module')
                .setDescription('Module to configure')
                .setRequired(true)
                .addChoices(
                    ...moduleRegistry.list().map((module) => ({
                        name: module.id,
                        value: module.id,
                    }))
                )
        )
        .addBooleanOption((option) =>
            option
                .setName('enabled')
                .setDescription('Enable or disable the module')
                .setRequired(true)
        ),
].map((command) => command.setContexts(0).setIntegrationTypes(0).toJSON());

async function currentManager(
    interaction: ChatInputCommandInteraction
): Promise<boolean> {
    if (!interaction.guild) return false;
    const member = await interaction.guild.members.fetch({
        user: interaction.user.id,
        force: true,
    });
    return (
        interaction.guild.ownerId === member.id ||
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageGuild)
    );
}

export async function routeInteraction(
    interaction: Interaction
): Promise<void> {
    if (!interaction.isRepliable()) return;
    try {
        if (!interaction.inGuild() || !interaction.guild) {
            await interaction.reply({
                content:
                    'Use this command in a server where the bot is installed.',
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const installation = await db.guildInstallation.findUnique({
            where: { guildId: interaction.guildId },
        });
        if (
            !installation?.active ||
            (env.BOT_GUILD_IDS.length &&
                !env.BOT_GUILD_IDS.includes(interaction.guildId))
        ) {
            await interaction.editReply(
                'This server installation is unavailable.'
            );
            return;
        }
        if (await acknowledgeRules(interaction)) return;
        if (await routeTickets(interaction)) return;
        if (await routeGiveaways(interaction)) return;
        if (await routeClips(interaction)) return;
        if (await routeAudio(interaction)) return;
        if (await routeRadio(interaction)) return;
        if (await routeLeveling(interaction)) return;
        if (await routeCustomCommands(interaction)) return;
        if (await routeScheduledUtilities(interaction)) return;
        if (await routeFeed(interaction)) return;
        if (await routeWorkflow(interaction)) return;
        if (await routeSnapshot(interaction)) return;
        if (await routeRestore(interaction)) return;
        if (await routeEconomy(interaction)) return;
        if (await routeEntertainment(interaction)) return;
        if (await routePolls(interaction)) return;
        if (await routeSuggestions(interaction)) return;
        if (await routeMemberUtilities(interaction)) return;
        if (await routeSelfRoles(interaction)) return;
        if (interaction.isChatInputCommand() && (await routeHeldActionRecovery(interaction)))
            return;
        if (!interaction.isChatInputCommand()) {
            await interaction.editReply(
                'This control is unknown or expired. Open a new panel with the relevant command.'
            );
            return;
        }
        if (await routeModeration(interaction)) return;
        switch (interaction.commandName) {
            case 'help':
                await interaction.editReply(
                    '/help — commands\n/setup — server diagnostics\n/settings module enabled — configure a module\n/status — current module status\n/warn /timeout /kick /ban /unban /purge /cases — opt-in moderation\n/afk /birthday — opt-in member sharing\n/suggest — submit and review server ideas\n/poll — native channel polls\n/remind /announce — scheduled channel messages\n/custom [name] — configured private server replies\n/xp profile or leaderboard — server XP\n/giveaway — server giveaways\n/ticket /ticket-panel — support tickets\n/radio — approved radio\n/roles-panel — configured self-service roles\nSettings require current Manage Server permission. Modules are opt-in.'
                );
                break;
            case 'setup': {
                if (!(await currentManager(interaction))) {
                    await interaction.editReply(
                        'Current Manage Server permission is required.'
                    );
                    return;
                }
                const bot = await interaction.guild.members.fetchMe({
                    force: true,
                });
                const settings = await db.guildModuleConfig.findMany({
                    where: { guildId: interaction.guildId },
                });
                const diagnostics = moduleRegistry.list().map((module) => {
                    const permissions = module.permissions.filter(
                        (permission) => !bot.permissions.has(permission)
                    );
                    const intents = module.intents.filter(
                        (intent) =>
                            !interaction.client.options.intents.has(intent)
                    );
                    const actions = Object.entries(
                        module.actionPermissions ?? {}
                    )
                        .map(([action, required]) => {
                            const missing = required.filter(
                                (permission) => !bot.permissions.has(permission)
                            );
                            return missing.length
                                ? `${action}: ${permissionNames(missing)}`
                                : '';
                        })
                        .filter(Boolean);
                    const saved = settings.find(
                        (row) => row.moduleId === module.id
                    );
                    const note = configurationNote(
                        module.id,
                        saved?.config ?? {}
                    );
                    return {
                        name: `${module.id} — ${saved?.enabled ? 'enabled' : 'disabled'}`,
                        value:
                            [
                                permissions.length
                                    ? `Missing bot permissions: ${permissionNames(permissions)}`
                                    : '',
                                intents.length
                                    ? `Missing Gateway intents: ${intentNames(intents)}. Operator must enable these and restart.`
                                    : '',
                                actions.length
                                    ? `Action permissions missing: ${actions.join('; ')}`
                                    : '',
                                note,
                            ]
                                .filter(Boolean)
                                .join('\n') ||
                            'Required permissions and Gateway intents are available.',
                    };
                });
                await interaction.editReply({
                    embeds: [
                        {
                            title: 'Server setup diagnostics',
                            description: `Use /settings to opt into modules. Configure channels and roles at ${env.FRONTEND_URL}/servers. Channel permissions and role hierarchy are checked again when an action runs.`,
                            fields: diagnostics,
                        },
                    ],
                });
                break;
            }
            case 'settings': {
                if (!(await currentManager(interaction))) {
                    await interaction.editReply(
                        'Current Manage Server permission is required.'
                    );
                    return;
                }
                const moduleId = interaction.options.getString('module', true);
                const enabled = interaction.options.getBoolean('enabled', true);
                if (moduleId === 'tickets') {
                    const actor = await interaction.guild.members.fetch({
                        user: interaction.user.id,
                        force: true,
                    });
                    if (
                        !actor.permissions.has([
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.ManageRoles,
                        ])
                    ) {
                        await interaction.editReply(
                            'Current Manage Channels and Manage Roles permissions are required for ticket configuration.'
                        );
                        return;
                    }
                }
                const module = moduleRegistry.get(moduleId);
                const missingIntents = module.intents.filter(
                    (intent) => !interaction.client.options.intents.has(intent)
                );
                if (enabled && missingIntents.length) {
                    await interaction.editReply(
                        `Missing Gateway intents: ${intentNames(missingIntents)}. Ask the operator to enable these and restart, then retry /settings.`
                    );
                    return;
                }
                const bot = await interaction.guild.members.fetchMe({
                    force: true,
                });
                const missingPermissions = module.permissions.filter(
                    (permission) => !bot.permissions.has(permission)
                );
                if (enabled && missingPermissions.length) {
                    await interaction.editReply(
                        `Missing bot permissions: ${permissionNames(missingPermissions)}. Update the bot role and channel permissions, then retry /settings.`
                    );
                    return;
                }
                const saved = await db.guildModuleConfig.findUnique({
                    where: {
                        guildId_moduleId: {
                            guildId: interaction.guildId,
                            moduleId,
                        },
                    },
                });
                if (
                    enabled &&
                    moduleId === 'leveling' &&
                    levelingConfig.parse(saved?.config ?? {}).rewards.length
                ) {
                    const actor = await interaction.guild.members.fetch({
                        user: interaction.user.id,
                        force: true,
                    });
                    if (
                        !actor.permissions.has(
                            PermissionFlagsBits.ManageRoles
                        ) &&
                        interaction.guild.ownerId !== actor.id
                    ) {
                        await interaction.editReply(
                            'Current Manage Roles permission is required to enable level rewards.'
                        );
                        return;
                    }
                }
                if (
                    enabled &&
                    moduleId === 'community-reports' &&
                    communityReportsConfig.parse(saved?.config ?? {}).counters
                        .length
                ) {
                    const actor = await interaction.guild.members.fetch({
                        user: interaction.user.id,
                        force: true,
                    });
                    if (
                        !actor.permissions.has(
                            PermissionFlagsBits.ManageChannels
                        ) &&
                        interaction.guild.ownerId !== actor.id
                    ) {
                        await interaction.editReply(
                            'Current Manage Channels permission is required to enable channel counters.'
                        );
                        return;
                    }
                }
                const note = configurationNote(moduleId, saved?.config ?? {});
                if (enabled && moduleId === 'audit-log' && note) {
                    await interaction.editReply(
                        `${note} Open ${env.FRONTEND_URL}/servers, save the audit channel, then retry /settings.`
                    );
                    return;
                }
                await moduleRegistry.configure(
                    interaction.guildId,
                    moduleId,
                    enabled,
                    saved?.config ?? {}
                );
                await interaction.editReply(
                    `${moduleId} ${enabled ? 'enabled' : 'disabled'} for this server.${enabled && note ? ` ${note}` : ''}`
                );
                break;
            }
            case 'status': {
                const settings = await db.guildModuleConfig.findMany({
                    where: { guildId: interaction.guildId },
                });
                await interaction.editReply(
                    `Bot connected. Server: ${interaction.guildId}\n${moduleRegistry
                        .list()
                        .map(
                            (module) =>
                                `${module.id}: ${settings.find((row) => row.moduleId === module.id)?.enabled ? 'enabled' : 'disabled'}`
                        )
                        .join('\n')}`
                );
                break;
            }
            default:
                await interaction.editReply('Unknown command. Use /help.');
        }
    } catch {
        console.warn('Interaction failed');
        try {
            if (interaction.deferred || interaction.replied)
                await interaction.editReply(
                    'The action failed. Check /status and try again.'
                );
            else
                await interaction.reply({
                    content: 'The action failed. Please try again.',
                    flags: MessageFlags.Ephemeral,
                });
        } catch {
            console.warn('Interaction response unavailable');
        }
    }
}

export async function registerGuildCommands(
    client: Client,
    guildIds: string[]
): Promise<void> {
    for (const guildId of guildIds) {
        const guild = await client.guilds.fetch(guildId);
        for (const command of [
            ...coreCommands,
            ...moderationCommands,
            rolePanelCommand,
            ...ticketCommands,
            radioCommand,
            audioCommand,
            clipCommand,
            giveawayCommand,
            xpCommand,
            customCommand,
            ...scheduledUtilityCommands,
            feedCommand,
            workflowCommand,
            snapshotCommand,
            restoreCommand,
            economyCommand,
            funCommand,
            tradeCommand,
            pollCommand,
            suggestCommand,
            ...memberUtilityCommands,
            recoveryCommand,
        ])
            await guild.commands.create(command);
    }
}
