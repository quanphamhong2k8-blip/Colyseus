// src/rooms/Solo.ts — room kiểu relay cho Flo Hero (Colyseus 0.15)
// Bản tối ưu độ trễ: relay không sao chép object, ack chỉ gửi khi cần sửa vị trí, tắt patch timer.
import { Room, Client } from "colyseus";

const LIM = 110; // giới hạn sàn đấu (khớp client)

export class Solo extends Room {
  maxClients = 8;
  last: Record<string, any> = {}; // trạng thái cuối của từng người chơi
  mobs: any = null;               // trạng thái quái cuối (chủ phòng gửi)

  onCreate(_options: any) {
    // Room này không dùng state schema → tắt vòng lặp patch (mặc định chạy mỗi 50ms vô ích)
    (this as any).setPatchRate?.(null);

    // vị trí / trạng thái người chơi → chuyển cho những người còn lại
    this.onMessage("p", (client, d) => {
      if (!d || typeof d !== "object") return;
      const ox = d.x, oz = d.z;
      const predicted = Number.isSafeInteger(d.seq) && Number.isFinite(ox) && Number.isFinite(oz);
      if (predicted) { // kẹp trong sàn đấu, sửa trực tiếp trên object vừa giải mã (không tạo bản sao)
        d.x = ox > LIM ? LIM : ox < -LIM ? -LIM : ox;
        d.z = oz > LIM ? LIM : oz < -LIM ? -LIM : oz;
      }
      d.id = client.sessionId;
      this.last[d.id] = d;
      this.broadcast("p", d, { except: client });
      // Ack chỉ có tác dụng khi server SỬA vị trí (client bỏ qua ack trùng khớp) → bỏ gói thừa, giảm ~1 gói/gói
      if (predicted && (d.x !== ox || d.z !== oz)) {
        client.send("ack", { seq: d.seq, x: d.x, z: d.z });
      }
    });
    // sự kiện (chiêu, hiệu ứng, sát thương...)
    this.onMessage("e", (client, d) => this.broadcast("e", d, { except: client }));
    // trạng thái quái (chủ phòng gửi)
    this.onMessage("m", (client, d) => {
      this.mobs = d;
      this.broadcast("m", d, { except: client });
    });
    // đồng bộ đồng hồ / đo RTT: trả giờ server
    this.onMessage("ping", (client, d) => client.send("pong", { c: d, s: Date.now() }));
    // client đăng ký xong handler mới gửi "ready" → nhận trạng thái hiện có
    this.onMessage("ready", (client) => {
      const now = Date.now();
      for (const id in this.last) {
        if (id !== client.sessionId) client.send("p", { ...this.last[id], id, ts: now }); // ts mới → không bị coi là gói cũ
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
