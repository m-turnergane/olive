import "react-native-url-polyfill/auto";
import {
  createClient,
  AuthError,
  User as SupabaseAuthUser,
} from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { User } from "../types";

// Ensure the WebBrowser auth session is properly completed on iOS
WebBrowser.maybeCompleteAuthSession();

// Get environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Custom storage adapter for React Native using expo-secure-store
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    SecureStore.deleteItemAsync(key);
  },
};

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

const getProjectNameForProxy = (): string | undefined => {
  const envOverride = process.env.EXPO_PUBLIC_PROJECT_NAME_FOR_PROXY;
  if (envOverride) {
    return envOverride;
  }

  const expoConfig = Constants.expoConfig ?? undefined;
  const owner = expoConfig?.owner;
  const slug = expoConfig?.slug;

  if (owner && slug) {
    return `@${owner}/${slug}`;
  }

  return undefined;
};

const buildRedirectUri = (isExpoGo: boolean) => {
  const baseOptions: Record<string, unknown> = {
    scheme: "olive",
    path: "auth/callback",
    preferLocalhost: false,
    isTripleSlashed: false,
  };

  if (isExpoGo) {
    baseOptions.useProxy = true;

    const projectNameForProxy = getProjectNameForProxy();

    if (projectNameForProxy) {
      baseOptions.projectNameForProxy = projectNameForProxy;
    } else {
      console.warn(
        "Expo AuthSession proxy requires the project full name (@owner/slug). Set it in app.json or provide EXPO_PUBLIC_PROJECT_NAME_FOR_PROXY."
      );
    }
  }

  return makeRedirectUri(baseOptions as Parameters<typeof makeRedirectUri>[0]);
};

/**
 * Sign up with email and password
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  name: string
): Promise<{ user: User | null; error: AuthError | null }> => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });

    if (error) {
      return { user: null, error };
    }

    if (data.user) {
      // Create user record in users table
      const { error: insertError } = await supabase.from("users").insert({
        id: data.user.id,
        email: data.user.email,
        name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("Error creating user record:", insertError);
      }

      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        name: name,
        photoUrl: `https://api.dicebear.com/7.x/initials/png?seed=${name}`,
      };

      return { user, error: null };
    }

    return { user: null, error: null };
  } catch (err) {
    console.error("Sign up error:", err);
    return { user: null, error: err as AuthError };
  }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (
  email: string,
  password: string
): Promise<{ user: User | null; error: AuthError | null }> => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Check if this email exists but was registered with OAuth
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        // Check if user exists in our database (might be OAuth user)
        const { data: existingUser } = await supabase
          .from("users")
          .select("id, email")
          .eq("email", email.toLowerCase())
          .single();

        if (existingUser) {
          // User exists but can't log in with password = likely OAuth user
          error.message =
            'This email is registered with Google. Please use "Continue with Google" to sign in.';
          return { user: null, error };
        }
      }

      return { user: null, error };
    }

    if (data.user) {
      // Fetch user data from users table
      const { data: userData, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (fetchError) {
        console.error("Error fetching user data:", fetchError);
      }

      const user: User = {
        id: data.user.id,
        email: data.user.email!,
        name: userData?.name || data.user.user_metadata?.name || "User",
        photoUrl:
          userData?.photo_url ||
          `https://api.dicebear.com/7.x/initials/png?seed=${
            userData?.name || "User"
          }`,
        created_at: userData?.created_at,
        updated_at: userData?.updated_at,
      };

      return { user, error: null };
    }

    return { user: null, error: null };
  } catch (err) {
    console.error("Sign in error:", err);
    return { user: null, error: err as AuthError };
  }
};

/**
 * Sign in with Google OAuth
 * Opens a browser for OAuth flow and handles the callback via URL session fragments
 */
export const signInWithGoogle = async (): Promise<{
  user: User | null;
  error: AuthError | Error | null;
}> => {
  try {
    const isExpoGo = Constants.appOwnership === "expo";

    const redirectUri = buildRedirectUri(isExpoGo);

    // For development client / Expo Go we still need a native redirect to resume the app
    const returnUri = makeRedirectUri({
      scheme: "olive",
      path: "auth/callback",
      preferLocalhost: false,
      isTripleSlashed: false,
    });

    console.log("Using redirect URI:", redirectUri);
    console.log("Using return URI:", returnUri);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
        scopes: "email profile",
      },
    });

    if (error) {
      console.error("OAuth initialization error:", error);
      return { user: null, error };
    }

    if (!data?.url) {
      return { user: null, error: new Error("No OAuth URL returned") };
    }

    console.log("Opening OAuth URL:", data.url);

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      isExpoGo ? returnUri : redirectUri
    );

    console.log("Auth session result:", result);

    if (result.type === "cancel" || result.type === "dismiss") {
      return { user: null, error: new Error("Authentication cancelled") };
    }

    if (result.type !== "success" || !result.url) {
      return {
        user: null,
        error: new Error("Authentication failed. Please try again."),
      };
    }

    const { accessToken, refreshToken, authCode } = extractOAuthParams(
      result.url
    );

    console.log("OAuth params extracted:", {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasAuthCode: !!authCode,
    });

    let sessionUser: SupabaseAuthUser | null = null;

    if (accessToken && refreshToken) {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

      console.log("setSession result:", { sessionData, sessionError });

      if (sessionError) {
        console.error("Error setting session:", sessionError);
        return { user: null, error: sessionError };
      }

      sessionUser = sessionData.session?.user ?? null;
    }

    if (!sessionUser && authCode) {
      const { data: exchangeData, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(authCode);

      console.log("exchangeCodeForSession result:", {
        exchangeData,
        exchangeError,
      });

      if (exchangeError) {
        console.error("Error exchanging code for session:", exchangeError);
        return { user: null, error: exchangeError };
      }

      sessionUser = exchangeData.session?.user ?? null;
    }

    if (!sessionUser) {
      const { data: sessionData, error: getSessionError } =
        await supabase.auth.getSession();

      if (getSessionError) {
        console.error("Error fetching session:", getSessionError);
      }

      sessionUser = sessionData.session?.user ?? null;
    }

    if (!sessionUser) {
      return {
        user: null,
        error: new Error("No session found after authentication"),
      };
    }

    return await createOrFetchUser(sessionUser);
  } catch (err) {
    console.error("Google sign in error:", err);
    return { user: null, error: err as Error };
  }
};

