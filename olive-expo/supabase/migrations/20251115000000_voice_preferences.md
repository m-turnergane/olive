# Voice & Location Preferences Schema Extension

**Date**: November 15, 2025  
**Type**: JSONB Schema Extension (No SQL changes required)

## Overview

This document describes the new fields added to the `user_preferences.data` JSONB column to support:
1. Voice gender selection for OpenAI Realtime API
2. Location data for find_care tool

## Schema Extensions

### Voice Preferences

**Field**: `voice_gender`  
**Type**: `string` (`'male'` | `'female'`)  
**Default**: `'female'` (if not set, defaults to `nova` voice)  
**Purpose**: Determines which voice to use for Realtime API sessions

**Behavior**:
- When `voice_gender = 'female'`: Uses `REALTIME_VOICE_FEMALE` env var (default: `nova`)
- When `voice_gender = 'male'`: Uses `REALTIME_VOICE_MALE` env var (default: `alloy`)

**Example**:
```json
{
  "voice_gender": "female",
  "nickname": "Alex",
  "tone": "casual"
}
```

### Location Preferences (for Find Care Tool)

**Field**: `location`  
**Type**: `string`  
**Format**: City name (e.g., `"Mississauga, ON"`) or lat/lng (e.g., `"43.5890,-79.6441"`)  
**Default**: `null` (will prompt user if not set)  
**Purpose**: User's location for mental health provider search

**Field**: `search_radius_km`  
**Type**: `number`  
**Default**: `25` (GTA-sized radius)  
**Purpose**: Search radius in kilometers for provider search

**Example**:
```json
{
  "location": "Mississauga, ON",
  "search_radius_km": 25,
  "voice_gender": "female"
}
```

## Implementation Notes

### No SQL Migration Required

The `user_preferences.data` column is **JSONB**, which is schema-less. New fields can be added without altering the table structure. This is by design for flexibility.

### Type Safety

TypeScript types have been updated in `types.ts`:

```typescript
export interface UserPreferences {
  user_id: string;
  data: {
    nickname?: string;
    pronouns?: string;
    tone?: 'casual' | 'professional' | 'supportive';
    opt_out_topics?: string[];
    crisis_prefs?: Record<string, any>;
    voice_gender?: 'male' | 'female'; // NEW
    location?: string; // NEW
    search_radius_km?: number; // NEW
  };
  updated_at: string;
}
```

### Server-Side Usage

The `realtime-ephemeral` Edge Function reads `voice_gender`:

```typescript
const { data: prefsData } = await supabase
  .from('user_preferences')
  .select('data')
  .eq('user_id', user.id)
  .single();

const userPrefs = prefsData?.data || {};
const voiceGender = userPrefs.voice_gender ?? 'female';
const selectedVoice = voiceGender === 'male' 
  ? REALTIME_VOICE_MALE 
  : REALTIME_VOICE_FEMALE;
```

### Client-Side Usage

Users can update preferences via Settings UI (to be implemented in Task C):

```typescript
// Update voice preference
await supabase
  .from('user_preferences')
  .upsert({
    user_id: user.id,
    data: {
      ...existingPrefs,
      voice_gender: 'male', // or 'female'
    },
  });
```

## Testing

### Test Voice Preference

1. In Settings, select "Male" or "Female" voice
2. Go to Voice tab
3. Tap orb to start session
4. Verify correct voice is used (check logs for selected voice)

### Test Default Behavior

1. For new users (no preference set)
2. Should default to `'female'` (nova voice)
3. Verify in Edge Function logs

## Related Files

- `/supabase/functions/realtime-ephemeral/index.ts` - Reads voice preference
- `/types.ts` - TypeScript interface
- `/components/SettingsPage.tsx` - UI for changing preferences (Task C)
- `/components/PreferencesView.tsx` - Preferences management

## Backwards Compatibility

✅ **Fully backwards compatible**

- Existing users without `voice_gender` will default to `'female'`
- No data migration needed
- Existing preferences remain intact

