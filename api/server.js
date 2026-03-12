const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Target email (hidden from frontend)
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'david@beyondsecure.se';
const AGENTMAIL_API_KEY = process.env.AGENTMAIL_API_KEY;
const AGENTMAIL_INBOX = process.env.AGENTMAIL_INBOX || 'contact@beyondsecure.se';

// Rate limiting - simple in-memory (reset on restart)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 3; // 3 requests per window per IP

app.use(cors());
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Rate limiting middleware
function checkRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const record = rateLimit.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_LIMIT_WINDOW;
  }
  
  record.count++;
  rateLimit.set(ip, record);
  
  if (record.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ 
      error: 'Too many requests. Please wait before trying again.' 
    });
  }
  
  next();
}

// Honeypot check - if these fields are filled, it's a bot
function checkHoneypot(req, res, next) {
  const { website, url, honeypot } = req.body;
  if (website || url || honeypot) {
    // Silently reject bots
    return res.status(200).json({ success: true, message: 'Thank you for your message!' });
  }
  next();
}

// Cloudflare Turnstile verification
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET_KEY) {
    console.warn('TURNSTILE_SECRET_KEY not set - skipping Turnstile verification');
    return true; // Skip if not configured
  }
  
  if (!token) {
    return false;
  }
  
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(TURNSTILE_SECRET_KEY)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(ip || '')}`
    });
    
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

app.post('/contact', checkRateLimit, checkHoneypot, async (req, res) => {
  const { name, email, company, subject, message } = req.body;
  const turnstileToken = req.body['cf-turnstile-response'];
  const ip = req.ip || req.connection.remoteAddress || '';
  
  // Verify Turnstile
  const turnstileValid = await verifyTurnstile(turnstileToken, ip);
  if (!turnstileValid) {
    return res.status(400).json({ 
      error: 'Security verification failed. Please try again.' 
    });
  }
  
  // Validation
  if (!name || !email || !message) {
    return res.status(400).json({ 
      error: 'Please fill in all required fields.' 
    });
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      error: 'Please provide a valid email address.' 
    });
  }
  
  // Message length check
  if (message.length < 10) {
    return res.status(400).json({ 
      error: 'Message is too short. Please provide more details.' 
    });
  }
  
  if (message.length > 5000) {
    return res.status(400).json({ 
      error: 'Message is too long. Please keep it under 5000 characters.' 
    });
  }

  try {
    // Send via AgentMail API
    if (AGENTMAIL_API_KEY) {
      const response = await fetch('https://api.agentmail.to/v1/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AGENTMAIL_API_KEY}`
        },
        body: JSON.stringify({
          from: AGENTMAIL_INBOX,
          to: CONTACT_EMAIL,
          subject: `[BeyondSecure Contact] ${subject || 'New inquiry'}`,
          text: `
New contact form submission from BeyondSecure.se

Name: ${name}
Email: ${email}
Company: ${company || 'Not specified'}
Subject: ${subject || 'Not specified'}

Message:
${message}

---
Reply to: ${email}
          `.trim(),
          reply_to: email
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        console.error('AgentMail error:', error);
        throw new Error('Failed to send message');
      }
    } else {
      // Fallback: just log (for dev)
      console.log('Contact form submission:', { name, email, company, subject, message });
    }
    
    res.json({ 
      success: true, 
      message: 'Thank you for your message! I\'ll get back to you soon.' 
    });
    
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ 
      error: 'Something went wrong. Please try again or email directly.' 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`BeyondSecure API running on port ${PORT}`);
});