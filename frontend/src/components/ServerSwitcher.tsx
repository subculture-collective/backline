import type { Server } from '../hooks/useServers';
import { useGuild } from '../store/guild';

type Props = {
    servers: Server[];
    disabled?: boolean;
    /** Visible label text. Pages that already say "Server" elsewhere can pass a longer label. */
    label?: string;
};

function serverIcon(server: Server) {
    return server.icon
        ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=64`
        : null;
}

/** Selects the server every protected page works on. The selection lives in the guild store. */
export default function ServerSwitcher({
    servers,
    disabled,
    label = 'Server',
}: Props) {
    const { guildId, selectGuild } = useGuild();
    const current = servers.find((server) => server.id === guildId);
    const icon = current ? serverIcon(current) : null;
    if (!servers.length) return null;
    return (
        <div className="bl-workspace-bar">
            {icon ? (
                <img
                    src={icon}
                    alt=""
                    width={32}
                    height={32}
                    className="rounded-full"
                />
            ) : (
                <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-full bg-bl-surface text-bl-ink ring-1 ring-bl-border inline-flex items-center justify-center font-display"
                >
                    {current?.name.slice(0, 1).toUpperCase() ?? '?'}
                </span>
            )}
            <label htmlFor="server-picker">{label}</label>
            <select
                id="server-picker"
                value={guildId ?? ''}
                onChange={(event) => selectGuild(event.target.value)}
                disabled={disabled}
                className="bl-input-compact"
            >
                {servers.map((server) => (
                    <option key={server.id} value={server.id}>
                        {server.name}
                    </option>
                ))}
            </select>
            <span className="text-sm text-bl-muted">
                {servers.length === 1
                    ? 'One manageable server'
                    : `${servers.length} manageable servers`}
            </span>
        </div>
    );
}
