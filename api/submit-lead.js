/**
 * Vercel Serverless Function: Submit Lead to Google Sheets
 *
 * This function receives quiz data and writes it to a Google Sheet.
 *
 * Required Environment Variables (set in Vercel Dashboard):
 * - GOOGLE_SHEETS_PRIVATE_KEY: The private key from your service account JSON
 * - GOOGLE_SHEETS_CLIENT_EMAIL: The client email from your service account JSON
 * - GOOGLE_SHEETS_SPREADSHEET_ID: The ID of your Google Spreadsheet
 *
 * Setup Instructions:
 * 1. Go to Google Cloud Console (https://console.cloud.google.com)
 * 2. Create a new project or select existing one
 * 3. Enable the Google Sheets API
 * 4. Create a Service Account (IAM & Admin > Service Accounts)
 * 5. Create and download a JSON key for the service account
 * 6. Share your Google Sheet with the service account email (Editor access)
 * 7. Add the environment variables to Vercel project settings
 */

const { google } = require('googleapis');

// CORS headers
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

module.exports = async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).json({ message: 'OK' });
        return;
    }

    // Only allow POST
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    try {
        const data = req.body;

        // Validate required fields
        if (!data.email || !data.first_name) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
            return;
        }

        // Check for required environment variables
        const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
        const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

        if (!privateKey || !clientEmail || !spreadsheetId) {
            console.log('Google Sheets credentials not configured. Storing lead locally.');

            // In development or if credentials aren't set, just log and return success
            console.log('Lead received:', {
                timestamp: data.timestamp || new Date().toISOString(),
                name: `${data.first_name} ${data.last_name}`,
                email: data.email,
                phone: data.phone,
                goal: data.primary_goal,
                days: data.training_days,
                experience: data.experience,
                challenge: data.challenge,
                source: data.source
            });

            res.status(200).json({
                success: true,
                message: 'Lead captured successfully (local mode)',
                leadId: `local_${Date.now()}`
            });
            return;
        }

        // Initialize Google Sheets API
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, '\n')
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Prepare row data
        const timestamp = data.timestamp || new Date().toISOString();
        const row = [
            timestamp,
            data.first_name || '',
            data.last_name || '',
            data.email || '',
            data.phone || '',
            data.primary_goal || '',
            data.training_days || '',
            data.experience || '',
            data.challenge || '',
            data.source || 'quiz',
            'New' // Status column
        ];

        // Append to Google Sheet
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Leads!A:K', // Adjust sheet name and range as needed
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [row]
            }
        });

        console.log('Lead saved to Google Sheets:', data.email);

        res.status(200).json({
            success: true,
            message: 'Lead captured successfully',
            leadId: `gs_${Date.now()}`
        });

    } catch (error) {
        console.error('Error saving lead:', error);

        // Don't expose internal errors to client
        res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again.'
        });
    }
};
