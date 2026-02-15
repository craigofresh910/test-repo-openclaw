import type { Server as HttpServer } from "http";
import { Server as IOServer } from "socket.io";

type GlobalWithIO = typeof globalThis & {
  __io?: IOServer;
};

export function initSocket(server: HttpServer) {
  const globalWithIO = globalThis as GlobalWithIO;
  if (!globalWithIO.__io) {
    globalWithIO.__io = new IOServer(server, {
      path: "/api/socket",
      cors: { origin: "*" },
    });
  }
  return globalWithIO.__io;
}

export function getIO() {
  return (globalThis as GlobalWithIO).__io ?? null;
}

export function emitEvent(event: string, payload: unknown) {
  const io = getIO();
  if (io) {
    io.emit(event, payload);
  }
}
