import { Link } from 'react-router-dom';

import { Icon, Mark, type IconName } from '../components/brand/RoadCase';
import { useTheme } from '../contexts/ThemeContext';

import './backline-landing.css';

const source = 'https://git.subcult.tv/subculture-collective/backline';

const groups: {
    number: string;
    name: string;
    icon: IconName;
    title: string;
    text: string;
    modules: string[];
    doc?: string;
}[] = [
    {
        number: '01',
        name: 'Welcome',
        icon: 'welcome',
        title: 'A good first hello',
        text: 'Greet new members, gate the rules, and let people pick the roles you make available.',
        modules: [
            'Onboarding',
            'Self-assigned roles',
            'Birthdays',
            'AFK status',
            'Polls',
            'Suggestions',
            'Community reports',
        ],
        doc: 'onboarding',
    },
    {
        number: '02',
        name: 'Safety',
        icon: 'safety',
        title: 'Keep the context',
        text: 'Every warning, timeout and ban lands in a case with a reason and the staff member who acted. Members get a private room to ask for help.',
        modules: [
            'Moderation and cases',
            'Anti-spam',
            'Audit log',
            'Private tickets',
            'Activity reports',
        ],
        doc: 'moderation',
    },
    {
        number: '03',
        name: 'Engage',
        icon: 'engage',
        title: 'A reason to stay',
        text: 'Levels, giveaways and audio for the nights the server is busy.',
        modules: ['Leveling', 'Economy', 'Giveaways', 'Entertainment', 'Audio'],
    },
    {
        number: '04',
        name: 'Automate',
        icon: 'automate',
        title: 'Run it while you sleep',
        text: 'Scheduled jobs, custom commands and feeds, plus recovery snapshots you confirm before anything is restored.',
        modules: [
            'Scheduled utilities',
            'Custom commands',
            'Twitch, YouTube, RSS',
            'Workflows',
            'Recovery snapshots',
        ],
        doc: 'selective-restore',
    },
    {
        number: '05',
        name: 'Operator',
        icon: 'operator',
        title: 'Bring your own',
        text: 'An open slot for plugins installed by whoever runs the bot. They stay muted until a server brings them up.',
        modules: ['Operator plugins'],
    },
];

const strips: { number: string; name: string; icon: IconName; up: boolean }[] =
    [
        { number: '01', name: 'Welcome', icon: 'welcome', up: true },
        { number: '02', name: 'Safety', icon: 'safety', up: true },
        { number: '03', name: 'Engage', icon: 'engage', up: true },
        { number: '04', name: 'Automate', icon: 'automate', up: false },
        { number: '05', name: 'Operator', icon: 'operator', up: false },
    ];

function State({ up }: { up: boolean }) {
    return (
        <span className={up ? 'lp-state is-live' : 'lp-state'}>
            <span className="lp-led" aria-hidden="true" />
            <span className="lp-state-word">{up ? 'Live' : 'Muted'}</span>
        </span>
    );
}

