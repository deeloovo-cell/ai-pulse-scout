import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

describe('publishStaticSite CLI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('fails fast when VERCEL_DEPLOY_HOOK_URL is missing', async () => {
    const module = await import('../../src/cli/publishStaticSite.js');
    process.env.VERCEL_DEPLOY_HOOK_URL = '';
    await expect(module.main()).rejects.toThrow(/VERCEL_DEPLOY_HOOK_URL/);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runs build:site and then triggers the Vercel deploy hook', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://example.com/deploy-hook';
    const child = new EventEmitter() as EventEmitter & { on: typeof EventEmitter.prototype.on };
    spawnMock.mockReturnValue(child);
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    vi.stubGlobal('fetch', fetchMock);

    const module = await import('../../src/cli/publishStaticSite.js');
    const runPromise = module.main();
    queueMicrotask(() => child.emit('exit', 0, null));
    await runPromise;

    expect(spawnMock).toHaveBeenCalledWith(
      process.execPath,
      ['--import', 'tsx', 'src/cli/buildStaticSite.ts'],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/deploy-hook',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
