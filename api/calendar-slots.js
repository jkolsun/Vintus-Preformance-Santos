/**
 * Vercel Serverless Function: Get Calendar Availability
 * Returns booked time slots from Google Calendar
 */

const { google } = require('googleapis');

// Configuration
const CONFIG = {
    availableHours: [9, 10, 11, 13, 14, 15, 16, 17, 18],
    availableDays: [1, 2, 3, 4, 5], // Monday - Friday
    maxAdvanceDays: 30,
    timezone: 'America/New_York'
};

// Generate simulated busy schedule for demo/fallback
function generateSimulatedBookings() {
    const bookings = {};
    const today = new Date();

    for (let i = 0; i < CONFIG.maxAdvanceDays; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        if (!CONFIG.availableDays.includes(date.getDay())) continue;

        const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        bookings[dateKey] = [];

        // Book 40-60% of slots to look busy
        const bookingRate = 0.4 + Math.random() * 0.2;

        CONFIG.availableHours.forEach(hour => {
            const isMorning = hour >= 9 && hour <= 11;
            const adjustedRate = isMorning ? bookingRate + 0.15 : bookingRate;

            [0, 30].forEach(minute => {
                if (Math.random() < adjustedRate) {
                    bookings[dateKey].push(`${hour}:${minute.toString().padStart(2, '0')}`);
                }
            });
        });

        // Ensure 2-4 slots available per day
        const totalSlots = CONFIG.availableHours.length * 2;
        const minAvailable = 2 + Math.floor(Math.random() * 3);
        const maxBooked = totalSlots - minAvailable;
        if (bookings[dateKey].length > maxBooked) {
            bookings[dateKey] = bookings[dateKey].slice(0, maxBooked);
        }
    }

    return bookings;
}

module.exports = async (req, res) => {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const calendarId = process.env.GOOGLE_CALENDAR_ID;
        const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
        const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;

        // If no calendar credentials, return simulated data
        if (!calendarId || !privateKey || !clientEmail) {
            console.log('Calendar not configured, using simulated data');
            return res.status(200).json({
                bookedSlots: generateSimulatedBookings(),
                source: 'simulated'
            });
        }

        // Initialize Google Calendar API
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: clientEmail,
                private_key: privateKey.replace(/\\n/g, '\n')
            },
            scopes: ['https://www.googleapis.com/auth/calendar.readonly']
        });

        const calendar = google.calendar({ version: 'v3', auth });

        // Get events for the next 30 days
        const now = new Date();
        const endDate = new Date();
        endDate.setDate(now.getDate() + CONFIG.maxAdvanceDays);

        const response = await calendar.events.list({
            calendarId,
            timeMin: now.toISOString(),
            timeMax: endDate.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        const events = response.data.items || [];
        const bookedSlots = {};

        // Process events into booked slots
        events.forEach(event => {
            if (!event.start || !event.start.dateTime) return;

            const start = new Date(event.start.dateTime);
            const dateKey = `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, '0')}-${start.getDate().toString().padStart(2, '0')}`;
            const timeKey = `${start.getHours()}:${start.getMinutes().toString().padStart(2, '0')}`;

            if (!bookedSlots[dateKey]) {
                bookedSlots[dateKey] = [];
            }
            bookedSlots[dateKey].push(timeKey);
        });

        // Add some strategic "busy" slots for social proof
        // This makes the calendar look realistically busy
        const enhancedSlots = { ...bookedSlots };
        for (let i = 0; i < CONFIG.maxAdvanceDays; i++) {
            const date = new Date(now);
            date.setDate(now.getDate() + i);

            if (!CONFIG.availableDays.includes(date.getDay())) continue;

            const dateKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;

            if (!enhancedSlots[dateKey]) {
                enhancedSlots[dateKey] = [];
            }

            // Add 2-4 strategic "buffer" blocks per day
            const bufferCount = 2 + Math.floor(Math.random() * 3);
            const availableForBuffer = CONFIG.availableHours.filter(h =>
                !enhancedSlots[dateKey].some(t => t.startsWith(`${h}:`))
            );

            for (let b = 0; b < bufferCount && availableForBuffer.length > 0; b++) {
                const randomIndex = Math.floor(Math.random() * availableForBuffer.length);
                const hour = availableForBuffer.splice(randomIndex, 1)[0];
                const minute = Math.random() < 0.5 ? 0 : 30;
                enhancedSlots[dateKey].push(`${hour}:${minute.toString().padStart(2, '0')}`);
            }
        }

        res.status(200).json({
            bookedSlots: enhancedSlots,
            source: 'calendar'
        });

    } catch (error) {
        console.error('Calendar API error:', error);
        // Fallback to simulated data on error
        res.status(200).json({
            bookedSlots: generateSimulatedBookings(),
            source: 'simulated',
            error: error.message
        });
    }
};
