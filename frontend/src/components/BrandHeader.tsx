import { NavLink, Link, useLocation } from 'react-router-dom';

import { useSession } from '../hooks/useSession';

import { Mark } from './brand/RoadCase';
import SessionStatus from './SessionStatus';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { ThemeToggle } from './ui/ThemeToggle';

export default function BrandHeader() {
    const { pathname } = useLocation();
    const { session } = useSession(pathname !== '/auth/callback');
    if (pathname === '/' && !session) return null;

    return (
        <header className="bl-app-header">
            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
                <Link to="/" className="bl-app-logo" aria-label="Backline home">
                    <Mark />
                    <span>Backline</span>
                </Link>
                <nav
                    className="bl-app-nav order-3 basis-full sm:order-none sm:basis-auto"
                    aria-label="Backline navigation"
                >
                    {!session ? (
                        <NavLink to="/status">Status</NavLink>
                    ) : (
                        <>
                            <NavLink to="/overview">Overview</NavLink>
                            <NavLink to="/servers">Server setup</NavLink>
                            <NavLink to="/moderation">Moderation</NavLink>
                            <NavLink to="/observed-activity">Activity</NavLink>
                            <NavLink to="/status">Status</NavLink>
                        </>
                    )}
                </nav>
                <div className="flex items-center gap-2">
                    <SessionStatus enabled={pathname !== '/auth/callback'} />
                    <LanguageSwitcher />
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
