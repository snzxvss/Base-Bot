import axios from 'axios'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config()

const SPREADSHEET_URL = process.env.SPREADSHEET_URL
const SPREADSHEET_ID = SPREADSHEET_URL.match(/\/d\/([a-zA-Z0-9-_]+)/)[1]
const SHEET_NAME = 'Articulos'

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

            // Delete the file if it exists
            const dataPath = 'data.json'
            if (fs.existsSync(dataPath)) {
                fs.unlinkSync(dataPath)
                console.log('Existing data.json file deleted')
            }

            // Write new data
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
            console.log('New data saved to data.json')
        } else {
            console.log('No data found.')
        }
    } catch (error) {
        console.error('Error fetching spreadsheet data:', error)
    }
}

export default fetchSpreadsheetData