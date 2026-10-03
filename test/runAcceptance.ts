import { WebSocket } from 'ws';

async function run() {
  console.log('Connecting Client A...');
  const wsA = new WebSocket('ws://localhost:3001');
  const msgsA: any[] = [];
  wsA.on('message', (d) => msgsA.push(JSON.parse(d.toString())));
  await new Promise((r) => wsA.on('open', r));

  console.log('Creating room...');
  wsA.send(JSON.stringify({
    type: 'CREATE_ROOM',
    playerName: 'Alpha',
    gameMode: 'deathmatch',
    color: '#3B82F6',
    accessory: 'fedora'
  }));

  while (!msgsA.find((m) => m.type === 'ROOM_JOINED')) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const joinedA = msgsA.find((m) => m.type === 'ROOM_JOINED');
  console.log('Room created with code:', joinedA.roomId);

  console.log('Connecting Client B...');
  const wsB = new WebSocket('ws://localhost:3001');
  const msgsB: any[] = [];
  wsB.on('message', (d) => msgsB.push(JSON.parse(d.toString())));
  await new Promise((r) => wsB.on('open', r));

  console.log('Client B joining room:', joinedA.roomId);
  wsB.send(JSON.stringify({
    type: 'JOIN_ROOM',
    roomId: joinedA.roomId,
    playerName: 'Bravo',
    color: '#EF4444',
    accessory: 'cap'
  }));

  while (!msgsB.find((m) => m.type === 'ROOM_JOINED')) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const joinedB = msgsB.find((m) => m.type === 'ROOM_JOINED');
  console.log('Client B joined! Host starting game...');

  wsA.send(JSON.stringify({ type: 'START_GAME' }));

  console.log('Waiting for NUMBER_SELECTION_REQUIRED...');
  while (!msgsA.find((m) => m.type === 'NUMBER_SELECTION_REQUIRED')) {
    await new Promise((r) => setTimeout(r, 50));
  }
  console.log('Number selection required received!');

  wsA.send(JSON.stringify({ type: 'SELECT_NUMBER', number: '1829' }));
  wsB.send(JSON.stringify({ type: 'SELECT_NUMBER', number: '7301' }));
  console.log('Selected numbers: A=1829, B=7301');

  console.log('Waiting for PLAYING state...');
  while (!msgsA.find((m) => m.type === 'STATE_CHANGE' && m.state === 'PLAYING')) {
    await new Promise((r) => setTimeout(r, 50));
  }
  console.log('Round is now PLAYING!');

  // Wait 4.1 seconds for spawn protection to wear off
  console.log('Waiting for spawn protection shield to expire (4.1s)...');
  await new Promise((r) => setTimeout(r, 4100));

  // Step 1: Position B facing away from A
  console.log('Setting Player A at [15,0,-10] facing +Z, Player B at [15,0,0] facing away (+Z)...');
  wsA.send(JSON.stringify({
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
  wsB.send(JSON.stringify({
    type: 'PLAYER_INPUT',
    seq: 1,
    position: [15, 0, 0],
    rotationY: Math.PI, // Facing away
    pitch: 0,
    velocity: [0, 0, 0],
    isCrouching: false,
    isSprinting: false,
    isMoving: false
  }));

  await new Promise((r) => setTimeout(r, 200));
  const latestSnapTurned = msgsA.filter((m) => m.type === 'GAME_SNAPSHOT').pop();
  const targetTurned = latestSnapTurned.players.find((p: any) => p.id === joinedB.playerId);
  console.log('Player B visibleNumber when turned away:', targetTurned?.visibleNumber);
  if (targetTurned?.visibleNumber !== null) {
    throw new Error(`Expected null visibleNumber when target turned away, got: ${targetTurned?.visibleNumber}`);
  }

  // Step 2: Player B turns toward Player A
  console.log('Player B turning toward Player A (yaw = 0)...');
  wsB.send(JSON.stringify({
    type: 'PLAYER_INPUT',
    seq: 2,
    position: [15, 0, 0],
    rotationY: 0, // Facing A
    pitch: 0,
    velocity: [0, 0, 0],
    isCrouching: false,
    isSprinting: false,
    isMoving: false
  }));

  await new Promise((r) => setTimeout(r, 200));
  const latestSnapFacing = msgsA.filter((m) => m.type === 'GAME_SNAPSHOT').pop();
  const targetFacing = latestSnapFacing.players.find((p: any) => p.id === joinedB.playerId);
  console.log('Player B visibleNumber when facing A:', targetFacing?.visibleNumber);
  if (targetFacing?.visibleNumber !== '7301') {
    throw new Error(`Expected '7301' when target facing, got: ${targetFacing?.visibleNumber}`);
  }

  // Step 3: Move behind stacked crates cover at x = -14, z = -28 (height 2.4m)
  console.log('Player B moving behind stacked crates at [-14,0,-20] while A is at [-14,0,-35]...');
  wsA.send(JSON.stringify({
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
  wsB.send(JSON.stringify({
    type: 'PLAYER_INPUT',
    seq: 3,
    position: [-14, 0, -20], // Stacked crate is at [-14, 0, -28], height 2.4m!
    rotationY: 0,
    pitch: 0,
    velocity: [0, 0, 0],
    isCrouching: false,
    isSprinting: false,
    isMoving: false
  }));

  await new Promise((r) => setTimeout(r, 300));

  const latestSnapBehindCrate = msgsA.filter((m) => m.type === 'GAME_SNAPSHOT').pop();
  const targetBehindCrate = latestSnapBehindCrate.players.find((p: any) => p.id === joinedB.playerId);
  console.log('Player B visibleNumber when behind stacked crate:', targetBehindCrate?.visibleNumber);
  if (targetBehindCrate?.visibleNumber !== null) {
    throw new Error(`Expected null visibleNumber when behind stacked crate, got: ${targetBehindCrate?.visibleNumber}`);
  }

  console.log('Player A attempting elimination through crate...');
  const rejectStartIndex = msgsA.length;
  wsA.send(JSON.stringify({
    type: 'ELIMINATION_ATTEMPT',
    targetId: joinedB.playerId,
    guessedNumber: '7301'
  }));

  while (!msgsA.slice(rejectStartIndex).find((m) => m.type === 'ELIMINATION_REJECTED')) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const reject = msgsA.slice(rejectStartIndex).find((m) => m.type === 'ELIMINATION_REJECTED');
  console.log('Elimination through crate rejected as expected! Reason:', reject.reason, '-', reject.message);
  if (reject.reason !== 'not_visible') {
    throw new Error(`Expected reason 'not_visible', got: ${reject.reason}`);
  }

  // Step 4: Move back to open line of sight and eliminate
  console.log('Moving back into clear line of sight...');
  wsA.send(JSON.stringify({
    type: 'PLAYER_INPUT',
    seq: 4,
    position: [15, 0, -10],
    rotationY: Math.PI,
    pitch: 0,
    velocity: [0, 0, 0],
    isCrouching: false,
    isSprinting: false,
    isMoving: false
  }));
  wsB.send(JSON.stringify({
    type: 'PLAYER_INPUT',
    seq: 4,
    position: [15, 0, 0],
    rotationY: 0,
    pitch: 0,
    velocity: [0, 0, 0],
    isCrouching: false,
    isSprinting: false,
    isMoving: false
  }));

  console.log('Waiting for 2.2s cooldown to clear...');
  await new Promise((r) => setTimeout(r, 2200));

  console.log('Player A decoding Player B with correct number 7301...');
  wsA.send(JSON.stringify({
    type: 'ELIMINATION_ATTEMPT',
    targetId: joinedB.playerId,
    guessedNumber: '7301'
  }));

  while (!msgsA.find((m) => m.type === 'ELIMINATION_EVENT')) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const elim = msgsA.find((m) => m.type === 'ELIMINATION_EVENT');
  console.log('SUCCESS! Player B eliminated! Event:', elim);

  console.log('Waiting for Player B respawn prompt...');
  while (!msgsB.find((m) => m.type === 'NUMBER_SELECTION_REQUIRED' && m.isRespawn)) {
    await new Promise((r) => setTimeout(r, 100));
  }
  console.log('Player B received new cipher assignment prompt for respawn!');

  wsA.close();
  wsB.close();
  console.log('ALL SECTION 64 ACCEPTANCE CRITERIA FULLY SATISFIED AND PASSED!');
}

run().catch((err) => {
  console.error('Acceptance test failed with error:', err);
  process.exit(1);
});
