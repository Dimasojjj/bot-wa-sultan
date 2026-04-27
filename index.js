const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, downloadContentFromMessage } = require("@whiskeysockets/baileys")
const pino = require("pino")
const axios = require("axios")
const moment = require("moment-timezone")
const sharp = require("sharp")
const ffmpeg = require("fluent-ffmpeg")
const ffmpegPath = require("ffmpeg-static")
const fs = require("fs")

ffmpeg.setFfmpegPath(ffmpegPath)
let pairingCodeRequested = false

// LIST MEME INDO OFFLINE - ANTI API TURU
const memeIndo = [
    "https://i.ibb.co/3W2Z8gX/meme1.jpg",
    "https://i.ibb.co/LJYJz0K/meme2.jpg",
    "https://i.ibb.co/6bW2p8z/meme3.jpg",
    "https://i.ibb.co/2N7qKjv/meme4.jpg",
    "https://i.ibb.co/7Y8qKjv/meme5.jpg",
    "https://i.ibb.co/9yY8qKj/meme6.jpg",
    "https://i.ibb.co/3yY8qKj/meme7.jpg",
    "https://i.ibb.co/5yY8qKj/meme8.jpg"
]

const quotesIndo = [
    "Hidup itu seperti kopi, kadang pahit kadang manis. Tapi kalo udah dingin ya dibuang.",
    "Jangan takut gagal, takutlah kalo lu ga pernah nyoba. Kecuali nyoba nyolong.",
    "Rezeki udah ada yang ngatur, tapi kalo lu diem aja ya diatur orang lain.",
    "Cinta itu buta, tapi tetangga melek semua.",
    "Uang bukan segalanya, tapi segalanya butuh uang.",
    "Jodoh emang ga kemana, tapi kalo lu diem di kamar ya ga ketemu-ketemu.",
    "Kerja keras ga bakal mengkhianati hasil, tapi bisa mengkhianati kesehatan."
]

const dareList = [
    "Chat mantan lu bilang 'kangen'",
    "Update status WA 'Lagi galau berat'",
    "VN ke grup bilang 'aku cinta kalian semua'",
    "Ganti PP jadi foto alay 5 menit",
    "Kirimin chat ke gebetan 'aku mimpiin kamu semalem'"
]

