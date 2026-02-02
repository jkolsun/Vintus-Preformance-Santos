/**
 * Vercel Serverless Function: Book Appointment
 * Creates a calendar event with Google Meet, logs to CRM, and sends confirmation email
 */

const { google } = require('googleapis');

// Send booking confirmation email via Resend
async function sendConfirmationEmail({ name, email, date, time, meetLink }) {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        console.log('Resend API key not configured, skipping email');
        return null;
    }

    const firstName = name.split(' ')[0];

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
            <!-- Header -->
            <div style="padding: 40px 40px 20px; text-align: center;">
                <h1 style="color: #f5c518; margin: 0; font-size: 28px; font-weight: 700;">VINTUS PERFORMANCE</h1>
                <p style="color: #ffffff; margin: 10px 0 0; font-size: 14px; letter-spacing: 2px;">ELITE COACHING</p>
            </div>

            <!-- Content -->
            <div style="padding: 20px 40px 40px;">
                <div style="background: rgba(245, 197, 24, 0.1); border-left: 4px solid #f5c518; padding: 20px; border-radius: 0 8px 8px 0; margin-bottom: 30px;">
                    <h2 style="color: #f5c518; margin: 0 0 5px; font-size: 20px;">You're Booked!</h2>
                    <p style="color: #cccccc; margin: 0; font-size: 14px;">Your strategy call is confirmed</p>
                </div>

                <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                    Hey ${firstName},<br><br>
                    Your free strategy call has been scheduled. I'm looking forward to learning about your fitness goals and showing you how we can get you there.
                </p>

                <!-- Meeting Details Box -->
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                    <h3 style="color: #f5c518; margin: 0 0 20px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Meeting Details</h3>

                    <div style="margin-bottom: 15px;">
                        <p style="color: #888888; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Date</p>
                        <p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">${date}</p>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <p style="color: #888888; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Time</p>
                        <p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">${time} (Eastern Time)</p>
                    </div>

                    ${meetLink ? `
                    <div>
                        <p style="color: #888888; margin: 0 0 10px; font-size: 12px; text-transform: uppercase;">Video Call Link</p>
                        <a href="${meetLink}" style="display: inline-block; background: #f5c518; color: #1a1a2e; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">Join Google Meet</a>
                    </div>
                    ` : ''}
                </div>

                <p style="color: #cccccc; font-size: 14px; line-height: 1.6; margin: 0 0 25px;">
                    <strong style="color: #ffffff;">What to expect:</strong><br>
                    We'll discuss your current fitness level, goals, and create a roadmap to get you results. This is a no-pressure conversation - just real talk about what's possible for you.
                </p>

                <p style="color: #cccccc; font-size: 14px; line-height: 1.6; margin: 0;">
                    See you soon,<br>
                    <strong style="color: #f5c518;">Coach Santi</strong><br>
                    Vintus Performance
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 30px 20px;">
            <p style="color: #888888; font-size: 12px; margin: 0;">
                Vintus Performance | Elite Personal Training
            </p>
        </div>
    </div>
</body>
</html>
    `;

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Vintus Performance <bookings@vintusperformance.org>',
                to: email,
                subject: `Your Strategy Call is Confirmed - ${date}`,
                html: htmlContent
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`Confirmation email sent: ${data.id}`);
            return data.id;
        } else {
            const error = await response.text();
            console.error('Resend error:', error);
            return null;
        }
    } catch (error) {
        console.error('Email sending error:', error.message);
        return null;
    }
}

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

                // Create calendar event
                // Note: Service accounts can't create Meet links for personal Gmail accounts
                // Santi can add a Meet link manually from the calendar
                const event = {
                    summary: `Strategy Call - ${name}`,
                    description: `Free Strategy Call with ${name}\n\nClient Email: ${email}\nClient Phone: ${phone}\n\nBooked via Vintus Performance website.\n\nTo add video call: Open this event in Google Calendar and click "Add Google Meet video conferencing"`,
                    start: {
                        dateTime: startTime.toISOString(),
                        timeZone: 'America/New_York'
                    },
                    end: {
                        dateTime: endTime.toISOString(),
                        timeZone: 'America/New_York'
                    },
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'email', minutes: 24 * 60 }, // 1 day before
                            { method: 'popup', minutes: 60 },      // 1 hour before
                            { method: 'popup', minutes: 30 }       // 30 min before
                        ]
                    }
                };

                const response = await calendar.events.insert({
                    calendarId,
                    resource: event
                });

                calendarEventId = response.data.id;

                console.log(`Calendar event created: ${calendarEventId}`);
            } catch (calendarError) {
                console.error('Calendar creation error:', calendarError.message);
                // Continue - we'll still log to sheets
            }
        }

        // Send confirmation email to client
        const formattedDate = startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const formattedTime = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

        await sendConfirmationEmail({
            name,
            email,
            date: formattedDate,
            time: formattedTime,
            meetLink
        });

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
