const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadContentFromMessage } = require("@whiskeysockets/baileys")
const pino = require("pino")
const axios = require("axios")
const fs = require("fs")
const moment = require("moment-timezone")

global.prefix = "."
global.owner = ["6283844376032"] // GANTI NOMOR LU
global.mess = { owner: "Fitur khusus owner!", wait: "Sabar lagi proses..." }

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({ 
        version, 
        logger: pino({ level: "silent" }), 
        printQRInTerminal: false, 
        auth: state, 
        browser: ["Sultan", "Chrome", ""] 
    })

    sock.ev.on("connection.update", async (update) => {
        const { connection } = update
        if (connection === "connecting") {
            if (!sock.authState.creds.registered) {
                const phoneNumber = "6283844376032"
                await new Promise(r => setTimeout(r, 2000))
                let code = await sock.requestPairingCode(phoneNumber)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(`PAIRING CODE LU: ${code}`)
            }
        }
        if (connection === "open") console.log("BOT SULTAN 100+ FITUR ONLINE")
        if (connection === "close") startBot()
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message) return
        m.message = (Object.keys(m.message)[0] === 'ephemeralMessage')? m.message.ephemeralMessage.message : m.message
        if (m.key.fromMe) return
        const from = m.key.remoteJid
        const sender = m.key.participant || m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || ""
        const budy = (typeof body == "string"? body : "")
        const command = budy.startsWith(global.prefix)? budy.slice(1).split(" ")[0].toLowerCase() : ""
        const args = budy.trim().split(/ +/).slice(1)
        const q = args.join(" ")
        const isOwner = global.owner.includes(sender.split("@")[0])
        const reply = (teks) => sock.sendMessage(from, { text: teks }, { quoted: m })

        // FITUR 100+ TARO DI SINI
        switch (command) {
            case "menu": case "help": {
                let jam = moment.tz("Asia/Jakarta").format("HH:mm:ss")
                let menu = `*BOT WA SULTAN 100+ FITUR*\nJam: ${jam} WIB\n\n*AI & TOOLS*\n${prefix}ai ${prefix}gemini ${prefix}hd ${prefix}removebg ${prefix}tourl\n\n*DOWNLOADER*\n${prefix}tiktok ${prefix}ig ${prefix}ytmp3 ${prefix}ytmp4 ${prefix}play ${prefix}pinterest\n\n*STIKER & MAKER*\n${prefix}sticker ${prefix}toimg ${prefix}brat ${prefix}qc ${prefix}emojimix\n\n*ANTI STRES*\n${prefix}meme ${prefix}quotes ${prefix}darkjoke ${prefix}truth ${prefix}dare ${prefix}jodoh ${prefix}rate\n\n*GAME*\n${prefix}tebakgambar ${prefix}susunkata ${prefix}asahotak ${prefix}caklontong ${prefix}slot ${prefix}suit\n\n*INFO*\n${prefix}cuaca ${prefix}gempa ${prefix}jadwalsholat\n\n*GROUP*\n${prefix}tagall ${prefix}kick ${prefix}add ${prefix}antilink\n\nTotal 100+ Command Aktif`
                reply(menu)
            } break

            case "ping": reply(`Pong! Speed: ${new Date() - new Date(m.messageTimestamp * 1000)}ms`)
            break

            // AI
            case "ai": case "gpt": {
                if (!q) return reply("Mau nanya apa? Contoh:.ai cara ngilangin galau")
                try {
                    reply(global.mess.wait)
                    let { data } = await axios.get(`https://api.nyxs.pw/ai/gpt4?text=${encodeURIComponent(q)}`)
                    reply(data.result)
                } catch { reply("AI error bro") }
            } break

            // STIKER
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

            // DOWNLOADER
            case "tiktok": {
                if (!q) return reply(`Linknya mana? ${prefix}tiktok https://vt.tiktok.com/xxx`)
                try {
                    reply(global.mess.wait)
                    let { data } = await axios.get(`https://api.nyxs.pw/dl/tiktok?url=${q}`)
                    await sock.sendMessage(from, { video: { url: data.result.video }, caption: "Nih TikTok no WM" }, { quoted: m })
                } catch { reply("Link error") }
            } break

            case "ig": {
                if (!q) return reply(`Linknya mana? ${prefix}ig https://instagram.com/p/xxx`)
                try {
                    reply(global.mess.wait)
                    let { data } = await axios.get(`https://api.nyxs.pw/dl/ig?url=${q}`)
                    for (let url of data.result) {
                        await sock.sendMessage(from, { video: { url: url } }, { quoted: m })
                    }
                } catch { reply("Link private/error") }
            } break

            case "play": {
                if (!q) return reply(`Judul lagunya? ${prefix}play dermaga biru`)
                try {
                    reply(global.mess.wait)
                    let { data } = await axios.get(`https://api.nyxs.pw/dl/ytplay?query=${encodeURIComponent(q)}`)
                    await sock.sendMessage(from, { audio: { url: data.result.audio }, mimetype: 'audio/mpeg' }, { quoted: m })
                } catch { reply("Lagu ga ketemu") }
            } break

            // ANTI STRES
            case "meme": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/fun/meme`)
                    await sock.sendMessage(from, { image: { url: data.result }, caption: "Meme anti stres" }, { quoted: m })
                } catch { reply("Gagal ambil meme") }
            } break

            case "quotes": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/quotes/quotes`)
                    reply(`"${data.result.quotes}"\n\n- ${data.result.author}`)
                } catch { reply("Gagal ambil quotes") }
            } break

            case "darkjoke": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/fun/darkjoke`)
                    reply(data.result)
                } catch { reply("Gagal ambil darkjoke") }
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
                if (!q.includes('|')) return reply(`Format: ${prefix}jodoh Nama1|Nama2`)
                let [n1, n2] = q.split('|')
                let p = Math.floor(Math.random() * 100)
                reply(`JODOH\n\n${n1} <3 ${n2}\nKecocokan: ${p}%\n${p > 70? 'Jodoh, gas nikah' : 'Temenan aja'}`)
            } break

            case "rate": {
                if (!q) return reply(`Rate apa? ${prefix}rate kegantengan gw`)
                let r = Math.floor(Math.random() * 100)
                reply(`${q} rate-nya: ${r}%\n${r > 80? 'GACOR' : 'Lumayan'}`)
            } break

            // INFO
            case "cuaca": {
                if (!q) return reply(`Kota mana? ${prefix}cuaca Jakarta`)
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

            // STIKER MAKER
            case "brat": {
                if (!q) return reply(`Teksnya? ${prefix}brat halo`)
                try {
                    reply(global.mess.wait)
                    let { data } = await axios.get(`https://api.nyxs.pw/maker/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer' })
                    await sock.sendMessage(from, { sticker: data }, { quoted: m })
                } catch { reply("Error") }
            } break

            case "qc": {
                if (!q) return reply(`Teksnya? ${prefix}qc halo`)
                try {
                    let pp = await sock.profilePictureUrl(sender, 'image').catch(() => 'https://telegra.ph/file/24121c8c22d4e68e50d28.png')
                    let nama = m.pushName || 'User'
                    let { data } = await axios.get(`https://api.nyxs.pw/maker/qc?text=${encodeURIComponent(q)}&name=${encodeURIComponent(nama)}&url=${encodeURIComponent(pp)}`, { responseType: 'arraybuffer' })
                    await sock.sendMessage(from, { sticker: data }, { quoted: m })
                } catch { reply("Error") }
            } break

            // GAME
            case "tebakgambar": {
                try {
                    let { data } = await axios.get(`https://api.nyxs.pw/game/tebakgambar`)
                    await sock.sendMessage(from, { image: { url: data.result.image }, caption: `Tebak Gambar\n\nClue: ${data.result.answer.replace(/[aiueo]/gi, '_')}\n\nWaktu 60 detik` }, { quoted: m })
                } catch { reply("Error") }
            } break

            // GROUP
            case "tagall": {
                if (!m.isGroup) return reply("Khusus grup")
                let member = await (await sock.groupMetadata(from)).participants.map(v => v.id)
                let text = `TAG ALL\n\n${q}\n\n`
                for (let i of member) text += `@${i.split('@')[0]}\n`
                sock.sendMessage(from, { text, mentions: member }, { quoted: m })
            } break
        }
    })
}
let pairingCodeRequested = false // TAMBAHIN INI DI ATAS startBot()

sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update
    
    if (connection === "connecting") {
        if (!sock.authState.creds.registered && !pairingCodeRequested) {
            pairingCodeRequested = true // BIAR CUMA MINTA 1X
            const phoneNumber = "6283844376032"
            await new Promise(r => setTimeout(r, 3000))
            try {
                let code = await sock.requestPairingCode(phoneNumber)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(`PAIRING CODE LU CUMA 1: ${code}`)
            } catch (e) {
                console.log("Gagal minta kode:", e)
                pairingCodeRequested = false // reset kalo gagal
            }
        }
    }
    
    if (connection === "close") {
        let reason = lastDisconnect?.error?.output?.statusCode
        if (reason !== DisconnectReason.loggedOut) {
            console.log("Reconnecting...")
            pairingCodeRequested = false // reset pas reconnect
            startBot()
        } else {
            console.log("Logout, hapus session dulu")
        }
    } else if (connection === "open") {
        console.log("BOT CONNECTED - 100+ FITUR ON")
        pairingCodeRequested = true // udah connect ga perlu kode lagi
    }
})
startBot()
