# E2E Testing Quick Reference

## Installation

```bash
npm install
npx playwright install
```

## Running Tests

### Basic

```bash
npm run test:e2e                # Run all tests
npm run test:e2e:ui             # UI mode (interactive)
npm run test:e2e:headed         # See browser window
npm run test:e2e:docker         # With Docker automation
```

### Advanced

```bash
npx playwright test                              # All tests
npx playwright test e2e/tests/api.spec.ts       # Specific file
npx playwright test -g "should create"          # By name
npx playwright test --project=chromium          # Specific browser
npx playwright test --debug                     # Debug mode
npx playwright test --headed                    # Headed mode
npx playwright test --workers=4                 # Parallel
```

## Viewing Results

```bash
npx playwright show-report e2e-report   # HTML report
cat e2e-results.json                    # JSON results
ls test-results/                        # Screenshots/videos
```

## Docker Management

```bash
./docker-start.sh       # Start all services
./docker-status.sh      # Check health
./docker-logs.sh        # View logs
./docker-stop.sh        # Stop services
```

## Test Files

- `e2e/tests/api.spec.ts` - API endpoint tests
- `e2e/tests/visualizer-ui.spec.ts` - UI tests
- `e2e/tests/full-integration.spec.ts` - Integration tests

## Debugging

```bash
# Debug specific test
npx playwright test --debug -g "test name"

# Open trace viewer
npx playwright show-trace test-results/.../trace.zip

# Generate test code
npx playwright codegen http://localhost:5173
```

## CI/CD

Tests run automatically on GitHub Actions for:
- Push to main/develop
- Pull requests
- Manual dispatch

## Service URLs

- Visualizer: http://localhost:5173
- API: http://localhost:3000
- Visualizer Backend: http://localhost:3001
- Qdrant: http://localhost:6333/dashboard

## Troubleshooting

```bash
# Services not starting
docker-compose up -d
./docker-status.sh

# Port conflicts
lsof -i :3000
docker-compose down

# Playwright issues
npx playwright install --with-deps
rm -rf node_modules package-lock.json && npm install
```

## Full Documentation

See [E2E_TESTING.md](./E2E_TESTING.md) for complete guide.