const extractOAuthParams = (
  url: string
): {
  accessToken?: string;
  refreshToken?: string;
  authCode?: string;
} => {
  try {
    const parsedUrl = new URL(url);

    const hash = parsedUrl.hash.startsWith("#")
      ? parsedUrl.hash.substring(1)
      : parsedUrl.hash;

    const fragmentParams = new URLSearchParams(hash);
    const queryParams = parsedUrl.searchParams;

    const accessToken =
      fragmentParams.get("access_token") ??
      queryParams.get("access_token") ??
      undefined;
    const refreshToken =
      fragmentParams.get("refresh_token") ??
      queryParams.get("refresh_token") ??
      undefined;
    const authCode =
      fragmentParams.get("code") ?? queryParams.get("code") ?? undefined;

    return { accessToken, refreshToken, authCode };
  } catch (error) {
    console.warn("Failed to parse OAuth callback URL:", error);
    return {};
  }
};

/**
 * Helper function to create or fetch user from database
 */
async function createOrFetchUser(authUser: SupabaseAuthUser): Promise<{
  user: User | null;
  error: AuthError | Error | null;
}> {
  try {
    // Fetch user record from database
    const { data: userData, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error fetching user data:", fetchError);
    }

    // If user doesn't exist, create them
    if (!userData) {
      const newUser = {
        id: authUser.id,
        email: authUser.email!,
        name:
          authUser.user_metadata?.name ||
          authUser.user_metadata?.full_name ||
          authUser.email?.split("@")[0] ||
          "User",
        photo_url:
          authUser.user_metadata?.avatar_url ||
          authUser.user_metadata?.picture ||
          `https://api.dicebear.com/7.x/initials/png?seed=${authUser.email}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from("users")
        .insert(newUser);

      if (insertError) {
        console.error("Error creating user record:", insertError);
      }

      const user: User = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        photoUrl: newUser.photo_url,
      };

      console.log("Created and returning new user:", user);
      return { user, error: null };
    }

    // Return existing user
    const user: User = {
      id: authUser.id,
      email: authUser.email!,
      name: userData.name || "User",
      photoUrl:
        userData.photo_url ||
        `https://api.dicebear.com/7.x/initials/png?seed=${userData.name}`,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
    };

    console.log("Returning existing user:", user);
    return { user, error: null };
  } catch (err) {
    console.error("Error in createOrFetchUser:", err);
    return { user: null, error: err as Error };
  }
}

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<{ error: AuthError | null }> => {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (err) {
    console.error("Sign out error:", err);
    return { error: err as AuthError };
  }
};

/**
 * Get the current session
 */
export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  } catch (err) {
    console.error("Get session error:", err);
    return { session: null, error: err as AuthError };
  }
};

/**
 * Get the current user
 */
export const getCurrentUser = async (): Promise<{
  user: User | null;
  error: AuthError | null;
}> => {
  try {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      return { user: null, error };
    }

    // Fetch user data from users table
    const { data: userData, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (fetchError) {
      console.error("Error fetching user data:", fetchError);
    }

    const user: User = {
      id: authUser.id,
      email: authUser.email!,
      name: userData?.name || authUser.user_metadata?.name || "User",
      photoUrl:
        userData?.photo_url ||
        `https://api.dicebear.com/7.x/initials/png?seed=${
          userData?.name || "User"
        }`,
      created_at: userData?.created_at,
      updated_at: userData?.updated_at,
    };

    return { user, error: null };
  } catch (err) {
    console.error("Get current user error:", err);
    return { user: null, error: err as AuthError };
  }
};

/**
 * Listen to auth state changes
 */
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const { user } = await getCurrentUser();
      callback(user);
    } else {
      callback(null);
    }
  });
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<User>
): Promise<{ error: Error | null }> => {
  try {
    const { error } = await supabase
      .from("users")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    return { error };
  } catch (err) {
    console.error("Update profile error:", err);
    return { error: err as Error };
  }
};
