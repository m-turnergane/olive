# MCP find_care Server

A Model Context Protocol (MCP) server that exposes a `find_care` tool for finding mental health care providers using Google Places API.

## Features

- **Smart specialization mapping**: Automatically maps user concerns (anxiety, couples therapy, grief, etc.) to relevant provider types
- **Intelligent ranking**: Ranks results by `rating * log(1 + reviews)` to balance quality with review volume
- **Flexible location input**: Accepts city names or lat/lng coordinates
- **Comprehensive filters**: Min rating, radius, open now, top-k results
- **Detailed provider info**: Name, address, rating, reviews, phone, website, Google Maps link

## Setup

### 1. Install Dependencies

```bash
cd servers/mcp-find-care
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
GOOGLE_PLACES_API_KEY=your_api_key_here
PORT=3001
HOST=localhost
LOG_LEVEL=info
```

### 3. Get Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable these APIs:
   - **Places API**
   - **Geocoding API**
4. Create credentials → API key
5. Restrict the key to only Places API and Geocoding API

## Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Stdio Mode (for MCP clients)

```bash
node dist/index.js --stdio
```

## API Endpoints

### Health Check

```bash
GET http://localhost:3001/health
```

### Invoke find_care Tool

```bash
POST http://localhost:3001/invoke
Content-Type: application/json

{
  "tool": "find_care",
  "arguments": {
    "query": "anxiety therapist",
    "location": { "city": "Mississauga, ON" },
    "radius_km": 35,
    "top_k": 5,
    "min_rating": 4.3
  }
}
```

## Tool Schema

### Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | No | "therapist mental health" | Search query or concern type |
| `location` | object | Yes | - | City name or coordinates |
| `radius_km` | number | No | 35 | Search radius in kilometers |
| `top_k` | number | No | 5 | Number of results to return |
| `open_now` | boolean | No | false | Filter for currently open providers |
| `min_rating` | number | No | 4.3 | Minimum Google rating |

### Location Formats

```json
// City name
{ "city": "Mississauga, ON" }

// Coordinates
{ "lat": 43.5890, "lng": -79.6441 }
```

### Output Schema

```json
[
  {
    "name": "Dr. Smith Psychology Clinic",
    "address": "123 Main St, Mississauga, ON",
    "rating": 4.8,
    "user_ratings_total": 127,
    "phone": "+1 (905) 123-4567",
    "website": "https://example.com",
    "place_id": "ChIJ...",
    "url": "https://www.google.com/maps/place/?q=place_id:ChIJ...",
    "types": ["psychologist", "health", "point_of_interest"],
    "location": {
      "lat": 43.5890,
      "lng": -79.6441
    }
  }
]
```

## Specialization Mapping

The tool automatically maps user concerns to relevant provider types:

| Concern Keywords | Provider Types |
|------------------|----------------|
| medication, prescription, psychiatric | psychiatrist, psychiatric |
| couples, marriage, relationship | marriage counselor, couples therapist |
| grief, loss, death, mourning | bereavement counselor, grief counselor |
| addiction, substance, alcohol | addiction counselor, substance abuse counselor |
| child, teen, adolescent | child psychologist, family therapist |
| trauma, ptsd, abuse | trauma therapist, ptsd specialist |
| anxiety, depression, stress | psychologist, therapist, anxiety specialist |
| (default) | psychologist, therapist, counselor |

## Integration with Olive

This server is designed to be called from the Olive chat-stream Edge Function:

1. **Chat-stream** declares `find_care` as an OpenAI tool
2. When model invokes the tool, **chat-stream** HTTP POSTs to this server's `/invoke` endpoint
3. Server queries Google Places API and returns ranked results
4. **Chat-stream** forwards results to model and client
5. **Client** displays results in FindCareModal

## Testing

### Manual Testing

```bash
# Health check
curl http://localhost:3001/health

# Find therapists in Mississauga
curl -X POST http://localhost:3001/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "find_care",
    "arguments": {
      "query": "anxiety therapist",
      "location": { "city": "Mississauga, ON" },
      "top_k": 3
    }
  }'
```

## Cost Considerations

Google Places API pricing (as of 2024):
- **Text Search**: $32 per 1000 requests
- **Place Details**: $17 per 1000 requests
- **Geocoding**: $5 per 1000 requests

Typical cost per `find_care` call:
- 2-3 Text Search requests (multiple provider types)
- 5-10 Place Details requests (top_k results)
- 0-1 Geocoding request (if city provided)

**Estimated**: $0.15 - $0.25 per tool invocation

## License

MIT

