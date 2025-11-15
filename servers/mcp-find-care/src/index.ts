/**
 * MCP Server: find_care
 * Finds mental health care providers using Google Places API
 * Exposes MCP tool via Streamable HTTP transport
 */

import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  findCareProviders,
  type FindCareParams,
  type CareProvider,
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
          "Find mental health care providers (therapists, psychiatrists, counselors) near a location, ranked by Google reviews. Use this when user asks for help finding professional care, mentions needing a therapist, or expresses interest in local mental health resources.",
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
            open_now: {
              type: "boolean",
              description:
                "Filter for currently open providers (default: false)",
              default: false,
            },
            min_rating: {
              type: "number",
              description: "Minimum Google rating (default: 4.3)",
              default: 4.3,
            },
          },
          required: [],
        },
      },
    ],
  };
});

// ============================================================================
// Tool Handler
// ============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "find_care") {
    try {
      const params = request.params.arguments as FindCareParams;

      // Call Google Places API
      const providers = await findCareProviders(params);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(providers, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Unknown tool: ${request.params.name}`);
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

    if (tool !== "find_care") {
      return res.status(400).json({ error: `Unknown tool: ${tool}` });
    }

    // Call the tool handler
    const providers = await findCareProviders(args as FindCareParams);

    res.json({ providers });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error invoking tool:", errorMessage);
    res.status(500).json({ error: errorMessage });
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
