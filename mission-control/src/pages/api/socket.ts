import type { NextApiRequest, NextApiResponse } from "next";
import { initSocket } from "@/lib/socket";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket?.server) {
    res.status(500).json({ ok: false, error: "socket_unavailable" });
    return;
  }

  initSocket(res.socket.server);
  res.status(200).json({ ok: true });
}
