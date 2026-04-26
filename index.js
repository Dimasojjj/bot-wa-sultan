const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } = require("@whiskeysockets/baileys")
const pino = require("pino")
const axios = require("axios")
const moment = require("moment-timezone")
const sharp = require("sharp") // BUAT CONVERT KE WEBP ANTI ABU2
const fs = require("fs")

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
        if (connection === "open") console.log("BOT FINAL FIX ON")
    })

    sock.ev.on("creds.update", saveCreds)

    // FUNGSI STIKER ANTI ABU2
    async function createSticker(buffer) {
        const webp = await sharp(buffer)
           .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
           .webp()
           .toBuffer()
        return webp
    }

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ""
        const command = body.startsWith(".")? body.slice(1).split(" ")[0].toLowerCase() : ""
        const q = body.trim().split(/ +/).slice(1).join(" ")
        const reply = (teks) => sock.sendMessage(from, { text: teks }, { quoted: m })

        try {
            switch (command) {
                case "menu": {
                    let jam = moment.tz("Asia/Jakarta").format("HH:mm:ss")
                    reply(`*BOT FINAL 100% WORK*\nJam: ${jam} WIB\n\n*DIJAMIN JALAN*\n.ping\n.gempa\n.jodoh <nama|nama>\n.sticker\n.toimg\n.brat <teks>\n.qc <teks>\n\n*GACHA - KALO API IDUP*\n.ai <tanya>\n.meme\n.play <judul>\n.tiktok <link>\n\nTes.ping dulu`)
                } break

                case "ping": reply("Pong! Aman bro " + (new Date() - new Date(m.messageTimestamp * 1000)) + "ms")
                break

                // STICKER 100% JADI - PAKE SHARP
                case "sticker": case "s": {
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    let msgType = qmsg? Object.keys(qmsg)[0] : Object.keys(m.message)[0]
                    if (msgType === 'imageMessage' || msgType === 'videoMessage') {
                        reply("Bikin stiker...")
                        let stream = await downloadContentFromMessage(qmsg? qmsg[msgType] : m.message[msgType], msgType.replace('Message', ''))
                        let buffer = Buffer.from([])
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        let stickerBuffer = await createSticker(buffer) // CONVERT WEBP ANTI ABU2
                        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m })
                    } else reply("Reply gambar/video pake.sticker")
                } break

                case "toimg": {
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    if (qmsg?.stickerMessage) {
                        reply("Convert ke gambar...")
                        let stream = await downloadContentFromMessage(qmsg.stickerMessage, 'sticker')
                        let buffer = Buffer.from([])
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        await sock.sendMessage(from, { image: buffer }, { quoted: m })
                    } else reply("Reply stiker pake.toimg")
                } break

                case "brat": {
                    if (!q) return reply(".brat halo")
                    reply("Bikin stiker...")
                    try {
                        let { data } = await axios.get(`https://brat.caliphdev.com/api/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 20000 })
                        await sock.sendMessage(from, { sticker: data }, { quoted: m })
                    } catch { reply("API Brat turu") }
                } break

                case "qc": {
                    if (!q) return reply(".qc halo")
                    reply("Bikin stiker...")
                    let pp = await sock.profilePictureUrl(m.key.participant || from, 'image').catch(() => 'https://telegra.ph/file/24121c8c22d4e68e50d28.png')
                    let nama = m.pushName || 'User'
                    try {
                        let { data } = await axios.get(`https://api.siputzx.my.id/api/m/qc?text=${encodeURIComponent(q)}&name=${encodeURIComponent(nama)}&url=${encodeURIComponent(pp)}`, { responseType: 'arraybuffer', timeout: 20000 })
                        await sock.sendMessage(from, { sticker: data }, { quoted: m })
                    } catch { reply("API QC turu") }
                } break

                // GEMPA - BMKG ASLI JADI PASTI JALAN
                case "gempa": {
                    let { data } = await axios.get(`https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`, { timeout: 10000 })
                    let i = data?.Infogempa?.gempa
                    if (!i) return reply("BMKG lagi turu")
                    reply(`*INFO GEMPA BMKG*\n\nWilayah: ${i.Wilayah}\nMagnitudo: ${i.Magnitude}\nKedalaman: ${i.Kedalaman}\nWaktu: ${i.Tanggal} ${i.Jam}\nPotensi: ${i.Potensi}\n\nSumber: BMKG`)
                } break

                // JODOH - OFFLINE ANTI ERROR
                case "jodoh": {
                    if (!q.includes('|')) return reply(".jodoh Dimas|Ayu")
                    let [n1, n2] = q.split('|')
                    let p = Math.floor(Math.random() * 100)
                    reply(`JODOH\n\n${n1} LOVE ${n2}\nKecocokan: ${p}%\n${p > 70? 'Jodoh gas nikah' : p > 40? 'Lumayan' : 'Temenan aja'}`)
                } break

                // MEME - 3 API CADANGAN
                case "meme": {
                    reply("Cari meme...")
                    let url = null
                    try {
                        let { data } = await axios.get(`https://api.siputzx.my.id/api/r/memeindo`, { timeout: 10000 })
                        url = data?.data?.url || data?.url
                    } catch {
                        try {
                            let { data } = await axios.get(`https://api.lolhuman.xyz/api/meme/memeindo`, { timeout: 10000 })
                            url = data?.result
                        } catch { url = null }
                    }
                    if (!url) return reply("Semua API Meme turu bro")
                    await sock.sendMessage(from, { image: { url: url }, caption: "Meme Indo" }, { quoted: m })
                } break

                // AI - 2 API CADANGAN
                case "ai": {
                    if (!q) return reply(".ai cara bahagia")
                    reply("Mikirr...")
                    try {
                        let { data } = await axios.get(`https://api.siputzx.my.id/api/ai/gpt3?prompt=Kamu asisten kocak&content=${encodeURIComponent(q)}`, { timeout: 20000 })
                        reply(data?.data || "AI turu")
                    } catch {
                        try {
                            let { data } = await axios.get(`https://api.ryzendesu.vip/api/ai/v2/chatgpt?text=${encodeURIComponent(q)}`, { timeout: 20000 })
                            reply(data?.response || "AI turu")
                        } catch { reply("Semua AI turu") }
                    }
                } break

                // PLAY - 2 API CADANGAN
                case "play": {
                    if (!q) return reply(".play dermaga biru")
                    reply("Cari lagu...")
                    let url = null
                    try {
                        let { data } = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?query=${encodeURIComponent(q)}`, { timeout: 30000 })
                        url = data?.data?.dl || data?.data?.download?.url
                    } catch {
                        try {
                            let { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp3?query=${encodeURIComponent(q)}`, { timeout: 30000 })
                            url = data?.data?.download?.url
                        } catch { url = null }
                    }
                    if (!url) return reply("Lagu ga ketemu / semua API turu")
                    await sock.sendMessage(from, { audio: { url: url }, mimetype: 'audio/mpeg' }, { quoted: m })
                } break
            }
        } catch (e) {
            console.log("ERROR:", command, e.message)
            reply(`Error: ${e.message}\nCoba lagi 1 menit`)
        }
    })
}

connectBot()
