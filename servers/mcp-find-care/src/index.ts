/**
 * MCP Server: find_care
 * Finds mental health care providers using Google Places API
 * Exposes MCP tool via Streamable HTTP transport
 */

// IMPORTANT: Load environment variables FIRST before any other imports
import { config } from "dotenv";
config();

// Now import everything else after env vars are loaded
import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  findCareProviders,
  findCareProvidersWithMetadata,
  findCareProvidersWithPagination,
  textSearch,
  nearbySearch,
  placeDetails,
  type FindCareParams,
  type CareProvider,
  type TextSearchParams,
  type NearbySearchParams,
  type PlaceDetailsParams,
  type CarePlace,
  type SearchResult,
} from "./places.js";

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "localhost";

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: "mcp-find-care",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ============================================================================
// Tool Definitions
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "find_care",
        description:
          "Find mental health care providers (therapists, psychiatrists, counselors) near a location, ranked by Google reviews. Use this when user asks for help finding professional care, mentions needing a therapist, or expresses interest in local mental health resources. Legacy interface for backward compatibility.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description:
                'Search query or concern type (e.g., "anxiety", "teen therapy", "grief counseling", "psychiatrist")',
            },
            location: {
              oneOf: [
                {
                  type: "object",
                  properties: {
                    city: {
                      type: "string",
                      description: 'City name (e.g., "Mississauga, ON")',
                    },
                  },
                  required: ["city"],
                },
                {
                  type: "object",
                  properties: {
                    lat: { type: "number", description: "Latitude" },
                    lng: { type: "number", description: "Longitude" },
                  },
                  required: ["lat", "lng"],
                },
              ],
              description: "User location as city name or coordinates",
            },
            radius_km: {
              type: "number",
              description: "Search radius in kilometers (default: 35)",
              default: 35,
            },
            top_k: {
              type: "number",
              description: "Number of results to return (default: 5)",
              default: 5,
            },
            min_rating: {
              type: "number",
              description: "Minimum Google rating (default: 4.3)",
              default: 4.3,
            },
            pageToken: {
              type: "string",
              description: "Pagination token from previous response (optional)",
            },
          },
          required: [],
        },
      },
      {
        name: "find_care_text",
        description:
          "Search for mental health care providers using text-based search with Google Places API (New) v1. Returns ranked results based on rating, reviews, distance, and mental health relevance. Supports pagination.",
        inputSchema: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description:
                'Reason or search query (e.g., "anxiety", "couples therapy", "trauma counseling"). Will be combined with mental health keywords automatically.',
            },
            location: {
              type: "object",
              properties: {
                lat: { type: "number", description: "Latitude" },
                lng: { type: "number", description: "Longitude" },
              },
              required: ["lat", "lng"],
              description: "User location coordinates",
            },
            radiusMeters: {
              type: "number",
              description: "Search radius in meters (default: 35000)",
              default: 35000,
            },
            pageToken: {
              type: "string",
              description: "Pagination token from previous response (optional)",
            },
          },
          required: ["location"],
        },
      },
      {
        name: "find_care_nearby",
        description:
          "Search for healthcare facilities near a location using Google Places API (New) v1 Nearby Search. Filters results to mental health related places. Good for finding clinics, hospitals, and psychiatric facilities.",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "object",
              properties: {
                lat: { type: "number", description: "Latitude" },
                lng: { type: "number", description: "Longitude" },
              },
              required: ["lat", "lng"],
              description: "User location coordinates",
            },
            includedTypes: {
              type: "array",
              items: { type: "string" },
              description:
                'Place types to include (e.g., ["doctor", "hospital", "psychiatric_hospital"]). Default: ["doctor", "hospital", "psychiatric_hospital"]',
              default: ["doctor", "hospital", "psychiatric_hospital"],
            },
            radiusMeters: {
              type: "number",
              description: "Search radius in meters (default: 35000)",
              default: 35000,
            },
          },
          required: ["location"],
        },
      },
      {
        name: "place_details",
        description:
          "Get detailed information about a specific place using Google Places API (New) v1. Includes opening hours, full contact details, and additional metadata.",
        inputSchema: {
          type: "object",
          properties: {
            placeId: {
              type: "string",
              description: "Google Place ID to fetch details for",
            },
          },
          required: ["placeId"],
        },
      },
    ],
  };
});

// ============================================================================
// Tool Handler
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const toolName = request.params.name;

    switch (toolName) {
      case "find_care": {
        const params = request.params.arguments as FindCareParams;
        const providers = await findCareProviders(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(providers, null, 2),
            },
          ],
        };
      }

      case "find_care_text": {
        const params = request.params.arguments as TextSearchParams;
        const result = await textSearch(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "find_care_nearby": {
        const params = request.params.arguments as NearbySearchParams;
        const result = await nearbySearch(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "place_details": {
        const params = request.params
          .arguments as unknown as PlaceDetailsParams;
        const place = await placeDetails(params);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(place, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error: any) {
    const errorResponse = {
      error: error.message || String(error),
      status: error.status,
      code: error.code,
      hint: error.hint,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
      isError: true,
    };
  }
});

// ============================================================================
// HTTP Server for Streamable Transport
// ============================================================================

const app = express();
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "mcp-find-care", version: "1.0.0" });
});

// MCP tool invocation endpoint
app.post("/invoke", async (req, res) => {
  try {
    const { tool, arguments: args } = req.body;

    switch (tool) {
      case "find_care": {
        const result = await findCareProvidersWithMetadata(
          args as FindCareParams
        );
        res.json(result); // Returns { providers, geocoded_location? }
        break;
      }

      case "find_care_text": {
        const result = await textSearch(args as TextSearchParams);
        res.json(result);
        break;
      }

      case "find_care_nearby": {
        const result = await nearbySearch(args as NearbySearchParams);
        res.json(result);
        break;
      }

      case "place_details": {
        const place = await placeDetails(args as PlaceDetailsParams);
        res.json({ place });
        break;
      }

      default:
        return res.status(400).json({ error: `Unknown tool: ${tool}` });
    }
  } catch (error: any) {
    const errorResponse = {
      error: error.message || String(error),
      status: error.status,
      code: error.code,
      hint: error.hint,
    };
    console.error("Error invoking tool:", errorResponse);
    res.status(500).json(errorResponse);
  }
});

// Start HTTP server
app.listen(PORT, () => {
  console.log(`🏥 MCP find_care server running on http://${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log(`Invoke endpoint: http://${HOST}:${PORT}/invoke`);
});

// ============================================================================
// Stdio Transport (for MCP client usage)
// ============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP find_care server running on stdio");
}

// Only run stdio transport if not started as HTTP server
if (process.argv.includes("--stdio")) {
  main().catch(console.error);
}
