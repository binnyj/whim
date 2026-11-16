import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderRoute } from '../test/render-route';

describe('app routes', () => {
  it('renders the home page inside the app shell', () => {
    renderRoute('/');

    expect(screen.getByRole('banner')).toHaveTextContent('Whim');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'I have some free time. What should I do?',
    );
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it.each(['/does-not-exist', '/deeply/nested/missing'])('shows the 404 page at %s', (path) => {
    renderRoute(path);

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent('Whim');
  });

  it('links from the 404 page back home', async () => {
    const { router } = renderRoute('/nope');

    await userEvent.click(screen.getByRole('link', { name: 'Back to home' }));

    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('free time');
  });
});
