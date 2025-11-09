// olive-expo/lib/googleOAuth.ts

import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import Constants from "expo-constants";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  // 1) Use Expo AuthSession proxy (works reliably in Expo Go)
  const redirectTo = makeRedirectUri({
    // @ts-expect-error `useProxy` is supported at runtime even though not typed yet.
    useProxy: true,
    path: "/auth/callback",
    projectNameForProxy: "@mgane/olive-expo",
  });

  console.log("🔐 Google OAuth - Redirect URI:", redirectTo);
  console.log("🔐 App ownership:", Constants.appOwnership);

  // 2) Ask Supabase for the provider auth URL (PKCE)
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      skipBrowserRedirect: true, // we will open the URL manually
      scopes: "email profile",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("❌ OAuth initialization error:", error);
    throw error;
  }

  if (!data?.url) {
    throw new Error("No OAuth URL returned from Supabase");
  }

  console.log("🌐 Opening OAuth URL:", data.url);

  const callbackUrl = await openAuthSessionWithDeepLinkFallback(
    data.url,
    redirectTo
  );

  console.log("🔗 Callback URL:", callbackUrl);

  // Parse URL - tokens might be in query params or hash fragment
  const urlObj = new URL(callbackUrl);

  // Try to get access_token and refresh_token from query params
  let accessToken = urlObj.searchParams.get("access_token");
  let refreshToken = urlObj.searchParams.get("refresh_token");

  // If not in query params, try hash fragment (Supabase implicit flow)
  if (!accessToken && urlObj.hash) {
    const hashParams = new URLSearchParams(urlObj.hash.substring(1));
    accessToken = hashParams.get("access_token");
    refreshToken = hashParams.get("refresh_token");
  }

  console.log("🔑 Access token found:", !!accessToken);
  console.log("🔑 Refresh token found:", !!refreshToken);

  if (accessToken && refreshToken) {
    console.log("🔄 Setting session with tokens...");

    // Use setSession with the tokens
    const { data: sessionData, error: sessionError } =
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

    if (sessionError) {
      console.error("❌ Session error:", sessionError);
      throw sessionError;
    }

    console.log("✅ Google OAuth successful!");
    return sessionData.session;
  }

  // Fallback: try PKCE code exchange
  const code =
    urlObj.searchParams.get("code") ||
    (urlObj.hash
      ? new URLSearchParams(urlObj.hash.substring(1)).get("code")
      : null);

  if (code) {
    console.log("🔄 Exchanging code for session...");

    const { data: sessionData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("❌ Session exchange error:", exchangeError);
      throw exchangeError;
    }

    console.log("✅ Google OAuth successful!");
    return sessionData.session;
  }

  // No tokens or code found
  console.error(
    "❌ No tokens or code in URL. Query params:",
    Array.from(urlObj.searchParams.entries())
  );
  console.error("❌ Hash:", urlObj.hash);
  throw new Error(
    "No authentication tokens or code received from OAuth provider"
  );
}

async function openAuthSessionWithDeepLinkFallback(
  authUrl: string,
  returnUrl: string
): Promise<string> {
  let completed = false;

  return new Promise<string>((resolve, reject) => {
    const onUrl = ({ url }: { url: string }) => {
      if (completed) {
        return;
      }
      completed = true;
      listener.remove();
      WebBrowser.dismissAuthSession();
      resolve(url);
    };

    const listener = Linking.addEventListener("url", onUrl);

    WebBrowser.openAuthSessionAsync(authUrl, returnUrl, {
      showInRecents: true,
    })
      .then((result) => {
        if (completed) {
          return;
        }
        completed = true;
        listener.remove();
        if (result.type === "success" && "url" in result && result.url) {
          resolve(result.url);
        } else {
          reject(
            new Error(
              `OAuth flow not completed: ${result.type}${
                "error" in result && result.error
                  ? ` (${String(result.error)})`
                  : ""
              }`
            )
          );
        }
      })
      .catch((error) => {
        if (!completed) {
          completed = true;
          listener.remove();
          reject(error);
        }
      });
  });
}
