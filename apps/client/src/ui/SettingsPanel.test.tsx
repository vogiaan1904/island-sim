import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GameProvider } from '../session/game.tsx';
import { loadSettings, type SettingsStorage } from '../store/settings.ts';
import { stubGame } from '../test/game.ts';
import { expectNoEmoji } from '../test/no-emoji.ts';
import { PanelHost } from './PanelHost.tsx';
import { PANEL_BODIES } from './panels.ts';
import { SettingsPanel } from './SettingsPanel.tsx';

function memory(): SettingsStorage {
  const data: Record<string, string> = {};
  return { getItem: (key) => data[key] ?? null, setItem: (key, value) => void (data[key] = value) };
}

function open(username = 'Lena') {
  const game = stubGame('playing');
  game.store.getState().setSession({ account: { id: 'id-lena', username } });
  const storage = memory();
  const view = render(
    <GameProvider game={game}>
      <SettingsPanel storage={storage} />
    </GameProvider>,
  );
  return { game, storage, ...view };
}

describe('the Settings panel', () => {
  it('is what the gear opens', () => {
    expect(PANEL_BODIES.settings).toBe(SettingsPanel);
    const game = stubGame('playing');
    game.store.getState().setView({ openPanel: 'settings' });
    render(
      <GameProvider game={game}>
        <PanelHost />
      </GameProvider>,
    );
    expect(screen.getByRole('region', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /sound/i })).toBeInTheDocument();
  });

  it('turns all sound off and on again, and remembers it on the device', async () => {
    const { game, storage } = open();
    const sound = screen.getByRole('switch', { name: /sound/i });
    expect(sound).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sound);
    expect(sound).toHaveAttribute('aria-checked', 'false');
    expect(game.store.getState().view.muted).toBe(true);
    expect(loadSettings(storage).muted).toBe(true);
    await userEvent.click(sound);
    expect(game.store.getState().view.muted).toBe(false);
    expect(loadSettings(storage).muted).toBe(false);
  });

  it('shows the quality in use and changes it to Low, Medium or High as the player\'s own choice, remembered on the device', async () => {
    const { game, storage } = open();
    act(() => game.store.getState().setView({ quality: 'medium' }));
    const group = screen.getByRole('radiogroup', { name: 'Quality' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Low' }));
    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked();
    expect(game.store.getState().view).toMatchObject({ quality: 'low', qualityChosen: true });
    expect(loadSettings(storage).quality).toBe('low');
    await userEvent.click(screen.getByRole('radio', { name: 'High' }));
    expect(game.store.getState().view.quality).toBe('high');
  });

  it('switches the controls between automatic, trackpad and mouse, remembered on the device', async () => {
    const { game, storage } = open();
    expect(screen.getByRole('radiogroup', { name: 'Controls' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Automatic' })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: 'Trackpad' }));
    expect(game.store.getState().view.controlsChoice).toBe('trackpad');
    expect(loadSettings(storage).controls).toBe('trackpad');
    await userEvent.click(screen.getByRole('radio', { name: 'Mouse' }));
    expect(game.store.getState().view.controlsChoice).toBe('mouse');
    await userEvent.click(screen.getByRole('radio', { name: 'Automatic' }));
    expect(game.store.getState().view.controlsChoice).toBe('auto');
    expect(loadSettings(storage).controls).toBe('auto');
  });

  it('shows the username as typed', () => {
    open('LenaK');
    expect(screen.getByText('LenaK')).toBeInTheDocument();
  });

  describe('change password', () => {
    it('sends both passwords, then says the other devices were signed out and empties the fields', async () => {
      const { game } = open();
      await userEvent.type(screen.getByLabelText('Current password'), 'old-password');
      await userEvent.type(screen.getByLabelText('New password'), 'brand-new-pass');
      await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
      expect(game.session.changePassword).toHaveBeenCalledWith('old-password', 'brand-new-pass');
      expect(await screen.findByRole('status')).toHaveTextContent('Password changed. Your other devices were signed out.');
      expect(screen.getByLabelText('Current password')).toHaveValue('');
      expect(screen.getByLabelText('New password')).toHaveValue('');
    });

    it('refuses a short new password in words, without asking the server', async () => {
      const { game } = open();
      await userEvent.type(screen.getByLabelText('Current password'), 'old-password');
      await userEvent.type(screen.getByLabelText('New password'), 'short');
      await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
      expect(screen.getByText('A password has at least 8 characters.')).toBeInTheDocument();
      expect(game.session.changePassword).not.toHaveBeenCalled();
    });

    it('asks for the current password when the form is left empty', async () => {
      const { game } = open();
      await userEvent.type(screen.getByLabelText('New password'), 'brand-new-pass');
      await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
      expect(screen.getByText('Type your current password first.')).toBeInTheDocument();
      expect(game.session.changePassword).not.toHaveBeenCalled();
    });

    it('says in plain words when the current password is wrong or the server cannot be reached', async () => {
      const { game } = open();
      game.session.changePassword = (async () => 'bad-credentials') as typeof game.session.changePassword;
      await userEvent.type(screen.getByLabelText('Current password'), 'wrong-password');
      await userEvent.type(screen.getByLabelText('New password'), 'brand-new-pass');
      await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
      expect(await screen.findByRole('alert')).toHaveTextContent("That isn't your current password. Check it and try again.");
      expect(screen.queryByRole('status')).toBeNull();

      game.session.changePassword = (async () => 'unreachable') as typeof game.session.changePassword;
      await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
      expect(await screen.findByRole('alert')).toHaveTextContent("The island can't be reached right now.");
    });
  });

  it('goes to the world screen from My worlds, closing the panel', async () => {
    const { game } = open();
    game.store.getState().setView({ openPanel: 'settings' });
    await userEvent.click(screen.getByRole('button', { name: 'My worlds' }));
    expect(game.session.showWorlds).toHaveBeenCalledOnce();
    expect(game.store.getState().view.openPanel).toBeNull();
  });

  it('logs out this device only, closing the panel', async () => {
    const { game } = open();
    game.store.getState().setView({ openPanel: 'settings' });
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(game.session.logOut).toHaveBeenCalledOnce();
    expect(game.store.getState().view.openPanel).toBeNull();
  });

  it('says why a log-out failed and stays open', async () => {
    const { game } = open();
    game.store.getState().setView({ openPanel: 'settings' });
    game.session.logOut = (async () => 'unreachable') as typeof game.session.logOut;
    await userEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("The island can't be reached right now.");
    expect(game.store.getState().view.openPanel).toBe('settings');
  });

  it('has no emoji', () => {
    const { container } = open();
    expectNoEmoji(container);
  });
});
