const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const pino = require("pino")
const axios = require("axios")
const moment = require("moment-timezone")

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const { version } = await fetchLatestBaileysVersion()
    
    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    })

    if (!sock.authState.creds.registered) {
        const phoneNumber = "6283844376032" // GANTI INI PAKE NOMOR LU, AWAL 62
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber)
            code = code?.match(/.{1,4}/g)?.join("-") || code
            console.log(`\nPAIRING CODE LU: ${code}\n`)
        }, 3000)
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update
        if(connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
        } else if(connection === "open") {
            console.log("BOT CONNECTED 🔥 SULTAN ONLINE")
        }
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || ""
        const command = body.toLowerCase()
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(" ")
        const reply = (teks) => sock.sendMessage(from, { text: teks }, { quoted: m })

        if (command == ".menu") {
            let jam = moment.tz("Asia/Jakarta").format("HH:mm:ss")
            reply(`*BOT WA SULTAN 24 JAM 🔥*\n\nJam: ${jam} WIB\n\n*LIST MENU:*\n1..ping - Cek bot\n2..sticker - Gambar jadi stiker\n3..brat <teks> - Stiker teks\n4..ai <pertanyaan> - Nanya AI\n5..tiktok <link> - Download TikTok\n6..ig <link> - Download IG\n7..owner - Info owner`)
        }
        else if (command == ".ping") reply(`Pong! 🏓 Railway 24 Jam 🔥`)
        else if (command == ".sticker" || command == ".s") {
            let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
            let msgType = qmsg? Object.keys(qmsg)[0] : Object.keys(m.message)[0]
            if (msgType === 'imageMessage') {
                let buffer = await sock.downloadMediaMessage(qmsg? { message: qmsg } : m)
                await sock.sendMessage(from, { sticker: buffer }, { quoted: m })
            } else reply("Reply gambar pake.sticker")
        }
        else if (command.startsWith(".ai ")) {
            if (!q) return reply("Mau nanya apa?.ai <pertanyaan>")
            reply("Sabar lagi mikir...")
            try {
                let res = await axios.get(`https://api.nyxs.pw/ai/gpt4?text=${encodeURIComponent(q)}`)
                reply(res.data.result)
            } catch { reply("AI lagi error bro") }
        }
        else if (command == ".owner") reply("Owner: Dimas 🔥\nBot 24 Jam by Railway")
    })
}
startBot()
