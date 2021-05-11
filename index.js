// WEB SERVER
const express = require('express')
const server = express()
const port = process.env.PORT || 8000;
server.get('/', (req, res) => {res.send('K-Bot server running...')})
server.listen(port, () => {
    console.clear()
    console.log('\nWeb-server running!\n')
})

// LOAD Baileys
const {
    WAConnection,
    MessageType,
    Presence,
    Mimetype,
    GroupSettingChange,
    MessageOptions,
    WALocationMessage,
    WA_MESSAGE_STUB_TYPES,
    ReconnectMode,
    ProxyAgent,
    waChatKey,
    mentionedJid,
    processTime,
} = require('@adiwajshing/baileys')

// LOAD DB CONNECTION
const db = require('./database');

// LOAD ADDITIONAL NPM PACKAGES
const fs = require('fs')
const ffmpeg = require('fluent-ffmpeg')
const WSF = require('wa-sticker-formatter')

async function fetchauth() {
    try{
    auth_result = await db.query('select * from auth;');
    console.log('Fetching login data...')
    auth_row_count = await auth_result.rowCount;
    if (auth_row_count == 0) {
        console.log('No login data found!')
    } else {
        console.log('Login data found!')
        auth_obj = {
            clientID: auth_result.rows[0].clientid,
            serverToken: auth_result.rows[0].servertoken,
            clientToken: auth_result.rows[0].clienttoken,
            encKey: auth_result.rows[0].enckey,
            macKey: auth_result.rows[0].mackey
        }
    }
    } catch {
        console.log('Creating database...')
        await db.query('CREATE TABLE auth(clientID text, serverToken text, clientToken text, encKey text, macKey text);');
        await fetchauth();
    }

}

// BASIC SETTINGS
prefix = '/';
source_link = 'https://github.com/karmaisgreat/simple-whatsapp-bot';

// LOAD CUSTOM FUNCTIONS
const getGroupAdmins = (participants) => {
	admins = []
	for (let i of participants) {
		i.isAdmin ? admins.push(i.jid) : ''
	}
	return admins
}
const adminHelp = (prefix, groupName) => {
        return `
─「 *${groupName} Admin Commands* 」─

*${prefix}add <phone number>*
    _Add any new member!_

*${prefix}kick <@mention>*
    _Kick any member out from group!_
    _Alias with ${prefix}remove, ${prefix}ban_

*${prefix}promote <@mention>*
    _Give admin permission to a member!_

*${prefix}demote <@mention>*
    _Remove admin permission of a member!_

*${prefix}rename <new-subject>*
    _Change group subject!_

*${prefix}chat <on/off>*
    _Enable/disable group chat_
    _/chat on - for everyone!_
    _/chat off - for admin only!_

*${prefix}link*
    _Get group invite link!_
    _Alias with ${prefix}getlink, ${prefix}grouplink_

*${prefix}sticker*
    _Create a sticker from different media types!_
    *Properties of sticker:*
        _crop_ - Used to crop the sticker size!
        _author_ - Add metadata in sticker!
        _pack_ - Add metadata in sticker!
        _nometadata_ - Remove all metadata from sticker!
    *Examples:*
        _${prefix}sticker pack simple-k-bot author Karma_
        _${prefix}sticker crop_
        _${prefix}sticker nometadata_

*${prefix}removebot*
    _Remove bot from group!_

*${prefix}source*
    _Get bot source code!_`
}
const getRandom = (ext) => {return `${Math.floor(Math.random() * 10000)}${ext}`}

