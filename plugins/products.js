// import fs from 'fs'
// import path from 'path'
// import fetchSpreadsheetData from '../services/spreadsheetServices.js'

// function normalizeText(text) {
//   return text?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || ''
// }

// // Función helper para delay
// const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

// export async function all(m) {
//   if (!m.isGroup && m.sender && m.text) {
//     console.log('Mensaje recibido:', m.text)
//     const response = normalizeText(m.text)
//     if (this.productsMode) {
//       try {
//         const dataPath = path.join(process.cwd(), 'data.json')
//         if (!fs.existsSync(dataPath)) {
//           await delay(5000) // 2s delay
//           await fetchSpreadsheetData()
//         }
//         const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) 
//         const product = data.find(item =>
//           normalizeText(item.Nombre).includes(response) ||
//           normalizeText(item.Descripción).includes(response)
//         )
//         if (product) {
//           await delay(5000) // 2s delay
//           await m.reply(`Encontré el producto: ${product.Nombre}\nDescripción: ${product.Descripción}`)
//         } else {
//           await delay(5000) // 2s delay
//           await m.reply("No encontré coincidencias.")
//         }
//       } catch (err) {
//         await delay(5000) // 2s delay
//         await m.reply("Ocurrió un error buscando el producto.")
//       }
//     }
//   }
// }