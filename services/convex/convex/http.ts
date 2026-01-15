import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register Better Auth routes with Convex
// Enable CORS for Electron cross-origin renderer
authComponent.registerRoutes(http, createAuth, { cors: true });

export default http;
