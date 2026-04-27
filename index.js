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

// DATABASE OFFLINE - ANTI API TURU
const memeIndo = [
    "https://i.ibb.co/3W2Z8gX/meme1.jpg",
    "https://i.ibb.co/LJYJz0K/meme2.jpg",
    "https://i.ibb.co/6bW2p8z/meme3.jpg",
    "https://i.ibb.co/2N7qKjv/meme4.jpg",
    "https://i.ibb.co/7Y8qKjv/meme5.jpg",
    "https://i.ibb.co/9yY8qKj/meme6.jpg"
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
    "Chat mantan lu bilang 'kangen'", "Update status WA 'Lagi galau berat'",
    "VN ke grup bilang 'aku cinta kalian semua'", "Ganti PP jadi foto alay 5 menit",
    "Kirimin chat ke gebetan 'aku mimpiin kamu semalem'", "Spam stiker 10x di grup"
]

const truthList = [
    "Siapa nama mantan terakhir?", "Pernah bohong ke ortu soal apa?",
    "Chat terakhir lu sama siapa?", "Kapan terakhir nangis?",
    "Rahasia apa yang belum pernah lu ceritain?", "Naksir siapa sekarang?"
]

const tebakGambarSoal = [
    { img: "https://i.ibb.co/3W2Z8gX/kereta.jpg", jwb: "KERETA API", clue: "K_RE_A A_I" },
    { img: "https://i.ibb.co/LJYJz0K/sapu.jpg", jwb: "SAPU LIDI", clue: "_A_U _I_I" },
    { img: "https://i.ibb.co/6bW2p8z/kacamata.jpg", jwb: "KACAMATA KUDA", clue: "_A_A_A _U_A" },
    { img: "https://i.ibb.co/2N7qKjv/meja.jpg", jwb: "MEJA MAKAN", clue: "_E_A _A_A_" }
]

