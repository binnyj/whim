import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockFetch, mockPendingFetch } from '../../test/mock-fetch';
import { renderRoute } from '../../test/render-route';

const healthy = { body: { status: 'ok', version: '1.4.2', uptime: 9 } };
const down = { status: 502, body: '<h1>Bad Gateway</h1>' };

describe('API status on the home page', () => {
  it('shows a loading message while the check is in flight', () => {
    mockPendingFetch();
    renderRoute('/');

    expect(screen.getByRole('status')).toHaveTextContent('Checking the API…');
  });

  it('goes from loading to showing the API version', async () => {
    const fetchSpy = mockFetch(healthy);
    renderRoute('/');

    expect(screen.getByRole('status')).toHaveTextContent('Checking the API…');
    expect(await screen.findByText('API is up')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('v1.4.2');
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/health');
  });

  it('shows the error and recovers when Retry succeeds', async () => {
    const fetchSpy = mockFetch(down, healthy);
    renderRoute('/');

    const status = screen.getByRole('status');
    expect(await within(status).findByText('API is down.')).toBeInTheDocument();
    expect(status).toHaveTextContent('Whim is temporarily unavailable. Please try again shortly.');

    await userEvent.click(within(status).getByRole('button', { name: 'Retry' }));

    expect(await within(status).findByText('API is up')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('shows the network message when the API cannot be reached', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    renderRoute('/');

    expect(
      await screen.findByText("Can't reach Whim. Check your connection and try again."),
    ).toBeInTheDocument();
  });

  it('shows a generic message when the response has the wrong shape', async () => {
    mockFetch({ body: { status: 'ok' } });
    renderRoute('/');

    expect(await screen.findByText('Unexpected response from the server.')).toBeInTheDocument();
  });
});
