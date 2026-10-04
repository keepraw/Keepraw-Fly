// Read-only local-browser investigation. Unobserved classes are NOT automatically unused.
import { chromium, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const archive = JSON.parse(readFileSync('examples/basic.keepraw-fly.json', 'utf8'));
const base = archive.flights[0];
base.bookingReference = 'LONGBOOKINGREFERENCE';
base.ticketNumber = '0161234567890';
base.destination.gate = '71';
base.baggageCarousel = 'D05';
base.extensions['keepraw-fly.seat'] = { seat: '12A', cabin: 'business', bookingClass: 'P' };
archive.flights = [base,
    { ...base, id: 'cancelled', flightNumber: 'UA124', cancelled: true },
    { ...base, id: 'diverted', flightNumber: 'UA125', divertedTo: { iata: 'SAN' } },
    { ...base, id: 'early', flightNumber: 'UA126', actualArrival: '2026-08-19T11:42:00-07:00' },
    { ...base, id: 'on-time', flightNumber: 'UA127', actualArrival: base.scheduledArrival },
    { ...base, id: 'older', flightNumber: 'UA128', serviceDate: '2025-08-19',
        scheduledDeparture: '2025-08-19T10:20:00-07:00', scheduledArrival: '2025-08-19T11:52:00-07:00',
        actualDeparture: undefined, actualArrival: undefined },
];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', reducedMotion: 'reduce' });
const page = await context.newPage();
const seen = new Set();
const snapshots = [];
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
async function sample(label) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const data = await page.evaluate(() => {
        const css = (selector) => {
            const el = document.querySelector(selector);
            if (!el)
                return null;
            const s = getComputedStyle(el);
            return { display: s.display, color: s.color, marginTop: s.marginTop, paddingTop: s.paddingTop,
                height: s.height, borderBottomWidth: s.borderBottomWidth, borderBottomStyle: s.borderBottomStyle,
                fontSize: s.fontSize, fontWeight: s.fontWeight, gap: s.gap, gridTemplateColumns: s.gridTemplateColumns,
                colorInk: s.getPropertyValue('--color-ink'), lineStrong: s.getPropertyValue('--line-strong') };
        };
        return { innerWidth, mobile: matchMedia('(max-width: 760px)').matches, theme: document.documentElement.dataset.theme,
            classes: [...new Set([...document.querySelectorAll('[class]')].flatMap(el => [...el.classList]))].sort(),
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            rowCount: document.querySelectorAll('.flight-row').length,
            statuses: [...document.querySelectorAll('.flight-status')].map(el => el.className),
            exploration: css('.passport-exploration'), close: css('.passport-exploration-close'), cities: css('.flight-route-cities'),
            row: css('.flight-row'), layout: css('.passport-layout'), map: css('.detail-route-map'), time: css('.detail-airport-time'),
            early: css('.detail-stop-meta .is-early'), positive: getComputedStyle(document.documentElement).getPropertyValue('--color-positive'),
            ink: getComputedStyle(document.documentElement).getPropertyValue('--ink'), muted: getComputedStyle(document.documentElement).getPropertyValue('--muted'),
            selected: document.querySelectorAll('.flight-row.is-selected').length,
            highlight: document.querySelectorAll('.map-route.is-highlighted').length,
            passportMap: document.querySelectorAll('.map-country').length,
        };
    });
    data.classes.forEach(c => seen.add(c));
    snapshots.push({ label, viewport: page.viewportSize(), ...data });
    expect(data.overflow, label + ' horizontal overflow').toBe(false);
}
try {
    await page.goto('http://127.0.0.1:5173/');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'audit.keepraw-fly.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(archive)) });
    await expect(page.locator('.import-control-primary')).toHaveCount(1);
    await sample('import-primary-preview');
    await page.getByRole('button', { name: 'Import this archive' }).click();
    await expect(page.locator('.flight-row')).toHaveCount(6);
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await expect(page.locator('.flight-row')).toHaveCount(6);
        if (viewport.width > 760)
            await expect(page.locator('.map-route')).not.toHaveCount(0);
        await sample('passport-archive');
        await page.locator('.passport-period').getByRole('button', { name: '2025', exact: true }).click();
        await expect(page.locator('.flight-row')).toHaveCount(1);
        await sample('passport-year');
        await page.locator('.passport-period').getByRole('button', { name: 'All', exact: true }).click();
        await page.locator('#passport-flight-search').fill('UA123');
        await expect(page.locator('.flight-row')).toHaveCount(1);
        await sample('passport-search');
        await page.locator('.clear-search').click();
        await page.locator(`.flight-record[data-flight-id="${base.id}"] .flight-row`).click();
        await expect(page.locator('.detail-heading')).toBeVisible();
        await page.locator('.detail-header-back').click();
        await expect(page.locator('.flight-row.is-selected')).toHaveCount(1);
        if (viewport.width > 760) {
            await page.locator(`.flight-record[data-flight-id="${base.id}"] .flight-row`).hover();
            await expect(page.locator('.map-route.is-highlighted')).not.toHaveCount(0);
        }
        await sample('passport-selected');
        if (viewport.width <= 760)
            await page.setViewportSize({ width: 1440, height: 900 });
        await page.locator('button.passport-spotlight-item').first().click();
        await expect(page.locator('.passport-exploration')).toBeVisible();
        await page.setViewportSize(viewport);
        await sample('passport-exploration');
        await page.locator('.passport-exploration-close').click();
    }
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await page.locator(`.flight-record[data-flight-id="${base.id}"] .flight-row`).click();
        await expect(page.locator('.detail-stop--departure')).toHaveCount(1);
        await expect(page.locator('.detail-stop--arrival')).toHaveCount(1);
        await expect(page.locator('.detail-heading-summary')).toContainText('delayed');
        await expect(page.locator('.detail-record-item--wide')).not.toHaveCount(0);
        if (viewport.width > 760)
            await expect(page.locator('.detail-map-route')).toBeVisible();
        await sample('detail-delayed-metadata');
        if (viewport.width > 760) {
            await page.getByRole('button', { name: 'Next', exact: true }).click();
            await sample('detail-adjacent');
            await page.getByRole('button', { name: 'Previous', exact: true }).click();
        }
        // At mobile the action is in the More menu.
        const edit = page.getByRole('button', { name: 'Edit flight', exact: true });
        if (!await edit.isVisible())
            await page.locator('.detail-header-more summary').click();
        await edit.click();
        await expect(page.getByRole('dialog', { name: 'Edit flight' })).toBeVisible();
        await sample('editor');
        await page.getByRole('dialog', { name: 'Edit flight' }).getByRole('button', { name: 'Cancel', exact: true }).last().click();
        await page.locator('.detail-header-back').click();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('.flight-record[data-flight-id="early"] .flight-row').click();
    await sample('detail-early');
    await page.locator('.detail-header-back').click();
    await page.goto('http://127.0.0.1:5173/#settings');
    await page.getByRole('button', { name: 'Add frequent flyer program' }).click();
    await expect(page.locator('.settings-membership.is-expanded')).toHaveCount(1);
    await sample('settings-expanded');
    await expect(page.locator('.import-control-settings')).toHaveCount(1);
    // CSV preview reaches both generated new/possible dispositions without saving records.
    const csv = readFileSync('examples/flights.csv', 'utf8');
    await page.locator('input[type=file][accept*="csv"]').first().setInputFiles({ name: 'audit.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await expect(page.locator('.import-disposition-new')).toHaveCount(1);
    await sample('csv-new');
    const possible = 'flightNumber,serviceDate,originIata,destinationIata,scheduledDeparture,scheduledArrival\nUA123,2026-08-19,SFO,LAX,2026-08-19T10:21,2026-08-19T11:52\n';
    await page.locator('input[type=file][accept*="csv"]').first().setInputFiles({ name: 'possible.csv', mimeType: 'text/csv', buffer: Buffer.from(possible) });
    await expect(page.locator('.import-disposition-possible')).toHaveCount(1);
    await sample('csv-possible');
    await page.setViewportSize({ width: 390, height: 844 });
    await sample('settings-mobile');
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const theme of ['light', 'dark']) {
        await page.locator('.settings-display-fields select').nth(1).selectOption(theme);
        await page.goto('http://127.0.0.1:5173/#passport');
        await page.locator('button.passport-spotlight-item').first().click();
        await sample('variables-' + theme + '-desktop');
        await page.setViewportSize({ width: 390, height: 844 });
        await sample('variables-' + theme + '-mobile');
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.locator('.passport-exploration-close').click();
        await page.goto('http://127.0.0.1:5173/#settings');
    }
    expect(errors).toEqual([]);
}
finally {
    await browser.close();
}
if (process.argv.includes('--json'))
    process.stdout.write(JSON.stringify({ snapshots, errors, seenClasses: [...seen].sort() }, null, 2) + '\n');
else
    console.log('Runtime audit:', snapshots.length, 'states,', seen.size, 'classes,', errors.length, 'page errors.');
