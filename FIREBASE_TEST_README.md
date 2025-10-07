# Firebase Leaderboard Testing Tool

## Purpose

This is a simple testing interface to verify that your Firebase Firestore leaderboard is working correctly. It helps you diagnose connection issues, test database operations, and ensure cross-player score syncing is functional.

## How to Use

### 1. Start Local Server
```bash
npm start
# or
python3 -m http.server 8000
```

### 2. Open in Browser
Navigate to: **http://localhost:8000/firebase-test.html**

### 3. Run Tests
Click the **"Run All Tests"** button to:
- ✅ Verify Firebase SDK is loaded
- ✅ Check Firebase initialization
- ✅ Test Firestore database connection
- ✅ Read current leaderboard entries
- ✅ Submit a test score
- ✅ Verify the score was saved

### 4. Review Results
The test results will show:
- Green ✅ checkmarks for successful operations
- Red ❌ errors if something fails
- Blue ℹ️ info messages with details

### 5. Copy Results (Optional)
Click **"📋 Copy Results"** to copy the test output to your clipboard for sharing or debugging.

## What Gets Tested

### Firebase Initialization
Confirms that:
- Firebase SDK loaded from CDN
- Configuration is correct
- Connection to your project succeeds

### Database Connection
Verifies:
- Firestore database is accessible
- Project ID matches your config
- Network connectivity to Firebase servers

### Read Operations
Tests:
- Fetching leaderboard entries
- Sorting by score (descending)
- Displaying entry details (name, score, date)

### Write Operations
Validates:
- Creating new leaderboard entries
- Data structure is correct
- Firestore security rules allow writes
- Document ID is returned

## Expected Output

### ✅ Success (Everything Working)
```
✅ Firebase SDK loaded
✅ Firebase initialized successfully
✅ Firestore database connected
ℹ️ Project ID: js13k-2025
ℹ️ Found 5 leaderboard entries
ℹ️ Top scores:
  1. PlayerName: 5000 (2025-10-06)
  2. AnotherPlayer: 4500 (2025-10-05)
...
✅ Score saved successfully! Doc ID: abc123xyz
```

### ❌ Common Issues

**Firebase SDK not loaded**
- Check internet connection (SDK loads from CDN)
- Verify `index.html` has Firebase script tags

**Permission denied**
- Check Firestore security rules
- Ensure rules allow `read` and `create` for leaderboard collection
- See `FIRESTORE_RULES.md` for correct configuration

**Connection timeout**
- Check Firebase project status
- Verify API key is correct
- Ensure project exists in Firebase Console

## Not Deployed to Production

This file is **for local testing only**. The `vercel.json` build configuration excludes it from production deployments, so it won't be accessible on your live site.

## Troubleshooting

### Test fails with "Firebase not initialized"
1. Check that `main.js` has the correct Firebase config
2. Verify the config matches your `.env` file
3. Ensure no typos in API key or project ID

### Test passes locally but fails on deployment
1. Check that Firebase config is embedded in deployed `main.js`
2. Verify Vercel deployment succeeded
3. Check browser console on live site for errors

### Scores don't sync between browsers
1. Verify both browsers show "Firebase connected" in console
2. Check Firebase Console to see if scores are in database
3. Ensure Firestore rules allow read access

## Related Documentation

- `QUICKSTART.md` - Quick testing guide
- `FIRESTORE_RULES.md` - Security rules setup
- `WHY_FIREBASE_KEYS_ARE_PUBLIC.md` - Security explanation
- `TESTING_NOW.md` - Comprehensive testing walkthrough

## Manual Testing Alternative

Instead of using this tool, you can test directly in the browser console:

```javascript
// Check Firebase status
typeof firebase           // Should be "object"
window.db                 // Should be Firestore instance
firebaseEnabled          // Should be true

// Test reading leaderboard
getLeaderboard().then(console.log)

// Test adding score (manual)
db.collection('leaderboard').add({
  name: "Test Player",
  score: 1000,
  date: "2025-10-06",
  streak: 5,
  perfectShields: 2
}).then(() => console.log('Success!'))
```

---

**Questions or issues?** Check the main README.md or open an issue on GitHub.
