# Sesi AI Chatbot Local Server
# Handles visual dashboard requests and executes pure Sesi model queries offline!

import http.server
import socketserver
import urllib.parse
import json
import subprocess
import os
import sys

# Force UTF-8 encoding on standard streams to prevent Windows console encoding crashes
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

PORT = 8000

class ChatbotHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow cross-origin requests for safety
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        
        # Route API Chat queries
        if parsed_url.path == '/chat':
            query_params = urllib.parse.parse_qs(parsed_url.query)
            user_query = query_params.get('q', [''])[0]
            
            if not user_query:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Empty query parameter 'q'"}).encode('utf-8'))
                return

            try:
                # 1. Write the query to query.txt for Sesi to read
                with open("query.txt", "w", encoding="utf-8") as f:
                    f.write(user_query)
                
                print(f"[SERVER] Active query logged: '{user_query}'")
                
                # 2. Execute Sesi chatbot script using cross-platform execution (with Powershell bypass on Windows if needed)
                if sys.platform == "win32":
                    cmd = 'powershell -ExecutionPolicy Bypass -Command "npx dotenvx run -- node bin/sesi.js main/chatbot.sesi"'
                else:
                    cmd = 'npx dotenvx run -- node bin/sesi.js main/chatbot.sesi'
                print(f"[SERVER] Spawning native Sesi AI compiler engine...")
                result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8')
                
                if result.returncode != 0:
                    print(f"[SERVER ERROR] Sesi compiler failed: {result.stderr}")
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Sesi compiler failed to execute", "details": result.stderr}).encode('utf-8'))
                    return
                
                # 3. Read the generated response.txt
                response_content = "Sorry, no response could be generated."
                if os.path.exists("response.txt"):
                    with open("response.txt", "r", encoding="utf-8") as f:
                        response_content = f.read()
                
                # 4. Respond to browser with the reasoning output!
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"response": response_content}).encode('utf-8'))
                print("[SERVER] Response successfully sent to visual console!")
                
            except Exception as e:
                print(f"[SERVER ERROR] Exception raised: {str(e)}")
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                
        else:
            # Fallback to serving static files (for chatbot.html dashboard!)
            super().do_GET()

# Ensure we run strictly on Port 8000
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), ChatbotHandler) as httpd:
    print(f"==================================================")
    print(f"[GATEWAY] Sesi AI Chatbot Local Gateway Active!")
    print(f"[URL] Serving console on: http://localhost:{PORT}/chatbot.html")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[SERVER] Gateway safely closed.")
        sys.exit(0)
