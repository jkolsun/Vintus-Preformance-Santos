# Vintus Performance - Lead Capture Setup Guide

This guide explains how to configure the lead capture system including Google Sheets integration and Google Calendar booking.

## Quick Start

1. Deploy to Vercel
2. Configure Google Sheets API
3. Set up Google Calendar embed
4. Connect to your follow-up system

---

## 1. Google Sheets Setup (Lead Storage)

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (e.g., "Vintus Performance Leads")
3. Select the project

### Step 2: Enable Google Sheets API

1. Go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click "Enable"

### Step 3: Create Service Account

1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Name: `vintus-sheets-writer`
4. Click "Create and Continue"
5. Grant role: "Editor" (or create custom role with Sheets edit permission)
6. Click "Done"

### Step 4: Create Service Account Key

1. Click on your new service account
2. Go to "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format
5. Download the key file (keep it secure!)

### Step 5: Create Google Spreadsheet

1. Create a new Google Sheet
2. Name the first sheet "Leads"
3. Add headers in row 1:
   - A: Timestamp
   - B: First Name
   - C: Last Name
   - D: Email
   - E: Phone
   - F: Primary Goal
   - G: Training Days
   - H: Experience
   - I: Challenge
   - J: Source
   - K: Status

4. Share the spreadsheet with your service account email (found in the JSON key file as `client_email`)
5. Give it "Editor" access

### Step 6: Get Spreadsheet ID

The spreadsheet ID is in the URL:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
```

### Step 7: Configure Vercel Environment Variables

In your Vercel project settings, add these environment variables:

```
GOOGLE_SHEETS_PRIVATE_KEY = [paste the private_key from your JSON file, including the -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----]
GOOGLE_SHEETS_CLIENT_EMAIL = [paste the client_email from your JSON file]
GOOGLE_SHEETS_SPREADSHEET_ID = [your spreadsheet ID]
```

---

## 2. Google Calendar Embed Setup

### Option A: Public Calendar Embed (Simple)

1. Go to [Google Calendar](https://calendar.google.com)
2. Create a calendar for appointments (or use existing)
3. Click the gear icon > Settings
4. Select your calendar from the left sidebar
5. Scroll to "Integrate calendar"
6. Copy the "Embed code" iframe

### Option B: Google Calendar Appointment Scheduling (Recommended)

1. Go to [Google Calendar](https://calendar.google.com)
2. Click "Create" > "Appointment schedule"
3. Set up your availability:
   - Duration: 30 minutes (or your preferred length)
   - Availability: Set your available times
   - Booking form: Add questions if needed
4. After creating, click on the appointment schedule
5. Click "Open booking page" to get the URL
6. You can embed this URL in an iframe

### Embedding the Calendar

Update the `quiz.js` file or directly in `start.html` to embed your calendar:

```javascript
// In quiz.js, update the calendar embed section:
const calendarEmbed = document.getElementById('calendarEmbed');
calendarEmbed.innerHTML = `
    <iframe
        src="YOUR_GOOGLE_CALENDAR_APPOINTMENT_URL"
        style="border: 0"
        width="100%"
        height="600"
        frameborder="0"
    ></iframe>
`;
```

Or for the embed code:

```html
<iframe
    src="https://calendar.google.com/calendar/appointments/schedules/YOUR_SCHEDULE_ID?gv=true"
    style="border: 0"
    width="100%"
    height="600"
></iframe>
```

---

## 3. Follow-Up System Integration

The API endpoint `/api/submit-lead` stores data in Google Sheets. Your follow-up UI can then:

### Twilio SMS Integration

Your separate follow-up UI should monitor the Google Sheet and trigger SMS via Twilio when new leads are added. Typical flow:

1. Lead submits quiz → Data goes to Google Sheets
2. Your follow-up system polls/webhooks the sheet
3. Based on lead status, send SMS via Twilio API

### SendGrid Email Integration

Similarly, your follow-up UI can trigger emails:

1. Welcome email immediately after quiz submission
2. Follow-up sequences based on lead status
3. Reminder emails for booked consultations

### Webhook Alternative

To get real-time notifications, you can add a webhook to the serverless function. Update `api/submit-lead.js`:

```javascript
// After saving to Google Sheets, trigger webhook
if (process.env.WEBHOOK_URL) {
    await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            event: 'new_lead',
            data: data
        })
    });
}
```

---

## 4. Testing the Integration

### Local Testing

1. Run `npm install` to install dependencies
2. Run `vercel dev` to start local development server
3. Navigate to `http://localhost:3000/start.html`
4. Complete the quiz
5. Check console for logged lead data (without Google credentials, it logs locally)

### Production Testing

1. Deploy to Vercel: `vercel --prod`
2. Set environment variables in Vercel dashboard
3. Test the quiz flow
4. Verify data appears in Google Sheet

---

## 5. Customizing Quiz Questions

The quiz questions are defined in `start.html`. To customize:

1. Edit the question text in each `.quiz-slide`
2. Update the options with new `data-value` attributes
3. Update the `generateAISummary()` function in `quiz.js` to reflect new mappings

---

## Files Overview

```
vintus-performance/
├── start.html          # Quiz landing page
├── css/
│   └── quiz.css        # Quiz-specific styles
├── js/
│   └── quiz.js         # Quiz functionality
├── api/
│   └── submit-lead.js  # Vercel serverless function
├── package.json        # Node dependencies
├── vercel.json         # Vercel configuration
└── SETUP.md            # This file
```

---

## Support

For issues with:
- **Google Sheets API**: Check Google Cloud Console logs
- **Vercel Functions**: Check Vercel dashboard > Functions logs
- **Quiz UI**: Check browser console for JavaScript errors
