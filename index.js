const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require("@whiskeysockets/baileys")
const pino = require("pino")

let pairingCodeRequested = false

async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const { version } = await fetchLatestBaileysVersion()
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", ""]
    })

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update
        
        if (connection === "connecting") {
            if (!sock.authState.creds.registered &&!pairingCodeRequested) {
                pairingCodeRequested = true
                const phoneNumber = "6283844376032"
                setTimeout(async () => {
                    try {
                        let code = await sock.requestPairingCode(phoneNumber)
                        code = code?.match(/.{1,4}/g)?.join("-") || code
                        console.log("PAIRING CODE CUMA 1X:", code)
                    } catch {
                        pairingCodeRequested = false
                    }
                }, 3000)
            }
        }
        
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut
            if (shouldReconnect) {
                pairingCodeRequested = false
                connectBot()
            }
        }
        
        if (connection === "open") {
            console.log("BOT CONNECTED - STABLE VERSION")
        }
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        
        const text = m.message.conversation || m.message.extendedTextMessage?.text || ""
        
        if (text === ".menu") {
            await sock.sendMessage(m.key.remoteJid, { text: "Bot Online\n1..ping\n2..owner" }, { quoted: m })
        }
        
        if (text === ".ping") {
            await sock.sendMessage(m.key.remoteJid, { text: "Pong! Stable" }, { quoted: m })
        }
        
        if (text === ".owner") {
            await sock.sendMessage(m.key.remoteJid, { text: "Owner: Dimas" }, { quoted: m })
        }
    })
}

connectBot()
