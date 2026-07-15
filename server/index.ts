/**
 * Kindred Peaks — authoritative room server (skeleton).
 *
 * Speaks the exact protocol the client's SocketAdapter expects
 * (src/multiplayer/NetworkManager.ts). Run it, set GameConfig.networkMode to
 * 'socket', and remote players replace the mock Wayfarer.
 *
 *   cd server && npm install && npm run dev
 */
import { Server } from 'socket.io';
import { WorldRoom } from './rooms/WorldRoom';

const PORT = Number(process.env.PORT ?? 2567);

const io = new Server(PORT, {
  cors: { origin: '*' },
});

const room = new WorldRoom(io);

io.on('connection', (socket) => {
  room.join(socket);
  socket.on('state', (snap) => room.onState(socket, snap));
  socket.on('emote', (emote) => room.onEmote(socket, emote));
  socket.on('hello', (data) => room.onHello(socket, data));
  socket.on('disconnect', () => room.leave(socket));
});

console.log(`[kindred-peaks] world room listening on :${PORT}`);
