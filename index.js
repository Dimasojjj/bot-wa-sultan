const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } = require("@whiskeysockets/baileys")
const pino = require("pino")
const axios = require("axios")
const moment = require("moment-timezone")

let pairingCodeRequested = false

async function connectBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({ version, logger: pino({ level: "silent" }), printQRInTerminal: false, auth: state, browser: ["Ubuntu", "Chrome", ""] })

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
                        console.log("PAIRING CODE:", code)
                    } catch { pairingCodeRequested = false }
                }, 3000)
            }
        }
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) {
                pairingCodeRequested = false
                connectBot()
            }
        }
        if (connection === "open") console.log("BOT SULTAN API BARU ON")
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || ""
        const command = body.startsWith(".")? body.slice(1).split(" ")[0].toLowerCase() : ""
        const q = body.trim().split(/ +/).slice(1).join(" ")
        const reply = (teks) => sock.sendMessage(from, { text: teks }, { quoted: m })

        try {
            switch (command) {
                case "menu": {
                    let jam = moment.tz("Asia/Jakarta").format("HH:mm:ss")
                    reply(`*BOT SULTAN FIX 404*\nJam: ${jam} WIB\n\n*AI*\n.ai <tanya>\n\n*DOWNLOADER*\n.tiktok <link>\n.play <judul>\n\n*STIKER*\n.sticker\n.brat <teks>\n\n*FUN*\n.meme\n.quotes\n.jodoh <nama|nama>\n\n*INFO*\n.gempa\n\n*GAME*\n.tebakgambar\n\nTes.ping`)
                } break

                case "ping": reply("Pong! Aman bro " + (new Date() - new Date(m.messageTimestamp * 1000)) + "ms")
                break

                case "ai": {
                    if (!q) return reply("Nanya apa?.ai cara bahagia")
                    reply("Mikirr...")
                    let { data } = await axios.get(`https://api.ryzendesu.vip/api/ai/v2/chatgpt?text=${encodeURIComponent(q)}`)
                    reply(data.response)
                } break

                case "sticker": case "s": {
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    let msgType = qmsg? Object.keys(qmsg)[0] : Object.keys(m.message)[0]
                    if (msgType === 'imageMessage' || msgType === 'videoMessage') {
                        let stream = await downloadContentFromMessage(qmsg? qmsg[msgType] : m.message[msgType], msgType.replace('Message', ''))
                        let buffer = Buffer.from([])
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        await sock.sendMessage(from, { sticker: buffer }, { quoted: m })
                    } else reply("Reply gambar/video pake.sticker")
                } break

                case "tiktok": {
                    if (!q) return reply(".tiktok https://vt.tiktok.com/xxx")
                    reply("Download...")
                    let { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/ttdl?url=${q}`)
                    await sock.sendMessage(from, { video: { url: data.data.video }, caption: "Nih no WM" }, { quoted: m })
                } break

                case "play": {
                    if (!q) return reply(".play dermaga biru")
                    reply("Cari lagu...")
                    let { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp3?query=${encodeURIComponent(q)}`)
                    await sock.sendMessage(from, { audio: { url: data.data.download.url }, mimetype: 'audio/mpeg' }, { quoted: m })
                } break

                case "brat": {
                    if (!q) return reply(".brat halo")
                    reply("Bikin stiker...")
                    let { data } = await axios.get(`https://api.ryzendesu.vip/api/image/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer' })
                    await sock.sendMessage(from, { sticker: data }, { quoted: m })
                } break

                case "meme": {
                    let { data } = await axios.get(`https://api.ryzendesu.vip/api/random/memeindo`)
                    await sock.sendMessage(from, { image: { url: data.url }, caption: "Meme" }, { quoted: m })
                } break

                case "quotes": {
                    let { data } = await axios.get(`https://api.ryzendesu.vip/api/random/quotes`)
                    reply(`"${data.data.quotes}"\n\n- ${data.data.author}`)
                } break

                case "jodoh": {
                    if (!q.includes('|')) return reply(".jodoh Dimas|Ayu")
                    let [n1, n2] = q.split('|')
                    let p = Math.floor(Math.random() * 100)
                    reply(`JODOH\n\n${n1} LOVE ${n2}\nKecocokan: ${p}%\n${p > 70? 'Jodoh' : 'Temenan'}`)
                } break

                case "gempa": {
                    let { data } = await axios.get(`https://api.ryzendesu.vip/api/information/gempa`)
                    let i = data.data
                    reply(`INFO GEMPA\n\nLokasi: ${i.wilayah}\nMagnitudo: ${i.magnitude}\nKedalaman: ${i.kedalaman}\nWaktu: ${i.waktu}`)
                } break

                case "tebakgambar": {
                    let { data } = await axios.get(`https://api.ryzendesu.vip/api/game/tebakgambar`)
                    await sock.sendMessage(from, { image: { url: data.data.image }, caption: `Tebak Gambar\n\nClue: ${data.data.answer.replace(/[aiueo]/gi, '_')}` }, { quoted: m })
                } break
            }
        } catch (e) {
            console.log("ERROR COMMAND:", command, e.message)
            reply(`Error bro: ${e.message}\nCoba command lain dulu`)
        }
    })
}

connectBot()
