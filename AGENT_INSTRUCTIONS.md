# Agent Instructions for NetInsight Development

This document provides instructions for AI agents and developers working on the NetInsight project. It outlines the project structure, coding standards, and development workflow.

## Project Overview

**NetInsight** is a comprehensive network traffic analysis dashboard built with:

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Python 3.10+, FastAPI, SQLite
- **Deployment**: Cloudflare Pages (frontend), Raspberry Pi 5 (backend)

## Project Structure

```
net-traffic/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities, API client, types
│   └── styles/            # CSS styles
├── backend/               # Backend API service
│   ├── services/          # Business logic services
│   ├── models/            # Pydantic models
│   └── utils/             # Utility functions
├── scripts/               # Build and utility scripts
└── docs/                  # Documentation files
```

## Key Files to Reference

### Documentation

- `README.md` - Main project documentation
- `PRD.md` - Product Requirements Document
- `ROADMAP.md` - Development roadmap and phases
- `REMAINING_TASKS.md` - Current task list with priorities
- `PERFORMANCE_OPTIMIZATIONS.md` - Performance optimization guide
- `API_ENHANCEMENTS.md` - Backend API documentation
- `INTEGRATION_GUIDE.md` - Frontend-backend integration guide

### Configuration

- `package.json` - Frontend dependencies and scripts
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `.env.example` - Environment variables template

### Core Code

- `src/App.tsx` - Main application component
- `src/lib/api.ts` - API client for backend communication
- `src/hooks/useApiData.ts` - Main data fetching hook
- `backend/main.py` - FastAPI application entry point

## Development Workflow

### 1. Before Starting Work

1. **Check Current Status**:
   - Read `REMAINING_TASKS.md` for current priorities
   - Check `ROADMAP.md` for phase status
   - Review `CRITICAL_TASKS_COMPLETED.md` for completed work

2. **Understand the Task**:
   - Identify which phase the task belongs to
   - Check dependencies and prerequisites
   - Review related documentation

