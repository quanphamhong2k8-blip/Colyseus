// src/rooms/Solo.ts — room kiểu relay cho Flo Hero (Colyseus 0.15)
import { Room, Client } from "colyseus";

export class Solo extends Room {
  maxClients = 8;
  last: Record<string, any> = {}; // trạng thái cuối của từng người chơi
  mobs: any = null;               // trạng thái quái cuối (chủ phòng gửi)

  onCreate(_options: any) {
    // vị trí / trạng thái người chơi → chuyển cho những người còn lại
    this.onMessage("p", (client, d) => {
      const predicted = Number.isSafeInteger(d?.seq)
        && Number.isFinite(d?.x)
        && Number.isFinite(d?.z);
      const snapshot = predicted
        ? { ...d, x: Math.max(-110, Math.min(110, d.x)), z: Math.max(-110, Math.min(110, d.z)) }
        : d;

      this.last[client.sessionId] = snapshot;
      this.broadcast("p", { ...snapshot, id: client.sessionId }, { except: client });
      if (predicted) {
        client.send("ack", { seq: d.seq, x: snapshot.x, z: snapshot.z });
      }
    });
    // sự kiện (chiêu, hiệu ứng, sát thương...)
    this.onMessage("e", (client, d) => this.broadcast("e", d, { except: client }));
    // trạng thái quái (chủ phòng gửi)
    this.onMessage("m", (client, d) => {
      this.mobs = d;
      this.broadcast("m", d, { except: client });
    });
    // đồng bộ đồng hồ: trả giờ server
    this.onMessage("ping", (client, d) => client.send("pong", { c: d, s: Date.now() }));
    // client đăng ký xong handler mới gửi "ready" → nhận trạng thái hiện có
    this.onMessage("ready", (client) => {
      for (const id in this.last) {
        if (id !== client.sessionId) client.send("p", { id, ...this.last[id] });
      }
      if (this.mobs) client.send("m", this.mobs);
    });
  }

  onJoin(client: Client) {}

  onLeave(client: Client) {
    delete this.last[client.sessionId];
    this.broadcast("leave", client.sessionId);
  }

  onDispose() {}
}
