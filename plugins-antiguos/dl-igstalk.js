
import fg from 'api-dylux'
let handler= async (m, { conn, args, text, usedPrefix, command }) => {
	
    if (!args[0]) throw `✳️ ${mssg.noUsername}\n\n📌${mssg.example} : ${usedPrefix + command} fg98_ff` 
    try {
    let res = await fg.igStalk(args[0])
    let te = `
┌──「 *STALKING* 
│𖠡 *🔖${mssg.name}:* ${res.name} 
│𖠡 *🔖${mssg.username}:* ${res.username}
│𖠡 *👥${mssg.followers}:* ${res.followersH}
│𖠡 *🫂${mssg.follows}:* ${res.followingH}
│𖠡 *📌${mssg.bio}:* ${res.description}
│𖠡 *🏝️${mssg.posts}:* ${res.postsH}
│𖠡 *🔗${mssg.link}:* https://instagram.com/${res.username.replace(/^@/, '')}
└────────────`

     await conn.sendFile(m.chat, res.profilePic, 'tt.png', te, m)
    } catch {
        m.reply(`✳️ ${mssg.error}`)
      }
     
}
handler.help = ['igstalk']
handler.tags = ['dl']
handler.command = ['igstalk'] 

export default handler
