const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, downloadContentFromMessage } = require("@whiskeysockets/baileys")
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
        browser: ["Chrome", "Linux", ""] 
    })

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update
        if(connection === "connecting") {
            if (!sock.authState.creds.registered) {
                const phoneNumber = "6283844376032"
                await new Promise(r => setTimeout(r, 2000))
                let code = await sock.requestPairingCode(phoneNumber)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(`PAIRING CODE LU: ${code}`)
            }
        }
        if(connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
        } else if(connection === "open") console.log("BOT CONNECTED - 100+ FITUR ON")
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || ""
        const command = body.toLowerCase().split(" ")[0]
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(" ")
        const reply = (teks) => sock.sendMessage(from, { text: teks }, { quoted: m })

        try {
            switch (command) {
                case '.menu':
                    let jam = moment.tz("Asia/Jakarta").format("HH:mm:ss")
                    reply(`BOT WA SULTAN 100+ FITUR\nJam: ${jam} WIB\n\nAI & TOOLS\n.ai <tanya> |.hd |.removebg\n\nDOWNLOADER\n.tiktok <link> |.ig <link> |.play <judul>\n\nSTIKER\n.sticker |.brat <teks> |.qc <teks>\n\nANTI STRES\n.meme |.quotes |.darkjoke |.truth |.dare\n.jodoh <nama|nama> |.rate <apa>\n\nINFO\n.cuaca <kota> |.gempa\n\nKetik.ping buat cek bot`)
                break
                
                case '.ping': 
                    reply(`Pong! Speed: ${new Date() - new Date(m.messageTimestamp * 1000)}ms\n100+ Fitur Aktif`)
                break
                
                case '.owner': 
                    reply("Owner: Dimas\nBot 24 Jam Railway\n100+ Fitur Anti Stres")
                break

                case '.ai':
                    if (!q) return reply("Mau nanya apa? Contoh:.ai cara ngilangin stres")
                    reply("Sabar lagi mikir...")
                    let ai = await axios.get(`https://api.nyxs.pw/ai/gpt4?text=${encodeURIComponent(q)}`)
                    reply(ai.data.result)
                break

                case '.sticker': case '.s':
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    let msgType = qmsg? Object.keys(qmsg)[0] : Object.keys(m.message)[0]
                    if (msgType === 'imageMessage' || msgType === 'videoMessage') {
                        reply("Bikin stiker...")
                        let stream = await downloadContentFromMessage(qmsg? qmsg[msgType] : m.message[msgType], msgType.replace('Message', ''))
                        let buffer = Buffer.from([])
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        await sock.sendMessage(from, { sticker: buffer }, { quoted: m })
                    } else reply("Reply gambar/video pake.sticker")
                break
                
                case '.tiktok':
                    if (!q) return reply("Linknya mana?.tiktok https://vt.tiktok.com/xxx")
                    reply("Download TikTok no WM...")
                    let tt = await axios.get(`https://api.nyxs.pw/dl/tiktok?url=${q}`)
                    await sock.sendMessage(from, { video: { url: tt.data.result.video }, caption: "Nih TikTok no WM" }, { quoted: m })
                break
                
                case '.play':
                    if (!q) return reply("Judul lagunya?.play dermaga biru")
                    reply("Cari lagu...")
                    let play = await axios.get(`https://api.nyxs.pw/dl/ytplay?query=${encodeURIComponent(q)}`)
                    await sock.sendMessage(from, { audio: { url: play.data.result.audio }, mimetype: 'audio/mpeg' }, { quoted: m })
                break

                case '.meme':
                    let meme = await axios.get(`https://api.nyxs.pw/fun/meme`)
                    await sock.sendMessage(from, { image: { url: meme.data.result }, caption: "Meme anti stres" }, { quoted: m })
                break
                
                case '.quotes': 
                    let qu = await axios.get(`https://api.nyxs.pw/quotes/quotes`)
                    reply(`QUOTES BUAT LU:\n\n"${qu.data.result.quotes}"\n\n- ${qu.data.result.author}`)
                break
                
                case '.darkjoke':
                    let dj = await axios.get(`https://api.nyxs.pw/fun/darkjoke`)
                    reply(`DARK JOKE:\n\n${dj.data.result}`)
                break
                
                case '.truth':
                    let tr = await axios.get(`https://api.nyxs.pw/fun/truth`)
                    reply(`TRUTH OR DARE\n\n${tr.data.result}`)
                break
                
                case '.dare':
                    let dr = await axios.get(`https://api.nyxs.pw/fun/dare`)
                    reply(`TRUTH OR DARE\n\n${dr.data.result}`)
                break
                
                case '.jodoh':
                    if (!q.includes('|')) return reply("Format salah. Contoh:.jodoh Dimas|Ayu")
                    let [nama1, nama2] = q.split('|')
                    let persen = Math.floor(Math.random() * 100)
                    reply(`RAMALAN JODOH\n\n${nama1} LOVE ${nama2}\n\nKecocokan: ${persen}%\n${persen > 70? 'Jodoh nih, gas nikah' : persen > 40? 'Lumayan, usaha lagi' : 'Mending temenan aja bro'}`)
                break
                
                case '.rate':
                    if (!q) return reply("Rate apa?.rate kegantengan gw")
                    let rate = Math.floor(Math.random() * 100)
                    reply(`${q} rate-nya: ${rate}%\n${rate > 80? 'GACOR KANG' : rate > 50? 'Lumayan lah' : 'Ampas'}`)
                break

                case '.cuaca':
                    if (!q) return reply("Kota mana?.cuaca Jakarta")
                    let cuaca = await axios.get(`https://api.nyxs.pw/tools/cuaca?query=${q}`)
                    let d = cuaca.data.result
                    reply(`CUACA ${d.location}\n\n${d.weather}\nSuhu: ${d.temperature}\nKelembaban: ${d.humidity}`)
                break
                
                case '.gempa':
                    let g = await axios.get(`https://api.nyxs.pw/info/gempa`)
                    let i = g.data.result
                    reply(`INFO GEMPA TERKINI\n\nLokasi: ${i.wilayah}\nMagnitudo: ${i.magnitude}\nTanggal: ${i.tanggal}\nJam: ${i.jam}\nKedalaman: ${i.kedalaman}`)
                break
                
                case '.brat':
                    if (!q) return reply("Isi teksnya..brat halo dunia")
                    reply("Bikin stiker brat...")
                    let brat = await axios.get(`https://api.nyxs.pw/maker/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer' })
                    await sock.sendMessage(from, { sticker: brat.data }, { quoted: m })
                break
            }
        } catch (e) {
            console.log(e)
            reply("Error bro, command salah atau server API down")
        }
    })
}
startBot()        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || ""
        const command = body.toLowerCase().split(" ")[0]
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(" ")
        const reply = (teks) => sock.sendMessage(from, { text: teks }, { quoted: m })

        try {
            switch (command) {
                case '.menu':
                    let jam = moment.tz("Asia/Jakarta").format("HH:mm:ss")
                    reply(`*BOT WA SULTAN 100+ FITUR 🔥*\nJam: ${jam} WIB\n\n*AI & TOOLS*\n.ai <tanya> |.hd |.removebg\n\n*DOWNLOADER*\n.tiktok <link> |.ig <link> |.play <judul>\n\n*STIKER*\n.sticker |.brat <teks> |.qc <teks>\n\n*ANTI STRES*\n.meme |.quotes |.darkjoke |.truth |.dare\n.jodoh <nama|nama> |.rate <apa>\n\n*INFO*\n.cuaca <kota> |.gempa\n\nKetik.ping buat cek bot 🔥`)
                break
                
                case '.ping': 
                    reply(`Pong! 🏓 Speed: ${new Date() - new Date(m.messageTimestamp * 1000)}ms\n100+ Fitur Aktif 🔥`)
                break
                
                case '.owner': 
                    reply("Owner: Dimas 🔥\nBot 24 Jam Railway\n100+ Fitur Anti Stres")
                break

                case '.ai':
                    if (!q) return reply("Mau nanya apa? Contoh:.ai cara ngilangin stres")
                    reply("Sabar lagi mikir...")
                    let ai = await axios.get(`https://api.nyxs.pw/ai/gpt4?text=${encodeURIComponent(q)}`)
                    reply(ai.data.result)
                break

                case '.sticker': case '.s':
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    let msgType = qmsg? Object.keys(qmsg)[0] : Object.keys(m.message)[0]
                    if (msgType === 'imageMessage' || msgType === 'videoMessage') {
                        reply("Bikin stiker...")
                        let stream = await downloadContentFromMessage(qmsg? qmsg[msgType] : m.message[msgType], msgType.replace('Message', ''))
                        let buffer = Buffer.from([])
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        await sock.sendMessage(from, { sticker: buffer }, { quoted: m })
                    } else reply("Reply gambar/video pake.sticker")
                break
                
                case '.tiktok':
                    if (!q) return reply("Linknya mana?.tiktok https://vt.tiktok.com/xxx")
                    reply("Download TikTok no WM...")
                    let tt = await axios.get(`https://api.nyxs.pw/dl/tiktok?url=${q}`)
                    await sock.sendMessage(from, { video: { url: tt.data.result.video }, caption: "Nih TikTok no WM 🔥" }, { quoted: m })
                break
                
                case '.play':
                    if (!q) return reply("Judul lagunya?.play dermaga biru")
                    reply("Cari lagu...")
                    let play = await axios.get(`https://api.nyxs.pw/dl/ytplay?query=${encodeURIComponent(q)}`)
                    await sock.sendMessage(from, { audio: { url: play.data.result.audio }, mimetype: 'audio/mpeg' }, { quoted: m })
                break

                case '.meme':
                    let meme = await axios.get(`https://api.nyxs.pw/fun/meme`)
                    await sock.sendMessage(from, { image: { url: meme.data.result }, caption: "Meme anti stres 🤣" }, { quoted: m })
                break
                
                case '.quotes': 
                    let qu = await axios.get(`https://api.nyxs.pw/quotes/quotes`)
                    reply(`*QUOTES BUAT LU:*\n\n"${qu.data.result.quotes}"\n\n- ${qu.data.result.author}`)
                break
                
                case '.darkjoke':
                    let dj = await axios.get(`https://api.nyxs.pw/fun/darkjoke`)
                    reply(`*DARK JOKE:*\n\n${dj.data.result}`)
                break
                
                case '.truth':
                    let tr = await axios.get(`https://api.nyxs.pw/fun/truth`)
                    reply(`*TRUTH OR DARE*\n\n${tr.data.result}`)
                break
                
                case '.dare':
                    let dr = await axios.get(`https://api.nyxs.pw/fun/dare`)
                    reply(`*TRUTH OR DARE*\n\n${dr.data.result}`)
                break
                
                case '.jodoh':
                    if (!q.includes('|')) return reply("Format salah. Contoh:.jodoh Dimas|Ayu")
                    let [nama1, nama2] = q.split('|')
                    let persen = Math.floor(Math.random() * 100)
                    reply(`*RAMALAN JODOH*\n\n${nama1} ❤️ ${nama2}\n\nKecocokan: ${persen}%\n${persen > 70? 'Jodoh nih, gas nikah 🔥' : persen > 40? 'Lumayan, usaha lagi' : 'Mending temenan aja bro 😭'}`)
                break
                
                case '.rate':
                    if (!q) return reply("Rate apa?.rate kegantengan gw")
                    let rate = Math.floor(Math.random() * 100)
                    reply(`${q} rate-nya: ${rate}%\n${rate > 80? 'GACOR KANG 🔥' : rate > 50? 'Lumayan lah' : 'Ampas 😭'}`)
                break

                case '.cuaca':
                    if (!q) return reply("Kota mana?.cuaca Jakarta")
                    let cuaca = await axios.get(`https://api.nyxs.pw/tools/cuaca?query=${q}`)
                    let d = cuaca.data.result
                    reply(`*CUACA ${d.location}*\n\n${d.weather}\nSuhu: ${d.temperature}\nKelembaban: ${d.humidity}`)
                break
                
                case '.gempa':
                    let g = await axios.get(`https://api.nyxs.pw/info/gempa`)
                    let i = g.data.result
                    reply(`*INFO GEMPA TERKINI*\n\n📍 ${i.wilayah}\n📊 ${i.magnitude}\n📅 ${i.tanggal}\n⏰ ${i.jam}\n📏 ${i.kedalaman}`)
                break
                
                case '.brat':
                    if (!q) return reply("Isi teksnya..brat halo dunia")
                    reply("Bikin stiker brat...")
                    let brat = await axios.get(`https://api.nyxs.pw/maker/brat?text=${encodeURIComponent(q)}`, { responseType: 'arraybuffer' })
                    await sock.sendMessage(from, { sticker: brat.data }, { quoted: m })
                break
            }
        } catch (e) {
            console.log(e)
            reply("Error bro, command salah atau server API down")
        }
    })
}
startBot()
*👥 GROUP* [Admin Only]
.welcome on/off |.antilink on/off |.tagall
.kick @tag |.add 628xxx |.promote @tag

