# Testing Documentation

This directory contains comprehensive tests for the Gas Distribution API project.

## Test Structure

```
tests/
├── __mocks__/           # Mock implementations for external dependencies
├── integration/         # Integration tests using supertest
├── unit/               # Unit tests for individual components
├── utils/              # Test utilities and helpers
├── setup.ts            # Global test setup and configuration
└── README.md           # This file
```

## Test Categories

### Unit Tests
- **Configuration (`unit/config/`)**: Tests for environment configuration validation
- **Error Utilities (`unit/utils/`)**: Tests for custom error classes
- **Middleware (`unit/middleware/`)**: Tests for authentication, validation, and error handling
- **Services (`unit/services/`)**: Tests for BlockchainService with mocked ethers
- **Controllers (`unit/controllers/`)**: Tests for API request handlers

### Integration Tests
- **Routes (`integration/routes/`)**: End-to-end API endpoint testing
- **Application (`integration/app.test.ts`)**: Application-level configuration testing

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test -- --coverage
```

### Run Specific Test Files
```bash
# Run unit tests only
npm test unit/

# Run integration tests only
npm test integration/

# Run specific test file
npm test blockchain.service.test.ts
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

## Test Configuration

### Environment Variables
Tests use the `.env.test` file for configuration. Key variables include:
- `NODE_ENV=test`
- Mock blockchain configuration
- Test API keys
- Suppressed logging levels

### Mocking Strategy
- **Ethers Library**: Mocked to simulate blockchain interactions
- **Winston Logger**: Mocked to suppress console output during tests
- **Blockchain Service**: Comprehensive mocking for all blockchain operations
- **Environment Config**: Mocked with test-specific values

## Test Utilities

### Test Helpers (`utils/test-helpers.ts`)
- Mock request/response creators
- Common test data constants
- Environment variable utilities
- Async testing helpers

### Mock Data (`utils/test-helpers.ts`)
```javascript
TEST_DATA = {
  ADDRESSES: {
    VALID: '0x742d35Cc6506C5b5b60c96b1c32B6C1e83aA0aEb',
    INVALID: '0xinvalid',
    // ... more test addresses
  },
  API_KEYS: {
    VALID: 'test-api-key-32-characters-long-abc123',
    INVALID: 'short',
  },
  // ... more test data
}
```

## Writing Tests

### Unit Test Example
```javascript
import { BlockchainService } from '../../../src/services/blockchain.service';
import { mockProvider, mockWallet } from '../../__mocks__/ethers';

describe('BlockchainService', () => {
  let blockchainService: BlockchainService;

  beforeEach(() => {
    jest.clearAllMocks();
    blockchainService = BlockchainService.getInstance();
  });

  it('should distribute gas successfully', async () => {
    mockProvider.getBalance.mockResolvedValue(BigInt('1000000000000000000'));
    // ... test implementation
  });
});
```

### Integration Test Example
```javascript
import request from 'supertest';
import { createApp } from '../../../src/app';

describe('Gas Routes', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  it('should distribute gas with valid API key', async () => {
    const response = await request(app)
      .post('/api/fair/gas')
      .set('Authorization', `Bearer ${TEST_DATA.API_KEYS.VALID}`)
      .send({ address: TEST_DATA.ADDRESSES.VALID })
      .expect(200);
  });
});
```

## Test Coverage

The test suite aims for high coverage across:
- ✅ Configuration validation and environment setup
- ✅ Error handling and custom error classes
- ✅ Middleware functionality (auth, validation, error handling)
- ✅ Business logic in services and controllers
- ✅ API endpoint integration testing
- ✅ Security and rate limiting
- ✅ Edge cases and error scenarios

### Coverage Targets
- **Statements**: >90%
- **Branches**: >85%
- **Functions**: >95%
- **Lines**: >90%

## Mocking External Dependencies

### Ethers.js Mocking
```javascript
// Mock provider methods
mockProvider.getBalance.mockResolvedValue(BigInt('1000000000000000000'));
mockProvider.getTransaction.mockResolvedValue(mockTransaction);

// Mock wallet methods
mockWallet.sendTransaction.mockResolvedValue(mockTransactionResponse);
```

### API Response Mocking
```javascript
// Mock successful blockchain service responses
mockBlockchainService.distributeGas.mockResolvedValue({
  hash: '0x123...',
  status: true,
  timestamp: new Date(),
});
```

## Common Test Patterns

### Testing Async Operations
```javascript
it('should handle async blockchain operations', async () => {
  mockProvider.getBalance.mockResolvedValue(BigInt('1000000000000000000'));
  
  const result = await blockchainService.getBalance();
  
  expect(result).toBe(BigInt('1000000000000000000'));
});
```

### Testing Error Handling
```javascript
it('should handle network errors', async () => {
  mockProvider.getBalance.mockRejectedValue(new Error('Network error'));
  
  await expect(blockchainService.getBalance())
    .rejects.toThrow(BlockchainError);
});
```

### Testing Middleware
```javascript
it('should authenticate valid API key', async () => {
  req.headers.authorization = `Bearer ${TEST_DATA.API_KEYS.VALID}`;
  
  await authenticateApiKey(req, res, next);
  
  expect(next).toHaveBeenCalledWith();
  expect(req.apiKey).toBe(TEST_DATA.API_KEYS.VALID);
});
```

## Debugging Tests

### Enable Verbose Output
```bash
npm test -- --verbose
```

### Debug Specific Test
```bash
npm test -- --testNamePattern="should distribute gas successfully"
```

### Debug with Node Inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Best Practices

1. **Isolation**: Each test should be independent and not rely on others
2. **Mocking**: Mock external dependencies consistently
3. **Assertions**: Use descriptive assertions and test edge cases
4. **Setup/Teardown**: Clean up mocks and state between tests
5. **Naming**: Use descriptive test names that explain the expected behavior
6. **Coverage**: Aim for high coverage but prioritize meaningful tests over percentage

## Troubleshooting

### Common Issues
- **Jest timeout**: Increase timeout for integration tests with network operations
- **Mock issues**: Ensure mocks are reset between tests with `jest.clearAllMocks()`
- **Environment variables**: Verify `.env.test` is loaded correctly
- **Async/await**: Properly handle promises in async tests

### Memory Leaks
```bash
# Check for memory leaks in tests
npm test -- --detectOpenHandles --forceExit
```