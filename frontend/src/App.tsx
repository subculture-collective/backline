import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import AnalyticsConsentBanner from './components/AnalyticsConsentBanner';
import BrandHeader from './components/BrandHeader';
import RequireAdmin from './components/RequireAdmin';
import RequireAuth from './components/RequireAuth';
import SuspicionDetail from './components/suspicion/SuspicionDetail';
import { usePageTracking } from './hooks/useAnalytics';
import { useRTL } from './hooks/useRTL';
import {
    Analytics,
    AdvancedAnalytics,
    AuthCallback,
    Bans,
    Dashboard,
    Login,
    Status,
    Suspicion,
    UserTimeline,
} from './pages';
import BacklineLanding from './pages/BacklineLanding';
import MetricsDashboard from './pages/MetricsDashboard';
import Moderation from './pages/Moderation';
import ModulePage from './pages/ModulePage';
import Overview from './pages/Overview';
import RuleEditor from './pages/RuleEditor';
import Rules from './pages/Rules';
import Servers from './pages/Servers';
import { useAuth } from './store/auth';

function AppContent() {
    const { t } = useTranslation();
    usePageTracking();
    useRTL();
    useEffect(() => {
        if (typeof BroadcastChannel === 'undefined') return;
        const channel = new BroadcastChannel('backline-session');
        channel.onmessage = (event) => {
            if (event.data === 'signed-out') useAuth.getState().logout();
        };
        return () => channel.close();
    }, []);

    return (
        <>
            {/* Skip to main content link for keyboard navigation */}
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only fixed top-4 left-4 z-50 bg-bl-action text-bl-on-action px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-bl-accent focus:ring-offset-2"
            >
                {t('navigation.skipToContent')}
            </a>
            <BrandHeader />
            <Routes>
                <Route path="/" element={<BacklineLanding />} />
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/status" element={<Status />} />

                <Route element={<RequireAuth />}>
                    <Route path="/overview" element={<Overview />} />
                    <Route path="/servers" element={<Servers />} />
                    <Route
                        path="/servers/modules/:moduleId"
                        element={<ModulePage />}
                    />
                    <Route path="/moderation" element={<Moderation />} />
                    <Route path="/observed-activity" element={<Dashboard />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route
                        path="/advanced-analytics"
                        element={<AdvancedAnalytics />}
                    />
                    <Route path="/metrics" element={<MetricsDashboard />} />
                    <Route path="/rules" element={<Rules />} />
                    <Route path="/rules/new" element={<RuleEditor />} />
                    <Route path="/rules/:id/edit" element={<RuleEditor />} />
                    <Route path="/suspicion" element={<Suspicion />} />
                    <Route
                        path="/suspicion/:userId"
                        element={<SuspicionDetail />}
                    />
                    <Route
                        path="/timeline/:userId"
                        element={<UserTimeline />}
                    />

                    <Route element={<RequireAdmin />}>
                        <Route path="/bans" element={<Bans />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            <AnalyticsConsentBanner />
        </>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

export default App;
