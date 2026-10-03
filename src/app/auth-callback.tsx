import { Redirect } from 'expo-router';

/**
 * Landing route for the OAuth deep link (marketappv3://auth-callback?code=…).
 * The code itself is exchanged by linkGoogleAccount(); this route only makes sure the router
 * doesn't show "not found" when Android opens the link, and returns to the profile.
 */
export default function AuthCallback() {
  return <Redirect href="/profile" />;
}