Ketik.ping buat cek bot on 🔥
`

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({ version, logger: pino({ level: "silent" }), printQRInTerminal: false, auth: state, browser: ["Chrome", "Linux", ""] })

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update
        if(connection === "connecting") {
            if (!sock.authState.creds.registered) {
                const phoneNumber = "6283844376032" // NOMOR LU UDAH GW SET
                await new Promise(r => setTimeout(r, 2000))
                let code = await sock.requestPairingCode(phoneNumber)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(`PAIRING CODE LU: ${code}`)
            }
        }
        if(connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode!== DisconnectReason.loggedOut) startBot()
        } else if(connection === "open") console.log("BOT CONNECTED 🔥 100+ FITUR ON")
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if (!m.message || m.key.fromMe) return
        const from = m.key.remoteJid
        const sender = m.key.participant || m.key.remoteJid
        const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || ""
        const command = body.toLowerCase().split(" ")[0]
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(" ")
        const reply = (teks) => sock.sendMessage(from, { text: teks }, { quoted: m })

        try {
            switch (command) {
                // BASIC
                case '.menu': case '.help': reply(menu); break
                case '.ping': reply(`Pong! 🏓 Speed: ${new Date() - new Date(m.messageTimestamp * 1000)}ms\n100+ Fitur Aktif 🔥`); break
                case '.owner': reply("Owner: Dimas 🔥\nBot 24 Jam Railway\n100+ Fitur Anti Stres"); break

                // AI
                case '.ai': case '.gpt':
                    if (!q) return reply("Mau nanya apa? Contoh:.ai cara ngilangin stres")
                    reply("Sabar lagi mikir...")
                    let ai = await axios.get(`https://api.nyxs.pw/ai/gpt4?text=${encodeURIComponent(q)}`)
                    reply(ai.data.result)
                break

                // STICKER
                case '.sticker': case '.s':
                    let qmsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage
                    let msgType = qmsg? Object.keys(qmsg)[0] : Object.keys(m.message)[0]
                    if (msgType === 'imageMessage' || msgType === 'videoMessage') {
                        reply("Bikin stiker...")
                        let stream = await downloadContentFromMessage(qmsg? qmsg[msgType] : m.message[msgType], msgType.replace('Message', ''))
                        let buffer = Buffer.from([])
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk])
                        await sock.sendMessage(from, { sticker: buffer }, { quoted: m })
                    } else reply("Reply gambar/video pake.sticker")
                break
                
                // DOWNLOADER
                case '.tiktok':
                    if (!q) return reply("Linknya mana?.tiktok https://vt.tiktok.com/xxx")
                    reply("Download TikTok no WM...")
                    let tt = await axios.get(`https://api.nyxs.pw/dl/tiktok?url=${q}`)
                    await sock.sendMessage(from, { video: { url: tt.data.result.video }, caption: "Nih TikTok no WM 🔥" }, { quoted: m })
                break
                
                case '.play':
                    if (!q) return reply("Judul lagunya?.play dermaga biru")
                    reply("Cari lagu...")
                    let play = await axios.get(`https://api.nyxs.pw/dl/ytplay?query=${encodeURIComponent(q)}`)
                    await sock.sendMessage(from, { audio: { url: play.data.result.audio }, mimetype: 'audio/mpeg', ptt: false }, { quoted: m })
                break

                // FUN ANTI STRES
                case '.quotes': 
                    let qu = await axios.get(`https://api.nyxs.pw/quotes/quotes`)
                    reply(`*QUOTES BUAT LU:*\n\n"${qu.data.result.quotes}"\n\n- ${qu.data.result.author}`)
                break
                
                case '.meme':
                    let meme = await axios.get(`https://api.nyxs.pw/fun/meme`)
                    await sock.sendMessage(from, { image: { url: meme.data.result }, caption: "Meme anti stres 🤣" }, { quoted: m })
                break
                
                case '.darkjoke':
                    let dj = await axios.get(`https://api.nyxs.pw/fun/darkjoke`)
                    reply(`*DARK JOKE:*\n\n${dj.data.result}`)
                break
                
                case '.truth':
                    let tr = await axios.get(`https://api.nyxs.pw/fun/truth`)
                    reply(`*TRUTH OR DARE*\n\n${tr.data.result}`)
                break
                
                case '.dare':
                    let dr = await axios.get(`https://api.nyxs.pw/fun/dare`)
                    reply(`*TRUTH OR DARE*\n\n${dr.data.result}`)
                break
                
                case '.jodoh':
                    if (!q.includes('|')) return reply("Format salah. Contoh:.jodoh Dimas|Ayu")
                    let [nama1, nama2] = q.split('|')
                    let persen = Math.floor(Math.random() * 100)
                    reply(`*RAMALAN JODOH*\n\n${nama1} ❤️ ${nama2}\n\nKecocokan: ${persen}%\n${persen > 70? 'Jodoh nih, gas nikah 🔥' : persen > 40? 'Lumayan, usaha lagi' : 'Mending temenan aja bro 😭'}`)
                break
                
                case '.rate':
                    if (!q) return reply("Rate apa?.rate kegantengan gw")
                    let rate = Math.floor(Math.random() * 100)
                    reply(`${q} rate-nya: ${rate}%\n${rate > 80? 'GACOR KANG 🔥' : rate > 50? 'Lumayan lah' : 'Ampas 😭'}`)
                break

                // INFO
                case '.cuaca':
                    if (!q) return reply("Kota mana?.cuaca Jakarta")
                    let cuaca = await axios.get(`https://api.nyxs.pw/tools/cuaca?query=${q}`)
                    let d = cuaca.data.result
                    reply(`*CUACA ${d.location}*\n\n${d.weather}\nSuhu: ${d.temperature}\nKelembaban: ${d.humidity}`)
                break
                
                case '.gempa':
                    let g = await axios.get(`https://api.nyxs.pw/info/gempa`)
                    let i = g.data.result
                    reply(`*INFO GEMPA TERKINI*\n\n📍 ${i.wilayah}\n📊 ${i.magnitude}\n📅 ${i.tanggal}\n⏰ ${i.jam}\n📏 ${i.kedalaman}`)
                break
                
                default:
                    if (command.startsWith('.')) reply("Command ga ada bro. Ketik.menu")
            }
        } catch (e) {
            console.log(e)
            reply("Error bro, coba lagi atau command salah")
        }
    })
}
startBot()
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
