# Gas Distribution API

A professional Node.js TypeScript backend service for distributing gas tokens on the FAIR Testnet EVM blockchain.

## Features

- 🔐 **Secure API Key Authentication**: Protected endpoints with API key validation
- ⛽ **Gas Distribution**: Automated distribution of 0.1 FAIR tokens per request
- 🛡️ **Rate Limiting**: Configurable request limits per minute and per day
- 📊 **Comprehensive Logging**: Winston-based logging with different log levels
- 🔄 **Graceful Shutdown**: Proper handling of termination signals
- ⚡ **TypeScript**: Fully typed for better developer experience
- 🏗️ **Clean Architecture**: Separation of concerns with controllers, services, and middleware

## Architecture

```
src/
├── config/          # Configuration management
├── controllers/     # Request handlers
├── middleware/      # Express middleware (auth, validation, error handling)
├── services/        # Business logic (blockchain interactions)
├── routes/          # API route definitions
├── types/           # TypeScript type definitions
├── utils/           # Utility functions (logger, errors)
├── app.ts          # Express application setup
└── index.ts        # Server entry point
```

## Prerequisites

- Node.js 18+ 
- npm or yarn
- A funded wallet on FAIR Testnet with native tokens
- FAIR Testnet RPC access (https://testnet-rpc.fair.cloud/)

## Installation

1. Clone the repository:
```bash
cd APIDistribution
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file from example:
```bash
cp .env.example .env
```

4. Configure your `.env` file:
```env
# Generate a secure API key
API_KEY=your-secure-api-key-at-least-32-characters

# Add your funded wallet private key
PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE

# Other configurations...
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3000 |
| `API_KEY` | API key for authentication (min 32 chars) | Required |
| `PRIVATE_KEY` | Wallet private key with 0x prefix | Required |
| `RPC_URL` | FAIR Testnet RPC endpoint | https://testnet-rpc.fair.cloud/ |
| `CHAIN_ID` | FAIR Testnet chain ID | 935 |
| `GAS_AMOUNT` | Amount to distribute per request | 0.1 |
| `MAX_REQUESTS_PER_MINUTE` | Rate limit per minute | 10 |
| `MAX_REQUESTS_PER_DAY` | Rate limit per day | 100 |
| `LOG_LEVEL` | Logging level (error/warn/info/debug) | info |

## Usage

### Development

Run with hot-reload:
```bash
npm run dev
```

### Production

Build and run:
```bash
npm run build
npm start
```

## API Endpoints

### Main Endpoint

#### `POST /api/fair/gas`
Distribute gas to a specified address.

**Headers:**
```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "amount": "0.1"  // Optional, defaults to configured GAS_AMOUNT
}
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "amount": "0.1",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "message": "Gas distribution successful"
}
```

### Additional Endpoints

- **Health Check**: `GET /api/health`
- **Wallet Info**: `GET /api/wallet/info` (requires API key)
- **Check Balance**: `GET /api/balance/:address` (requires API key)
- **Estimate Gas**: `POST /api/estimate` (requires API key)
- **Transaction Status**: `GET /api/transaction/:txHash` (requires API key)

## API Authentication

The API uses Bearer token authentication. Include your API key in the request headers:

```bash
# Using curl
curl -X POST http://localhost:3000/api/fair/gas \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"address":"0x..."}'

# Using axios
const response = await axios.post('http://localhost:3000/api/fair/gas', 
  { address: '0x...' },
  { headers: { 'Authorization': 'Bearer YOUR_API_KEY' }}
);
```

## Error Handling

The API returns structured error responses:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "statusCode": 400
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Common error codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid API key)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Security Best Practices

1. **API Key**: Generate a strong API key using:
   ```bash
   openssl rand -base64 32
   ```

2. **Private Key**: Store your private key securely and never commit it to version control

3. **Rate Limiting**: Configure appropriate rate limits for your use case

4. **CORS**: In production, configure specific origins instead of wildcards

5. **Monitoring**: Implement proper monitoring and alerting for your production deployment

## Development

### Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

### Project Structure Benefits

- **Separation of Concerns**: Clear separation between business logic, API handling, and infrastructure
- **Type Safety**: Full TypeScript support with strict mode
- **Error Handling**: Centralized error handling with custom error classes
- **Validation**: Request validation using Zod schemas
- **Logging**: Structured logging with Winston
- **Security**: Helmet for security headers, rate limiting, and API key authentication

## Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use a process manager like PM2:
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name gas-distribution-api
   ```

3. Configure nginx as a reverse proxy
4. Set up SSL certificates (Let's Encrypt recommended)
5. Monitor logs and set up alerts

## License

MIT