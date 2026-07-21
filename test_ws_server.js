const Bun = globalThis.Bun;

Bun.serve({
  port: 8999,
  hostname: "0.0.0.0",
  fetch(req, server) {
    console.log("=== Incoming WebSocket Upgrade Request ===");
    console.log("URL:", req.url);
    console.log("Method:", req.method);
    for (const [key, val] of req.headers.entries()) {
      console.log(`${key}: ${val}`);
    }
    
    if (server.upgrade(req)) {
      console.log("Upgrade triggered successfully");
      return undefined;
    }
    console.log("Upgrade failed");
    return new Response("Upgrade failed", { status: 400 });
  },
  websocket: {
    open(ws) {
      console.log("WebSocket opened");
      ws.send("hello");
    },
    message(ws, msg) {
      console.log("Message received:", msg);
    },
    close(ws) {
      console.log("WebSocket closed");
    }
  }
});
console.log("Test WebSocket server running on port 8999...");
