import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RoomManager } from '../server/src/rooms/RoomManager';
import { ServerPlayer } from '../server/src/players/ServerPlayer';
import { WebSocket } from 'ws';

// Mock minimal WebSocket for testing
function createMockSocket(): any {
  const sentMessages: any[] = [];
  return {
    readyState: WebSocket.OPEN,
    send: (str: string) => {
      sentMessages.push(JSON.parse(str));
    },
    getSentMessages: () => sentMessages,
    getLastMessage: () => sentMessages[sentMessages.length - 1]
  };
}

describe('DECODED Room & Multiplayer Server Authority Tests', () => {
  it('generates unique 5-character alphanumeric room codes', () => {
    const rm = new RoomManager();
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = rm.generateRoomCode();
      assert.strictEqual(code.length, 5);
      assert.strictEqual(/^[A-Z0-9]{5}$/.test(code), true);
      assert.strictEqual(codes.has(code), false);
      codes.add(code);
    }
  });

  it('creates and joins rooms properly with host assignment', () => {
    const rm = new RoomManager();
    const ws1 = createMockSocket();
    const p1 = new ServerPlayer('p1', 'Alpha', ws1);

    const room = rm.createRoom(p1, 'deathmatch');
    assert.strictEqual(room.hostId, 'p1');
    assert.strictEqual(room.players.size, 1);

    const ws2 = createMockSocket();
    const p2 = new ServerPlayer('p2', 'Bravo', ws2);
    const joinRes = rm.joinRoom(room.id, p2);

    assert.strictEqual(joinRes.success, true);
    assert.strictEqual(room.players.size, 2);
    assert.strictEqual(rm.getPlayerRoom('p2')?.id, room.id);

    room.destroy();
  });

  it('authoritatively validates eliminations: correct vs wrong number', () => {
    const rm = new RoomManager();
    const ws1 = createMockSocket();
    const ws2 = createMockSocket();
    const p1 = new ServerPlayer('p1', 'Spy_1', ws1);
    const p2 = new ServerPlayer('p2', 'Spy_2', ws2);

    const room = rm.createRoom(p1, 'deathmatch');
    rm.joinRoom(room.id, p2);

    // Transition room to PLAYING
    p1.setSecretNumber('1829');
    p2.setSecretNumber('7301');
    (room as any).state = 'PLAYING';

    // Set positions in open zone: p1 at (15, 0, -10) looking at p2; p2 at (15, 0, 0) looking at p1 (yaw = 0)
    p1.position = [15, 0, -10];
    p1.rotationY = Math.PI; // p1 looks towards +Z (at p2)
    p2.position = [15, 0, 0];
    p2.rotationY = 0; // p2 looks towards -Z (at p1, forehead visible)

    // Test 1: P1 guesses wrong number for P2
    room.handleEliminationAttempt(p1.id, p2.id, '9999');
    const lastP1Msg = ws1.getLastMessage();
    assert.strictEqual(lastP1Msg.type, 'ELIMINATION_REJECTED');
    assert.strictEqual(lastP1Msg.reason, 'wrong_number');
    assert.strictEqual(p2.isDead, false, 'Target should survive wrong number');

    // Test 2: P1 is on cooldown, cannot immediately guess again
    room.handleEliminationAttempt(p1.id, p2.id, '7301');
    const cooldownMsg = ws1.getLastMessage();
    assert.strictEqual(cooldownMsg.type, 'ELIMINATION_REJECTED');
    assert.strictEqual(cooldownMsg.reason, 'cooldown');

    // Reset cooldown for next test
    p1.cooldownUntil = 0;

    // Test 3: Correct guess eliminates target!
    room.handleEliminationAttempt(p1.id, p2.id, '7301');
    assert.strictEqual(p2.isDead, true, 'Target should be eliminated upon correct number');
    assert.strictEqual(p1.kills, 1);
    assert.strictEqual(p1.score, 100);

    const elimMsg = ws1.getLastMessage();
    assert.strictEqual(elimMsg.type, 'ELIMINATION_EVENT');
    assert.strictEqual(elimMsg.victimId, 'p2');
    assert.strictEqual(elimMsg.eliminatedNumber, '7301');

    room.destroy();
  });

  it('rejects elimination if target is turned away', () => {
    const rm = new RoomManager();
    const ws1 = createMockSocket();
    const ws2 = createMockSocket();
    const p1 = new ServerPlayer('p1', 'Spy_1', ws1);
    const p2 = new ServerPlayer('p2', 'Spy_2', ws2);

    const room = rm.createRoom(p1, 'deathmatch');
    rm.joinRoom(room.id, p2);

    p1.setSecretNumber('1829');
    p2.setSecretNumber('7301');
    (room as any).state = 'PLAYING';

    p1.position = [15, 0, -10];
    p1.rotationY = Math.PI;
    p2.position = [15, 0, 0];
    p2.rotationY = Math.PI; // Target turned away (facing +Z, away from p1)

    room.handleEliminationAttempt(p1.id, p2.id, '7301');
    const msg = ws1.getLastMessage();
    assert.strictEqual(msg.type, 'ELIMINATION_REJECTED');
    assert.strictEqual(msg.reason, 'not_visible');
    assert.strictEqual(p2.isDead, false);

    room.destroy();
  });
});
