/**
 * Vercel Serverless Function: Submit Lead to Vintus CRM (Google Sheets)
 *
 * Columns: Timestamp | First Name | Last Name | Email | Phone | Primary Goal |
 *          Training Days | Experience | Challenge | Source | Intent |
 *          Booking Status | Booked Time | Notes
 */

const { google } = require('googleapis');

// Intent detection based on quiz answers
function detectIntent(data) {
    let score = 0;

    // High-commitment training schedule = higher intent
    if (data.training_days === '6+') score += 3;
    else if (data.training_days === '4-5') score += 2;
    else if (data.training_days === '2-3') score += 1;

    // Experience level - intermediate/advanced usually more serious
    if (data.experience === 'advanced') score += 2;
    else if (data.experience === 'intermediate') score += 2;
    else if (data.experience === 'beginner') score += 1;

    // Challenge type - some indicate higher buying intent
    if (data.challenge === 'no-results') score += 3; // Frustrated, wants solution
    else if (data.challenge === 'structure') score += 2; // Needs accountability
    else if (data.challenge === 'energy') score += 1;
    else if (data.challenge === 'unsure') score += 1;

    // Goal specificity
    if (data.primary_goal === 'build-muscle' || data.primary_goal === 'lose-fat') score += 2;
    else if (data.primary_goal === 'well-rounded') score += 2;
    else if (data.primary_goal === 'endurance') score += 1;

    // Classify intent
    if (score >= 8) return 'High';
    if (score >= 5) return 'Medium';
    return 'Low';
}

// Format goal for readability
function formatGoal(goal, otherText) {
    const goalMap = {
        'build-muscle': 'Build Muscle',
        'lose-fat': 'Lose Fat',
        'endurance': 'Improve Endurance',
        'well-rounded': 'Well-Rounded',
        'other': otherText || 'Other'
    };
    return goalMap[goal] || goal || '';
}

// Format challenge for readability
function formatChallenge(challenge) {
    const challengeMap = {
        'structure': 'Lack of Structure/Accountability',
        'no-results': 'Not Seeing Results',
        'energy': 'Inconsistent Energy/Recovery',
        'unsure': 'Unsure How to Train/Fuel'
    };
    return challengeMap[challenge] || challenge || '';
}

// Format experience for readability
function formatExperience(exp) {
    const expMap = {
        'beginner': 'Beginner',
        'intermediate': 'Intermediate',
        'advanced': 'Advanced'
    };
    return expMap[exp] || exp || '';
}

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

        // Detect lead intent
        const intent = detectIntent(data);

        if (!privateKey || !clientEmail || !spreadsheetId) {
            console.log('Google Sheets credentials not configured. Lead data:');
            console.log({
                timestamp: data.timestamp || new Date().toISOString(),
                name: `${data.first_name} ${data.last_name}`,
                email: data.email,
                phone: data.phone,
                goal: formatGoal(data.primary_goal, data.primary_goal_other),
                days: data.training_days,
                experience: formatExperience(data.experience),
                challenge: formatChallenge(data.challenge),
                source: data.source,
                intent: intent
            });

            res.status(200).json({
                success: true,
                message: 'Lead captured (local mode)',
                leadId: `local_${Date.now()}`,
                intent: intent
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

        // Prepare row data matching CRM columns:
        // Timestamp | First Name | Last Name | Email | Phone | Primary Goal |
        // Training Days | Experience | Challenge | Source | Intent |
        // Booking Status | Booked Time | Notes
        const timestamp = data.timestamp || new Date().toISOString();
        const row = [
            timestamp,
            data.first_name || '',
            data.last_name || '',
            data.email || '',
            data.phone || '',
            formatGoal(data.primary_goal, data.primary_goal_other),
            data.training_days || '',
            formatExperience(data.experience),
            formatChallenge(data.challenge),
            data.source || 'quiz',
            intent,
            'New', // Booking Status
            '',    // Booked Time (empty until they book)
            ''     // Notes (empty for now)
        ];

        // Append to Google Sheet (Sheet1 is default)
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Sheet1!A:N',
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: [row]
            }
        });

        console.log(`Lead saved: ${data.email} | Intent: ${intent}`);

        res.status(200).json({
            success: true,
            message: 'Lead captured successfully',
            leadId: `gs_${Date.now()}`,
            intent: intent
        });

    } catch (error) {
        console.error('Error saving lead:', error);

        res.status(500).json({
            success: false,
            message: 'An error occurred. Please try again.'
        });
    }
};
