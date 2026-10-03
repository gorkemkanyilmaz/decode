import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WebSocket } from 'ws';

function connectClient(): Promise<{ ws: WebSocket; messages: any[]; waitFor: (predicate: (msg: any) => boolean, timeout?: number) => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3001');
    const messages: any[] = [];

    ws.on('open', () => {
      resolve({
        ws,
        messages,
        waitFor: (predicate: (msg: any) => boolean, timeout: number = 8000) => {
          return new Promise((res, rej) => {
            const existing = messages.find(predicate);
            if (existing) return res(existing);

            const timer = setTimeout(() => {
              rej(new Error(`Timeout waiting for message matching predicate.`));
            }, timeout);

            const onMsg = (data: any) => {
              try {
                const parsed = JSON.parse(data.toString());
                if (predicate(parsed)) {
                  clearTimeout(timer);
                  ws.off('message', onMsg);
                  res(parsed);
                }
              } catch (e) {}
            };

            ws.on('message', onMsg);
          });
        }
      });
    });

    ws.on('message', (data) => {
      try {
        messages.push(JSON.parse(data.toString()));
      } catch (e) {}
    });

    ws.on('error', reject);
  });
}

describe('DECODED Master Multiplayer Acceptance Test (Section 64)', () => {
  it('executes full two-player room, movement, occlusion, number reading and elimination flow', async () => {
    const clientA = await connectClient();
    clientA.ws.send(JSON.stringify({
      type: 'CREATE_ROOM',
      playerName: 'Agent_Alpha',
      gameMode: 'deathmatch',
      color: '#3B82F6',
      accessory: 'fedora'
    }));

    const joinedA = await clientA.waitFor((m) => m.type === 'ROOM_JOINED');
    const roomCode = joinedA.roomId;
    assert.ok(roomCode);

    const clientB = await connectClient();
    clientB.ws.send(JSON.stringify({
      type: 'JOIN_ROOM',
      roomId: roomCode,
      playerName: 'Agent_Bravo',
      color: '#EF4444',
      accessory: 'cap'
    }));

    const joinedB = await clientB.waitFor((m) => m.type === 'ROOM_JOINED');
    assert.strictEqual(joinedB.roomId, roomCode);

    // Host starts match
    clientA.ws.send(JSON.stringify({ type: 'START_GAME' }));

    await clientA.waitFor((m) => m.type === 'NUMBER_SELECTION_REQUIRED');
    await clientB.waitFor((m) => m.type === 'NUMBER_SELECTION_REQUIRED');

    // Both select numbers
    clientA.ws.send(JSON.stringify({ type: 'SELECT_NUMBER', number: '1829' }));
    clientB.ws.send(JSON.stringify({ type: 'SELECT_NUMBER', number: '7301' }));

    await clientA.waitFor((m) => m.type === 'STATE_CHANGE' && m.state === 'PLAYING');

    // Wait for spawn protection to expire
    await new Promise((r) => setTimeout(r, 4100));

    // Player A looks at B, but B turned away
    clientA.ws.send(JSON.stringify({
      type: 'PLAYER_INPUT',
      seq: 1,
      position: [15, 0, -10],
      rotationY: Math.PI,
      pitch: 0,
      velocity: [0, 0, 0],
      isCrouching: false,
      isSprinting: false,
      isMoving: false
    }));
    clientB.ws.send(JSON.stringify({
      type: 'PLAYER_INPUT',
      seq: 1,
      position: [15, 0, 0],
      rotationY: Math.PI,
      pitch: 0,
      velocity: [0, 0, 0],
      isCrouching: false,
      isSprinting: false,
      isMoving: false
    }));

    await new Promise((r) => setTimeout(r, 200));
    const snapA = clientA.messages.filter((m) => m.type === 'GAME_SNAPSHOT').pop();
    const otherA = snapA.players.find((p: any) => p.id === joinedB.playerId);
    assert.strictEqual(otherA.visibleNumber, null, 'Forehead number should be null when target turned away');

    // Player B turns toward Player A
    clientB.ws.send(JSON.stringify({
      type: 'PLAYER_INPUT',
      seq: 2,
      position: [15, 0, 0],
      rotationY: 0,
      pitch: 0,
      velocity: [0, 0, 0],
      isCrouching: false,
      isSprinting: false,
      isMoving: false
    }));

    await new Promise((r) => setTimeout(r, 200));
    const snapFacing = clientA.messages.filter((m) => m.type === 'GAME_SNAPSHOT').pop();
    const otherFacing = snapFacing.players.find((p: any) => p.id === joinedB.playerId);
    assert.strictEqual(otherFacing.visibleNumber, '7301', 'Forehead number should be visible when target turns toward viewer');

    // Player B moves behind stacked crate cover (height 2.4m)
    clientA.ws.send(JSON.stringify({
      type: 'PLAYER_INPUT',
      seq: 3,
      position: [-14, 0, -35],
      rotationY: Math.PI,
      pitch: 0,
      velocity: [0, 0, 0],
      isCrouching: false,
      isSprinting: false,
      isMoving: false
    }));
    clientB.ws.send(JSON.stringify({
      type: 'PLAYER_INPUT',
      seq: 3,
      position: [-14, 0, -20],
      rotationY: 0,
      pitch: 0,
      velocity: [0, 0, 0],
      isCrouching: false,
      isSprinting: false,
      isMoving: false
    }));

    await new Promise((r) => setTimeout(r, 250));
    const snapBehind = clientA.messages.filter((m) => m.type === 'GAME_SNAPSHOT').pop();
    const otherBehind = snapBehind.players.find((p: any) => p.id === joinedB.playerId);
    assert.strictEqual(otherBehind.visibleNumber, null, 'Forehead number should be null when behind cover');

    // Wrong guess yields penalty & rejection
    const rejectStartIdx = clientA.messages.length;
    clientA.ws.send(JSON.stringify({
      type: 'ELIMINATION_ATTEMPT',
      targetId: joinedB.playerId,
      guessedNumber: '9999'
    }));

    while (!clientA.messages.slice(rejectStartIdx).find((m) => m.type === 'ELIMINATION_REJECTED')) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const reject = clientA.messages.slice(rejectStartIdx).find((m) => m.type === 'ELIMINATION_REJECTED');
    assert.strictEqual(reject.reason, 'wrong_number', 'Server must reject wrong number');

    // Wait for wrong-guess cooldown to clear (5.1s)
    await new Promise((r) => setTimeout(r, 5100));

    // Player A eliminates Player B by entering seen number 7301 even though B moved behind cover
    clientA.ws.send(JSON.stringify({
      type: 'ELIMINATION_ATTEMPT',
      targetId: joinedB.playerId,
      guessedNumber: '7301'
    }));

    const elimA = await clientA.waitFor((m) => m.type === 'ELIMINATION_EVENT');
    assert.strictEqual(elimA.victimId, joinedB.playerId);
    assert.strictEqual(elimA.eliminatedNumber, '7301');
    assert.strictEqual(elimA.attackerScore, 100);

    // Verify Player B respawn prompt
    const respawnB = await clientB.waitFor((m) => m.type === 'NUMBER_SELECTION_REQUIRED' && m.isRespawn);
    assert.ok(respawnB);

    clientA.ws.close();
    clientB.ws.close();
  });
});
