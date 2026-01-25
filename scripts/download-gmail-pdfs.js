#!/usr/bin/env node

/**
 * Gmail PDF Downloader Script
 * 
 * Downloads PDF attachments from emails sent by @kobioron.co.il
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project (or select existing)
 * 3. Enable the Gmail API:
 *    - Go to "APIs & Services" > "Library"
 *    - Search for "Gmail API" and enable it
 * 4. Create OAuth 2.0 credentials:
 *    - Go to "APIs & Services" > "Credentials"
 *    - Click "Create Credentials" > "OAuth client ID"
 *    - Choose "Desktop app" as application type
 *    - Download the JSON file
 *    - Save it as "credentials.json" in this project root
 * 5. Run this script: node scripts/download-gmail-pdfs.js
 *    - First run will open a browser for authentication
 *    - Token will be saved for future runs
 * 
 * Usage:
 *   node scripts/download-gmail-pdfs.js           # Download new PDFs
 *   node scripts/download-gmail-pdfs.js --list    # List emails without downloading
 *   node scripts/download-gmail-pdfs.js --all     # Download all (including already downloaded)
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

// Configuration
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'gmail-token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const PDF_DIR = path.join(process.cwd(), 'data', 'pdfs');

// Search query for emails from kobioron.co.il with attachments
const SEARCH_QUERY = 'from:kobioron.co.il has:attachment filename:pdf';

/**
 * Load saved credentials if they exist
 */
function loadSavedCredentials() {
  try {
    const content = fs.readFileSync(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Save credentials to file for future use
 */
function saveCredentials(client, credentials) {
  const key = credentials.installed || credentials.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  fs.writeFileSync(TOKEN_PATH, payload);
  console.log('Token saved to', TOKEN_PATH);
}

/**
 * Start a local server to handle OAuth callback
 */
function startLocalServer(authUrl, oAuth2Client) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url, true);
        if (parsedUrl.pathname === '/oauth2callback') {
          const code = parsedUrl.query.code;
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1>✓ Authentication Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          
          server.close();
          
          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);
          resolve(oAuth2Client);
        }
      } catch (e) {
        reject(e);
      }
    });
    
    server.listen(3333, () => {
      console.log('\n=================================================');
      console.log('AUTHORIZATION REQUIRED');
      console.log('=================================================');
      console.log('\nPlease open this URL in your browser:\n');
      console.log(authUrl);
      console.log('\n=================================================\n');
      
      // Try to open the browser automatically on Windows
      const { exec } = require('child_process');
      exec(`start "" "${authUrl}"`, (err) => {
        if (err) {
          console.log('(Could not open browser automatically. Please open the URL manually.)');
        }
      });
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout'));
    }, 300000);
  });
}

/**
 * Authorize with Google OAuth
 */
async function authorize() {
  // Check for existing token
  let client = loadSavedCredentials();
  if (client) {
    console.log('Using saved credentials');
    return client;
  }
  
  // Check for credentials file
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error('\n❌ Error: credentials.json not found!\n');
    console.log('Please follow these steps to set up Google OAuth:\n');
    console.log('1. Go to https://console.cloud.google.com/');
    console.log('2. Create a new project (or select existing)');
    console.log('3. Enable the Gmail API:');
    console.log('   - Go to "APIs & Services" > "Library"');
    console.log('   - Search for "Gmail API" and enable it');
    console.log('4. Configure OAuth consent screen:');
    console.log('   - Go to "APIs & Services" > "OAuth consent screen"');
    console.log('   - Choose "External" user type');
    console.log('   - Fill in app name and your email');
    console.log('   - Add scope: https://www.googleapis.com/auth/gmail.readonly');
    console.log('   - Add your email as a test user');
    console.log('5. Create OAuth 2.0 credentials:');
    console.log('   - Go to "APIs & Services" > "Credentials"');
    console.log('   - Click "Create Credentials" > "OAuth client ID"');
    console.log('   - Choose "Desktop app" as application type');
    console.log('   - Download the JSON file');
    console.log('   - Save it as "credentials.json" in this project root\n');
    process.exit(1);
  }
  
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    'http://localhost:3333/oauth2callback'
  );
  
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  
  // Start local server and wait for callback
  const authorizedClient = await startLocalServer(authUrl, oAuth2Client);
  
  // Save credentials for future use
  saveCredentials(authorizedClient, credentials);
  
  return authorizedClient;
}

/**
 * Get attachment data from a message
 */
async function getAttachment(gmail, messageId, attachmentId) {
  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId: messageId,
    id: attachmentId,
  });
  return response.data.data;
}

/**
 * Extract date from email headers
 */
function extractDateFromHeaders(headers) {
  const dateHeader = headers.find(h => h.name.toLowerCase() === 'date');
  if (dateHeader) {
    const date = new Date(dateHeader.value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    }
  }
  return null;
}

/**
 * Extract sender from email headers
 */
function extractSenderFromHeaders(headers) {
  const fromHeader = headers.find(h => h.name.toLowerCase() === 'from');
  if (fromHeader) {
    return fromHeader.value;
  }
  return null;
}

/**
 * Find PDF attachments in message parts recursively
 */
