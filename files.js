export const files = {
  'src/db/init.js': {
    file: {
      contents: `
import Database from 'better-sqlite3';

export function initializeDatabase() {
  const db = new Database('sms_app.db');

  // Create users table
  db.exec(\`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  \`);

  // Create campaigns table
  db.exec(\`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      keyword TEXT UNIQUE NOT NULL,
      response_message TEXT NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  \`);

  // Create message logs table
  db.exec(\`
    CREATE TABLE IF NOT EXISTS message_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      from_number TEXT NOT NULL,
      to_number TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    )
  \`);

  return db;
}
`
    }
  },
  'src/models/user.js': {
    file: {
      contents: `
import bcrypt from 'bcryptjs';

export class UserModel {
  constructor(db) {
    this.db = db;
  }

  createUser(username, password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = this.db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    return stmt.run(username, hashedPassword);
  }

  getUserByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  validatePassword(user, password) {
    return bcrypt.compareSync(password, user.password);
  }
}
`
    }
  },
  'src/models/campaign.js': {
    file: {
      contents: `
export class CampaignModel {
  constructor(db) {
    this.db = db;
  }

  createCampaign(name, keyword, responseMessage, userId) {
    const stmt = this.db.prepare(
      'INSERT INTO campaigns (name, keyword, response_message, created_by) VALUES (?, ?, ?, ?)'
    );
    return stmt.run(name, keyword, responseMessage, userId);
  }

  getCampaignByKeyword(keyword) {
    const stmt = this.db.prepare('SELECT * FROM campaigns WHERE keyword = ?');
    return stmt.get(keyword);
  }

  getCampaignsByUser(userId) {
    const stmt = this.db.prepare('SELECT * FROM campaigns WHERE created_by = ?');
    return stmt.all(userId);
  }

  logMessage(campaignId, fromNumber, toNumber, message, status) {
    const stmt = this.db.prepare(
      'INSERT INTO message_logs (campaign_id, from_number, to_number, message, status) VALUES (?, ?, ?, ?, ?)'
    );
    return stmt.run(campaignId, fromNumber, toNumber, message, status);
  }
}
`
    }
  },
  'src/routes/auth.js': {
    file: {
      contents: `
import express from 'express';
import { body, validationResult } from 'express-validator';

export function createAuthRouter(userModel) {
  const router = express.Router();

  router.post('/register', [
    body('username').trim().isLength({ min: 3 }),
    body('password').isLength({ min: 6 })
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, password } = req.body;

    try {
      userModel.createUser(username, password);
      res.json({ success: true });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: 'Username already exists' });
      } else {
        res.status(500).json({ error: 'Server error' });
      }
    }
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = userModel.getUserByUsername(username);

    if (user && userModel.validatePassword(user, password)) {
      req.session.authenticated = true;
      req.session.userId = user.id;
      req.session.username = username;
      res.json({ success: true });
    } else {
      res.status(401).send('Invalid username or password');
    }
  });

  router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
  });

  return router;
}
`
    }
  },
  'src/routes/campaigns.js': {
    file: {
      contents: `
import express from 'express';
import { body, validationResult } from 'express-validator';

export function createCampaignRouter(campaignModel) {
  const router = express.Router();

  router.post('/', [
    body('name').trim().isLength({ min: 3 }),
    body('keyword').trim().isLength({ min: 2 }),
    body('responseMessage').trim().isLength({ min: 5 })
  ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, keyword, responseMessage } = req.body;

    try {
      campaignModel.createCampaign(name, keyword, responseMessage, req.session.userId);
      res.json({ success: true });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(400).json({ error: 'Keyword already exists' });
      } else {
        res.status(500).json({ error: 'Server error' });
      }
    }
  });

  router.get('/', async (req, res) => {
    try {
      const campaigns = campaignModel.getCampaignsByUser(req.session.userId);
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}
`
    }
  },
  'index.js': {
    file: {
      contents: `
import express from 'express';
import session from 'express-session';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { initializeDatabase } from './src/db/init.js';
import { UserModel } from './src/models/user.js';
import { CampaignModel } from './src/models/campaign.js';
import { createAuthRouter } from './src/routes/auth.js';
import { createCampaignRouter } from './src/routes/campaigns.js';

dotenv.config();

const app = express();
const port = 3111;

// Initialize database and models
const db = initializeDatabase();
const userModel = new UserModel(db);
const campaignModel = new CampaignModel(db);

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Routes
app.use('/auth', createAuthRouter(userModel));
app.use('/api/campaigns', isAuthenticated, createCampaignRouter(campaignModel));

// Serve login page
app.get('/login', (req, res) => {
  if (req.session.authenticated) {
    res.redirect('/');
    return;
  }
  res.sendFile('public/login.html', { root: '.' });
});

// Serve main application
app.get('/', isAuthenticated, (req, res) => {
  res.sendFile('public/index.html', { root: '.' });
});

// Handle incoming SMS
app.post('/webhook/sms', async (req, res) => {
  const { Body: message, From: from } = req.body;
  const keyword = message.trim().toLowerCase();

  try {
    const campaign = campaignModel.getCampaignByKeyword(keyword);
    
    if (campaign) {
      await client.messages.create({
        body: campaign.response_message,
        to: from,
        from: process.env.TWILIO_PHONE_NUMBER
      });

      campaignModel.logMessage(
        campaign.id,
        from,
        process.env.TWILIO_PHONE_NUMBER,
        campaign.response_message,
        'sent'
      );
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing SMS:', error);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(\`App is live at http://localhost:\${port}\`);
});
`
    }
  },
  'public/login.html': {
    file: {
      contents: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - SMS Campaign Manager</title>
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
    <div class="container">
        <div class="auth-form">
            <h1>SMS Campaign Manager</h1>
            <div id="error" class="error"></div>
            
            <form id="loginForm" class="form">
                <div class="form-group">
                    <label for="username">Username:</label>
                    <input type="text" id="username" required>
                </div>
                <div class="form-group">
                    <label for="password">Password:</label>
                    <input type="password" id="password" required>
                </div>
                <button type="submit">Login</button>
            </form>
            
            <div class="auth-links">
                <a href="#" id="showRegister">Need an account? Register</a>
            </div>
            
            <form id="registerForm" class="form hidden">
                <h2>Register</h2>
                <div class="form-group">
                    <label for="regUsername">Username:</label>
                    <input type="text" id="regUsername" required>
                </div>
                <div class="form-group">
                    <label for="regPassword">Password:</label>
                    <input type="password" id="regPassword" required>
                </div>
                <button type="submit">Register</button>
                <div class="auth-links">
                    <a href="#" id="showLogin">Already have an account? Login</a>
                </div>
            </form>
        </div>
    </div>
    <script src="/js/auth.js"></script>
</body>
</html>
`
    }
  },
  'public/index.html': {
    file: {
      contents: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMS Campaign Manager</title>
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>SMS Campaign Manager</h1>
            <div class="user-info">
                <span id="username"></span>
                <button id="logoutBtn" class="btn-danger">Logout</button>
            </div>
        </header>

        <main>
            <section class="campaigns-section">
                <h2>Your Campaigns</h2>
                <button id="newCampaignBtn" class="btn-primary">New Campaign</button>
                <div id="campaignsList"></div>
            </section>

            <div id="newCampaignModal" class="modal hidden">
                <div class="modal-content">
                    <h2>Create New Campaign</h2>
                    <form id="newCampaignForm">
                        <div class="form-group">
                            <label for="campaignName">Campaign Name:</label>
                            <input type="text" id="campaignName" required>
                        </div>
                        <div class="form-group">
                            <label for="keyword">Keyword:</label>
                            <input type="text" id="keyword" required>
                        </div>
                        <div class="form-group">
                            <label for="responseMessage">Response Message:</label>
                            <textarea id="responseMessage" required></textarea>
                        </div>
                        <div class="modal-actions">
                            <button type="submit" class="btn-primary">Create</button>
                            <button type="button" class="btn-secondary" id="cancelCampaign">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    </div>
    <script src="/js/app.js"></script>
</body>
</html>
`
    }
  },
  'public/css/styles.css': {
    file: {
      contents: `
:root {
    --primary-color: #0066ff;
    --danger-color: #ff3333;
    --success-color: #28a745;
    --background-color: #f8f9fa;
    --border-color: #dee2e6;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    background-color: var(--background-color);
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.auth-form {
    max-width: 400px;
    margin: 2rem auto;
    padding: 2rem;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.form-group {
    margin-bottom: 1rem;
}

.form-group label {
    display: block;
    margin-bottom: 0.5rem;
}

.form-group input,
.form-group textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 4px;
}

.error {
    color: var(--danger-color);
    margin-bottom: 1rem;
}

button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
}

.btn-primary {
    background-color: var(--primary-color);
    color: white;
}

.btn-danger {
    background-color: var(--danger-color);
    color: white;
}

.btn-secondary {
    background-color: #6c757d;
    color: white;
}

.hidden {
    display: none;
}

header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
}

.user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.campaigns-section {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
}

.modal-content {
    background: white;
    padding: 2rem;
    border-radius: 8px;
    width: 100%;
    max-width: 500px;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 1rem;
}

.campaign-card {
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 1rem;
    margin-bottom: 1rem;
}

.campaign-card h3 {
    margin-bottom: 0.5rem;
}

.campaign-stats {
    display: flex;
    gap: 2rem;
    margin-top: 1rem;
    color: #666;
}
`
    }
  },
  'public/js/auth.js': {
    file: {
      contents: `
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const errorDiv = document.getElementById('error');

    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                window.location.href = '/';
            } else {
                const error = await response.text();
                errorDiv.textContent = error;
            }
        } catch (error) {
            errorDiv.textContent = 'Login failed';
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('regUsername').value;
        const password = document.getElementById('regPassword').value;

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                registerForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
                errorDiv.textContent = 'Registration successful! Please login.';
                errorDiv.style.color = 'green';
            } else {
                const data = await response.json();
                errorDiv.textContent = data.error || 'Registration failed';
            }
        } catch (error) {
            errorDiv.textContent = 'Registration failed';
        }
    });
});
`
    }
  },
  'public/js/app.js': {
    file: {
      contents: `
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    const newCampaignBtn = document.getElementById('newCampaignBtn');
    const newCampaignModal = document.getElementById('newCampaignModal');
    const newCampaignForm = document.getElementById('newCampaignForm');
    const cancelCampaignBtn = document.getElementById('cancelCampaign');
    const campaignsList = document.getElementById('campaignsList');

    // Load user info
    fetch('/auth/user')
        .then(response => response.json())
        .then(user => {
            document.getElementById('username').textContent = \`Welcome, \${user.username}!\`;
        });

    // Load campaigns
    function loadCampaigns() {
        fetch('/api/campaigns')
            .then(response => response.json())
            .then(campaigns => {
                campaignsList.innerHTML = campaigns.map(campaign => \`
                    <div class="campaign-card">
                        <h3>\${campaign.name}</h3>
                        <p>Keyword: <strong>\${campaign.keyword}</strong></p>
                        <p>Response: \${campaign.response_message}</p>
                        <div class="campaign-stats">
                            <span>Created: \${new Date(campaign.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                \`).join('');
            });
    }

    loadCampaigns();

    // Event Listeners
    logoutBtn.addEventListener('click', () => {
        window.location.href = '/auth/logout';
    });

    newCampaignBtn.addEventListener('click', () => {
        newCampaignModal.classList.remove('hidden');
    });

    cancelCampaignBtn.addEventListener('click', () => {
        newCampaignModal.classList.add('hidden');
        newCampaignForm.reset();
    });

    newCampaignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('campaignName').value,
            keyword: document.getElementById('keyword').value,
            responseMessage: document.getElementById('responseMessage').value
        };

        try {
            const response = await fetch('/api/campaigns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                newCampaignModal.classList.add('hidden');
                newCampaignForm.reset();
                loadCampaigns();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to create campaign');
            }
        } catch (error) {
            alert('Failed to create campaign');
        }
    });
});
`
    }
  },
  'package.json': {
    file: {
      contents: `{
  "name": "sms-campaign-manager",
  "type": "module",
  "dependencies": {
    "express": "latest",
    "express-session": "latest",
    "express-validator": "latest",
    "bcryptjs": "latest",
    "twilio": "latest",
    "dotenv": "latest",
    "better-sqlite3": "latest",
    "nodemon": "latest"
  },
  "scripts": {
    "start": "nodemon index.js"
  }
}`
    }
  },
  '.env': {
    file: {
      contents: `TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here
SESSION_SECRET=your_session_secret_here`
    }
  }
}