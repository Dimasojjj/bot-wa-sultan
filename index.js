const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } = require("@whiskeysockets/baileys")
const pino = require("pino")
const axios = require("axios")
const moment = require("moment-timezone")
const sharp = require("sharp")
const ffmpeg = require("fluent-ffmpeg")
const ffmpegPath = require("ffmpeg-static")
const fs = require("fs")
const { promisify } = require("util")
const stream = require("stream")
const pipeline = promisify(stream.pipeline)

ffmpeg.setFfmpegPath(ffmpegPath)
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
        if (connection === "open") console.log("BOT FINAL VIDEO STIKER ON")
    })

    sock.ev.on("creds.update", saveCreds)

    // FUNGSI STIKER FOTO
    async function createSticker(buffer) {
        return await sharp(buffer)
          .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp()
          .toBuffer()
    }

    // FUNGSI STIKER VIDEO - PAKE FFMPEG
    async function createVideoSticker(buffer) {
        const inputPath = `./temp_${Date.now()}.mp4`
        const outputPath = `./temp_${Date.now()}.webp`
        fs.writeFileSync(inputPath, buffer)
        
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
               .on('error', reject)
               .on('end', resolve)
               .addOutputOptions([
                    '-vcodec', 'libwebp',
                    '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse',
                    '-loop', '0',
                    '-ss', '00:00:00.0',
                    '-t', '00:00:10.0',
                    '-preset', 'default',
                    '-an',
                    '-vsync', '0'
                ])
               .toFormat('webp')
               .save(outputPath)
        })
        
        const webp = fs.readFileSync(outputPath)
        fs.unlinkSync(inputPath)
        fs.unlinkSync(outputPath)
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
                    reply(`*BOT FINAL*\nJam: ${jam} WIB\n\n*100% JALAN*\n.ping\n.gempa\n.jodoh <nama|nama>\n.sticker [foto/video]\n.toimg\n.brat <teks>\n\n*GACHA*\n.ai <tanya>\n.play <judul>\n.meme\n\nStiker video max 10 detik`)
                } break

                case "ping": reply("Pong! Aman bro " + (new Date() - new Date(m.messageTimestamp * 1000)) + "ms")
                break

                // STICKER FOTO + VIDEO JADI
                case "sticker": case "s": {
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    let msgType = qmsg? Object.keys(qmsg)[0] : Object.keys(m.message)[0]
                    if (msgType === 'imageMessage') {
                        reply("Bikin stiker foto...")
                        let stream = await downloadContentFromMessage(qmsg? qmsg[msgType] : m.message[msgType], 'image')
                        let buffer = Buffer.from([])
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        let stickerBuffer = await createSticker(buffer)
                        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m })
                    } else if (msgType === 'videoMessage') {
                        reply("Bikin stiker video... Max 10 detik")
                        let stream = await downloadContentFromMessage(qmsg? qmsg[msgType] : m.message[msgType], 'video')
                        let buffer = Buffer.from([])
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        let stickerBuffer = await createVideoSticker(buffer) // PAKE FFMPEG
                        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m })
                    } else reply("Reply foto/video max 10 detik pake.sticker")
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

                // BRAT FIX - 3 API CADANGAN
                case "brat": {
                    if (!q) return reply(".brat halo")
                    reply("Bikin stiker...")
                    let success = false
                    try {
                        let { data } = await axios.get(`https://brat.caliphdev.com/api/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 20000 })
                        await sock.sendMessage(from, { sticker: data }, { quoted: m })
                        success = true
                    } catch {
                        try {
                            let { data } = await axios.get(`https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 20000 })
                            await sock.sendMessage(from, { sticker: data }, { quoted: m })
                            success = true
                        } catch {
                            try {
                                let { data } = await axios.get(`https://api.zenkey.my.id/api/maker/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 20000 })
                                await sock.sendMessage(from, { sticker: data }, { quoted: m })
                                success = true
                            } catch { }
                        }
                    }
                    if (!success) reply("Semua API Brat turu")
                } break

                // GEMPA - BMKG ASLI
                case "gempa": {
                    let { data } = await axios.get(`https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`, { timeout: 10000 })
                    let i = data?.Infogempa?.gempa
                    if (!i) return reply("BMKG lagi turu")
                    reply(`*INFO GEMPA BMKG*\n\nWilayah: ${i.Wilayah}\nMagnitudo: ${i.Magnitude}\nKedalaman: ${i.Kedalaman}\nWaktu: ${i.Tanggal} ${i.Jam}\nPotensi: ${i.Potensi}`)
                } break

                // JODOH - OFFLINE
                case "jodoh": {
                    if (!q.includes('|')) return reply(".jodoh Dimas|Ayu")
                    let [n1, n2] = q.split('|')
                    let p = Math.floor(Math.random() * 100)
                    reply(`JODOH\n\n${n1} LOVE ${n2}\nKecocokan: ${p}%\n${p > 70? 'Jodoh gas nikah' : p > 40? 'Lumayan' : 'Temenan aja'}`)
                } break

                // MEME - API LUAR NEGERI
                case "meme": {
                    reply("Cari meme...")
                    try {
                        let { data } = await axios.get(`https://meme-api.com/gimme/memes`, { timeout: 10000 })
                        await sock.sendMessage(from, { image: { url: data?.url }, caption: data?.title || "Meme" }, { quoted: m })
                    } catch { reply("API Meme luar juga turu") }
                } break

                // AI - API LUAR NEGERI
                case "ai": {
                    if (!q) return reply(".ai cara bahagia")
                    reply("Mikirr...")
                    try {
                        let { data } = await axios.get(`https://api.simsimi.vn/v2/?text=${encodeURIComponent(q)}&lc=id`, { timeout: 20000 })
                        reply(data?.success || "AI turu")
                    } catch { reply("AI turu semua") }
                } break

                // PLAY - HAPUS DULU, YT SUSAH
                case "play": {
                    reply("Fitur.play lagi maintenance\nYouTube blokir Railway. Pake.tiktok aja dulu")
                } break
            }
        } catch (e) {
            console.log("ERROR:", command, e.message)
            reply(`Error: ${e.message}`)
        }
    })
}

connectBot()
