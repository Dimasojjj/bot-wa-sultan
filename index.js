const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } = require("@whiskeysockets/baileys")
const pino = require("pino")
const axios = require("axios")
const moment = require("moment-timezone")
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
        if (connection === "open") console.log("BOT SULTAN ALL FIX ON")
    })

    sock.ev.on("creds.update", saveCreds)

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
                    reply(`*BOT SULTAN ALL FIX*\nJam: ${jam} WIB\n\n*ANTI ERROR*\n.ping\n.ai <tanya>\n.gempa\n.quotes\n.jodoh <nama|nama>\n\n*DOWNLOADER*\n.tiktok <link>\n.play <judul>\n\n*STIKER 100% JADI*\n.sticker\n.toimg\n.brat <teks>\n.qc <teks>\n\n*FUN*\n.meme\n\n*GAME*\n.tebakgambar\n\nKalo error = API turu, bukan bot rusak`)
                } break

                case "ping": reply("Pong! Aman bro " + (new Date() - new Date(m.messageTimestamp * 1000)) + "ms")
                break

                // AI FIX
                case "ai": {
                    if (!q) return reply("Nanya apa?.ai cara bahagia")
                    reply("Mikirr...")
                    let { data } = await axios.get(`https://api.siputzx.my.id/api/ai/gpt3?prompt=Kamu asisten kocak&content=${encodeURIComponent(q)}`, { timeout: 20000 })
                    reply(data?.data || data?.result || "AI lagi turu bro")
                } break

                // STICKER FIX - ANTI ABU ABU
                case "sticker": case "s": {
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    let msgType = qmsg? Object.keys(qmsg)[0] : Object.keys(m.message)[0]
                    if (msgType === 'imageMessage' || msgType === 'videoMessage') {
                        reply("Bikin stiker...")
                        let stream = await downloadContentFromMessage(qmsg? qmsg[msgType] : m.message[msgType], msgType.replace('Message', ''))
                        let buffer = Buffer.from([])
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        // FIX ABU ABU: Kasih metadata stiker
                        await sock.sendMessage(from, {
                            sticker: buffer,
                            packname: "Bot Sultan",
                            author: "Dimas"
                        }, { quoted: m })
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
                    let { data } = await axios.get(`https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 20000 })
                    await sock.sendMessage(from, {
                        sticker: data,
                        packname: "Bot Sultan",
                        author: "Brat"
                    }, { quoted: m })
                } break

                case "qc": {
                    if (!q) return reply(".qc halo")
                    reply("Bikin stiker...")
                    let pp = await sock.profilePictureUrl(m.key.participant || from, 'image').catch(() => 'https://telegra.ph/file/24121c8c22d4e68e50d28.png')
                    let nama = m.pushName || 'User'
                    let { data } = await axios.get(`https://api.siputzx.my.id/api/m/qc?text=${encodeURIComponent(q)}&name=${encodeURIComponent(nama)}&url=${encodeURIComponent(pp)}`, { responseType: 'arraybuffer', timeout: 20000 })
                    await sock.sendMessage(from, {
                        sticker: data,
                        packname: "Bot Sultan",
                        author: nama
                    }, { quoted: m })
                } break

                // GEMPA FIX - BMKG ASLI
                case "gempa": {
                    let { data } = await axios.get(`https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`, { timeout: 10000 })
                    let i = data?.Infogempa?.gempa
                    if (!i) return reply("BMKG lagi turu")
                    reply(`*INFO GEMPA BMKG*\n\nWilayah: ${i.Wilayah}\nMagnitudo: ${i.Magnitude}\nKedalaman: ${i.Kedalaman}\nWaktu: ${i.Tanggal} ${i.Jam}\nPotensi: ${i.Potensi}\n\nSumber: BMKG`)
                } break

                // QUOTES FIX
                case "quotes": {
                    let { data } = await axios.get(`https://api.siputzx.my.id/api/r/quotesanime`, { timeout: 10000 })
                    let q = data?.data
                    if (!q?.quotes) return reply("Quotes lagi turu")
                    reply(`"${q.quotes}"\n\n- ${q.character} | ${q.anime}`)
                } break

                // JODOH - OFFLINE JADI GAK ERROR
                case "jodoh": {
                    if (!q.includes('|')) return reply(".jodoh Dimas|Ayu")
                    let [n1, n2] = q.split('|')
                    let p = Math.floor(Math.random() * 100)
                    reply(`JODOH\n\n${n1} LOVE ${n2}\nKecocokan: ${p}%\n${p > 70? 'Jodoh gas nikah' : p > 40? 'Lumayan, usaha lagi' : 'Temenan aja'}`)
                } break

                // PLAY FIX
                case "play": {
                    if (!q) return reply(".play dermaga biru")
                    reply("Cari lagu...")
                    let { data } = await axios.get(`https://api.siputzx.my.id/api/d/ytmp3?query=${encodeURIComponent(q)}`, { timeout: 30000 })
                    let url = data?.data?.dl || data?.data?.download?.url || data?.result?.download?.url
                    if (!url) return reply("Lagu ga ketemu / API turu. Coba judul lain")
                    await sock.sendMessage(from, { audio: { url: url }, mimetype: 'audio/mpeg' }, { quoted: m })
                } break

                // TIKTOK FIX
                case "tiktok": {
                    if (!q) return reply(".tiktok https://vt.tiktok.com/xxx")
                    reply("Download...")
                    let { data } = await axios.get(`https://api.siputzx.my.id/api/d/tiktok?url=${q}`, { timeout: 30000 })
                    let url = data?.data?.video || data?.data?.play || data?.result?.video
                    if (!url) return reply("Link error / API turu")
                    await sock.sendMessage(from, { video: { url: url }, caption: "Nih no WM" }, { quoted: m })
                } break

                // MEME FIX
                case "meme": {
                    let { data } = await axios.get(`https://api.siputzx.my.id/api/r/memeindo`, { timeout: 10000 })
                    let url = data?.data?.url || data?.url
                    if (!url) return reply("Meme lagi turu")
                    await sock.sendMessage(from, { image: { url: url }, caption: "Meme Indo" }, { quoted: m })
                } break

                // TEBAK GAMBAR FIX
                case "tebakgambar": {
                    let { data } = await axios.get(`https://api.siputzx.my.id/api/game/tebakgambar`, { timeout: 10000 })
                    let d = data?.data
                    if (!d?.image) return reply("Game lagi turu")
                    await sock.sendMessage(from, { image: { url: d.image }, caption: `Tebak Gambar\n\nClue: ${d.answer.replace(/[aiueo]/gi, '_')}\n\nJawab di chat` }, { quoted: m })
                } break
            }
        } catch (e) {
            console.log("ERROR COMMAND:", command, e.message)
            if (e.code === 'ECONNABORTED') {
                reply(`Error: API kelamaan bro, coba lagi`)
            } else {
                reply(`Error: ${e.message}\nCoba command lain / tunggu 1 menit`)
            }
        }
    })
}

connectBot()
