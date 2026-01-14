import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { makeMapifyRequest } from "./requester.js";

const DEFAULT_LANGUAGE = "en";
const DEFAULT_MODE = "prompt";

const server = new McpServer({
  name: "mapify-mcp-server",
  version: "1.0.0",
});

server.tool(
  "generate_mindmap",
  "Generate a mind map from various inputs and provide both an image and an editable link",
  {
    prompt: z
      .string()
      .describe(
        "The prompt to generate the mind map. When mode is website or youtube, the prompt should be a URL without any other text."
      ),
    mode: z
      .enum(["prompt", "ai-search", "youtube", "website"])
      .default("prompt")
      .describe("The mode to generate the mind map"),
    language: z
      .enum([
        "id",
        "ms",
        "da",
        "de",
        "en",
        "es",
        "fr",
        "it",
        "nl",
        "no",
        "pl",
        "pt",
        "ro",
        "fi",
        "sv",
        "vi",
        "tr",
        "hu",
        "cs",
        "uk",
        "ru",
        "bg",
        "ar",
        "fa",
        "he",
        "hi",
        "th",
        "ja",
        "zh-CN",
        "zh-TW",
        "ko",
      ])
      .default("en")
      .describe("The language of the mind map"),
  },
  async ({ prompt, mode, language }) => {
    if (mode === "youtube" || mode === "website") {
      // Remove the @ symbol from the prompt if it exists (for Cursor)
      if (prompt.startsWith("@")) {
        prompt = prompt.slice(1);
      }
    }

    const result = await makeMapifyRequest(
      prompt,
      mode || DEFAULT_MODE,
      language || DEFAULT_LANGUAGE
    );

    if (result.code !== 0) {
      return {
        content: [
          {
            type: "text",
            text:
              result.code === 10006
                ? `Your do not have sufficient Mapify credits to generate a mind map.`
                : result.code === 102
                ? `Please provide "MAPIFY_API_KEY" in the environment variables of your Mapify MCP Server settings.`
                : `Failed to generate mind map: ${result.message}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `The mind map has been generated.`,
        },
        {
          type: "text",
          text: `To view the mind map, click [here](${result.data.image})`,
        },
        {
          type: "text",
          text: `To edit the mind map, click [here](${result.data.continual})`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error occurred:", error);
  process.exit(1);
});
