import axios from 'axios'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config()

const SPREADSHEET_URL = process.env.SPREADSHEET_URL
const SPREADSHEET_ID = SPREADSHEET_URL.match(/\/d\/([a-zA-Z0-9-_]+)/)[1]
const SHEET_NAME = 'Articulos' // Cambia esto si tu hoja tiene otro nombre

console.log(`SPREADSHEET_URL: ${SPREADSHEET_URL}`)
console.log(`SPREADSHEET_ID: ${SPREADSHEET_ID}`)
console.log(`SHEET_NAME: ${SHEET_NAME}`)

export async function fetchSpreadsheetData() {
    try {
        console.log('Fetching data from Google Sheets...')
        const response = await axios.get(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`)

        const jsonData = JSON.parse(response.data.substr(47).slice(0, -2))
        const rows = jsonData.table.rows
        if (rows.length) {
            const headers = jsonData.table.cols.map(col => col.label)
            const data = rows.map(row => {
                let obj = {}
                row.c.forEach((cell, index) => {
                    obj[headers[index]] = cell ? cell.v : null
                })
                return obj
            })

            fs.writeFileSync('data.json', JSON.stringify(data, null, 2))
            console.log('Data saved to data.json')
        } else {
            console.log('No data found.')
        }
    } catch (error) {
        console.error('Error fetching spreadsheet data:', error)
    }
}

export default fetchSpreadsheetData