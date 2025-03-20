// server.js
const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

// Temporary in-memory storage for user profiles
const userProfiles = {};

// Retrieve secrets/config from environment variables
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Twitter endpoints for OAuth2
// Token endpoint: https://api.twitter.com/2/oauth2/token
// User profile endpoint: for example, Twitter’s "users/me" endpoint (depending on API version)
// Note: Check Twitter’s documentation for the precise endpoints and scopes.
app.get('/auth/twitter/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send('Missing authorization code or state parameter.');
  }

  try {
    // Exchange authorization code for an access token
    // Twitter requires the PKCE code_verifier (which we pass using our state parameter)
    const tokenResponse = await axios.post('https://api.twitter.com/2/oauth2/token', null, {
      params: {
        code: code,
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        // If required, include client_secret. With PKCE it may be omitted on public clients.
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        code_verifier: state, // In our Unity flow, we use the generated code verifier as the state.
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token } = tokenResponse.data;

    // Fetch user profile information.
    // Twitter API v2 provides a /2/users/me endpoint; adjust as needed.
    const userResponse = await axios.get('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      params: {
        // Specify desired fields (e.g., profile_image_url, username, name)
        'user.fields': 'id,name,username,profile_image_url'
      }
    });

    const userProfile = userResponse.data.data;

    // Store profile data using the state as key
    userProfiles[state] = userProfile;

    // Inform the user to return to Unity (or perform a redirect to a custom URL scheme if desired)
    res.send('<html><body>Twitter Auth Successful! You can close this window and return to the app.</body></html>');
  } catch (error) {
    console.error('Error during Twitter authentication:', error.response ? error.response.data : error.message);
    res.status(500).send('Authentication failed.');
  }
});

// Endpoint for Unity to poll for the profile data
app.get('/getProfile', (req, res) => {
  const { state } = req.query;
  if (state && userProfiles[state]) {
    const profile = userProfiles[state];
    delete userProfiles[state]; // Remove after retrieval
    res.json(profile);
  } else {
    res.status(404).send('Profile not found.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
