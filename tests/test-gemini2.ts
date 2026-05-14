const { GoogleGenAI } = require('@google/genai');
const client = new GoogleGenAI({apiKey: 'abc'});
console.log('models.generateImages length:', client.models.generateImages.length);