export default function BacklineLanding() {
    const { effectiveTheme, setTheme } = useTheme();

    return (
        <div className="backline">
            <header className="lp-header">
                <Link to="/" className="lp-brand" aria-label="Backline home">
                    <Mark className="lp-mark" />
                    <span>Backline</span>
                </Link>
                <nav className="lp-nav" aria-label="Main navigation">
                    <a href="#modules">The modules</a>
                    <a href="#soundcheck">Soundcheck</a>
                    <a href="#pilot">Pilot</a>
                </nav>
                <div className="lp-header-end">
                    <div className="lp-switch" role="group" aria-label="Theme">
                        <button
                            type="button"
                            aria-pressed={effectiveTheme === 'dark'}
                            onClick={() => setTheme('dark')}
                        >
                            <Icon name="stage" size={16} />
                            <span className="lp-switch-word">Stage</span>
                        </button>
                        <button
                            type="button"
                            aria-pressed={effectiveTheme === 'light'}
                            onClick={() => setTheme('light')}
                        >
                            <Icon name="loadin" size={16} />
                            <span className="lp-switch-word">Load-in</span>
                        </button>
                    </div>
                    <Link className="lp-button lp-button-secondary" to="/login">
                        Sign in
                    </Link>
                </div>
            </header>

            <main id="main-content">
                <section className="lp-hero" aria-labelledby="bl-title">
                    <div>
                        <span className="lp-tape">Discord bot + dashboard</span>
                        <h1 id="bl-title">The gear behind your community.</h1>
                        <p className="lp-lead">
                            Welcome new members, keep a record of every
                            moderation call, and give people a private room to
                            ask for help. 23 modules, each one muted until you
                            bring it up.
                        </p>
                        <div className="lp-actions">
                            <Link
                                className="lp-button lp-button-primary"
                                to="/login"
                            >
                                Pilot sign in <Icon name="arrow" />
                            </Link>
                            <a
                                className="lp-button lp-button-secondary"
                                href="#modules"
                            >
                                See the modules
                            </a>
                        </div>
                        <p className="lp-note">
                            Private pilot with the SUBCULT community. Public
                            installation is not open yet.
                        </p>
                    </div>

                    <figure
                        className="lp-rack lp-corners"
                        aria-label="Example server with three of five module groups live. Fictional sample, not a live server."
                    >
                        <div className="lp-rack-head">
                            <span className="lp-eyebrow">
                                Example server · fictional
                            </span>
                            <span className="lp-state is-live">
                                <span className="lp-led" aria-hidden="true" />3
                                of 5 groups live
                            </span>
                        </div>
                        <div className="lp-strips" aria-hidden="true">
                            {strips.map((strip) => (
                                <div
                                    key={strip.number}
                                    className={
                                        strip.up ? 'lp-strip is-up' : 'lp-strip'
                                    }
                                >
                                    <Icon
                                        name={strip.icon}
                                        className="lp-strip-icon"
                                    />
                                    <span className="lp-strip-num">
                                        {strip.number}
                                    </span>
                                    <span className="lp-track">
                                        <i />
                                    </span>
                                    <span className="lp-strip-name">
                                        {strip.name}
                                    </span>
                                    <State up={strip.up} />
                                </div>
                            ))}
                        </div>
                        <ul className="lp-key" aria-hidden="true">
                            {strips.map((strip) => (
                                <li key={strip.number}>
                                    <b>{strip.number}</b>
                                    {strip.name}
                                    <State up={strip.up} />
                                </li>
                            ))}
                        </ul>
                        <figcaption className="lp-rack-foot">
                            <span>
                                <b>#142</b> · timeout 1h · marlo_k
                            </span>
                            <span className="lp-state is-live">
                                <span className="lp-led" aria-hidden="true" />
                                Delivered
                            </span>
                        </figcaption>
                    </figure>
                </section>

                <section
                    id="modules"
                    className="lp-section"
                    aria-labelledby="bl-modules-title"
                >
                    <div className="lp-section-head">
                        <h2 id="bl-modules-title">What's in the case</h2>
                        <p>
                            Five groups, 23 modules. Configure each one from the
                            dashboard or with /settings in Discord.
                        </p>
                    </div>
                    <div className="lp-rows">
                        {groups.map((group) => (
                            <article
                                key={group.number}
                                className={
                                    group.number === '05'
                                        ? 'lp-row is-slot'
                                        : 'lp-row'
                                }
                                aria-labelledby={`bl-group-${group.number}`}
                            >
                                <div className="lp-row-id">
                                    <span className="lp-tape">
                                        {group.number} · {group.name}
                                    </span>
                                    <Icon name={group.icon} size={24} />
                                </div>
                                <div>
                                    <h3 id={`bl-group-${group.number}`}>
                                        {group.title}
                                    </h3>
                                    <p>{group.text}</p>
                                    {group.doc && (
                                        <a
                                            className="lp-doc"
                                            href={`${source}/src/branch/main/docs/developer/${group.doc}.md`}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Read the details
                                            <span className="sr-only">
                                                {' '}
                                                about {group.name.toLowerCase()}
                                            </span>
                                            <Icon name="external" size={16} />
                                        </a>
                                    )}
                                </div>
                                <ul aria-label={`${group.name} modules`}>
                                    {group.modules.map((module) => (
                                        <li key={module}>{module}</li>
                                    ))}
                                </ul>
                            </article>
                        ))}
                    </div>
                </section>

                <section
                    id="soundcheck"
                    className="lp-section"
                    aria-labelledby="bl-soundcheck-title"
                >
                    <div className="lp-section-head">
                        <h2 id="bl-soundcheck-title">Soundcheck</h2>
                        <p>Three steps from sign-in to a working server.</p>
                    </div>
                    <ol className="lp-steps">
                        <li>
                            <span className="lp-step-num">01</span>
                            <h3>Sign in</h3>
                            <p>
                                Use Discord. You see the servers where you hold
                                Manage Server.
                            </p>
                        </li>
                        <li>
                            <span className="lp-step-num">02</span>
                            <h3>Bring modules up</h3>
                            <p>
                                Everything starts muted. Switch on what your
                                server needs and set the channels and staff
                                roles it uses.
                            </p>
                        </li>
                        <li>
                            <span className="lp-step-num">03</span>
                            <h3>Check the log</h3>
                            <p>
                                Moderation and settings changes are jobs with a
                                state you can read back.
                            </p>
                        </li>
                    </ol>
                </section>

                <section
                    id="pilot"
                    className="lp-section"
                    aria-labelledby="bl-pilot-title"
                >
                    <div className="lp-pilot">
                        <div>
                            <span className="lp-tape">Private pilot</span>
                            <h2 id="bl-pilot-title">Not on tour yet.</h2>
                            <p>
                                Backline is a release candidate running with the
                                SUBCULT community. Public installation is not
                                open. If you already have pilot access, your
                                dashboard is ready to sign in.
                            </p>
                        </div>
                        <div className="lp-actions">
                            <Link
                                className="lp-button lp-button-primary"
                                to="/login"
                            >
                                Pilot sign in <Icon name="arrow" />
                            </Link>
                            <a
                                className="lp-button lp-button-secondary"
                                href={source}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Read the source <Icon name="external" />
                            </a>
                        </div>
                    </div>
                </section>

                <section className="lp-section" aria-labelledby="bl-faq-title">
                    <div className="lp-section-head">
                        <h2 id="bl-faq-title">A few practical things</h2>
                    </div>
                    <div className="lp-faq">
                        <details>
                            <summary>Can I add Backline to my server?</summary>
                            <p>
                                Public installation is not available yet.
                                Backline is in a private pilot with SUBCULT; a
                                broader release needs its own installation and
                                operating checks.
                            </p>
                        </details>
                        <details>
                            <summary>
                                Do I have to turn on every module?
                            </summary>
                            <p>
                                No. Modules start disabled and are configured
                                separately for each server. Choose the channels,
                                roles, and capabilities your community needs.
                            </p>
                        </details>
                        <details>
                            <summary>Who can see support tickets?</summary>
                            <p>
                                The ticket opener, invited participants,
                                configured staff, and the bot receive access.
                                Discord server owners and administrators retain
                                their inherent access.
                            </p>
                        </details>
                        <details>
                            <summary>
                                Where can I read the implementation details?
                            </summary>
                            <p>
                                The project’s{' '}
                                <a
                                    href={`${source}/src/branch/main/docs/developer/bot-expansion-roadmap.md`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    development documentation
                                </a>{' '}
                                explains the modules, implementation sequence,
                                and qualification gates.
                            </p>
                        </details>
                    </div>
                </section>
            </main>

            <footer className="lp-footer">
                <span>
                    Backline · a tool from{' '}
                    <a href="https://subcult.tv/">SUBCULT</a>. For the people
                    behind the community.
                </span>
                <span>
                    <a href="https://subcult.tv/support">Support SUBCULT</a>.
                    Membership does not grant pilot access or moderation
                    services.
                </span>
            </footer>
        </div>
    );
}
