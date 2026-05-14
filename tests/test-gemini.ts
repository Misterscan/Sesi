const { GoogleGenAI } = require('@google/genai');
console.log('GoogleGenAI keys:', Object.keys(new GoogleGenAI({apiKey: 'abc'}).models));
