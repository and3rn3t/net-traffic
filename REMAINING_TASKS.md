# Remaining Frontend-Backend Integration Tasks

## Critical: Main App Integration

### 1. ✅ **Replace Mock Data with API Hook** (PRIORITY: HIGH)

**Current State**: App.tsx still uses `useKV` and mock data generation
**Needs**: Replace with `useApiData` hook

**Location**: `src/App.tsx` lines 62-123

**Action Required**:

- Remove mock data initialization code
- Replace with `useApiData` hook
- Remove mock data generation interval
- Add loading/error state handling

### 2. ✅ **Update Capture Control** (PRIORITY: HIGH)

**Current State**: Uses local state `setIsCapturing`
**Needs**: Use API `startCapture`/`stopCapture` functions

**Location**: `src/App.tsx` line 144-151

### 3. ✅ **Add Connection Status Indicator** (PRIORITY: MEDIUM)

**Current State**: No visible connection status
**Needs**: Show backend connection status in UI

**Location**: Header area of App.tsx

### 4. ✅ **Add Loading States** (PRIORITY: MEDIUM)

**Current State**: No loading indicators during initial fetch
**Needs**: Show loading spinner while connecting to backend

**Location**: App.tsx component render

## Feature Integrations

### 5. ⚠️ **Device Management UI** (PRIORITY: MEDIUM)

**Current State**: No way to update device names/notes
**Needs**: Add edit functionality to DevicesList component

**Action Required**:

- Add edit button/dialog to DevicesList
- Use `apiClient.updateDevice()` to save changes
- Show success/error feedback

### 6. ⚠️ **Search Functionality** (PRIORITY: LOW)

**Current State**: No search UI
**Needs**: Add search bar component

**Action Required**:

- Create SearchBar component
- Use `apiClient.search()` endpoint
- Display search results

### 7. ⚠️ **Export Integration** (PRIORITY: LOW)

**Current State**: DataExporter component exists but doesn't use API
**Needs**: Integrate with `/api/export/flows` endpoint

**Action Required**:

- Update DataExporter to use `apiClient.exportFlows()`
- Add time range picker
- Support CSV/JSON export

### 8. ⚠️ **Advanced Flow Filtering UI** (PRIORITY: LOW)

**Current State**: ConnectionsTable shows all flows
**Needs**: Add filter UI for protocol, IP, time range, etc.

**Action Required**:

- Add filter sidebar/dropdown
- Use enhanced `getFlows()` with filter parameters
- Update ConnectionsTable to use filtered data

### 9. ⚠️ **Historical Trends Time Range** (PRIORITY: LOW)

**Current State**: HistoricalTrends has time range tabs but doesn't query API
**Needs**: Connect time range selection to API analytics endpoint

**Action Required**:

- Update HistoricalTrends to fetch data based on selected range
- Use `apiClient.getAnalytics()` with different hour values

## Quality of Life Improvements

### 10. ⚠️ **Connection Health Monitor** (PRIORITY: MEDIUM)

**Needs**:

- Visual indicator when backend is disconnected
- Automatic reconnection attempts
- Health check status in header

### 11. ⚠️ **Error Boundary Enhancement** (PRIORITY: LOW)

**Needs**:

- Better error messages for API failures
- Retry mechanisms
- Offline mode detection

### 12. ⚠️ **Performance Optimization** (PRIORITY: LOW)

**Needs**:

- Cache frequently accessed data
- Debounce API calls
- Virtual scrolling for large lists

## Testing & Validation

### 13. ⚠️ **Integration Testing** (PRIORITY: HIGH)

**Needs**:

- Test with API enabled/disabled
- Test WebSocket reconnection
- Test error scenarios
- Test with real Raspberry Pi backend

### 14. ⚠️ **Environment Configuration** (PRIORITY: MEDIUM)

**Needs**:

- Add `.env.example` file
- Document all environment variables
- Create setup validation script

## Documentation

### 15. ⚠️ **User Guide** (PRIORITY: LOW)

**Needs**:

- How to configure backend connection
- Troubleshooting guide
- API endpoint reference