function findPdfAttachments(parts, attachments = []) {
  if (!parts) return attachments;
  
  for (const part of parts) {
    if (part.filename && part.filename.toLowerCase().endsWith('.pdf') && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        attachmentId: part.body.attachmentId,
        size: part.body.size,
      });
    }
    
    if (part.parts) {
      findPdfAttachments(part.parts, attachments);
    }
  }
  
  return attachments;
}

/**
 * Generate filename in the project format
 */
function generateFilename(emailDate, originalFilename) {
  // Check if the original filename already has the date prefix
  if (/^\d{4}-\d{2}-\d{2}/.test(originalFilename)) {
    return originalFilename;
  }
  
  // Use email date and assume it's for the main project
  return `${emailDate} - מוסינזון 5 תל אביב.pdf`;
}

/**
 * List all PDF emails from kobioron.co.il
 */
async function listEmails(gmail) {
  const emails = [];
  let pageToken = null;
  
  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: SEARCH_QUERY,
      pageToken: pageToken,
      maxResults: 100,
    });
    
    if (response.data.messages) {
      for (const message of response.data.messages) {
        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });
        
        const headers = fullMessage.data.payload.headers;
        const date = extractDateFromHeaders(headers);
        const sender = extractSenderFromHeaders(headers);
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No subject';
        const attachments = findPdfAttachments([fullMessage.data.payload]);
        
        if (attachments.length > 0) {
          emails.push({
            id: message.id,
            date,
            sender,
            subject,
            attachments,
          });
        }
      }
    }
    
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  
  // Sort by date
  emails.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  
  return emails;
}

/**
 * Download PDFs from emails
 */
async function downloadPdfs(gmail, emails, options = {}) {
  const { downloadAll = false } = options;
  
  // Ensure PDF directory exists
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }
  
  // Get existing PDFs
  const existingFiles = new Set(
    fs.readdirSync(PDF_DIR)
      .filter(f => f.endsWith('.pdf'))
      .map(f => f.toLowerCase())
  );
  
  let downloaded = 0;
  let skipped = 0;
  const downloadedFiles = [];
  
  for (const email of emails) {
    for (const attachment of email.attachments) {
      const filename = generateFilename(email.date, attachment.filename);
      const filePath = path.join(PDF_DIR, filename);
      
      // Check if file already exists
      if (!downloadAll && existingFiles.has(filename.toLowerCase())) {
        console.log(`⏭️  Skipping (exists): ${filename}`);
        skipped++;
        continue;
      }
      
      // Check if a file with similar date exists
      if (!downloadAll && email.date) {
        const datePrefix = email.date;
        const existsWithDate = [...existingFiles].some(f => f.startsWith(datePrefix.toLowerCase()));
        if (existsWithDate) {
          console.log(`⏭️  Skipping (date exists): ${filename}`);
          skipped++;
          continue;
        }
      }
      
      try {
        console.log(`📥 Downloading: ${filename}`);
        
        const attachmentData = await getAttachment(gmail, email.id, attachment.attachmentId);
        const buffer = Buffer.from(attachmentData, 'base64url');
        
        fs.writeFileSync(filePath, buffer);
        downloaded++;
        downloadedFiles.push(filename);
        
        console.log(`   ✓ Saved to: ${filePath}`);
      } catch (error) {
        console.error(`   ❌ Error downloading ${filename}:`, error.message);
      }
    }
  }
  
  return { downloaded, skipped, downloadedFiles };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const downloadAll = args.includes('--all');
  
  console.log('\n📧 Gmail PDF Downloader for Construction Reports\n');
  console.log('Searching for: emails from @kobioron.co.il with PDF attachments\n');
  
  // Authorize
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });
  
  // List emails
  console.log('Fetching emails...\n');
  const emails = await listEmails(gmail);
  
  if (emails.length === 0) {
    console.log('No emails found matching the search criteria.');
    return;
  }
  
  console.log(`Found ${emails.length} email(s) with PDF attachments:\n`);
  
  for (const email of emails) {
    console.log(`📅 ${email.date || 'Unknown date'}`);
    console.log(`   From: ${email.sender}`);
    console.log(`   Subject: ${email.subject}`);
    console.log(`   Attachments: ${email.attachments.map(a => a.filename).join(', ')}`);
    console.log('');
  }
  
  if (listOnly) {
    console.log('(List only mode - no files downloaded)');
    return;
  }
  
  // Download PDFs
  console.log('\n--- Downloading PDFs ---\n');
  const result = await downloadPdfs(gmail, emails, { downloadAll });
  
  console.log('\n--- Summary ---\n');
  console.log(`Downloaded: ${result.downloaded}`);
  console.log(`Skipped (already exists): ${result.skipped}`);
  
  if (result.downloadedFiles.length > 0) {
    console.log('\nNewly downloaded files:');
    result.downloadedFiles.forEach(f => console.log(`  - ${f}`));
    console.log('\nNext steps:');
    console.log('  1. Review the downloaded PDFs in data/pdfs/');
    console.log('  2. Run: npm run process-pdfs');
    console.log('     This will process the new PDFs and add them to the database.');
  }
}

main().catch(console.error);