// MAIN FUNCTION
async function main() {

    // LOADING SESSION
    const conn = new WAConnection()
    conn.logger.level = 'warn'
    conn.on('qr', () => {console.log('SCAN THE ABOVE QR CODE TO LOGIN!')})
    await fetchauth(); //GET LOGIN DATA
    if (auth_row_count == 1) {conn.loadAuthInfo(auth_obj)}
    conn.on('connecting', () => {console.log('Connecting...')})
    conn.on('open', () => {
        console.clear()
        console.log('Connected!')
    })
    await conn.connect({timeoutMs: 30 * 1000})
    const authInfo = conn.base64EncodedAuthInfo() // UPDATED LOGIN DATA
    load_clientID = authInfo.clientID;
    load_serverToken = authInfo.serverToken;
    load_clientToken = authInfo.clientToken;
    load_encKey = authInfo.encKey;
    load_macKey = authInfo.macKey;
    // INSERT / UPDATE LOGIN DATA
    if (auth_row_count == 0) {
        console.log('Inserting login data...')
        db.query('INSERT INTO auth VALUES($1,$2,$3,$4,$5);',[load_clientID,load_serverToken,load_clientToken,load_encKey,load_macKey])
        db.query('commit;')
        console.log('New login data inserted!')
    } else {
        console.log('Updating login data....')
        db.query('UPDATE auth SET clientid = $1, servertoken = $2, clienttoken = $3, enckey = $4, mackey = $5;',[load_clientID,load_serverToken,load_clientToken,load_encKey,load_macKey])
        db.query('commit;')
        console.log('Login data updated!')
    }

    conn.on('group-participants-update', async (anu) => {
		try {
			const mdata = await conn.groupMetadata(anu.jid)
			console.log(anu)
			if (anu.action == 'add') {
				num = anu.participants[0]
				num_split = `${num.split('@s.whatsapp.net')[0]}`
                console.log('Joined: ', num)
			}
		} catch (e) {
			console.log(e)
		}
	})

    conn.on('chat-update', async (mek) => {
        try {
            if (!mek.hasNewMessage) return
            mek = JSON.parse(JSON.stringify(mek)).messages[0]
            if (!mek.message) return
            if (mek.key && mek.key.remoteJid == 'status@broadcast') return
            if (mek.key.fromMe) return
            const content = JSON.stringify(mek.message)
            global.prefix
            const from = mek.key.remoteJid
            const type = Object.keys(mek.message)[0]
            const {
                text,
                extendedText,
                contact,
                location,
                liveLocation,
                image,
                video,
                sticker,
                document,
                audio,
                product
            } = MessageType
            body = (type === 'conversation' && mek.message.conversation.startsWith(prefix)) ? mek.message.conversation : (type == 'imageMessage') && mek.message.imageMessage.caption.startsWith(prefix) ? mek.message.imageMessage.caption : (type == 'videoMessage') && mek.message.videoMessage.caption.startsWith(prefix) ? mek.message.videoMessage.caption : (type == 'extendedTextMessage') && mek.message.extendedTextMessage.text.startsWith(prefix) ? mek.message.extendedTextMessage.text : ''
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase()
            const args = body.trim().split(/ +/).slice(1)
            const isCmd = body.startsWith(prefix)

            errors = {
                admin_error: '_❌ ERROR: Admin permission failed! ❌_'
            }

            const botNumber = conn.user.jid
            const isGroup = from.endsWith('@g.us')
            const sender = isGroup ? mek.participant : mek.key.remoteJid
            const groupMetadata = isGroup ? await conn.groupMetadata(from) : ''
            const groupName = isGroup ? groupMetadata.subject : ''
            const groupMembers = isGroup ? groupMetadata.participants : ''
            const groupAdmins = isGroup ? getGroupAdmins(groupMembers) : ''
            const isBotGroupAdmins = groupAdmins.includes(botNumber) || false
            const isGroupAdmins = groupAdmins.includes(sender) || false

            const reply = (teks) => {
                conn.sendMessage(from, teks, text, {
                    quoted: mek
                })
            }

            const costum = (pesan, tipe, target, target2) => {
                conn.sendMessage(from, pesan, tipe, {
                    quoted: {
                        key: {
                            fromMe: false,
                            participant: `${target}`,
                            ...(from ? {
                                remoteJid: from
                            } : {})
                        },
                        message: {
                            conversation: `${target2}`
                        }
                    }
                })
            }

            const isMedia = (type === 'imageMessage' || type === 'videoMessage')
			const isQuotedImage = type === 'extendedTextMessage' && content.includes('imageMessage')
			const isQuotedVideo = type === 'extendedTextMessage' && content.includes('videoMessage')
			const isQuotedSticker = type === 'extendedTextMessage' && content.includes('stickerMessage')
            if (isCmd && isGroup) console.log('[COMMAND]', command, '[FROM]', sender.split('@')[0], '[IN]', groupName)

            /////////////// COMMANDS \\\\\\\\\\\\\\\

            switch (command) {

                /////////////// HELP \\\\\\\\\\\\\\\

                case 'help':
                case 'acmd':
                    if (!isGroup) return;
                    await costum(adminHelp(prefix, groupName), text);
                    break

                case 'link':
                case 'getlink':
                case 'grouplink':
                    if (!isGroup) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    gc_invite_code = await conn.groupInviteCode(from)
                    gc_link = `https://chat.whatsapp.com/${gc_invite_code}`
                    conn.sendMessage(from, gc_link, text, {
                        quoted: mek,
                        detectLinks: true
                    })
                    break;

                case 'source':
                    if (!isGroup) return;
                    conn.sendMessage(from, source_link, text, {
                        quoted: mek,
                        detectLinks: true
                    })
                    break;


                case 'sticker':
                    if (!isGroup) return;

                    // Format should be <prefix>sticker pack <pack_name> author <author_name>
                    var packName = ""
                    var authorName = ""

                    // Check if pack keyword is found in args!
                    if(args.includes('pack') == true) {
                        packNameDataCollection = false;
                        for (let i = 0; i < args.length; i++) {
                            // Enables data collection when keyword found in index!
                            if(args[i].includes('pack') == true) {
                                packNameDataCollection = true;
                            }
                            if (args[i].includes('author') == true) {
                                packNameDataCollection = false;
                            }
                            // If data collection is enabled and args length is more then one it will start appending!
                            if (packNameDataCollection == true) {
                                packName = packName + args[i] + ' '
                            }
                        }
                        // Check if variable contain unnecessary startup word!
                        if (packName.startsWith('pack ')) {
                            packName = `${packName.split('pack ')[1]}`
                        }
                    }

                    // Check if author keyword is found in args!
                    if (args.includes('author') == true) {
                        authorNameDataCollection = false;
                        for (let i = 0; i < args.length; i++) {
                            // Enables data collection when keyword found in index!
                            if(args[i].includes('author') == true) {
                                authorNameDataCollection = true;
                            }
                            // If data collection is enabled and args length is more then one it will start appending!
                            if (authorNameDataCollection == true) {
                                authorName = authorName + args[i] + ' '
                            }
                            // Check if variable contain unnecessary startup word!
                            if (authorName.startsWith('author ')) {
                                authorName = `${authorName.split('author ')[1]}`
                            }
                        }
                    }

                    // Check if packName and authorName is empty it will pass default values!
                    if (packName == "") {
                        packName = "simple-whatsapp-bot"
                    }
                    if (authorName == "") {
                        authorName = "github.com/karmaisgreat/simple-whatsapp-bot"
                    }

                    outputOptions = [`-vcodec`,`libwebp`,`-vf`,`scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`];
                    if(args.includes('crop') == true) {
                        outputOptions = [
                            `-vcodec`,
                            `libwebp`,
                            `-vf`,
                            `crop=w='min(min(iw\,ih)\,500)':h='min(min(iw\,ih)\,500)',scale=500:500,setsar=1,fps=15`,
                            `-loop`,
                            `0`,
                            `-ss`,
                            `00:00:00.0`,
                            `-t`,
                            `00:00:10.0`,
                            `-preset`,
                            `default`,
                            `-an`,
                            `-vsync`,
                            `0`,
                            `-s`,
                            `512:512`
                        ];
                    }

					if ((isMedia && !mek.message.videoMessage || isQuotedImage)) {
						const encmedia = isQuotedImage ? JSON.parse(JSON.stringify(mek).replace('quotedM','m')).message.extendedTextMessage.contextInfo : mek
						const media = await conn.downloadAndSaveMediaMessage(encmedia)
						ran = getRandom('.webp')
						reply('⌛ Processing image... ⏳')
						await ffmpeg(`./${media}`)
							.input(media)
							.on('error', function (err) {
								fs.unlinkSync(media)
								console.log(`Error : ${err}`)
								reply('_❌ ERROR: Failed to convert image into sticker! ❌_')
							})
							.on('end', function () {
								buildSticker()
							})
							.addOutputOptions(outputOptions)
							.toFormat('webp')
							.save(ran)

                        async function buildSticker(){
                            if(args.includes('nometadata') == true) {
                                conn.sendMessage(from, fs.readFileSync(ran), sticker, {quoted: mek})
                                fs.unlinkSync(media)
                                fs.unlinkSync(ran)
                            } else {
                                const webpWithMetadata = await WSF.setMetadata(packName, authorName, ran)
                                conn.sendMessage(from, webpWithMetadata, MessageType.sticker)
                                fs.unlinkSync(media)
                                fs.unlinkSync(ran)
                            }
                        }

                    } else if ((isMedia && mek.message.videoMessage.seconds < 11 || isQuotedVideo && mek.message.extendedTextMessage.contextInfo.quotedMessage.videoMessage.seconds < 11)) {
						const encmedia = isQuotedVideo ? JSON.parse(JSON.stringify(mek).replace('quotedM','m')).message.extendedTextMessage.contextInfo : mek
						const media = await conn.downloadAndSaveMediaMessage(encmedia)
						ran = getRandom('.webp')
						reply('⌛ Processing animation... ⏳')
						await ffmpeg(`./${media}`)
							.inputFormat(media.split('.')[1])
							.on('error', function (err) {
								fs.unlinkSync(media)
								mediaType = media.endsWith('.mp4') ? 'video' : 'gif'
								reply(`_❌ ERROR: Failed to convert ${mediaType} to sticker! ❌_`)
							})
							.on('end', function () {
							    buildSticker()
							})
							.addOutputOptions(outputOptions)
							.toFormat('webp')
							.save(ran)

                        async function buildSticker(){
                            if(args.includes('nometadata') == true) {
                                conn.sendMessage(from, fs.readFileSync(ran), sticker, {quoted: mek})
                                fs.unlinkSync(media)
                                fs.unlinkSync(ran)
                            } else {
                                const webpWithMetadata = await WSF.setMetadata(packName, authorName, ran)
                                conn.sendMessage(from, webpWithMetadata, MessageType.sticker)
                                fs.unlinkSync(media)
                                fs.unlinkSync(ran)
                            }
                        }
                    }
                    break;

                /////////////// ADMIN COMMANDS \\\\\\\\\\\\\\\

                case 'add':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (args.length < 1) return;
                    var num = '';
                    if (args.length > 1) {
                        for (let j = 0; j < args.length; j++) {
                            num = num + args[j]
                        }
                        num = `${num.replace(/ /g, '')}@s.whatsapp.net`
                    } else {
                        num = `${args[0].replace(/ /g, '')}@s.whatsapp.net`
                    }
                    if (num.startsWith('+')) {
                        num = `${num.split('+')[1]}`
                    }
                    const response = await conn.groupAdd(from, [num])
                    get_status = `${num.split('@s.whatsapp.net')[0]}`
                    get_status = response[`${get_status}@c.us`];
                    if (get_status == 400) {
                        reply('_❌ ERROR: Invalid number! ❌_');
                    }
                    if (get_status == 403) {
                        reply('_❌ ERROR: Number has privacy on adding group! ❌_');
                    }
                    if (get_status == 408) {
                        reply('_❌ ERROR: Number has left the group recently! ❌_');
                    }
                    if (get_status == 409) {
                        reply('_❌ ERROR: Number is already exists! ❌_');
                    }
                    if (get_status == 500) {
                        reply('_❌ ERROR: Group is currently full! ❌_');
                    }
                    if (get_status == 200) {
                        reply('_✔ SUCCESS: Number added to group! ✔_');
                    }
                    break;

                case 'kick':
                case 'remove':
                case 'ban':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (mek.message.extendedTextMessage === undefined || mek.message.extendedTextMessage === null) return;
                    mentioned = mek.message.extendedTextMessage.contextInfo.mentionedJid
                    if (groupAdmins.includes(`${mentioned}`) == true) return;
                    if (mentioned.length > 1) {
                        return;
                    } else {
                        conn.groupRemove(from, mentioned)
                    }
                    break;

                case 'promote':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (mek.message.extendedTextMessage === undefined || mek.message.extendedTextMessage === null) return;
                    mentioned = mek.message.extendedTextMessage.contextInfo.mentionedJid
                    if (groupAdmins.includes(`${mentioned}`) == true) return;
                    if (mentioned.length > 1) {
                        return;
                    } else {
                        conn.groupMakeAdmin(from, mentioned)
                    }
                    break;

                case 'demote':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (mek.message.extendedTextMessage === undefined || mek.message.extendedTextMessage === null) return reply('_⚠ USAGE: /demote <@mention> ⚠_');
                    mentioned = mek.message.extendedTextMessage.contextInfo.mentionedJid
                    if (groupAdmins.includes(`${mentioned}`) == false) return;
                    if (mentioned.length > 1) {
                        return;
                    } else {
                        conn.groupDemoteAdmin(from, mentioned)
                    }
                    break;

                case 'chat':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (args.length < 1) return;
                    if (args[0] == 'on') {
                        conn.groupSettingChange(from, GroupSettingChange.messageSend, false);
                    } else if (args[0] == 'off') {
                        conn.groupSettingChange(from, GroupSettingChange.messageSend, true);
                    } else {
                        return;
                    }
                    break;

                case 'rename':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (args.length < 1) return;
                    get_subject = '';
                    for (i = 0; i < args.length; i++) {
                        get_subject = get_subject + args[i] + ' ';
                    }
                    conn.groupUpdateSubject(from, get_subject);
                    break;

                case 'removebot':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    conn.groupLeave(from)
                    break;

                default:
                    break;
            }
        } catch (e) {
            console.log('Error : %s', e)
        }
    })
}
main()