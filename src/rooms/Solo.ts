// src/rooms/Solo.ts — room kiểu relay cho Flo Hero (Colyseus 0.15)
import { Room, Client } from "colyseus";

export class Solo extends Room {
  maxClients = 8;
  last: Record<string, any> = {}; // trạng thái cuối của từng người chơi
  mobs: any = null;               // trạng thái quái cuối (chủ phòng gửi)

  onCreate(_options: any) {
    // vị trí / trạng thái người chơi → chuyển cho những người còn lại
    this.onMessage("p", (client, d) => {
      this.last[client.sessionId] = d;
      this.broadcast("p", { ...d, id: client.sessionId }, { except: client });
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