3. **Set Up Environment**:

   ```bash
   # Frontend
   npm install
   npm run dev

   # Backend (if needed)
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

### 2. Coding Standards

#### TypeScript/React

- **Use TypeScript strictly**: No `any` types unless absolutely necessary
- **Functional components**: Use function components, not class components
- **Hooks**: Prefer custom hooks for reusable logic
- **Memoization**: Use `useMemo` and `useCallback` for expensive operations
- **Error handling**: Always handle errors gracefully with user-friendly messages

**Example Component Structure**:

```tsx
import { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';

interface ComponentProps {
  data: DataType[];
  onAction: (id: string) => void;
}

export function Component({ data, onAction }: ComponentProps) {
  const [state, setState] = useState<StateType>(initialState);

  const computed = useMemo(() => {
    // Expensive calculation
    return data.map(/* ... */);
  }, [data]);

  const handleClick = useCallback(
    (id: string) => {
      onAction(id);
    },
    [onAction]
  );

  return <Card>{/* Component JSX */}</Card>;
}
```

#### Python/Backend

- **Type hints**: Use type hints for all function parameters and returns
- **Pydantic models**: Use Pydantic for request/response validation
- **Async/await**: Use async functions for I/O operations
- **Error handling**: Use FastAPI's HTTPException for API errors
- **Logging**: Use Python's logging module, not print statements

**Example Service Structure**:

```python
from typing import List, Optional
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

class Service:
    async def get_data(self, limit: int = 100) -> List[DataType]:
        try:
            # Service logic
            return data
        except Exception as e:
            logger.error(f"Error getting data: {e}")
            raise HTTPException(status_code=500, detail=str(e))
```

### 3. API Integration

#### Frontend API Calls

- **Use React Query**: For data fetching, use `@tanstack/react-query`
- **Use API Client**: Always use `apiClient` from `src/lib/api.ts`
- **Error Handling**: Handle errors with user-friendly messages
- **Loading States**: Always show loading indicators
- **Caching**: Leverage React Query's caching (configured in `queryClient.ts`)

**Example**:

```tsx
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

const { data, isLoading, error } = useQuery({
  queryKey: ['devices'],
  queryFn: () => apiClient.getDevices(),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

#### Backend API Endpoints

- **Follow REST conventions**: GET, POST, PATCH, DELETE
- **Use Pydantic models**: For request/response validation
- **Document endpoints**: Add docstrings and type hints
- **Handle errors**: Return appropriate HTTP status codes

**Example**:

```python
@app.get("/api/devices/{device_id}")
async def get_device(device_id: str) -> Device:
    device = await storage.get_device(device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device
```

### 4. Performance Considerations

#### Always Implement

- ✅ **Debouncing**: For search inputs and filters (500ms delay)
- ✅ **Caching**: Use React Query for API data
- ✅ **Lazy Loading**: For heavy components (use `lazy.tsx`)
- ✅ **Virtual Scrolling**: For lists with 100+ items
- ✅ **Memoization**: For expensive calculations

#### Performance Checklist

- [ ] Are API calls debounced where appropriate?
- [ ] Is data cached using React Query?
- [ ] Are heavy components lazy-loaded?
- [ ] Are large lists using virtual scrolling?
- [ ] Are expensive calculations memoized?

### 5. Testing Requirements

#### Frontend Tests

- **Unit tests**: Test hooks and utilities
- **Integration tests**: Test API integration
- **Component tests**: Test critical components

**Run tests**:

```bash
npm run test          # Run all tests
npm run test:ui       # Run with UI
npm run test:coverage # With coverage
```

#### Backend Tests

- **Service tests**: Test business logic
- **API tests**: Test endpoints
- **Integration tests**: Test with database

**Run tests**:

```bash
cd backend
pytest tests/
```

### 6. Documentation Requirements

#### When Adding Features

1. **Update relevant docs**:
   - `REMAINING_TASKS.md` - Mark task as completed
   - `ROADMAP.md` - Update phase status
   - Component/function docstrings

2. **Add examples**:
   - Usage examples in component files
   - API endpoint examples in backend docs

3. **Update changelog**:
   - Document breaking changes
   - Note new features
   - List bug fixes

### 7. Environment Configuration

#### Frontend Environment Variables

- `VITE_USE_REAL_API` - Enable/disable real API (default: `false`)
- `VITE_API_BASE_URL` - Backend API URL (default: `http://localhost:8000`)

**Validation**:

```bash
npm run validate:env
```

#### Backend Environment Variables

- `NETWORK_INTERFACE` - Network interface for packet capture
- `HOST` - Server host (default: `0.0.0.0`)
- `PORT` - Server port (default: `8000`)

### 8. Common Patterns

#### Data Fetching Pattern

```tsx
// Use React Query for API data
const { data, isLoading, error } = useQuery({
  queryKey: ['resource', params],
  queryFn: () => apiClient.getResource(params),
  enabled: shouldFetch,
  staleTime: 5 * 60 * 1000,
});
```

#### Error Handling Pattern

```tsx
// Always handle errors gracefully
if (error) {
  return <ErrorDisplay error={error} onRetry={refetch} />;
}

if (isLoading) {
  return <LoadingSpinner />;
}

return <Component data={data} />;
```

#### Debouncing Pattern

```tsx
import { useDebounce } from '@/hooks/useDebounce';

const [query, setQuery] = useState('');
const debouncedQuery = useDebounce(query, 500);

useEffect(() => {
  if (debouncedQuery) {
    // Perform search
  }
}, [debouncedQuery]);
```

### 9. Git Workflow

#### Commit Messages

Use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `perf:` - Performance improvements
- `refactor:` - Code refactoring
- `test:` - Test additions/changes

**Example**:

```
feat: Add debouncing to flow filters

- Added 500ms debounce to filter inputs
- Integrated React Query for caching
- Updated useFlowFilters hook
```

#### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation
- `refactor/description` - Refactoring

### 10. Code Review Checklist

Before submitting code, ensure:

- [ ] Code follows TypeScript/Python style guidelines
- [ ] All tests pass
- [ ] No linter errors (`npm run lint`)
- [ ] Documentation is updated
- [ ] Performance optimizations are applied
- [ ] Error handling is implemented
- [ ] Loading states are shown
- [ ] Environment variables are documented
- [ ] No console.log statements (use logger)
- [ ] No commented-out code

### 11. Troubleshooting

#### Common Issues

**Frontend won't start**:

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Backend connection fails**:

- Check `VITE_USE_REAL_API` is set to `true`
- Verify `VITE_API_BASE_URL` is correct
- Check backend is running
- Run `npm run validate:env`

**Type errors**:

```bash
# Check TypeScript
npm run type-check
```

**Linter errors**:

```bash
# Auto-fix where possible
npm run lint:fix
```

### 12. Resources

#### Documentation

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [React Query Documentation](https://tanstack.com/query/latest)

#### Project-Specific

- `INTEGRATION_GUIDE.md` - Frontend-backend integration
- `PERFORMANCE_OPTIMIZATIONS.md` - Performance best practices
- `API_ENHANCEMENTS.md` - Backend API reference
- `TROUBLESHOOTING.md` - Common issues and solutions

### 13. Agent-Specific Guidelines

#### When Working on Tasks

1. **Read the task description carefully** in `REMAINING_TASKS.md`
2. **Check dependencies** - Ensure prerequisites are met
3. **Review similar implementations** - Look at existing code for patterns
4. **Test thoroughly** - Test with both API enabled and disabled
5. **Update documentation** - Mark tasks complete, update roadmap
6. **Follow patterns** - Use existing hooks, components, and utilities

#### When Creating New Features

1. **Check if similar feature exists** - Avoid duplication
2. **Use existing patterns** - Follow established conventions
3. **Add to lazy loading** - If component is heavy, add to `lazy.tsx`
4. **Implement caching** - Use React Query for API data
5. **Add error handling** - Always handle errors gracefully
6. **Write documentation** - Document usage and examples

#### When Fixing Bugs

1. **Reproduce the issue** - Understand the problem
2. **Check related code** - Look for similar issues
3. **Fix the root cause** - Don't just patch symptoms
4. **Add tests** - Prevent regression
5. **Update documentation** - Note the fix

### 14. Priority Guidelines

#### High Priority Tasks

- Critical bugs affecting core functionality
- Security vulnerabilities
- Performance issues
- Integration problems

#### Medium Priority Tasks

- Feature enhancements
- UX improvements
- Documentation updates
- Code refactoring

#### Low Priority Tasks

- Nice-to-have features
- Code cleanup
- Optimization opportunities
- Future considerations

### 15. Questions to Ask

Before starting work, consider:

1. **Is this the right approach?** - Check existing patterns
2. **Are there dependencies?** - Check prerequisites
3. **Is it documented?** - Check if similar features are documented
4. **Is it tested?** - Check if tests exist for similar code
5. **Is it performant?** - Consider performance implications
6. **Is it accessible?** - Consider accessibility requirements

## Quick Reference

### Common Commands

```bash
# Frontend
npm run dev              # Start dev server
npm run build            # Build for production
npm run lint             # Run linter
npm run type-check       # TypeScript check
npm run validate:env     # Validate environment
npm run test             # Run tests

# Backend
cd backend
python main.py           # Run backend
pytest                   # Run tests
```

### Key Hooks

- `useApiData` - Main data fetching hook
- `useFlowFilters` - Flow filtering with caching
- `useDebounce` - Debounce values
- `useHistoricalTrends` - Historical data with caching
- `useReconnection` - Automatic reconnection

### Key Components

- `ConnectionsTableEnhanced` - Main connections table
- `DevicesListEnhanced` - Device list with API integration
- `SearchBar` - Search with debouncing
- `ConnectionHealthMonitor` - Backend health monitoring
- `ErrorBoundary` - Error handling

### Key Files

- `src/lib/api.ts` - API client
- `src/lib/queryClient.ts` - React Query config
- `src/hooks/useApiData.ts` - Data fetching
- `backend/main.py` - Backend API
- `backend/services/storage.py` - Database service

---

**Last Updated**: December 2024  
**Maintainer**: Development Team  
**Version**: 1.0
