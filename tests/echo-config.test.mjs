import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

// Run the app's ESM .js files without changing the package's module type.
function runEcho(script) {
  const result = spawnSync(process.execPath, [
    "--experimental-default-type=module", "--input-type=module", "-e", script,
  ], { cwd: new URL("..", import.meta.url), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

const configured = `
  process.env.NEXT_PUBLIC_REVERB_APP_KEY = 'public-test-key';
  process.env.NEXT_PUBLIC_REVERB_HOST = 'reverb.example.test';
  process.env.NEXT_PUBLIC_REVERB_PORT = '8080';
  process.env.NEXT_PUBLIC_REVERB_SCHEME = 'http';
`;

test("SSR import and getEcho do not require window even with configuration", () => {
  runEcho(`${configured}
    const { getEcho } = await import('./lib/echo.js');
    const assert = (await import('node:assert/strict')).default;
    assert.equal(getEcho(), null);
  `);
});

test("a browser without any required public setting does not connect", () => {
  for (const name of ["APP_KEY", "HOST", "PORT", "SCHEME"]) {
    runEcho(`${configured}
      globalThis.window = {};
      delete process.env.NEXT_PUBLIC_REVERB_${name};
      const { getEcho } = await import('./lib/echo.js');
      const assert = (await import('node:assert/strict')).default;
      assert.equal(getEcho(), null);
    `);
  }
});

test("nomination subscriptions include both event and subject IDs", () => {
  runEcho(`
    const { getNominationChannelName } = await import('./lib/echo.js');
    const assert = (await import('node:assert/strict')).default;
    assert.equal(getNominationChannelName(12, 34), 'events.12.nominations.34');
    assert.equal(getNominationChannelName(56, 34), 'events.56.nominations.34');
  `);
});

test("configured browsers share one Reverb connection with the requested transport", () => {
  for (const scheme of ["http", "https"]) {
    runEcho(`${configured}
      globalThis.window = {};
      process.env.NEXT_PUBLIC_REVERB_SCHEME = '${scheme}';
      const Pusher = (await import('pusher-js')).default;
      // Suppress only the network connection; keep real Echo/Pusher configuration.
      Pusher.prototype.connect = function () {};
      const { getEcho } = await import('./lib/echo.js');
      const assert = (await import('node:assert/strict')).default;
      const echo = getEcho();
      assert.ok(echo);
      assert.equal(getEcho(), echo);
      assert.equal(echo.connector.options.broadcaster, 'reverb');
      assert.equal(echo.connector.pusher.key, 'public-test-key');
      assert.equal(echo.connector.pusher.config.wsHost, 'reverb.example.test');
      assert.equal(echo.connector.pusher.config.wsPort, 8080);
      assert.equal(echo.connector.pusher.config.wssPort, 8080);
      assert.equal(echo.connector.pusher.config.useTLS, ${scheme === "https"});
      assert.deepEqual(echo.connector.pusher.config.enabledTransports, ['ws', 'wss']);
    `);
  }
});

test("private authorization uses the existing credentialed Axios client and reports success or error", () => {
  runEcho(`${configured}
    globalThis.window = {};
    const Pusher = (await import('pusher-js')).default;
    Pusher.prototype.connect = function () {};
    const api = (await import('./lib/api.js')).default;
    const assert = (await import('node:assert/strict')).default;
    const requests = [];
    const failure = new Error('Forbidden');
    api.defaults.adapter = async (config) => {
      requests.push(config);
      if (requests.length === 2) throw failure;
      return { data: { auth: 'signed-authorization' }, status: 200, statusText: 'OK', headers: {}, config };
    };
    const { getEcho } = await import('./lib/echo.js');
    const authorizer = getEcho().connector.options.authorizer({ name: 'private-events.12.nominations.34' });
    const success = await new Promise((resolve) => authorizer.authorize('123.456', (...args) => resolve(args)));
    assert.deepEqual(success, [false, { auth: 'signed-authorization' }]);
    const error = await new Promise((resolve) => authorizer.authorize('123.456', (...args) => resolve(args)));
    assert.deepEqual(error, [true, failure]);
    for (const request of requests) {
      assert.equal(request.url, '/api/broadcasting/auth');
      assert.equal(request.method, 'post');
      assert.equal(request.withCredentials, true);
      assert.equal(request.withXSRFToken, true);
      assert.deepEqual(JSON.parse(request.data), { socket_id: '123.456', channel_name: 'private-events.12.nominations.34' });
    }
  `);
});

test("leaderboard subscribes privately to the exact Laravel event and leaves without disconnecting shared Echo", () => {
  runEcho(`${configured}
    globalThis.window = {};
    const Pusher = (await import('pusher-js')).default;
    Pusher.prototype.connect = function () {};
    const { getEcho, getNominationChannelName } = await import('./lib/echo.js');
    const leaderboard = await import('./lib/voting-leaderboard.mjs');
    const assert = (await import('node:assert/strict')).default;
    assert.equal(typeof leaderboard.subscribeToNominationLeaderboard, 'function');
    const echo = getEcho();
    const statuses = [];
    const snapshots = [];
    let refreshed = 0;
    const base = {
      event: { id: 12, slug: 'gala', title: 'Gala' },
      subject: { id: 34, slug: 'singer', title: 'Singer', status: 'active' },
      total_votes: 0, total_registrations: 2, participation_percentage: 0,
      contestants: [{ id: 7, name: 'Ava', display_order: 0, votes: 0, rank: 1, percentage: 0 }],
    };
    const stop = leaderboard.subscribeToNominationLeaderboard({
      echo, channelName: getNominationChannelName(12, 34), eventId: 12, subjectId: 34,
      mode: 'nomination', status: 'active', onStatus: (value) => statuses.push(value),
      getBaseSnapshot: () => base,
      onSnapshot: (value) => snapshots.push(value), revalidate: async () => { refreshed++; return base; },
    });
    const channel = echo.connector.channels['private-events.12.nominations.34'];
    assert.ok(channel);
    assert.equal(echo.connector.channels['events.12.nominations.34'], undefined);
    const update = {
      event_id: 12, subject_id: 34, status: 'active', total_votes: 1, total_registrations: 2,
      contestant_votes: [1],
    };
    channel.subscription.emit('App\\\\Events\\\\NominationStatisticsUpdated', update);
    assert.deepEqual(snapshots, [{
      ...base, total_votes: 1, total_registrations: 2, participation_percentage: 50,
      contestants: [{ id: 7, name: 'Ava', display_order: 0, votes: 1, rank: 1, percentage: 100 }],
    }]);
    channel.subscription.emit('pusher:subscription_succeeded', {});
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(refreshed, 1);
    assert.equal(statuses.at(-1), 'connected');
    echo.connector.pusher.connection.emit('state_change', { previous: 'connected', current: 'disconnected' });
    assert.equal(statuses.at(-1), 'disconnected');
    stop();
    assert.equal(echo.connector.channels['private-events.12.nominations.34'], undefined);
    assert.equal(getEcho(), echo);
    assert.equal(echo.connector.pusher.connection.state, 'initialized');
  `);
});

test("regular voting leaderboard subscribes to its private Reverb channel and projects vote updates", () => {
  runEcho(`${configured}
    globalThis.window = {};
    const Pusher = (await import('pusher-js')).default;
    Pusher.prototype.connect = function () {};
    const { getEcho, getVotingChannelName } = await import('./lib/echo.js');
    const leaderboard = await import('./lib/voting-leaderboard.mjs');
    const assert = (await import('node:assert/strict')).default;
    assert.equal(typeof leaderboard.subscribeToVotingLeaderboard, 'function');
    const echo = getEcho();
    const statuses = [];
    const snapshots = [];
    let refreshed = 0;
    const base = {
      event: { id: 12, slug: 'gala', title: 'Gala' },
      subject: { id: 34, slug: 'singer', title: 'Singer', status: 'active' },
      total_votes: 0, total_registrations: 2, participation_percentage: 0,
      contestants: [
        { id: 7, name: 'Ava', display_order: 0, votes: 0, rank: 1, percentage: 0 },
        { id: 8, name: 'Bea', display_order: 1, votes: 0, rank: 1, percentage: 0 },
      ],
    };
    const stop = leaderboard.subscribeToVotingLeaderboard({
      echo, channelName: getVotingChannelName(12, 34), eventId: 12, subjectId: 34,
      mode: 'manual', status: 'active', onStatus: (value) => statuses.push(value),
      getBaseSnapshot: () => base,
      onSnapshot: (value) => snapshots.push(value), revalidate: async () => { refreshed++; return base; },
    });
    const channel = echo.connector.channels['private-events.12.voting.34'];
    assert.ok(channel);
    assert.equal(echo.connector.channels['events.12.voting.34'], undefined);
    channel.subscription.emit('App\\\\Events\\\\VotingStatisticsUpdated', {
      event_id: 12, subject_id: 34, status: 'active', total_votes: 1, total_registrations: 2,
      contestant_votes: [1, 0],
    });
    assert.equal(snapshots[0].total_votes, 1);
    assert.equal(snapshots[0].contestants[0].votes, 1);
    assert.equal(refreshed, 0);
    channel.subscription.emit('pusher:subscription_succeeded', {});
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(refreshed, 1);
    assert.equal(statuses.at(-1), 'connected');
    stop();
    assert.equal(echo.connector.channels['private-events.12.voting.34'], undefined);
  `);
});
