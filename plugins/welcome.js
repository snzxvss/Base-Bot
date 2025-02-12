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
      if (typeof this.awaitingConfirmation[m.sender] === 'object' && this.awaitingConfirmation[m.sender] !== true) {
        const formState = this.awaitingConfirmation[m.sender]
        if (formState.stage === 'formName') {
          formState.name = m.text.trim()
          formState.stage = 'formId'
          await this.sendMessage(m.chat, { 
            text: "Por favor, ingresa tu número de identificación:" 
          })
          return
        } else if (formState.stage === 'formId') {
          formState.idNumber = m.text.trim()
          formState.stage = 'formAddress'
          await this.sendMessage(m.chat, { 
            text: "Por favor, ingresa tu dirección completa:" 
          })
          return
        } else if (formState.stage === 'formAddress') {
          formState.address = m.text.trim()
          formState.stage = 'formConfirmation'
          
          // Mostrar resumen de la información
          const product = this.selectedProduct && this.selectedProduct[m.sender]
         
          let confirmMsg = "_*Por favor confirma que la siguiente información es correcta:*_\n\n"
          confirmMsg += `• *Nombre:* ${formState.name}\n`
          confirmMsg += `• *Identificación:* ${formState.idNumber}\n`
          confirmMsg += `• *Dirección:* ${formState.address}\n`
          confirmMsg += "\n\t_*Información del producto*_\n\n"
          if (product) {
            confirmMsg += `• *Producto:* ${product.Nombre}\n`
            confirmMsg += `• *Descripción:* ${product.Descripción}\n`
            confirmMsg += `• *Precio:* ${product.Precio ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(product.Precio) : 'N/A'}\n`
          }
          confirmMsg += "\nResponde *si* para confirmar o *no* para cancelar y volver a empezar."
          
          await this.sendMessage(m.chat, { text: confirmMsg })
          return
        } else if (formState.stage === 'formConfirmation') {
          const answer = normalizeText(m.text)
          if (answer === 'si') {
            // Guardamos la información del formulario
            this.formData = this.formData || {}
            this.formData[m.sender] = { 
              name: formState.name, 
              idNumber: formState.idNumber,
              address: formState.address 
            }
            
            // Formatear el precio y mostrar QR
            const product = this.selectedProduct && this.selectedProduct[m.sender]
            const formattedPrice = (product && product.Precio)
              ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(product.Precio)
              : 'N/A'
    
            const __filename = fileURLToPath(import.meta.url)
            const __dirname = path.dirname(__filename)
            const qrPath = path.join(__dirname, '../assets/qr.jpg')
            const qrBuffer = fs.readFileSync(qrPath)
            await this.sendFile(m.chat, qrBuffer, 'qr.jpg', `Por favor, realiza el pago de *${formattedPrice}* mediante el siguiente QR y envía la captura del pago.\n\n> Recuerda que debes enviar la captura del pago para completar la transacción.`)
            
            // Ahora se espera la captura del pago
            this.awaitingPayment[m.sender] = true
            delete this.awaitingConfirmation[m.sender]
            return
          } else if (answer === 'no') {
            await this.sendMessage(m.chat, { 
              text: "Entendido, volvamos a empezar.\nPor favor, ingresa tu nombre completo:" 
            })
            this.awaitingConfirmation[m.sender] = { stage: 'formName' }
            return
          } else {
            await this.sendMessage(m.chat, { 
              text: "❌ Por favor responde solo *Si* o *No*" 
            })
            return
          }
        }
      } else {
        // Recoger la respuesta inicial de confirmación
        const answer = normalizeText(m.text)
        if (answer === 'si') {
          console.log("Confirmación recibida: SI")
          // Inicia la recopilación del formulario; primer paso: pedir nombre completo
          this.awaitingConfirmation[m.sender] = { stage: 'formName' }
          await this.sendMessage(m.chat, { 
            text: "Por favor, ingresa tu nombre completo:" 
          })
          return
        } else if (answer === 'no') {
          console.log("Confirmación recibida: NO")
          await m.reply("Gracias por tu respuesta. Si necesitas buscar otro producto, vuelve a intentarlo.")
          delete this.awaitingConfirmation[m.sender]
          return
        }
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
        
        // Recuperar información del formulario, del producto seleccionado y el número del pagador
        const formData = (this.formData && this.formData[m.sender]) || {}
        const productData = (this.selectedProduct && this.selectedProduct[m.sender]) || {}
        const senderNumber = `+${m.sender.split('@')[0]}`
    
        let detailsMsg = "\t_*Información de transacción*_\t\n\n"
        detailsMsg += `*Nombre:* ${formData.name || "N/A"}\n`
        detailsMsg += `*Identificación:* ${formData.idNumber || "N/A"}\n`
        detailsMsg += `*Número:* ${senderNumber}\n`
        detailsMsg += `*Dirección:* ${formData.address || "N/A"}\n` 
        detailsMsg += `\n\t_*Detalles del producto*_\t\n\n`
        if (productData.Nombre) {
          detailsMsg += `*Código:* ${productData.ID || 'N/A'}\n`
          detailsMsg += `*Producto:* ${productData.Nombre}\n`
          detailsMsg += `*Descripción:* ${productData.Descripción}\n`
          detailsMsg += `*Precio:* ${productData.Precio ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(productData.Precio) : 'N/A'}\n`
          detailsMsg += `*Stock:* ${productData.Stock || 'N/A'}\n`
        }
        await global.conn.sendMessage(targetJid, { text: detailsMsg })
        
        await m.reply("*Gracias por la compra. Hemos recibido la captura del pago.*\n> En breve nos colocaremos en contacto contigo para coordinar la entrega.")
        
        // Borrar toda la sesión de conversación
        delete this.awaitingPayment[m.sender]
        delete this.awaitingProduct[m.sender]
        delete this.awaitingConfirmation[m.sender]
        delete this.selectedProduct[m.sender]
        delete this.formData[m.sender]
    
        // Borrar sesión del archivo sessions.json
        loadSessions()
        if (sessions[m.sender]) {
          delete sessions[m.sender]
          saveSessions()
        }
    
        // Establecer stage como 'new' para la próxima interacción
        stage = 'new'
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
        
        // Nombre de la empresa del .env
        const companyName = process.env.NAMEBUSINESS || '[NOMBRE TIENDA]'
    
          await this.sendMessage(m.chat, { 
            text: `👋 ¡Hola *${m.pushName}*!\n\nBienvenido a *${companyName}*.\n\nSoy tu bot de atención al cliente y estoy aquí para ayudarte en lo que necesites.` 
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
                  "• Ingresa el *código* del producto.\n\n" +  
                  "> 😊 ¡Estamos aquí para ayudarte!" 
          })
          // Se termina la ejecución aquí para que el primer mensaje no se procese como búsqueda
          return
        }
    
        console.log('Continuando con el flujo de mensajes...')
        // A partir de aquí se procesan mensajes posteriores a la bienvenida
        if (m.text) {
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
              // Al encontrar el producto, almacenamos la información para enviarla junto al pago
              this.selectedProduct = this.selectedProduct || {}
              this.selectedProduct[m.sender] = product
              
              await delay(5000)
              const formattedPrice = (product && product.Precio)
                ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(product.Precio)
                : 'N/A'
              await m.reply(`Encontré el producto solicitado.\n*• Nombre:* ${product.Nombre}\n*• Descripción:* ${product.Descripción}\n*• Precio:* ${formattedPrice}`)
              
              try {
                if (product.ImagenURL) {
                  const tempDir = path.join(process.cwd(), './tmp')
                  if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir)
                  }
                  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
                  const imagePath = path.join(tempDir, `imagen_producto_${uniqueSuffix}.jpg`)
                  const res = await fetch(product.ImagenURL)
                  const buffer = await res.arrayBuffer()
                  fs.writeFileSync(imagePath, Buffer.from(buffer))
                  await this.sendFile(m.chat, fs.readFileSync(imagePath), `imagen_producto_${uniqueSuffix}.jpg`)
                }
              } catch (err) {
                console.error('Error sending product image:', err)
              }
              
              // Preguntar si es el producto que buscaba y establecer flag de confirmación
              await delay(1000)
              await this.sendMessage(m.chat, { 
                text: `¿Es el producto que buscabas? \nPor favor responde con un "*Si*" o un "*No*" para confirmar.`
              })
              this.awaitingConfirmation[m.sender] = true
              
            } else {
              await delay(5000)
              await m.reply(`No encontré coincidencias para un producto "*${m.text}*". Por favor, intenta de nuevo.`)
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