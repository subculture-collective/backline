import { expect, test } from '@playwright/test';

test.describe('authentication boundaries', () => {
    test('shows the Discord sign-in link and consent requirements on /login', async ({
        page,
    }) => {
        await page.goto('/login');

        await expect(
            page.getByRole('heading', { name: 'Backline' })
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: 'Login with Discord' })
        ).toHaveAttribute(
            'href',
            'http://localhost:3001/api/auth/discord/start'
        );
        await expect(
            page.getByText('By logging in, you agree to our terms of service')
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Analytics & Privacy' })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Accept' })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Decline' })
        ).toBeVisible();
    });

    test('redirects an anonymous server route to login after navigation and reload', async ({
        page,
    }) => {
        await page.route('**/api/auth/me', (route) =>
            route.fulfill({ status: 401, json: { error: 'Unauthorized' } })
        );
        await page.route('**/api/auth/refresh', (route) =>
            route.fulfill({ status: 401, json: { error: 'Unauthorized' } })
        );
        await page.goto('/servers');

        await expect(page).toHaveURL(/\/login$/);
        await expect(
            page.getByRole('link', { name: 'Login with Discord' })
        ).toBeVisible();

        await page.reload();

        await expect(page).toHaveURL(/\/login$/);
        await expect(
            page.getByRole('heading', { name: 'Backline' })
        ).toBeVisible();
    });

    test('offers retry during an outage and redirects after an anonymous response', async ({
        page,
    }) => {
        let recovered = false;
        await page.route('**/api/auth/me', (route) =>
            route.fulfill({
                status: recovered ? 401 : 503,
                json: { error: recovered ? 'Unauthorized' : 'Unavailable' },
            })
        );
        await page.route('**/api/auth/refresh', (route) =>
            route.fulfill({ status: 401, json: { error: 'Unauthorized' } })
        );
        await page.goto('/servers');
        await expect(page.getByRole('alert')).toHaveText(
            'We could not check your session. Try again when the connection recovers.'
        );
        await expect(page).toHaveURL(/\/servers$/);
        recovered = true;
        await page
            .getByRole('banner')
            .getByRole('button', { name: 'Retry session check' })
            .click();
        await expect(page).toHaveURL(/\/login$/);
    });
});

test.describe('landing page', () => {
    test('loads the published Backline title and hero heading', async ({
        page,
    }) => {
        await page.goto('/');

        await expect(page).toHaveTitle(
            'Backline — The tools behind your community'
        );
        await expect(
            page.getByRole('heading', {
                name: 'The gear behind your community.',
            })
        ).toBeVisible();
    });
});
