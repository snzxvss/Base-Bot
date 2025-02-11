import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import fetchSpreadsheetData from '../services/spreadsheetServices.js'

// Archivo de sesiones
const SESSIONS_FILE = path.join(process.cwd(), 'sessions.json')
let sessions = {}

// Funciones de manejo de sesiones
function loadSessions() {
  if (fs.existsSync(SESSIONS_FILE)) {
    sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'))
  }
}

function saveSessions() {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2))
}

// Función para normalizar texto
function normalizeText(text) {
  return text?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || ''
}

// Función helper para delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export async function all(m) {
  console.log('Mensaje recibido:', m.text)
  const initMensaje = m.text

  // Evitar responder a mensajes del propio bot
  if ((m.message && m.message.fromMe) || (m.key && m.key.fromMe) || m.isBaileys) {
    return
  }

  // Inicializa los estados si no existen
  this.awaitingConfirmation = this.awaitingConfirmation || {}
  this.awaitingPayment = this.awaitingPayment || {}
  this.awaitingProduct = this.awaitingProduct || {}

  // Determinar en qué parte del flujo se encuentra el usuario
  let stage
  if (this.awaitingConfirmation[m.sender]) stage = 'confirmation'
  else if (this.awaitingPayment[m.sender]) stage = 'payment'
  else if (typeof this.awaitingProduct[m.sender] !== 'undefined') stage = 'product'
  else stage = 'new'
  console.log(`Estado actual para ${m.sender}: ${stage}`)

  switch (stage) {
    case 'confirmation': {
      const answer = normalizeText(m.text)
      if (answer === 'si') {
        console.log("Confirmación recibida: SI")
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = path.dirname(__filename)
        const qrPath = path.join(__dirname, '../assets/qr.jpg')
        const qrBuffer = fs.readFileSync(qrPath)
        await this.sendFile(m.chat, qrBuffer, 'qr.jpg', "Por favor, realiza el pago mediante el QR y envía la captura del pago.")
        // Ahora se espera la captura del pago
        this.awaitingPayment[m.sender] = true
        delete this.awaitingConfirmation[m.sender]
        return
      } else if (answer === 'no') {
        console.log("Confirmación recibida: NO")
        await m.reply("Gracias por tu respuesta. Si necesitas buscar otro producto, vuelve a intentarlo.")
        delete this.awaitingConfirmation[m.sender]
        return
      }
      break
    }
    case 'payment': {
      if (m.message && (m.message.image || m.message.imageMessage)) {
        console.log("Captura de pago recibida, reenviando...")
        let targetNumber = process.env.PAYMENT_NUMBER || "573023606047"
        // Asegurarse de tener el jid completo
        const targetJid = targetNumber.includes('@') ? targetNumber : `${targetNumber}@s.whatsapp.net`
        console.log("Reenviando captura de pago a:", targetJid)
        await global.conn.copyNForward(targetJid, m, true)
        await m.reply("Gracias. Hemos recibido la captura del pago.")
        delete this.awaitingPayment[m.sender]
        return
      }
      break
    }
    case 'new':
    default: {
      // Flujo principal para nuevos usuarios o sesiones
      if (!m.isGroup && m.sender) {
        loadSessions()
        const now = Date.now()
        const userData = sessions[m.sender] || { lastTime: null }

        // Si es la primera vez o han pasado más de 30 minutos, enviamos el mensaje inicial
        if (!userData.lastTime || (now - userData.lastTime) > 30 * 60 * 1000) {
          userData.lastTime = now
          sessions[m.sender] = userData
          saveSessions()

          await this.sendMessage(m.chat, { 
            text: `👋 ¡Hola ${m.pushName}!\n\nBienvenido/a a [NOMBRE TIENDA].\n\nSoy tu bot de atención al cliente y estoy aquí para ayudarte en lo que necesites.` 
          })

          const __filename = fileURLToPath(import.meta.url)
          const __dirname = path.dirname(__filename)      
          const pdfPath = path.join(__dirname, '../assets/prueba.pdf')
          const buffer = fs.readFileSync(pdfPath)
          await this.sendFile(m.chat, buffer, 'prueba.pdf', '> Aquí tienes nuestro catalogo.')

          this.productsMode = true
          // Marcamos que se espera un mensaje de producto
          this.awaitingProduct[m.sender] = true

          console.log('Modo productos activado. Preguntando por producto...')
          await delay(3000)
          await this.sendMessage(m.chat, { 
            text: "*¿Qué producto te interesa del catalogo?*\n\n" +
                  "✏️ *Opciones para buscar:*\n" +
                  "• Ingresa el *nombre* del producto.\n" +
                  "• Ingresa el *código* del producto.\n" +
                  "• Envía una *imagen recortada* que permita identificarlo.\n\n" +
                  "> 😊 ¡Estamos aquí para ayudarte!" 
          })
          // Se termina la ejecución aquí para que el primer mensaje no se procese como búsqueda
          return
        }

        console.log('Continuando con el flujo de mensajes...')
        // A partir de aquí se procesan mensajes posteriores a la bienvenida
        if (m.text) {
          console.log('Mensaje diferente al inicial:', m.text)
          console.log('Mensaje inicial:', initMensaje)
          console.log('+--------------------------------------+')
          // Fin de la espera de producto
          this.awaitingProduct[m.sender] = false
          console.log("Producto search solicitado:", m.text)
          const response = normalizeText(m.text)
          try {
            const dataPath = path.join(process.cwd(), 'data.json')
            if (!fs.existsSync(dataPath)) {
              console.log("Data file not found. Fetching data from Google Sheets...")
              await delay(1000)
              await fetchSpreadsheetData()
            }
            const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"))
            const product = data.find(item =>
              normalizeText(item.Nombre).includes(response) ||
              normalizeText(item.Descripción).includes(response)
            )
            if (product) {
              await delay(5000)
              await m.reply(`Encontré el producto solicitado.\n*• Nombre:* ${product.Nombre}\n*• Descripción:* ${product.Descripción}`)
              // Preguntar si es el producto que buscaba y establecer flag de confirmación
              await delay(1000)
              await this.sendMessage(m.chat, { 
                text: "¿Es el producto que buscabas? Por favor responde *si* o *no*." 
              })
              this.awaitingConfirmation[m.sender] = true
            } else {
              await delay(5000)
              await m.reply("No encontré coincidencias.")
            }
          } catch (err) {
            await delay(5000)
            await m.reply("Ocurrió un error buscando el producto.")
          }
          return
        }
      }
      break
    }
  }
}