const aiJawaban = [
    "Hmm menarik, tapi gw lagi ga mood jawab.",
    "Pertanyaan bagus! Jawabannya ada di hati lu sendiri.",
    "Error 404: Otak gw ga nyampe. Coba tanya yg lebih gampang.",
    "Menurut primbon digital, jawabannya adalah 42.",
    "AI lagi cuti bro, tanya ke Google aja dulu.",
    "Sistem lagi sibuk ngitung dosa. Coba lagi nanti.",
    "Maaf, budget API abis. Jawab manual aja ya."
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
        if (connection === "open") console.log("BOT SULTAN OFFLINE MODE ON")
    })

    sock.ev.on("creds.update", saveCreds)

    async function createSticker(buffer) {
        return await sharp(buffer).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp().toBuffer()
    }

    async function createVideoSticker(buffer) {
        const inputPath = `./temp_${Date.now()}.mp4`
        const outputPath = `./temp_${Date.now()}.webp`
        fs.writeFileSync(inputPath, buffer)
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath).on('error', reject).on('end', resolve)
           .addOutputOptions(['-vcodec','libwebp','-vf','scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse','-loop','0','-ss','00:00:00.0','-t','00:00:10.0','-preset','default','-an','-vsync','0'])
           .toFormat('webp').save(outputPath)
        })
        const webp = fs.readFileSync(outputPath)
        fs.unlinkSync(inputPath); fs.unlinkSync(outputPath)
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
                    reply(`*BOT SULTAN OFFLINE 25 FITUR*\nJam: ${jam} WIB\n\n*STIKER*\n.sticker [foto/video]\n.brat <teks>\n.qc <teks>\n.toimg\n\n*FUN OFFLINE*\n.meme\n.quotes\n.dare\n.truth\n.jodoh <nama|nama>\n.rate <apa>\n.gantengcek\n.cantikit\n.howgay\n\n*GAME*\n.tebakgambar\n.suit <gunting/batu/kertas>\n.slot\n\n*INFO*\n.ping\n.gempa\n.cuaca <kota>\n\n*GROUP*\n.tagall <pesan>\n.hidetag <pesan>\n\n*AI OFFLINE*\n.ai <tanya>\n\n100% Anti API Turu`)
                } break

                case "ping": reply("Pong! " + (new Date() - new Date(m.messageTimestamp * 1000)) + "ms")
                break

                case "sticker": case "s": {
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    let msgType = qmsg? Object.keys(qmsg)[0] : Object.keys(m.message)[0]
                    if (msgType === 'imageMessage') {
                        reply("Bikin stiker foto...")
                        let stream = await downloadContentFromMessage(qmsg? qmsg[msgType] : m.message[msgType], 'image')
                        let buffer = Buffer.from([]); for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        let stickerBuffer = await createSticker(buffer)
                        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m })
                    } else if (msgType === 'videoMessage') {
                        reply("Bikin stiker video... Max 10 detik")
                        let stream = await downloadContentFromMessage(qmsg? qmsg[msgType] : m.message[msgType], 'video')
                        let buffer = Buffer.from([]); for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        let stickerBuffer = await createVideoSticker(buffer)
                        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m })
                    } else reply("Reply foto/video max 10 detik")
                } break

                case "toimg": {
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    if (qmsg?.stickerMessage) {
                        reply("Convert...")
                        let stream = await downloadContentFromMessage(qmsg.stickerMessage, 'sticker')
                        let buffer = Buffer.from([]); for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        await sock.sendMessage(from, { image: buffer }, { quoted: m })
                    } else reply("Reply stiker")
                } break

                // BRAT OFFLINE - PAKE CANVAS LOKAL
                case "brat": {
                    if (!q) return reply(".brat halo")
                    reply("Bikin stiker...")
                    const canvas = require("canvas")
                    const c = canvas.createCanvas(512, 512)
                    const ctx = c.getContext("2d")
                    ctx.fillStyle = "#FFFFFF"
                    ctx.fillRect(0, 0, 512, 512)
                    ctx.font = "bold 60px Arial"
                    ctx.fillStyle = "#000000"
                    ctx.textAlign = "center"
                    ctx.fillText(q, 256, 280)
                    const buffer = c.toBuffer()
                    let stickerBuffer = await createSticker(buffer)
                    await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m })
                } break

                // QC OFFLINE
                case "qc": {
                    if (!q) return reply(".qc halo")
                    reply("Bikin stiker...")
                    const canvas = require("canvas")
                    const c = canvas.createCanvas(512, 300)
                    const ctx = c.getContext("2d")
                    ctx.fillStyle = "#1E1E1E"
                    ctx.fillRect(0, 0, 512, 300)
                    ctx.font = "30px Arial"
                    ctx.fillStyle = "#FFFFFF"
                    ctx.fillText(m.pushName || 'User', 20, 50)
                    ctx.font = "25px Arial"
                    ctx.fillText(q, 20, 100)
                    const buffer = c.toBuffer()
                    let stickerBuffer = await createSticker(buffer)
                    await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m })
                } break

                // MEME OFFLINE
                case "meme": {
                    let url = memeIndo[Math.floor(Math.random() * memeIndo.length)]
                    await sock.sendMessage(from, { image: { url: url }, caption: "Meme Indo Ngakak" }, { quoted: m })
                } break

                // QUOTES OFFLINE
                case "quotes": {
                    let quote = quotesIndo[Math.floor(Math.random() * quotesIndo.length)]
                    reply(`"${quote}"`)
                } break

                case "dare": reply(`*DARE*\n\n${dareList[Math.floor(Math.random() * dareList.length)]}`)
                break

                case "truth": reply(`*TRUTH*\n\n${truthList[Math.floor(Math.random() * truthList.length)]}`)
                break

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

                case "gantengcek": reply(`Tingkat kegantengan lu: ${Math.floor(Math.random() * 100)}%\n${Math.random() > 0.5? 'UWOGH PRIA IDAMAN' : 'Perlu skincare bro'}`)
                break

                case "cantikcek": reply(`Tingkat kecantikan lu: ${Math.floor(Math.random() * 100)}%\n${Math.random() > 0.5? 'UWOGH BIDADARI' : 'Udah cantik kok'}`)
                break

                case "howgay": {
                    let r = Math.floor(Math.random() * 100)
                    reply(`${q || 'Lu'} ${r}% gay\n${r > 70? '🌈' : r > 40? 'Agak laen' : 'Straight'}`)
                } break

                // TEBAK GAMBAR OFFLINE
                case "tebakgambar": {
                    let s = tebakGambarSoal[Math.floor(Math.random() * tebakGambarSoal.length)]
                    await sock.sendMessage(from, { image: { url: s.img }, caption: `*TEBAK GAMBAR*\n\nClue: ${s.clue}\n\nJawaban: ${s.jwb}` }, { quoted: m })
                } break

                case "suit": {
                    if (!q) return reply(".suit gunting/batu/kertas")
                    let bot = ["gunting", "batu", "kertas"][Math.floor(Math.random() * 3)]
                    let hasil = q === bot? "SERI" : (q === "batu" && bot === "gunting") || (q === "gunting" && bot === "kertas") || (q === "kertas" && bot === "batu")? "MENANG" : "KALAH"
                    reply(`Lu: ${q}\nBot: ${bot}\n\nHasil: *${hasil}*`)
                } break

                case "slot": {
                    let emojis = ["🍒", "🍋", "🍊", "🍉", "🍇", "💎", "7️⃣"]
                    let a = emojis[Math.floor(Math.random() * emojis.length)]
                    let b = emojis[Math.floor(Math.random() * emojis.length)]
                    let c = emojis[Math.floor(Math.random() * emojis.length)]
                    let hasil = (a === b && b === c)? "JACKPOT! 🎉" : (a === b || b === c || a === c)? "Hampir!" : "Zonk"
                    reply(`*SLOT*\n\n[ ${a} | ${b} | ${c} ]\n\n${hasil}`)
                } break

                case "gempa": {
                    let { data } = await axios.get(`https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`, { timeout: 10000 })
                    let i = data?.Infogempa?.gempa
                    if (!i) return reply("BMKG turu")
                    reply(`*INFO GEMPA BMKG*\n\nWilayah: ${i.Wilayah}\nMagnitudo: ${i.Magnitude}\nKedalaman: ${i.Kedalaman}\nWaktu: ${i.Tanggal} ${i.Jam}\nPotensi: ${i.Potensi}`)
                } break

                // CUACA PAKE OPEN-METEO - GRATIS & ANTI BLOKIR
                case "cuaca": {
                    if (!q) return reply(".cuaca Jakarta")
                    try {
                        let { data: geo } = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=id`)
                        if (!geo.results) return reply("Kota ga ketemu")
                        let { latitude, longitude, name } = geo.results[0]
                        let { data } = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`)
                        let w = data.current_weather
                        reply(`*CUACA ${name}*\n\nSuhu: ${w.temperature}°C\nKecepatan Angin: ${w.windspeed} km/h\nKode Cuaca: ${w.weathercode}`)
                    } catch { reply("API Cuaca turu") }
                } break

                case "tagall": {
                    if (!isGroup) return reply("Khusus grup")
                    let member = (await sock.groupMetadata(from)).participants.map(v => v.id)
                    let text = `*TAG ALL*\n\n${q}\n\n`
                    for (let i of member) text += `@${i.split('@')[0]}\n`
                    sock.sendMessage(from, { text, mentions: member }, { quoted: m })
                } break

                case "hidetag": {
                    if (!isGroup) return reply("Khusus grup")
                    let member = (await sock.groupMetadata(from)).participants.map(v => v.id)
                    sock.sendMessage(from, { text: q || "Hidetag", mentions: member }, { quoted: m })
                } break

                // AI OFFLINE - ANTI TURU
                case "ai": {
                    if (!q) return reply(".ai cara bahagia")
                    let jawaban = aiJawaban[Math.floor(Math.random() * aiJawaban.length)]
                    reply(jawaban)
                } break
            }
        } catch (e) {
            console.log("ERROR:", command, e.message)
            reply(`Error: ${e.message}`)
        }
    })
}

connectBot()
