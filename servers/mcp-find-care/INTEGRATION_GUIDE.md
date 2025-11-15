# MCP find_care Integration Guide

## Current Status

### ✅ Completed

1. **MCP Server Implementation** (`servers/mcp-find-care/`)

   - Package structure with TypeScript
   - Google Places API integration (Text Search + Details)
   - Specialization mapping for mental health concerns
   - Intelligent ranking by `rating * log(1 + reviews)`
   - HTTP endpoint `/invoke` for tool calls
   - Health check endpoint `/health`

2. **Bridge - Partial** (`supabase/functions/chat-stream/index.ts`)
   - Tool definition (`FIND_CARE_TOOL`) added to OpenAI tools array
   - `invokeFindCare()` helper function for MCP server calls
   - `buildRuntimeFacts()` updated to include location from preferences
   - MCP_FIND_CARE_URL environment variable support

### 🚧 In Progress

3. **Bridge - Tool Call Handler**

   - Need to add logic to detect tool calls in OpenAI response
   - Handle tool invocation and inject results back to OpenAI
   - Return structured results to client for modal display

4. **Client - FindCareModal Component**

   - Create modal UI component
   - Display loading state and results
   - Interactive features (call, map link)

5. **Preferences Extension**
   - Update `user_preferences.data` JSONB schema
   - Add location and search_radius_km fields
   - Update Settings UI for location editing

### 📋 Remaining Tasks

6. **DB Schema Updates**

   - Document preference schema changes
   - Verify RPCs exist and work correctly
   - Add indexes if needed

7. **Environment Configuration**

   - Add MCP_FIND_CARE_URL to ENV_TEMPLATE.md
   - Add GOOGLE_PLACES_API_KEY documentation
   - Deployment instructions

8. **End-to-End Testing**
   - Test MCP server standalone
   - Test integration with chat-stream
   - Test UI modal display
   - Test preferences persistence

## Next Steps

### Step 1: Complete Tool Call Handler in chat-stream

Add logic after building `openaiMessages` to handle tool calls:

```typescript
// After constructing openaiMessages, before streaming
let finalMessages = openaiMessages;
let toolCallLoop = 0;
const MAX_TOOL_CALLS = 5;

while (toolCallLoop < MAX_TOOL_CALLS) {
  const result = await callOpenAI(finalMessages);

  if (result.kind === "error") {
    return errorResponse(result);
  }

  // Non-streaming for tool call detection
  if (!CHAT_STREAM || toolCallLoop > 0) {
    const data = await result.json();
    const toolCalls = data.choices?.[0]?.message?.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      // No more tool calls, return final response
      if (data.choices?.[0]?.message?.content) {
        return textResponse(data.choices[0].message.content);
      }
      break;
    }

    // Handle tool calls
    for (const toolCall of toolCalls) {
      if (toolCall.function.name === "find_care") {
        const args = JSON.parse(toolCall.function.arguments);
        const toolResult = await invokeFindCare(
          args,
          prefs?.data?.location,
          prefs?.data?.search_radius_km
        );

        // Add tool call and result to messages
        finalMessages.push({
          role: "assistant",
          content: null,
          tool_calls: [toolCall],
        });
        finalMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }
    }

    toolCallLoop++;
  } else {
    // First call with streaming - return stream
    return streamResponse(result.stream);
  }
}
```

### Step 2: Create FindCareModal Component

```typescript
// components/FindCareModal.tsx
interface FindCareModalProps {
  visible: boolean;
  onClose: () => void;
  providers: CareProvider[];
  loading: boolean;
}
```

### Step 3: Wire Modal to Chat Stream

Update `ChatView.tsx` to:

- Detect tool results in stream
- Show FindCareModal when providers received
- Display summary message in chat

### Step 4: Update Preferences

Add to `PreferencesView.tsx`:

- Location input field (city/region)
- Search radius slider (10-100km)
- Save to `user_preferences.data`

## Deployment

### 1. Start MCP Server

```bash
cd servers/mcp-find-care
npm install
# Create .env with GOOGLE_PLACES_API_KEY
npm run build
npm start
```

### 2. Deploy Edge Function

```bash
cd supabase
# Set MCP_FIND_CARE_URL in Supabase dashboard
# If running locally: http://host.docker.internal:3001
# If deployed: https://your-mcp-server.com
supabase functions deploy chat-stream
```

### 3. Update Client

```bash
cd olive-expo
# No changes needed - client receives tool results in stream
```

## Testing Checklist

- [ ] MCP server health check responds
- [ ] MCP server /invoke returns providers
- [ ] chat-stream detects tool calls
- [ ] chat-stream calls MCP server
- [ ] Client receives tool results
- [ ] Modal displays correctly
- [ ] Location preferences save
- [ ] Runtime context includes location

## Cost Estimation

**Per find_care invocation**:

- Google Places Text Search: 2-3 requests × $0.032 = $0.064 - $0.096
- Google Places Details: 5 requests × $0.017 = $0.085
- Google Geocoding (if city): 1 request × $0.005 = $0.005

**Total**: ~$0.15 - $0.19 per tool call

**Monthly estimate** (100 tool calls): ~$15 - $19

## Security Considerations

1. **API Keys**:

   - GOOGLE_PLACES_API_KEY never exposed to client
   - Stored in MCP server environment only
   - MCP server URL can be internal (not public)

2. **Rate Limiting**:

   - Consider adding rate limits to prevent abuse
   - Cache results per location/query (optional)

3. **User Privacy**:
   - Only share city-level location in context
   - Don't log precise coordinates
   - RLS ensures users can only see own preferences

## Future Enhancements

1. **Cache Popular Searches**:

   - Cache "therapist in Mississauga" for 24h
   - Reduce API costs by 50-70%

2. **Favorite Providers**:

   - Let users save providers
   - New table: `favorite_providers`

3. **Booking Integration**:

   - Partner with booking platforms
   - Direct appointment scheduling

4. **Insurance Filtering**:
   - Add insurance provider filter
   - Requires provider database enrichment
