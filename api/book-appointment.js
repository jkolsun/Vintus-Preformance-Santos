/**
 * Vercel Serverless Function: Book Appointment
 * Creates a calendar event with Google Meet and logs to CRM
 */

const { google } = require('googleapis');

module.exports = async (req, res) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, email, phone, date, time, datetime } = req.body;

        // Validate required fields
        if (!name || !email || !date || !time) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
        const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

        // Parse the time
        const [hour, minute] = time.split(':').map(Number);
        const [year, month, day] = date.split('-').map(Number);

        const startTime = new Date(year, month - 1, day, hour, minute);
        const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes

        let calendarEventId = null;
        let meetLink = null;

        // Try to create calendar event if credentials exist
        if (calendarId && privateKey && clientEmail) {
            try {
                const auth = new google.auth.GoogleAuth({
                    credentials: {
                        client_email: clientEmail,
                        private_key: privateKey.replace(/\\n/g, '\n')
                    },
                    scopes: ['https://www.googleapis.com/auth/calendar']
                });

                const calendar = google.calendar({ version: 'v3', auth });

                // Create event with Google Meet
                const event = {
                    summary: `Strategy Call - ${name}`,
                    description: `Free Strategy Call with ${name}\n\nContact: ${email}\nPhone: ${phone}\n\nBooked via Vintus Performance website.`,
                    start: {
                        dateTime: startTime.toISOString(),
                        timeZone: 'America/New_York'
                    },
                    end: {
                        dateTime: endTime.toISOString(),
                        timeZone: 'America/New_York'
                    },
                    attendees: [
                        { email: email }
                    ],
                    conferenceData: {
                        createRequest: {
                            requestId: `vintus-${Date.now()}`,
                            conferenceSolutionKey: { type: 'hangoutsMeet' }
                        }
                    },
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'email', minutes: 24 * 60 }, // 1 day before
                            { method: 'email', minutes: 60 },      // 1 hour before
                            { method: 'popup', minutes: 30 }       // 30 min before
                        ]
                    }
                };

                const response = await calendar.events.insert({
                    calendarId,
                    resource: event,
                    conferenceDataVersion: 1,
                    sendUpdates: 'all' // Send email invites to attendees
                });

                calendarEventId = response.data.id;
                meetLink = response.data.hangoutLink || response.data.conferenceData?.entryPoints?.[0]?.uri;

                console.log(`Calendar event created: ${calendarEventId}`);
            } catch (calendarError) {
                console.error('Calendar creation error:', calendarError.message);
                // Continue - we'll still log to sheets
            }
        }

        // Log to Google Sheets CRM
        if (spreadsheetId && privateKey && clientEmail) {
            try {
                const auth = new google.auth.GoogleAuth({
                    credentials: {
                        client_email: clientEmail,
                        private_key: privateKey.replace(/\\n/g, '\n')
                    },
                    scopes: ['https://www.googleapis.com/auth/spreadsheets']
                });

                const sheets = google.sheets({ version: 'v4', auth });

                // Format the booking time nicely
                const options = {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                };
                const bookedTimeFormatted = startTime.toLocaleString('en-US', options);

                // Prepare row - check if this is updating an existing lead or new
                const row = [
                    new Date().toISOString(),           // Timestamp
                    name.split(' ')[0] || name,         // First Name
                    name.split(' ').slice(1).join(' ') || '', // Last Name
                    email,                               // Email
                    phone,                               // Phone
                    '',                                  // Primary Goal
                    '',                                  // Training Days
                    '',                                  // Experience
                    '',                                  // Challenge
                    'booking-page',                      // Source
                    'High',                              // Intent (booking = high intent)
                    'Booked',                            // Booking Status
                    bookedTimeFormatted,                 // Booked Time
                    meetLink ? `Meet: ${meetLink}` : ''  // Notes
                ];

                await sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: 'Sheet1!A:N',
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    requestBody: {
                        values: [row]
                    }
                });

                console.log(`Booking logged to CRM: ${email}`);
            } catch (sheetsError) {
                console.error('Sheets logging error:', sheetsError.message);
            }
        }

        // Return success
        res.status(200).json({
            success: true,
            message: 'Booking confirmed',
            eventId: calendarEventId,
            meetLink: meetLink,
            bookingDetails: {
                name,
                email,
                date: startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
                time: startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
            }
        });

    } catch (error) {
        console.error('Booking error:', error);

        res.status(500).json({
            success: false,
            error: 'An error occurred while booking. Please try again.'
        });
    }
};
