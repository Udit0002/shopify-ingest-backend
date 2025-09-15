# Shopify Integration App 🛍️

This project provides a robust backend solution for integrating with Shopify, allowing you to manage tenants, stores, customers, orders, and products. It offers API endpoints for data insights and handles Shopify webhooks to keep your local database synchronized with your Shopify stores.

## 🚀 Key Features

- **Tenant and Store Management:** Register new tenants and associate Shopify stores with them.
- **Shopify Webhook Handling:**  Receive and validate Shopify webhooks for orders, customers, and products, ensuring data consistency.
- **Data Synchronization:**  Periodically synchronize product data from Shopify to your local database using a cron job.
- **Data Insights API:**  Retrieve summaries of key metrics like total customers, orders, and revenue for each tenant.
- **Order Data Retrieval:** Fetch orders grouped by date, filtered by store or tenant, within a specified date range.
- **Health Check Endpoint:**  A simple endpoint to monitor the application's status.
- **Concurrency Control:** Prevents concurrent execution of the data synchronization cron job using Postgres advisory locks.

## 🛠️ Tech Stack

- **Backend:**
    - Node.js
    - Express.js
- **Database:**
    - PostgreSQL
    - Prisma (ORM)
- **Shopify Integration:**
    - Shopify API
    - Webhooks
- **Cron Job Scheduling:**
    - `node-cron`
- **HTTP Client:**
    - `axios`
- **Environment Variables:**
    - `dotenv`
- **Supabase:**
    - `@supabase/supabase-js` (for server-side admin tasks)
- **Middleware:**
    - `morgan` (HTTP request logger)
    - `cors` (Cross-Origin Resource Sharing)
- **Other:**
    - `crypto` (for HMAC validation)

## 📦 Getting Started

### Prerequisites

- Node.js (>=16)
- npm or yarn
- PostgreSQL database
- Supabase account (if using Supabase features)
- Shopify Partner account and a development store

### Installation

1.  **Clone the repository:**

    ```bash
    git clone <repository_url>
    cd <project_directory>
    ```

2.  **Install dependencies:**

    ```bash
    npm install # or yarn install
    ```

3.  **Set up environment variables:**

    - Create a `.env` file in the root directory.
    - Add the following environment variables, replacing the placeholders with your actual values:

    ```
    DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<database>?schema=public"
    SHOPIFY_WEBHOOK_SECRET=<your_shopify_webhook_secret>
    SUPABASE_URL=<your_supabase_url>
    SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_role_key>
    PORT=3000 # Optional, defaults to 3000
    ```

4.  **Set up Prisma:**

    ```bash
    npx prisma migrate dev --name init
    npx prisma generate
    ```

    This will create the database tables based on the schema defined in `prisma/schema.prisma`.

### Running Locally

1.  **Start the server:**

    ```bash
    npm run dev # or yarn dev
    ```

    This will start the Express.js server, and you can access the API endpoints at `http://localhost:3000` (or the port you specified in your `.env` file).

## 💻 Usage

Once the server is running, you can access the following API endpoints:

-   **Health Check:** `GET /health` - Returns `{ status: "ok" }`
-   **Tenant Registration:** `POST /tenants/register` - Registers a new tenant and store.  Requires `tenantName`, `shopDomain`, and `accessToken` in the request body.
-   **Data Insights Summary:** `GET /insights/summary/:tenantId` - Returns a summary of total customers, orders, and revenue for a given tenant.
-   **Orders by Date:** `GET /insights/orders-by-date/:id?from=<date>&to=<date>` - Returns orders grouped by date, filtered by store or tenant ID and date range.
-   **Shopify Webhooks:** `POST /shopify/webhooks` - Handles Shopify webhooks.  Requires the `X-Shopify-Hmac-Sha256` header for validation.

## 📂 Project Structure

```
├── src/
│   ├── cron/
│   │   └── sync.js          # Cron job for syncing data from Shopify
│   ├── lib/
│   │   ├── prisma.js        # Prisma client initialization
│   │   └── supabase.js      # Supabase client initialization (server-side)
│   ├── routes/
│   │   ├── health.js        # Health check route
│   │   ├── insights.js      # Data insights routes
│   │   ├── shopify.js       # Shopify webhook routes
│   │   └── tenants.js       # Tenant management routes
│   ├── index.js             # Main entry point of the application
├── prisma/
│   └── schema.prisma      # Prisma schema definition
├── .env                   # Environment variables
├── package.json           # Project dependencies and scripts
└── README.md              # This file
```


## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and commit them with descriptive messages.
4.  Push your changes to your fork.
5.  Submit a pull request.

