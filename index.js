const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const pino = require("pino")

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({ 
        version, 
        logger: pino({ level: "silent" }), 
        printQRInTerminal: false, 
        auth: state, 
        browser: ["Chrome", "Linux", ""] 
    })

    sock.ev.on("connection.update", async (update) => {
        const { connection } = update
        if(connection === "open") console.log("BOT CONNECTED - MINIMAL WORK")
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message) return
        const from = m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || ""
        if (body === ".menu") {
            await sock.sendMessage(from, { text: "Bot Online\n.menu\n.ping" }, { quoted: m })
        }
        if (body === ".ping") {
            await sock.sendMessage(from, { text: "Pong!" }, { quoted: m })
        }
    })
}

startBot()
