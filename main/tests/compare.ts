import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// The tool we want the model to call
function escalateTicket(customerId: string, reason: string): string {
  console.log(`ESCALATION: Customer ${customerId} for ${reason}`);
  return "Escalation logged.";
}

// 1. Tool Declaration for the SDK (Boilerplate)
const escalateToolDeclaration = {
  functionDeclarations: [
    {
      name: "escalateTicket",
      description: "Escalate an urgent customer ticket",
      parameters: {
        type: Type.OBJECT,
        properties: {
          customerId: { type: Type.STRING, description: "ID of the customer" },
          reason: { type: Type.STRING, description: "Reason for escalation" }
        },
        required: ["customerId", "reason"]
      }
    }
  ]
};

async function processFeedback() {
  let processingLog = "Pipeline Start:\n";
  
  const rawFeedback = [
    "My account was charged twice for the pro plan! Fix this now!",
    "The new dashboard is really clean, great job team.",
    "I can't figure out how to export my data to CSV, it just spins."
  ];

  for (const feedback of rawFeedback) {
    processingLog += `Processing: ${feedback}\n`;
    
    // 2. Structured Data Extraction (Boilerplate Schema)
    const schema = {
      type: Type.OBJECT,
      properties: {
        sentiment: { type: Type.STRING },
        category: { type: Type.STRING, description: "Billing, UI, or Technical" },
        isUrgent: { type: Type.BOOLEAN },
        summary: { type: Type.STRING }
      },
      required: ["sentiment", "category", "isUrgent", "summary"]
    };

    const analysisResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: `Analyze the customer feedback. Category should be Billing, UI, or Technical.\nFeedback: ${feedback}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    // 3. Manual JSON parsing and error handling
    let analysis;
    try {
      analysis = JSON.parse(analysisResponse.text || "{}");
    } catch (e) {
      console.error("Failed to parse JSON");
      continue;
    }

    console.log(`Result for: ${analysis.summary}`);

    // 4. Conditional Tool Calling & Response Handling
    if (analysis.isUrgent) {
      const escalationResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Call escalateTicket for customer '1234' with an exact reason based on:\n${feedback}`,
        config: {
          tools: [escalateToolDeclaration]
        }
      });

      // 5. Manual extraction of the function call from the response object
      if (escalationResponse.functionCalls && escalationResponse.functionCalls.length > 0) {
        const call = escalationResponse.functionCalls[0];
        if (call.name === "escalateTicket") {
          const args = call.args as any;
          // Manual invocation of our local function using the args
          const resolution = escalateTicket(args.customerId, args.reason);
          processingLog += `Urgent action taken: ${resolution}\n`;
        }
      } else {
         processingLog += `Urgent action failed to trigger tool.\n`;
      }
    } else {
      processingLog += "Logged routinely.\n";
    }
  }

  console.log("\n--- Final Processing Log ---");
  console.log(processingLog);
}

processFeedback().catch(console.error);