const truthList = [
    "Siapa nama mantan terakhir?",
    "Pernah bohong ke ortu soal apa?",
    "Chat terakhir lu sama siapa?",
    "Kapan terakhir nangis?",
    "Rahasia apa yang belum pernah lu ceritain?"
]

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
        if (connection === "open") console.log("BOT SULTAN 15 FITUR ON")
    })

    sock.ev.on("creds.update", saveCreds)

    async function createSticker(buffer) {
        return await sharp(buffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp()
        .toBuffer()
    }

    async function createVideoSticker(buffer) {
        const inputPath = `./temp_${Date.now()}.mp4`
        const outputPath = `./temp_${Date.now()}.webp`
        fs.writeFileSync(inputPath, buffer)
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
             .on('error', reject).on('end', resolve)
             .addOutputOptions(['-vcodec','libwebp','-vf','scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse','-loop','0','-ss','00:00:00.0','-t','00:00:10.0','-preset','default','-an','-vsync','0'])
             .toFormat('webp').save(outputPath)
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
        const isGroup = from.endsWith('@g.us')
        const sender = m.key.participant || from

        try {
            switch (command) {
                case "menu": {
                    let jam = moment.tz("Asia/Jakarta").format("HH:mm:ss")
                    reply(`*BOT SULTAN 15 FITUR*\nJam: ${jam} WIB\n\n*STIKER*\n.sticker [foto/video]\n.brat <teks>\n.qc <teks>\n.toimg\n\n*ANTI STRES*\n.meme\n.quotes\n.dare\n.truth\n.jodoh <nama|nama>\n.rate <apa>\n.gantengcek\n\n*INFO*\n.ping\n.gempa\n.cuaca <kota>\n\n*GAME*\n.tebakgambar\n.suit <gunting/batu/kertas>\n\n*GROUP*\n.tagall <pesan>\n\n*AI*\n.ai <tanya>`)
                } break

                case "ping": reply("Pong! " + (new Date() - new Date(m.messageTimestamp * 1000)) + "ms")
                break

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
                        let stickerBuffer = await createVideoSticker(buffer)
                        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m })
                    } else reply("Reply foto/video max 10 detik")
                } break

                case "toimg": {
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    if (qmsg?.stickerMessage) {
                        reply("Convert...")
                        let stream = await downloadContentFromMessage(qmsg.stickerMessage, 'sticker')
                        let buffer = Buffer.from([])
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        await sock.sendMessage(from, { image: buffer }, { quoted: m })
                    } else reply("Reply stiker")
                } break

                case "brat": {
                    if (!q) return reply(".brat halo")
                    reply("Bikin stiker...")
                    let buffer = null
                    try {
                        let res = await axios.get(`https://brat.caliphdev.com/api/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 20000 })
                        buffer = res.data
                    } catch {
                        try {
                            let res = await axios.get(`https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer', timeout: 20000 })
                            buffer = res.data
                        } catch { return reply("API Brat turu semua") }
                    }
                    let stickerBuffer = await createSticker(buffer)
                    await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m })
                } break

                case "qc": {
                    if (!q) return reply(".qc halo")
                    reply("Bikin stiker...")
                    let pp = await sock.profilePictureUrl(sender, 'image').catch(() => 'https://telegra.ph/file/24121c8c22d4e68e50d28.png')
                    let nama = m.pushName || 'User'
                    try {
                        let { data } = await axios.get(`https://api.siputzx.my.id/api/m/qc?text=${encodeURIComponent(q)}&name=${encodeURIComponent(nama)}&url=${encodeURIComponent(pp)}`, { responseType: 'arraybuffer', timeout: 20000 })
                        await sock.sendMessage(from, { sticker: data }, { quoted: m })
                    } catch { reply("API QC turu") }
                } break

                // MEME OFFLINE - ANTI API TURU
                case "meme": {
                    let url = memeIndo[Math.floor(Math.random() * memeIndo.length)]
                    await sock.sendMessage(from, { image: { url: url }, caption: "Meme Indo Ngakak" }, { quoted: m })
                } break

                // QUOTES OFFLINE
                case "quotes": {
                    let quote = quotesIndo[Math.floor(Math.random() * quotesIndo.length)]
                    reply(`"${quote}"`)
                } break

                case "dare": {
                    let d = dareList[Math.floor(Math.random() * dareList.length)]
                    reply(`*DARE*\n\n${d}`)
                } break

                case "truth": {
                    let t = truthList[Math.floor(Math.random() * truthList.length)]
                    reply(`*TRUTH*\n\n${t}`)
                } break

                case "jodoh": {
                    if (!q.includes('|')) return reply(".jodoh Dimas|Ayu")
                    let [n1, n2] = q.split('|')
                    let p = Math.floor(Math.random() * 100)
                    reply(`JODOH\n\n${n1} ❤️ ${n2}\nKecocokan: ${p}%\n${p > 70? 'Jodoh gas nikah' : p > 40? 'Lumayan' : 'Temenan aja'}`)
                } break

                case "rate": {
                    if (!q) return reply(".rate kegantengan gw")
                    let r = Math.floor(Math.random() * 100)
                    reply(`${q} rate-nya: ${r}%\n${r > 80? 'GACOR KANG' : r > 50? 'Lumayan lah' : 'Perlu upgrade'}`)
                } break

                case "gantengcek": {
                    let r = Math.floor(Math.random() * 100)
                    reply(`Tingkat kegantengan lu: ${r}%\n${r > 80? 'UWOGH PRIA IDAMAN' : r > 50? 'Standar' : 'Perlu skincare bro'}`)
                } break

                case "gempa": {
                    let { data } = await axios.get(`https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`, { timeout: 10000 })
                    let i = data?.Infogempa?.gempa
                    if (!i) return reply("BMKG turu")
                    reply(`*INFO GEMPA BMKG*\n\nWilayah: ${i.Wilayah}\nMagnitudo: ${i.Magnitude}\nKedalaman: ${i.Kedalaman}\nWaktu: ${i.Tanggal} ${i.Jam}\nPotensi: ${i.Potensi}`)
                } break

                case "cuaca": {
                    if (!q) return reply(".cuaca Jakarta")
                    try {
                        let { data } = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(q)}&appid=060a6bcfa19809c2cd4d97a212b192c3&units=metric&lang=id`)
                        reply(`*CUACA ${data.name}*\n\n${data.weather[0].description}\nSuhu: ${data.main.temp}°C\nKelembaban: ${data.main.humidity}%\nAngin: ${data.wind.speed} m/s`)
                    } catch { reply("Kota ga ketemu / API turu") }
                } break

                case "tebakgambar": {
                    let soal = [
                        { img: "https://i.ibb.co/3W2Z8gX/contoh1.jpg", jwb: "KERETA API" },
                        { img: "https://i.ibb.co/LJYJz0K/contoh2.jpg", jwb: "SAPU LIDI" }
                    ]
                    let s = soal[Math.floor(Math.random() * soal.length)]
                    await sock.sendMessage(from, { image: { url: s.img }, caption: `*TEBAK GAMBAR*\n\nClue: ${s.jwb.replace(/[AIUEO]/gi, '_')}\n\nJawab langsung di chat` }, { quoted: m })
                } break

                case "suit": {
                    if (!q) return reply(".suit gunting/batu/kertas")
                    let bot = ["gunting", "batu", "kertas"][Math.floor(Math.random() * 3)]
                    let hasil = q === bot? "SERI" : (q === "batu" && bot === "gunting") || (q === "gunting" && bot === "kertas") || (q === "kertas" && bot === "batu")? "MENANG" : "KALAH"
                    reply(`Lu: ${q}\nBot: ${bot}\n\nHasil: *${hasil}*`)
                } break

                case "tagall": {
                    if (!isGroup) return reply("Khusus grup")
                    let member = (await sock.groupMetadata(from)).participants.map(v => v.id)
                    let text = `*TAG ALL*\n\n${q}\n\n`
                    for (let i of member) text += `@${i.split('@')[0]}\n`
                    sock.sendMessage(from, { text, mentions: member }, { quoted: m })
                } break

                // AI - 1 API LUAR + FALLBACK LUCU
                case "ai": {
                    if (!q) return reply(".ai cara bahagia")
                    reply("Mikirr...")
                    try {
                        let { data } = await axios.get(`https://api.simsimi.vn/v2/?text=${encodeURIComponent(q)}&lc=id`, { timeout: 15000 })
                        if (data?.success) return reply(data.success)
                        throw Error()
                    } catch {
                        // FALLBACK KALO TURU
                        let jawaban = [
                            "Aduh otak gw lagi loading bro, tanya yg lain dulu",
                            "Server AI lagi istirahat, kasian dia capek",
                            "Error 404: Jawaban tidak ditemukan, coba tanya ke Google",
                            "Lagi maintenance bro, AI-nya lagi ngopi"
                        ]
                        reply(jawaban[Math.floor(Math.random() * jawaban.length)])
                    }
                } break
            }
        } catch (e) {
            console.log("ERROR:", command, e.message)
            reply(`Error: ${e.message}`)
        }
    })
}

connectBot()
