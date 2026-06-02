import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

function makeChildProcessMock() {
  const child = new EventEmitter() as EventEmitter & { on: typeof EventEmitter.prototype.on };
  queueMicrotask(() => child.emit('exit', 0, null));
  return child;
}

describe('publishStaticSite CLI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    spawnMock.mockImplementation(() => makeChildProcessMock());
  });

  it('runs build:site and then deploys the generated static site via the local deploy script', async () => {
    const module = await import('../../src/cli/publishStaticSite.js');
    await module.main();

    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      process.execPath,
      ['--import', 'tsx', 'src/cli/buildStaticSite.ts'],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: 'inherit',
        env: expect.objectContaining({
          STATIC_SITE_WINDOW_START: expect.any(String),
          STATIC_SITE_WINDOW_END: expect.any(String),
        }),
      }),
    );

    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      'bash',
      [expect.stringMatching(/scripts\/deploy-static-site\.sh$/)],
      expect.objectContaining({
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
      }),
    );
  });
});
