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
        if (connection === "open") console.log("BOT SULTAN 25 FITUR ON")
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

        switch (command) {
            case "menu": {
                let jam = moment.tz("Asia/Jakarta").format("HH:mm:ss")
                reply(`*BOT SULTAN 25 FITUR*\nJam: ${jam} WIB\n\n*AI*\n.ai <tanya>\n\n*DOWNLOADER*\n.tiktok <link>\n.ig <link>\n.play <judul>\n\n*STIKER*\n.sticker\n.brat <teks>\n.qc <teks>\n\n*ANTI STRES*\n.meme\n.quotes\n.darkjoke\n.truth\n.dare\n.jodoh <nama|nama>\n.rate <apa>\n.gantengcek\n\n*GAME*\n.tebakgambar\n.suit <gunting/batu/kertas>\n\n*INFO*\n.cuaca <kota>\n.gempa\n\n*GROUP*\n.tagall\nKetik.ping buat test`)
            } break

            case "ping": reply("Pong! Speed: " + (new Date() - new Date(m.messageTimestamp * 1000)) + "ms")
            break

            case "ai": {
                if (!q) return reply("Nanya apa?.ai cara ngilangin stres")
                try {
                    reply("Mikirr...")
                    let { data } = await axios.get(`https://api.nyxs.pw/ai/gpt4?text=${encodeURIComponent(q)}`)
                    reply(data.result)
                } catch { reply("AI error") }
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
                try {
                    reply("Download...")
                    let { data } = await axios.get(`https://api.nyxs.pw/dl/tiktok?url=${q}`)
                    await sock.sendMessage(from, { video: { url: data.result.video }, caption: "Nih no WM" }, { quoted: m })
                } catch { reply("Link error") }
            } break

            case "ig": {
                if (!q) return reply(".ig https://instagram.com/p/xxx")
                try {
                    reply("Download...")
                    let { data } = await axios.get(`https://api.nyxs.pw/dl/ig?url=${q}`)
                    for (let url of data.result) await sock.sendMessage(from, { video: { url: url } }, { quoted: m })
                } catch { reply("Link private/error") }
            } break

            case "play": {
                if (!q) return reply(".play dermaga biru")
                try {
                    reply("Cari lagu...")
                    let { data } = await axios.get(`https://api.nyxs.pw/dl/ytplay?query=${encodeURIComponent(q)}`)
                    await sock.sendMessage(from, { audio: { url: data.result.audio }, mimetype: 'audio/mpeg' }, { quoted: m })
                } catch { reply("Lagu ga ketemu") }
            } break

            case "brat": {
                if (!q) return reply(".brat halo dunia")
                try {
                    reply("Bikin stiker...")
                    let { data } = await axios.get(`https://api.nyxs.pw/maker/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer' })
                    await sock.sendMessage(from, { sticker: data }, { quoted: m })
                } catch { reply("Error") }
            } break

            case "qc": {
                if (!q) return reply(".qc halo")
                try {
                    let pp = await sock.profilePictureUrl(m.key.participant || from, 'image').catch(() => 'https://telegra.ph/file/24121c8c22d4e68e50d28.png')
                    let nama = m.pushName || 'User'
                    let { data } = await axios.get(`https://api.nyxs.pw/maker/qc?text=${encodeURIComponent(q)}&name=${encodeURIComponent(nama)}&url=${encodeURIComponent(pp)}`, { responseType: 'arraybuffer' })
                    await sock.sendMessage(from, { sticker: data }, { quoted: m })
                } catch { reply("Error") }
            } break

            case "meme": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/fun/meme`)
                    await sock.sendMessage(from, { image: { url: data.result }, caption: "Meme anti stres" }, { quoted: m })
                } catch { reply("Error") }
            } break

            case "quotes": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/quotes/quotes`)
                    reply(`"${data.result.quotes}"\n\n- ${data.result.author}`)
                } catch { reply("Error") }
            } break

            case "darkjoke": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/fun/darkjoke`)
                    reply(data.result)
                } catch { reply("Error") }
            } break

            case "truth": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/fun/truth`)
                    reply(`TRUTH:\n\n${data.result}`)
                } catch { reply("Error") }
            } break

            case "dare": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/fun/dare`)
                    reply(`DARE:\n\n${data.result}`)
                } catch { reply("Error") }
            } break

            case "jodoh": {
                if (!q.includes('|')) return reply(".jodoh Dimas|Ayu")
                let [n1, n2] = q.split('|')
                let p = Math.floor(Math.random() * 100)
                reply(`JODOH\n\n${n1} LOVE ${n2}\nKecocokan: ${p}%\n${p > 70? 'Jodoh, gas nikah' : 'Temenan aja'}`)
            } break

            case "rate": {
                if (!q) return reply(".rate kegantengan gw")
                let r = Math.floor(Math.random() * 100)
                reply(`${q} rate-nya: ${r}%\n${r > 80? 'GACOR' : 'Lumayan'}`)
            } break

            case "gantengcek": {
                let r = Math.floor(Math.random() * 100)
                reply(`Tingkat kegantengan lu: ${r}%\n${r > 80? 'UWOGH PRIA IDAMAN' : 'Perlu skincare bro'}`)
            } break

            case "tebakgambar": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/game/tebakgambar`)
                    await sock.sendMessage(from, { image: { url: data.result.image }, caption: `Tebak Gambar\n\nClue: ${data.result.answer.replace(/[aiueo]/gi, '_')}` }, { quoted: m })
                } catch { reply("Error") }
            } break

            case "suit": {
                if (!q) return reply(".suit gunting/batu/kertas")
                let bot = ["gunting", "batu", "kertas"][Math.floor(Math.random() * 3)]
                let hasil = q === bot? "SERI" : (q === "batu" && bot === "gunting") || (q === "gunting" && bot === "kertas") || (q === "kertas" && bot === "batu")? "MENANG" : "KALAH"
                reply(`Lu: ${q}\nBot: ${bot}\n\nHasil: ${hasil}`)
            } break

            case "cuaca": {
                if (!q) return reply(".cuaca Jakarta")
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/tools/cuaca?query=${q}`)
                    let d = data.result
                    reply(`CUACA ${d.location}\n\n${d.weather}\nSuhu: ${d.temperature}`)
                } catch { reply("Kota ga ketemu") }
            } break

            case "gempa": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/info/gempa`)
                    let i = data.result
                    reply(`INFO GEMPA\n\nLokasi: ${i.wilayah}\nMagnitudo: ${i.magnitude}\nTanggal: ${i.tanggal}`)
                } catch { reply("Error") }
            } break

            case "tagall": {
                if (!m.key.remoteJid.endsWith('@g.us')) return reply("Khusus grup")
                let member = (await sock.groupMetadata(from)).participants.map(v => v.id)
                let text = `TAG ALL\n\n${q}\n\n`
                for (let i of member) text += `@${i.split('@')[0]}\n`
                sock.sendMessage(from, { text, mentions: member }, { quoted: m })
            } break
        }
    })
}

connectBot()
