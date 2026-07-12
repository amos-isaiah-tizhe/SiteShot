# OneXp SiteShot — Node.js / Express / MongoDB

A full-stack website screenshot tool built with:

- **Backend**: Node.js + Express.js
- **Database**: MongoDB Atlas (via Mongoose)
- **Views**: EJS templates (plain HTML + CSS + JS output — no React, no build step)
- **Auth**: Session-based (bcrypt passwords, express-session)
- **IDE**: VSCode ready — no framework tooling required

---

## Project structure

```
onexp-siteshot/
├── config/
│   └── db.js               # MongoDB Atlas connection
├── middleware/
│   └── auth.js             # requireAuth / redirectIfAuth guards
├── models/
│   ├── User.js             # User schema (name, email, password, plan, apiKey)
│   └── Contact.js          # Contact form submissions
├── public/
│   ├── assets/             # logo.png, hero.jpg
│   ├── css/styles.css      # Full design system (no Tailwind, no PostCSS)
│   └── js/main.js          # FAQ accordion, mobile menu, screenshot capture
├── routes/
│   ├── auth.js             # GET/POST /login, /register, POST /logout
│   └── pages.js            # GET /, /api, /pricing, /faq, /contact + POST /contact
├── views/
│   ├── partials/
│   │   ├── header.ejs      # Shared <head>, sticky nav, mobile menu
│   │   └── footer.ejs      # Shared footer + <script> tag
│   ├── index.ejs           # Home — hero, capture form, features, CTA
│   ├── api.ejs             # API docs page
│   ├── pricing.ejs         # Pricing plans
│   ├── faq.ejs             # Accordion FAQ
│   ├── contact.ejs         # Contact form (saves to MongoDB)
│   ├── login.ejs           # Login form
│   ├── register.ejs        # Register form
│   ├── 404.ejs
│   └── 500.ejs
├── .env.example
├── .gitignore
├── package.json
└── server.js               # Express app entry point
```

---

## Quick start

### 1. Clone / open in VSCode

```bash
cd onexp-siteshot
code .
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/onexp-siteshot?retryWrites=true&w=majority
SESSION_SECRET=some-long-random-string
NODE_ENV=development
```

**Getting a MongoDB Atlas URI:**

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free cluster (M0)
3. Add a database user under **Database Access**
4. Whitelist your IP under **Network Access** (or `0.0.0.0/0` for dev)
5. Click **Connect → Connect your application** and copy the URI

### 4. Run the server

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

Open [https://siteshot.onexportalhq.com](https://siteshot.onexportalhq.com)

---

## Pages

| Route       | Description                      |
| ----------- | -------------------------------- |
| `/`         | Home — screenshot capture tool   |
| `/api`      | API docs                         |
| `/pricing`  | Pricing plans                    |
| `/faq`      | Accordion FAQ                    |
| `/contact`  | Contact form (stored in MongoDB) |
| `/register` | Create account                   |
| `/login`    | Log in                           |
| `/logout`   | POST — destroys session          |

---

## Screenshot capture

The capture tool uses [thum.io](https://image.thum.io) as a keyless preview service for the public-facing tool. In production you can swap `buildScreenshotUrl()` in `public/js/main.js` to point at your own backend screenshot API (e.g. using Puppeteer/Playwright).

---

## Extending

- **Add Puppeteer**: `npm install puppeteer` and add a `POST /api/v1/screenshot` route in `routes/pages.js`
- **Add Stripe billing**: Install `stripe` and create a `/billing` route
- **Add API keys**: Generate on register and expose in a `/dashboard` route
- **Add nodemailer**: Send confirmation emails from the contact form route

---

## VSCode recommended extensions

- **ESLint** — `dbaeumer.vscode-eslint`
- **Prettier** — `esbenp.prettier-vscode`
- **EJS Language Support** — `DigitalBrainstem.javascript-ejs-support`
- **MongoDB for VS Code** — `mongodb.mongodb-vscode`
- **Thunder Client** — `rangav.vscode-thunder-client` (API testing)
