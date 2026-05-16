require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

// ── Configuration ────────────────────────────────────────────────────────────

const AUTO_REPLY_MESSAGE =
  process.env.AUTO_REPLY_MESSAGE ||
  "Thank you for your message. Biswaroop will respond to you shortly.";

// Reply to group messages as well? Set REPLY_TO_GROUPS=true in .env to enable.
const REPLY_TO_GROUPS = process.env.REPLY_TO_GROUPS === "true";

// Optional: only reply once per sender per session (avoids spamming in long chats).
// Set REPLY_ONCE_PER_SENDER=false in .env to disable.
const REPLY_ONCE_PER_SENDER = process.env.REPLY_ONCE_PER_SENDER !== "false";

// ── State ────────────────────────────────────────────────────────────────────

const repliedSenders = new Set();

// ── Client setup ─────────────────────────────────────────────────────────────

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  },
});

// ── Events ───────────────────────────────────────────────────────────────────

client.on("qr", (qr) => {
  console.log("\n──────────────────────────────────────────");
  console.log("  Scan the QR code below with WhatsApp:");
  console.log("  (Open WhatsApp → Settings → Linked Devices → Link a Device)");
  console.log("──────────────────────────────────────────\n");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("✓ Authenticated — session saved locally.");
});

client.on("auth_failure", (msg) => {
  console.error("✗ Authentication failed:", msg);
  console.error("  Delete the .wwebjs_auth folder and restart to re-scan the QR code.");
  process.exit(1);
});

client.on("ready", () => {
  console.log("\n──────────────────────────────────────────");
  console.log("  WhatsApp auto-reply agent is RUNNING");
  console.log(`  Reply once per sender: ${REPLY_ONCE_PER_SENDER}`);
  console.log(`  Reply to groups:       ${REPLY_TO_GROUPS}`);
  console.log("──────────────────────────────────────────\n");
});

client.on("message", async (message) => {
  try {
    // Ignore messages sent by the account itself.
    if (message.fromMe) return;

    const chat = await message.getChat();

    // Optionally skip group chats.
    if (chat.isGroup && !REPLY_TO_GROUPS) return;

    const senderId = message.from;

    // Optionally skip if already replied to this sender in the current session.
    if (REPLY_ONCE_PER_SENDER && repliedSenders.has(senderId)) return;

    const contact = await message.getContact();
    const senderName = contact.pushname || contact.name || senderId;

    console.log(
      `[${new Date().toLocaleTimeString()}] Message from ${senderName} (${senderId}): "${message.body}"`
    );

    await message.reply(AUTO_REPLY_MESSAGE);
    repliedSenders.add(senderId);

    console.log(`  ↳ Auto-replied to ${senderName}`);
  } catch (err) {
    console.error("Error handling message:", err);
  }
});

client.on("disconnected", (reason) => {
  console.warn("Client disconnected:", reason);
  console.warn("Attempting to restart in 5 seconds…");
  setTimeout(() => client.initialize(), 5000);
});

// ── Start ─────────────────────────────────────────────────────────────────────

console.log("Starting WhatsApp auto-reply agent…");
client.initialize();
