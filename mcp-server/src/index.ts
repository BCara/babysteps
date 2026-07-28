import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (requires GOOGLE_APPLICATION_CREDENTIALS)
admin.initializeApp();
const db = admin.firestore();

const server = new Server(
  {
    name: 'babysteps-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'log_baby_event',
        description: 'Log a new event (feed, sleep, diaper, etc.) for a baby',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'The user ID' },
            type: { type: 'string', enum: ['feed', 'sleep', 'diaper', 'tummytime', 'bath', 'medication'] },
            durationMinutes: { type: 'number', description: 'Duration in minutes if applicable' },
            notes: { type: 'string', description: 'Any extra notes' },
            condition: { type: 'string', enum: ['wet', 'dirty', 'both'], description: 'Condition if diaper' }
          },
          required: ['userId', 'type'],
        },
      },
      {
        name: 'query_baby_events',
        description: 'Get recent events for a baby',
        inputSchema: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'The user ID' },
            limit: { type: 'number', description: 'Max events to return (default 10)' }
          },
          required: ['userId'],
        },
      }
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'log_baby_event') {
    const { userId, type, durationMinutes, notes, condition } = args as any;
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const babyIds = userDoc.data()?.babyIds || [];
      if (babyIds.length === 0) throw new Error('No baby found for user');
      
      const babyId = babyIds[0];
      const event: any = {
        type,
        startTime: admin.firestore.Timestamp.now(),
        endTime: type === 'sleep' ? null : admin.firestore.Timestamp.now(),
        source: 'gemini',
        loggedBy: userId,
      };
      
      if (durationMinutes) event.duration = durationMinutes;
      if (notes) event.notes = notes;
      if (condition && type === 'diaper') event.metadata = { condition };

      await db.collection('babies').doc(babyId).collection('events').add(event);
      return { content: [{ type: 'text', text: `Successfully logged ${type} event.` }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Error logging event: ${error.message}` }], isError: true };
    }
  }

  if (name === 'query_baby_events') {
    const { userId, limit = 10 } = args as any;
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const babyIds = userDoc.data()?.babyIds || [];
      if (babyIds.length === 0) throw new Error('No baby found for user');
      
      const babyId = babyIds[0];
      const snapshot = await db.collection('babies').doc(babyId).collection('events')
        .orderBy('startTime', 'desc')
        .limit(limit)
        .get();
        
      const events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      return { content: [{ type: 'text', text: JSON.stringify(events, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Error querying events: ${error.message}` }], isError: true };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('BabySteps MCP Server running on stdio');
}

run().catch(console.error);
