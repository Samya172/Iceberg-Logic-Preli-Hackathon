// File: worker.js
import { analyzeTicketWithLLM } from './apicall.js';

/**
 * Main request handler coordinating routing, validation, and error management.
 */
export async function handleRequest(request, env) {
  try {
    const url = new URL(request.url);

    // 1. GET /health Endpoint
    if (request.method === 'GET' && url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. POST /analyze-ticket Endpoint
    if (request.method === 'POST' && url.pathname === '/analyze-ticket') {
      let body;
      try {
        body = await request.json();
      } catch (err) {
        // Return 400 for malformed JSON parsing errors
        return createJSONResponse({ error: 'Malformed input. Invalid JSON structure.' }, 400);
      }

      // Syntactic Validation (Check required root fields)
      const { ticket_id, complaint } = body;
      if (!ticket_id || complaint === undefined) {
        return createJSONResponse({ error: 'Missing required fields: ticket_id and complaint are required.' }, 400);
      }

      // Semantic Validation (Check for empty contents)
      if (typeof complaint !== 'string' || complaint.trim() === '') {
        return createJSONResponse({ error: 'Semantically invalid data: complaint text cannot be empty.' }, 422);
      }

      // Coordinate processing with the AI pipeline layer, forwarding 'env' for credentials
      const analysisResult = await analyzeTicketWithLLM(body, env);

      // Force enforce echoing back the incoming ticket_id to fulfill strict API contract
      analysisResult.ticket_id = ticket_id;

      return createJSONResponse(analysisResult, 200);
    }

    // Fallback for unmatched endpoints
    return createJSONResponse({ error: 'Resource not found' }, 404);

  } catch (globalError) {
    // 3. Fallback 500 error wrapper - guarantees the system never crashes or leaks secrets/tokens
    return createJSONResponse({ 
      error: 'An internal server error occurred while processing your request.' 
    }, 500);
  }
}

/**
 * Utility helper to build structured HTTP JSON responses cleanly.
 */
function createJSONResponse(payload, status) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: { 'Content-Type': 'application/json' }
  });
}